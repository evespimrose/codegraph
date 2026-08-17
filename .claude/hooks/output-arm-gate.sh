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
    elif ! grep -qE '<!-- BLK: BLK-[0-9]+' "$LATEST" 2>/dev/null; then
      echo "{\"systemMessage\": \"[output-arm] $LATEST — BLK 형식(2번째 줄 <!-- BLK: BLK-XXX -->, 숫자)이 아니면 codegraph 회수 시 hits.blk가 null로 유실됨 (2026-08-15 M2 실측)\"}"
    fi
  fi
  exit 0
fi

# 변경은 있는데 적재 없음 → 리마인더.
#   단 Stop 은 매 턴 발화하므로 무조건 알리면 같은 문구가 세션 내내 메인 컨텍스트로 역류한다
#   (실측: 리마인더가 반복되면서도 적재율은 오르지 않음 = 순수 오염). 세션당 1회로 제한한다.
#   세션 식별자는 tool-history.log 의 첫 줄(session-start 가 매 세션 새로 씀)을 해시해 쓴다.
REMINDED_FILE=".claude/state/output-arm-reminded"
SESSION_KEY=$(head -1 .claude/state/tool-history.log 2>/dev/null | cksum | tr -d ' \t')
[ -z "$SESSION_KEY" ] && SESSION_KEY="no-session"
[ -f "$REMINDED_FILE" ] && [ "$(cat "$REMINDED_FILE" 2>/dev/null)" = "$SESSION_KEY" ] && exit 0
printf '%s' "$SESSION_KEY" > "$REMINDED_FILE" 2>/dev/null

echo '{"systemMessage": "[output-arm] 변경 있음 · docs/output/ 적재 없음 (세션 1회 알림)"}'
exit 0
