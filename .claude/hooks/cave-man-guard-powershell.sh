#!/bin/bash
# cave-man-guard-powershell.sh: PreToolUse:PowerShell — Cave-Man Protocol L1 우회 차단
# HANDOVER-MANAGED
# PowerShell 도구로 Bash 탐색을 우회하려는 시도 차단

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

VIOLATION=""
# PowerShell 재귀 탐색 명령 차단
if echo "$COMMAND" | grep -qE 'Get-ChildItem.*-Recurse|gci.*-Recurse|ls.*-Recurse|dir.*-Recurse|dir.*-s'; then
  VIOLATION="Get-ChildItem -Recurse (재귀 파일 탐색)"
elif echo "$COMMAND" | grep -qE 'Select-String.*-Path.*\*|sls.*-Path.*\*'; then
  VIOLATION="Select-String -Path 와일드카드 (재귀 grep)"
elif echo "$COMMAND" | grep -qE 'Get-ChildItem.*-Filter.*-Recurse|gci.*-Filter.*-Recurse'; then
  VIOLATION="Get-ChildItem -Filter -Recurse"
fi

if [ -n "$VIOLATION" ]; then
  echo "$(date +%s) PowerShell-Bypass $VIOLATION" >> .claude/state/violation-count.log

  python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'Cave-Man Protocol L1: PowerShell로 Bash 탐색 우회 시도 감지 ($VIOLATION)',
    'additionalContext': '⛔ CAVE-MAN GUARD L1: PowerShell 우회 차단\n\n감지: $VIOLATION\n\nBash와 동일한 규칙 적용:\n  1. codegraph_context / codegraph_search\n  2. codegraph_files (파일 구조)\n  3. Glob / Grep 도구 (단, codegraph 후)\n\nPowerShell은 시스템 작업(설치, 빌드, 권한)에만 사용 — 파일 탐색 금지'
  }
}))
"
  exit 0
fi

# 정상 — 통과
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
