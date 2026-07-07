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

VIOLATION=""
if echo "$COMMAND" | grep -qE 'Get-ChildItem.*-Recurse|gci.*-Recurse|ls.*-Recurse|dir.*-Recurse|dir.*-s'; then
  VIOLATION="Get-ChildItem -Recurse (재귀 파일 탐색)"
elif echo "$COMMAND" | grep -qE 'Select-String.*-Path.*\*|sls.*-Path.*\*'; then
  VIOLATION="Select-String -Path 와일드카드 (재귀 grep)"
elif echo "$COMMAND" | grep -qE 'Get-ChildItem.*-Filter.*-Recurse|gci.*-Filter.*-Recurse'; then
  VIOLATION="Get-ChildItem -Filter -Recurse"
elif echo "$COMMAND" | grep -qE '(Get-Content|gc|type)\s+.*\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)(\s|$)'; then
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
  'additionalContext': '⛔ SONAR GUARD L1: 서브에이전트는 탐색 우회 불가. codegraph_* 도구를 먼저 사용할 것.'}}))
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
  'additionalContext': 'STRICT 모드 — codegraph_* 선행 후 Glob/Grep 도구 사용.'}}))
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
  2. codegraph 강제(회귀 및 재시도) — 이 시도를 취소하고 codegraph_context/codegraph_search로
     먼저 조사한 뒤 Glob/Grep/Read로 원 목표를 재시도한다.
  3. 거부(manual stop) — 여기서 작업을 중단하고 사용자에게 보고한다.
  4. 커스텀 답변 — 자유 응답으로 사용자가 직접 방향을 재지정한다.

사용자 응답 전까지 이 명령을 재시도하지 말 것.'''
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol L1: PowerShell 우회 감지 ({violation}) [{ctx}] — AskUserQuestion 4택 필요',
  'additionalContext': msg}}))
" "$VIOLATION" "$CTX_LABEL" "$TRAIL" "$TRAIL_N"
exit 0
