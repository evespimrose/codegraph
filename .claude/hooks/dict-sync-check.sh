#!/bin/bash
# dict-sync-check.sh
# HANDOVER-MANAGED
# .cs 파일이 Write/Edit 도구로 수정될 때 dictionary.md 갱신 필요 여부를 알린다.
# Claude Code PostToolUse 훅 (Write|Edit 매처)

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if echo "$FILE_PATH" | grep -qE '\.cs$'; then
  BASENAME=$(basename "$FILE_PATH")
  echo "{\"systemMessage\": \"[dict-sync] ${BASENAME} 수정됨 → manage/dictionary.md § 1 갱신 여부 확인 (신규 파일이면 갱신 필수)\"}"
fi

exit 0
