#!/bin/bash
# tool-history-recorder.sh: PostToolUse — 도구 사용 이력 기록 (L1 검증용)
# HANDOVER-MANAGED
# 모든 도구 호출을 .claude/state/tool-history.log 에 append.
# 형식: <epoch> <TOOL_NAME> <AGENT_TYPE|MAIN> <outcome>
#   outcome ∈ {ok, failed, unknown} — tool_response 휴리스틱 판정(최선노력, 보장 아님):
#     - dict에 error/is_error 키 → failed
#     - 텍스트에 "no results/matches/files/context found" 류 패턴 → failed
#     - tool_response 없음/판정 불가 → unknown
#     - 그 외 → ok

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"

TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"

OUTCOME=$(echo "$INPUT" | python3 -c "
import json, sys, re
try:
    d = json.load(sys.stdin)
except Exception:
    print('unknown'); sys.exit(0)
resp = d.get('tool_response', None)
if resp is None:
    print('unknown'); sys.exit(0)
if isinstance(resp, dict) and (resp.get('error') or resp.get('is_error')):
    print('failed'); sys.exit(0)
try:
    text = resp if isinstance(resp, str) else json.dumps(resp, ensure_ascii=False)
except Exception:
    text = str(resp)
if re.search(r'(?i)no (results?|matches?|files?|sessions?|context)\s*(found)?\b|not found\b|0 found\b', text):
    print('failed'); sys.exit(0)
print('ok')
" 2>/dev/null || echo "unknown")

if [ -n "$TOOL_NAME" ]; then
  echo "$(date +%s) $TOOL_NAME ${CTX_LABEL} ${OUTCOME}" >> "$HISTORY_FILE"

  # 히스토리 파일 크기 제한 (직전 100개만 유지)
  TAIL_LINES=$(tail -n 100 "$HISTORY_FILE" 2>/dev/null)
  echo "$TAIL_LINES" > "$HISTORY_FILE"
fi

# PostToolUse는 응답 차단 안 함
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','permissionDecision':'allow'}}))"
