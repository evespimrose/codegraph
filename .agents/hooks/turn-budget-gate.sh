#!/bin/bash
# turn-budget-gate.sh: CRG2강제 — 세션 턴(도구 호출) 예산 게이트
#   - 턴 수 = 결정론적 프록시 (토큰 정밀 측정은 비결정·비용↑ → 미채택, 본 게이트 범위 밖)
#   - 카운트 원천: .claude/state/tool-history.log (session-start.sh가 세션 시작 시 초기화
#       → 라인 수 = 금세션 누적 턴. '#' 주석 라인 제외.)
#   - 설정: .claude/state/turn-budget
#       off            → 침묵 통과 (기본)
#       <N>            → N턴 초과 시 경고만 (차단 아님)
#       <N>:block      → N턴 초과 시 PreToolUse 차단(ask) (옵트인)
#   - 두 진입점에서 발화: PreToolUse(턴 누적 시점) + Stop(세션 종료 사후 요약)
#   - 패턴 차용: codegraph-gate.sh(ask) + output-arm-gate.sh(경고만/침묵통과)

INPUT=$(cat)
STATE_FILE=".claude/state/turn-budget"
HISTORY_FILE=".claude/state/tool-history.log"

# ── 설정 로드: off면 즉시 침묵 통과 ──
STATE="off"
[ -f "$STATE_FILE" ] && STATE=$(tr -d '[:space:]' < "$STATE_FILE")
if [ -z "$STATE" ] || [ "$STATE" = "off" ]; then
  exit 0
fi

# LIMIT 과 강제 모드(warn|block) 파싱:  "<N>" 또는 "<N>:block"
LIMIT="${STATE%%:*}"
MODE_FLAG="${STATE#*:}"
[ "$MODE_FLAG" = "$STATE" ] && MODE_FLAG="warn"   # ':' 없으면 warn
# LIMIT 이 양의 정수가 아니면 설정 오류 → 침묵 통과(안전)
case "$LIMIT" in
  ''|*[!0-9]*) exit 0 ;;
esac
[ "$LIMIT" -le 0 ] && exit 0

# ── C2-3: 금세션 턴 카운트 (tool-history.log, 주석/빈줄 제외) ──
#   grep -c 는 0매치 시 exit 1 → '|| echo 0' 와 결합하면 출력이 "0\n0"으로 깨짐.
#   따라서 매치 라인만 출력하고 wc -l 로 센 뒤 공백 제거(결정론적 정수 보장).
TURNS=0
if [ -f "$HISTORY_FILE" ]; then
  TURNS=$(grep -vE '^[[:space:]]*(#|$)' "$HISTORY_FILE" 2>/dev/null | wc -l | tr -d '[:space:]')
fi
# 방어적: 정수 아니면 0
case "$TURNS" in ''|*[!0-9]*) TURNS=0 ;; esac

# 이벤트 종류 식별 (PreToolUse vs Stop)
EVENT=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('hook_event_name',''))" 2>/dev/null || echo "")

# ── C2-4: Stop 사후 게이트 (경고만, exit 0 — output-arm-gate 패턴) ──
if [ "$EVENT" = "Stop" ]; then
  if [ "$TURNS" -gt "$LIMIT" ]; then
    python3 -c "import json; print(json.dumps({'systemMessage': '[turn-budget] 세션 종료 — 총 $TURNS 턴 (예산 $LIMIT 초과). 다음 세션은 작업을 더 작게 쪼개거나 서브에이전트 위임/플랜 분할을 고려하세요.'}))"
  fi
  exit 0
fi

# ── PreToolUse: 예산 미만이면 통과 ──
if [ "$TURNS" -lt "$LIMIT" ]; then
  exit 0
fi

# 예산 도달/초과
if [ "$MODE_FLAG" = "block" ]; then
  # 옵트인 차단 (codegraph-gate ask 패턴)
  python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'turn-budget: 세션 턴 $TURNS >= 예산 $LIMIT (block 모드)',
    'additionalContext': '⛔ TURN-BUDGET: 세션 도구 호출 $TURNS회로 예산($LIMIT)에 도달.\n\n계속하려면 승인하거나, 작업을 분할/위임하세요.\n경고만 원하면: .claude/state/turn-budget 를 \"$LIMIT\" (:block 제거)로, 해제는 \"off\".'
  }
}))
"
  exit 0
fi

# 기본: 경고만 (차단 아님) — systemMessage 1회
python3 -c "import json; print(json.dumps({'systemMessage': '[turn-budget] 세션 턴 $TURNS / 예산 $LIMIT 도달 (경고만). 작업 분할·서브에이전트 위임 고려. 차단 원하면 turn-budget 를 \"$LIMIT:block\" 으로.'}))"
exit 0
