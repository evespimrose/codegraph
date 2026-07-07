#!/bin/bash
# output-arm-gate.sh: Stop 훅 — Output Arm 사후 결정론 게이트 (caveman 입국심사 Atom 3)
# ON인데 파일 변경이 있으면서 docs/output/ 적재가 없으면 경고. 절대 차단하지 않음(알림만).

STATE_FILE=".claude/state/output-arm"
STATE="on"
[ -f "$STATE_FILE" ] && STATE=$(tr -d '[:space:]' < "$STATE_FILE")

# OFF면 침묵 통과
if [ "$STATE" != "on" ]; then
  exit 0
fi

# 변경 파일 감지: git 우선, 비git이면 최근 mtime 폴백(git 부재 시 기존 침묵 무력화 방지)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CHANGED=$(git status --porcelain 2>/dev/null | grep -vE '\.claude/state/output-arm' || true)
else
  CHANGED=$(find . -type f -mmin -10 2>/dev/null | grep -vE '/\.git/|\.claude/state/output-arm' || true)
fi
[ -z "$CHANGED" ] && exit 0

# docs/output/ 적재가 이미 있으면 최신 파일의 SCHEMA.md 필수 필드 존재를 검증(차단 안 함 — 경고만)
if echo "$CHANGED" | grep -q 'docs/output/'; then
  LATEST=$(ls -t docs/output/*.md 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    MISSING=""
    for f in task date project blk links keywords compressed source_turns; do
      grep -q "^${f}:" "$LATEST" 2>/dev/null || MISSING="$MISSING $f"
    done
    if [ -n "$MISSING" ]; then
      echo "{\"systemMessage\": \"[output-arm] 최신 산출물 $LATEST 스키마 미준수 — 누락 필드:$MISSING (SCHEMA.md 참조)\"}"
    fi
  fi
  exit 0
fi

# 변경은 있는데 적재 없음 → 리마인더
echo '{"systemMessage": "[output-arm] ON · 파일 변경 감지 but docs/output/ 적재 없음 → must-see 산출물을 docs/output/YYYY-MM-DD-<task>.md (코드위치=BLK 태그, 참조=마크다운 링크)로 수집했는지 확인. 메인엔 링크+\"XX 완료\"만."}'
exit 0
