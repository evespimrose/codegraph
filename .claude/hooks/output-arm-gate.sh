#!/bin/bash
# output-arm-gate.sh: Stop 훅 — Output Arm 사후 결정론 게이트 (caveman 입국심사 Atom 3)
# ON인데 파일 변경이 있으면서 docs/output/ 적재가 없으면 경고. 절대 차단하지 않음(알림만).

STATE_FILE=".claude/state/output-arm"
STATE="on"
[ -f "$STATE_FILE" ] && STATE=$(tr -d '[:space:]' < "$STATE_FILE")

# 묶인 작업이 REVIEW 인데 Review Pack(<slug>-review.md)이 없으면 세션당 1회 알림. output-arm 상태와 무관하게 본다.
#   세션당 1회 제한은 아래 REMINDED_FILE 과 같은 방식이고, 키만 따로 둔다(두 알림이 서로 가리지 않게 함).
# tool-history 헤더는 마지막에 시작한 세션 것이라 동시 세션에서 틀림. 훅 입력의 session_id 를 씀
SID8=$(cat | python3 -c "import json,sys; print((json.load(sys.stdin).get('session_id') or '')[:8])" 2>/dev/null)
BOUND=".claude/state/riper-session/$SID8"
if [ -n "$SID8" ] && [ -f "$BOUND" ]; then
  STATE_REL=$(head -1 "$BOUND" | tr -d '\r')
  if [ -f "$STATE_REL" ]; then
    MODE_NOW=$(sed -n 's/^MODE=//p' "$STATE_REL" | tr -d '\r')
    PLAN_REL=$(sed -n 's/^PLAN_FILE=//p' "$STATE_REL" | tr -d '\r')
    SLUG=$(basename "$STATE_REL" .state)
    PACK_REL="$(dirname "$PLAN_REL")/$SLUG-review.md"
    PACK_REMINDED=".claude/state/review-pack-reminded"
    if [ "$MODE_NOW" = "REVIEW" ] && [ ! -f "$PACK_REL" ] && [ "$(cat "$PACK_REMINDED" 2>/dev/null)" != "$SID8" ]; then
      printf '%s' "$SID8" > "$PACK_REMINDED" 2>/dev/null
      echo "{\"systemMessage\": \"[review-pack] 묶인 작업 $SLUG 은 REVIEW 인데 Review Pack 이 없음 (세션 1회 알림). python .claude/skills/review-pack/scripts/pack.py build $SLUG\"}"
      # Stop 훅 stdout 은 JSON 하나여야 파싱됨. 아래 output-arm 알림은 다음 Stop 에서 냄
      exit 0
    fi
  fi
fi

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
    for f in task date project links keywords compressed source_turns; do
      grep -q "^${f}:" "$LATEST" 2>/dev/null || MISSING="$MISSING $f"
    done
    if [ -n "$MISSING" ]; then
      echo "{\"systemMessage\": \"[output-arm] 최신 산출물 $LATEST 스키마 미준수 — 누락 필드:$MISSING (SCHEMA.md 참조)\"}"
    fi
  fi
  exit 0
fi

# 변경은 있는데 적재 없음 → 리마인더.
#   단 Stop 은 매 턴 발화하므로 무조건 알리면 같은 문구가 세션 내내 메인 컨텍스트로 역류한다
#   (실측: 리마인더가 반복되면서도 적재율은 오르지 않음 = 순수 오염). 세션당 1회로 제한한다.
#   6.4 수정(2026-09-23): 이전에는 tool-history.log 첫 줄을 통째로 해시했다. 그 줄이 Windows
#   대화형 date 출력이라 같은 날 모든 세션이 같은 키를 받았고(H1), "세션당 1회"가 실제로는
#   "하루 1회"로 동작해 알림이 사실상 죽어 있었다. 이제 헤더의 session= 토큰을 직접 쓴다.
REMINDED_FILE=".claude/state/output-arm-reminded"
SESSION_KEY=$(head -1 .claude/state/tool-history.log 2>/dev/null | sed -n 's/.*session=\([A-Za-z0-9]*\).*/\1/p')
# 구버전 헤더 폴백 — session= 토큰이 없으면 예전처럼 첫 줄 해시로 내려간다
[ -z "$SESSION_KEY" ] && SESSION_KEY=$(head -1 .claude/state/tool-history.log 2>/dev/null | cksum | tr -d ' \t')
[ -z "$SESSION_KEY" ] && SESSION_KEY="no-session"
[ -f "$REMINDED_FILE" ] && [ "$(cat "$REMINDED_FILE" 2>/dev/null)" = "$SESSION_KEY" ] && exit 0
printf '%s' "$SESSION_KEY" > "$REMINDED_FILE" 2>/dev/null

echo '{"systemMessage": "[output-arm] 변경 있음 · docs/output/ 적재 없음 (세션 1회 알림)"}'
exit 0
