#!/bin/bash
# strategic-compact-reminder.sh: PostToolUse:Edit|Write — 제안형 컴팩션 트리거 (A7)
# tool-history.log 누적 라인 수가 임계값 도달 시 "수동 /compact 고려" 경고만 stderr 출력함(강제 아님, exit 0).
# 임계값: env STRATEGIC_COMPACT_THRESHOLD (기본 50). 스팸 방지 위해 임계 배수 넘을 때 1회만 발화함.
# 근거: ECC strategic-compact 훅 = 제안형(경고만). 참조: 컴팩션_생존_전략 "참조 사례 — 제안형 컴팩션 트리거".

set -uo pipefail

HISTORY_FILE=".claude/state/tool-history.log"
STATE_FILE=".claude/state/strategic-compact-last"
THRESHOLD="${STRATEGIC_COMPACT_THRESHOLD:-50}"

# 임계값이 양의 정수가 아니면 비활성(비차단 통과)
case "$THRESHOLD" in
  ''|*[!0-9]*) exit 0 ;;
esac
[ "$THRESHOLD" -le 0 ] && exit 0

# 카운터 = tool-history.log 현재 라인 수 (세션마다 초기화됨)
[ -f "$HISTORY_FILE" ] || exit 0
COUNT=$(wc -l < "$HISTORY_FILE" 2>/dev/null | tr -d '[:space:]')
case "$COUNT" in ''|*[!0-9]*) exit 0 ;; esac

# 직전 발화 카운트 로드 (없으면 0)
LAST=0
[ -f "$STATE_FILE" ] && LAST=$(tr -d '[:space:]' < "$STATE_FILE")
case "$LAST" in ''|*[!0-9]*) LAST=0 ;; esac

# 임계값 이상이고 직전 발화 이후 임계값만큼 더 쌓였을 때만 발화(50, 100, ... 지점)
if [ "$COUNT" -ge "$THRESHOLD" ] && [ "$((COUNT - LAST))" -ge "$THRESHOLD" ]; then
  echo "[strategic-compact-reminder] 도구 호출 ${COUNT}회 누적(임계 ${THRESHOLD}). 지금 수동 /compact 를 고려하세요 — 성능 저하 전 핵심 상태를 /memory:save 로 외부화 권장(제안일 뿐, 강제 아님)." >&2
  printf '%s' "$COUNT" > "$STATE_FILE"
fi

exit 0
