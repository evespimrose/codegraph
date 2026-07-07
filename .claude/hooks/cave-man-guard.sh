#!/bin/bash
# cave-man-guard.sh: PreToolUse:Bash — Cave-Man Protocol 강제 이행
# HANDOVER-MANAGED
# bash 탐색 명령(find, ls -r/la, grep -r, rg, fd) 감지 → systemMessage 경고 출력
#
# Claude Code hook output format:
#   {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask"|"allow"|"deny", "permissionDecisionReason": "...", "additionalContext": "..."}}
# permissionDecision "ask" → 사용자 확인 요청 (기본)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# 탐색 패턴 감지
VIOLATION=""

if echo "$COMMAND" | grep -qE '^\s*(find\s|find$)'; then
  VIOLATION="find"
elif echo "$COMMAND" | grep -qE 'ls\s+(-[a-zA-Z]*[rRlLaA][a-zA-Z]*\s|--[a-z]|\s+-r|\s+-la|\s+-al|\s+--all)'; then
  VIOLATION="ls -r/la"
elif echo "$COMMAND" | grep -qE 'ls\s+-'; then
  # ls with any flag that might be recursive
  if echo "$COMMAND" | grep -qE 'ls\s+-[a-zA-Z]*[rR]'; then
    VIOLATION="ls -r"
  fi
elif echo "$COMMAND" | grep -qE '(grep\s+.*-r|grep\s+.*--recursive|grep\s+-[a-zA-Z]*r[a-zA-Z]*\s)'; then
  VIOLATION="grep -r"
elif echo "$COMMAND" | grep -qE '^\s*rg\s'; then
  VIOLATION="rg (ripgrep)"
elif echo "$COMMAND" | grep -qE '^\s*fd\s'; then
  VIOLATION="fd"
fi

if [ -n "$VIOLATION" ]; then
  python3 -c "
import json
msg = '''⛔ CAVE-MAN GUARD: bash 탐색 감지 ($VIOLATION)

Cave-Man Protocol 위반 — bash로 파일을 탐색하지 말 것.

올바른 경로:
  1. manage/dictionary.md § 1 에서 BLK 코드로 파일 경로 조회
  2. Glob 도구 사용 (bash find 아님)
  3. Grep 도구 사용 (bash grep -r 아님)

예시:
  ❌ find Assets -name \"*.cs\"
  ✅ manage/dictionary.md § 1 → BLK-001 항목 확인
  ✅ Glob(\"Assets/**/*.cs\")

이 명령을 계속 실행하려면 아래 이유를 명시하세요.'''

print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'Cave-Man Protocol: bash 탐색 감지 (' + '$VIOLATION' + '). dictionary.md § 1 또는 Glob/Grep 도구를 사용하세요.',
    'additionalContext': msg
  }
}))
"
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
