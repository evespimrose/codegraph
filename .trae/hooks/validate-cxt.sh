#!/bin/bash
# validate-cxt.sh — cxt 파일의 BLK 태그 존재 여부 검증
# 인자: $1 = 검증할 cxt 파일 경로
# 종료 코드: 0 = OK, 1 = 오류

FILE="$1"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "ERROR: 파일이 없습니다: $FILE"
  exit 1
fi

# 2행 BLK 태그 검증
LINE2=$(sed -n '2p' "$FILE")

if echo "$LINE2" | grep -qE '<!--\s*BLK:.*-->'; then
  BLK=$(echo "$LINE2" | grep -oP 'BLK-\d+\w*' | head -1)
  echo "OK: BLK 태그 확인됨 → $LINE2"

  # 인프라 태그는 dictionary 확인 생략
  if [ -z "$BLK" ]; then
    echo "INFO: 인프라 작업 — dictionary § 1 확인 생략"
    exit 0
  fi

  # dictionary § 1에서 해당 BLK 존재 여부 확인
  DICT="manage/dictionary.md"
  if [ -f "$DICT" ]; then
    COUNT=$(grep -c "$BLK" "$DICT" 2>/dev/null || echo 0)
    if [ "$COUNT" -gt 0 ]; then
      echo "OK: dictionary에 $BLK 항목 존재 (${COUNT}행)"
    else
      echo "WARN: dictionary에 $BLK 항목 없음 → § 1 갱신 필요"
    fi
  else
    echo "WARN: manage/dictionary.md 없음 — dictionary 확인 생략"
  fi
  exit 0
else
  echo "ERROR: 2행 BLK 태그 누락"
  echo "  현재 2행: $LINE2"
  echo "  필수 형식: <!-- BLK: BLK-XXX -->"
  echo "  조치: context-sharer 재실행 후 BLK 태그 포함하여 저장"
  exit 1
fi
