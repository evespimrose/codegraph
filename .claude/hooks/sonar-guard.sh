#!/bin/bash
# sonar-guard.sh: PreToolUse:Bash — Sonar Protocol 강제 이행
# HANDOVER-MANAGED
# bash 탐색·소스출력 명령(find, ls -r/la, grep -r, rg, fd, cat/head/tail .cs...) 감지 → 차단
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

# 탐색·소스출력 패턴 감지
VIOLATION=""

if echo "$COMMAND" | grep -qE '^\s*(find\s|find$)'; then
  VIOLATION="find"
elif echo "$COMMAND" | grep -qE 'ls\s+(-[a-zA-Z]*[rRlLaA][a-zA-Z]*\s|--[a-z]|\s+-r|\s+-la|\s+-al|\s+--all)'; then
  VIOLATION="ls -r/la"
elif echo "$COMMAND" | grep -qE 'ls\s+-'; then
  if echo "$COMMAND" | grep -qE 'ls\s+-[a-zA-Z]*[rR]'; then
    VIOLATION="ls -r"
  fi
elif echo "$COMMAND" | grep -qE '(grep\s+.*-r|grep\s+.*--recursive|grep\s+-[a-zA-Z]*r[a-zA-Z]*\s)'; then
  VIOLATION="grep -r"
elif echo "$COMMAND" | grep -qE '^\s*rg\s'; then
  VIOLATION="rg (ripgrep)"
elif echo "$COMMAND" | grep -qE '^\s*fd\s'; then
  VIOLATION="fd"
elif echo "$COMMAND" | grep -qE '(cat|head|tail|less|more|od|strings|nl|xxd)\s+.*\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)(\s|$)'; then
  VIOLATION="source output (cat/head/tail/...)"
fi

if [ -z "$VIOLATION" ]; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

echo "$(date +%s) ${CTX_LABEL} bash:${VIOLATION}" >> .claude/state/violation-count.log

# 서브에이전트: 하드 deny, 유도 없음
if [ -n "$AGENT_ID" ]; then
  python3 -c "
import json, sys
violation, ctx = sys.argv[1], sys.argv[2]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol: 서브에이전트 bash 탐색/소스출력 차단 ({violation}) [{ctx}]',
  'additionalContext': '⛔ SONAR GUARD: 서브에이전트는 탐색 우회 불가. codegraph_* 도구를 먼저 사용할 것.'}}))
" "$VIOLATION" "$CTX_LABEL"
  exit 0
fi

# 메인 + strict: 하드 deny, 유도 없음
if [ "${CG_GATE_MAIN_STRICT:-0}" = "1" ]; then
  python3 -c "
import json, sys
violation = sys.argv[1]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'Sonar Protocol (strict): bash 탐색/소스출력 차단 ({violation})',
  'additionalContext': 'STRICT 모드 — codegraph_* 선행 후 Read/Grep/Glob 사용.'}}))
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
msg = f'''⛔ SONAR GUARD: bash 탐색/소스출력 감지 ({violation}) [{ctx}]
{trail_block}
Sonar Protocol 위반 — bash로 파일을 탐색하거나 소스 코드를 직접 출력하지 말 것.
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
  'permissionDecisionReason': f'Sonar Protocol: bash 탐색/소스출력 감지 ({violation}) [{ctx}] — AskUserQuestion 4택 필요',
  'additionalContext': msg}}))
" "$VIOLATION" "$CTX_LABEL" "$TRAIL" "$TRAIL_N"
exit 0
