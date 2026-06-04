#!/bin/bash
# dict-blk-announce.sh
# HANDOVER-MANAGED
# PostToolUse:Read hook — cxt 파일 로드 직후 BLK 태그 파싱 후 dictionary § 1 관련 파일 목록을 주입.
# Claude가 별도 grep 없이 즉시 대상 파일을 알 수 있도록 한다.

FILE_PATH=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

# cxt 숫자 패턴 파일만 처리 (cxt123.md, cxt128.md 등)
if ! echo "$FILE_PATH" | grep -qE 'cxt[0-9]+\.md$'; then
  exit 0
fi

# 파일 존재 확인
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# 2행 BLK 태그 추출
LINE2=$(sed -n '2p' "$FILE_PATH" 2>/dev/null)
if ! echo "$LINE2" | grep -qE '<!--\s*BLK:.*-->'; then
  # BLK 태그 없음 — 경고만 출력
  BASENAME=$(basename "$FILE_PATH")
  MSG="[doc-context] ${BASENAME}: 2행 BLK 태그 없음. manage/dictionary.md § 3 키워드 인덱스에서 BLK 추정 필요."
  echo "{\"systemMessage\": \"${MSG}\"}"
  exit 0
fi

# BLK 목록 추출
BLKS=$(echo "$LINE2" | grep -oP 'BLK-\d+\w*' | tr '\n' ' ')

# dictionary § 1에서 해당 BLK 파일 목록 grep
DICT="manage/dictionary.md"
if [ ! -f "$DICT" ]; then
  exit 0
fi

MATCHED_FILES=""
for BLK in $BLKS; do
  ROWS=$(grep -E "^\| \`.*\` \| ${BLK}" "$DICT" 2>/dev/null | awk -F'|' '{gsub(/[` ]/,"",$2); print $2}')
  if [ -n "$ROWS" ]; then
    MATCHED_FILES="${MATCHED_FILES}${ROWS}\n"
  fi
done

BASENAME=$(basename "$FILE_PATH")
if [ -n "$MATCHED_FILES" ]; then
  FILE_LIST=$(echo -e "$MATCHED_FILES" | sort -u | head -10 | tr '\n' ', ' | sed 's/, $//')
  MSG="[doc-context] ${BASENAME} → BLK: ${BLKS}| 관련 파일: ${FILE_LIST}"
else
  MSG="[doc-context] ${BASENAME} → BLK: ${BLKS}| dictionary § 1 매칭 없음 — 신규 BLK 가능성"
fi

echo "{\"systemMessage\": \"${MSG}\"}"
exit 0
