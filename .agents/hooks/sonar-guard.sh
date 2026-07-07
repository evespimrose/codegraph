#!/bin/bash
# sonar-guard.sh: PreToolUse:Bash — Sonar Protocol 강제 이행
# HANDOVER-MANAGED
# bash 탐색·소스출력 명령(find, ls -r/la, grep -r, rg, fd, cat/head/tail .cs...) 감지 → 차단/경고
# D1: 서브에이전트(agent_id 존재) → deny, 메인 → ask (CG_GATE_MAIN_STRICT=1 시 메인도 deny)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
if [ -n "$AGENT_ID" ]; then DECISION="deny"; else DECISION="ask"; fi
[ "${CG_GATE_MAIN_STRICT:-0}" = "1" ] && DECISION="deny"

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

if [ -n "$VIOLATION" ]; then
  echo "$(date +%s) ${CTX_LABEL} bash:${VIOLATION}" >> .claude/state/violation-count.log

  python3 -c "
import json, sys
violation = sys.argv[1]
decision  = sys.argv[2]
ctx       = sys.argv[3]
msg = f'''⛔ SONAR GUARD: bash 탐색/소스출력 감지 ({violation}) [{ctx}]

Sonar Protocol 위반 — bash로 파일을 탐색하거나 소스 코드를 직접 출력하지 말 것.

올바른 경로:
  1. manage/dictionary.md § 1 에서 BLK 코드로 파일 경로 조회
  2. Glob 도구 사용 (bash find 아님)
  3. Grep 도구 사용 (bash grep -r 아님)
  4. codegraph_* 도구로 구조 파악 후 Read 도구 사용

이 명령을 계속 실행하려면 이유를 명시하세요.'''
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': decision,
    'permissionDecisionReason': f'Sonar Protocol: bash 탐색/소스출력 감지 ({violation}) [{ctx}].',
    'additionalContext': msg
  }
}))
" "$VIOLATION" "$DECISION" "$CTX_LABEL"
  exit 0
fi

# 위반 없음 — 허용
python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'allow'
  }
}))
"
