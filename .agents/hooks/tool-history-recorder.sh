#!/bin/bash
# tool-history-recorder.sh: PostToolUse — 도구 사용 이력 기록 (L1 검증용)
# HANDOVER-MANAGED
# 모든 도구 호출을 .claude/state/tool-history.log 에 append.
# 형식: <epoch> <TOOL_NAME> <AGENT_TYPE|MAIN>

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"

TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"

if [ -n "$TOOL_NAME" ]; then
  echo "$(date +%s) $TOOL_NAME ${CTX_LABEL}" >> "$HISTORY_FILE"

  # 히스토리 파일 크기 제한 (직전 100개만 유지)
  TAIL_LINES=$(tail -n 100 "$HISTORY_FILE" 2>/dev/null)
  echo "$TAIL_LINES" > "$HISTORY_FILE"
fi

# PostToolUse는 응답 차단 안 함
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','permissionDecision':'allow'}}))"
