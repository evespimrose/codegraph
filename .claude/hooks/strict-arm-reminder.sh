#!/bin/bash
# strict-arm-reminder.sh: PreToolUse (매처 없음, 전 도구 호출) — Strict Arm 주기 리마인더
# output-arm/subagent-dispatch/codegraph-first는 텍스트 컨벤션(SKILL.md)에 크게 의존하는데,
#   sonnet 계열은 세션이 길어지면 이 텍스트 규칙을 쉽게 놓친다(attention drop) — opus 대비 이탈 빈도가 높음.
# 완화책: tool-history.log 누적 호출 수 기준 N회(기본10)마다 5개 조항 요약을 강제 재주입(L3/L5식 매 턴 reminder).
# OFF면 침묵 통과(exit 0, 오버헤드 0). 차단 없음 — 항상 allow, additionalContext만 주입.
# 토글: .claude/state/strict-arm (on/off, 기본 on) — /strict-arm 커맨드.

set -uo pipefail

STATE_FILE=".claude/state/strict-arm"
STATE="on"
[ -f "$STATE_FILE" ] && STATE=$(tr -d '[:space:]' < "$STATE_FILE")

if [ "$STATE" != "on" ]; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

HISTORY_FILE=".claude/state/tool-history.log"
INTERVAL="${STRICT_ARM_REMINDER_INTERVAL:-10}"
case "$INTERVAL" in ''|*[!0-9]*) INTERVAL=10 ;; esac
[ "$INTERVAL" -le 0 ] && INTERVAL=10

COUNT=0
[ -f "$HISTORY_FILE" ] && COUNT=$(wc -l < "$HISTORY_FILE" 2>/dev/null | tr -d '[:space:]')
case "$COUNT" in ''|*[!0-9]*) COUNT=0 ;; esac

# 호출 수가 INTERVAL의 배수일 때만 리마인더 주입(그 외엔 침묵 allow — 매 호출 주입은 자기모순적 토큰 낭비)
if [ "$COUNT" -gt 0 ] && [ "$((COUNT % INTERVAL))" -eq 0 ]; then
  python3 -c "
import json
msg = ('[strict-arm] 메인 컨텍스트 타이핑 극최소화 · 서브에이전트 디스패치 금지 · '
       'codegraph 도구 우선 · 완료 시 \'XX 완료\'만 · Auto-Clarity 예외(보안/비가역/모호/반복질문/블로커)만 정상출력.')
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'allow',
  'additionalContext': msg}}))
"
else
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
fi

exit 0
