#!/bin/bash
# sonar-guard-powershell.sh: PreToolUse:PowerShell — Sonar Protocol L1 우회 차단
# HANDOVER-MANAGED
# PowerShell 도구로 Bash 탐색을 우회하려는 시도 차단
# D1: 서브에이전트(agent_id 존재) → 하드 deny(AskUserQuestion 유도 없음)
#     메인 → deny + AskUserQuestion 4택 유도(허용/codegraph 강제/거부/커스텀)
#     (CG_GATE_MAIN_STRICT=1 시 메인도 하드 deny — 유도 없음)
# 일회성 우회: .claude/state/sonar-override 에 비어있지 않은 내용이 있으면
#   1회 소모(삭제) 후 allow — 메인 + non-strict 경로에서만 적용.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
OVERRIDE_FILE=".claude/state/sonar-override"
HISTORY_FILE=".claude/state/tool-history.log"
TRAIL_N=5

# 최근 도구 이력에서 "경위"(성공/실패) 트레일 구성 — 최선노력, tool-history.log outcome 필드 기반
build_trail() {
  local hf="$1" n="${2:-5}"
  [ -f "$hf" ] || return
  python3 -c "
import sys
n = int(sys.argv[2])
try:
    with open(sys.argv[1], encoding='utf-8') as f:
        lines = f.readlines()[-n:]
except Exception:
    lines = []
label = {'ok':'성공', 'failed':'실패', 'unknown':'불명'}
out = []
for ln in lines:
    parts = ln.strip().split()
    if len(parts) >= 4:
        tool, outcome = parts[1], parts[3]
        out.append(f'  {tool}: {label.get(outcome, outcome)}')
    elif len(parts) == 3:
        out.append(f'  {parts[1]}: 불명(구버전 로그)')
print('\n'.join(out))
" "$hf" "$n"
}

# 2026-09-11 패턴 협소화. 이전 패턴들은 두 가지 결함이 있었다.
#  (1) 단어 경계 미확인 — 'dir.*-s' 는 mkdir 처럼 dir 을 품은 단어만 있어도 뒤쪽 아무 -s 플래그와
#      결합해 매칭됐다. 'gc'·'type'·'ls'·'sls' 도 같다(logcat·prototype·pulls·tools).
#      bash 쪽 sonar-guard 의 grep -r · ls 버그와 정확히 같은 종류다.
#  (2) '.*' 가 파이프·세미콜론을 넘어 무관한 후속 명령의 플래그를 끌어왔다.
# 해결: 명령 위치 앵커 + 명령명 뒤 공백 강제 + [^|;&]* 로 파이프 비월경 + 플래그를 온전한 토큰으로.
# PowerShell 은 대소문자를 안 가리므로 -i 를 쓴다.
CMDPOS='(^|[|;&{([:space:]])'
VIOLATION=""
if echo "$COMMAND" | grep -qiE "${CMDPOS}(Get-ChildItem|gci|ls|dir)[[:space:]][^|;&]*-Recurse([[:space:]]|$)"; then
  VIOLATION="Get-ChildItem -Recurse (재귀 파일 탐색)"
elif echo "$COMMAND" | grep -qiE "${CMDPOS}dir[[:space:]][^|;&]*[-/]s([[:space:]]|$)"; then
  VIOLATION="dir /s (재귀 파일 탐색)"
elif echo "$COMMAND" | grep -qiE "${CMDPOS}(Select-String|sls)[[:space:]][^|;&]*-Path[^|;&]*\*"; then
  VIOLATION="Select-String -Path 와일드카드 (재귀 grep)"
elif echo "$COMMAND" | grep -qiE "${CMDPOS}(Get-Content|gc|type)[[:space:]][^|;&]*\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)([[:space:]]|$)"; then
  VIOLATION="Get-Content 소스 출력 우회"
fi

if [ -z "$VIOLATION" ]; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

echo "$(date +%s) ${CTX_LABEL} ps:${VIOLATION}" >> .claude/state/violation-count.log

# 서브에이전트: 하드 deny, 유도 없음
if [ -n "$AGENT_ID" ]; then
  python3 -c "
import json, sys
violation, ctx = sys.argv[1], sys.argv[2]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol L1: 서브에이전트 PowerShell 우회 차단 ({violation}) [{ctx}]',
  'additionalContext': '⛔ SONAR GUARD L1: 서브에이전트는 탐색 우회 불가. `codegraph` CLI(Bash, MCP 아님)를 먼저 사용할 것.'}}))
" "$VIOLATION" "$CTX_LABEL"
  exit 0
fi

# 메인 + strict: 하드 deny, 유도 없음
if [ "${CG_GATE_MAIN_STRICT:-0}" = "1" ]; then
  python3 -c "
import json, sys
violation = sys.argv[1]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol L1 (strict): PowerShell 우회 차단 ({violation})',
  'additionalContext': 'STRICT 모드 — `codegraph` CLI(Bash, MCP 아님) 선행 후 Glob/Grep 도구 사용.'}}))
" "$VIOLATION"
  exit 0
fi

# 메인 + 일회성 우회 토큰 존재: 1회 소모 후 allow
if [ -s "$OVERRIDE_FILE" ]; then
  REASON=$(cat "$OVERRIDE_FILE")
  rm -f "$OVERRIDE_FILE"
  echo "$(date +%s) ${CTX_LABEL} override-used:${VIOLATION}:${REASON}" >> .claude/state/violation-count.log
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 메인 + 우회 토큰 없음: deny + AskUserQuestion 4택 유도
TRAIL=$(build_trail "$HISTORY_FILE" "$TRAIL_N")
python3 -c "
import json, sys
violation, ctx, trail, n = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
trail_block = f'\n최근 시도 경위 (직전 {n}개 도구):\n{trail}\n' if trail else ''
msg = f'''⛔ SONAR GUARD L1: PowerShell 우회 차단 감지 ({violation}) [{ctx}]
{trail_block}
Bash와 동일한 규칙 적용 — PowerShell은 시스템 작업(설치, 빌드, 권한)에만 사용, 파일 탐색/소스 출력 금지.
이 명령을 그대로 재시도하지 말고, 지금 AskUserQuestion 도구를 호출하여 사용자에게 정확히 다음 4개 선택지를 제시하라:

  1. 허용 — 원래 명령을 그대로 승인하고 진행. 승인 시 먼저
     printf '%s' \"사용자 승인: <사유>\" > .claude/state/sonar-override
     로 1회성 우회 토큰을 기록한 뒤 원래 명령을 재시도한다.
  2. codegraph 강제(회귀 및 재시도) — 이 시도를 취소하고 `codegraph context "<intent>" -p <root>`
     또는 `codegraph query "<symbol>" -p <root>`(Bash로 직접 호출, MCP 아님)로 먼저 조사한 뒤
     Glob/Grep/Read로 원 목표를 재시도한다.
  3. 거부(manual stop) — 여기서 작업을 중단하고 사용자에게 보고한다.
  4. 커스텀 답변 — 자유 응답으로 사용자가 직접 방향을 재지정한다.

사용자 응답 전까지 이 명령을 재시도하지 말 것.'''
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol L1: PowerShell 우회 감지 ({violation}) [{ctx}] — AskUserQuestion 4택 필요',
  'additionalContext': msg}}))
" "$VIOLATION" "$CTX_LABEL" "$TRAIL" "$TRAIL_N"
exit 0
