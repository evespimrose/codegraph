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

# 변경 파일 (git 미초기화/오류는 무시). 상태파일 자체 변경은 제외.
CHANGED=$(git status --porcelain 2>/dev/null | grep -vE '\.claude/state/output-arm' || true)
[ -z "$CHANGED" ] && exit 0

# docs/output/ 적재가 이미 있으면 통과
if echo "$CHANGED" | grep -q 'docs/output/'; then
  exit 0
fi

# 변경은 있는데 적재 없음 → 리마인더
echo '{"systemMessage": "[output-arm] ON · 파일 변경 감지 but docs/output/ 적재 없음 → must-see 산출물을 docs/output/YYYY-MM-DD-<task>.md (코드위치=BLK 태그, 참조=마크다운 링크)로 수집했는지 확인. 메인엔 링크+\"XX 완료\"만."}'
exit 0
