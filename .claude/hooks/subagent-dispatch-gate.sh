#!/bin/bash
# subagent-dispatch-gate.sh: PreToolUse:Task — 서브에이전트 디스패치 3-모드 게이트
# HANDOVER-MANAGED
#
# 설정: .claude/state/subagent-dispatch  (토글: /subagent-dispatch auto|manual|off|status)
#   auto    → 침묵 허용 (exit 0, allow)
#   manual  → 디스패치 전 사용자 승인 요구 (permissionDecision: ask)  ← 기본값(파일 없거나 미인식)
#   off     → 디스패치 차단 (permissionDecision: deny) — 메인이 도구로 직접 처리
#
# 사유: 서브에이전트 콜드스타트 토큰 세금 — fresh prefix cache-miss 로 소형 작업 시 메인 대비 ~100배.
#       기본 manual = "사용자 발의 확인" 을 매 디스패치마다 강제(초대형/병렬 독립 작업만 승인 권장).
# 패턴 차용: turn-budget-gate.sh(상태파일 로드) · sonar-guard.sh(deny) · codegraph-gate.sh(ask).

STATE_FILE=".claude/state/subagent-dispatch"
MODE="manual"
[ -f "$STATE_FILE" ] && MODE=$(tr -d '[:space:]' < "$STATE_FILE")
case "$MODE" in auto|manual|off) ;; *) MODE="manual";; esac

# auto: 침묵 허용
[ "$MODE" = "auto" ] && exit 0

# off: 차단
if [ "$MODE" = "off" ]; then
  python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'deny',
    'permissionDecisionReason': '서브에이전트 디스패치 차단 (off 모드) — 메인이 도구로 직접 처리',
    'additionalContext': '''⛔ SUBAGENT DISPATCH = OFF

서브에이전트(Task) 디스패치가 차단됨 (콜드스타트 토큰 세금: 소형 작업 시 메인 대비 ~100배).
메인이 codegraph → Read/Edit 로 직접 처리하세요.
완화: /subagent-dispatch manual (승인형) 또는 /subagent-dispatch auto (상시 허용).'''
  }
}))
"
  exit 0
fi

# manual (기본): 승인 요구
python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': '서브에이전트 디스패치 승인 필요 (manual 모드) — 콜드스타트 토큰 세금 확인',
    'additionalContext': '''⚠️ SUBAGENT DISPATCH GATE (manual)

서브에이전트(Task) 호출 = 콜드스타트 토큰 세금 (소형 작업 시 메인 대비 ~100배).
승인 권장 케이스만:
  • 초대형 규모 변경 — 메인 컨텍스트 오염이 더 비쌀 때
  • 병렬 독립 작업 — 상태 공유 없는 복수 작업 동시 실행
그 외에는 메인이 codegraph→Read/Edit 직접 처리가 저렴합니다.
승인 시 체크: Task 프롬프트에 필요한 규칙 서브셋만 동봉했는가 (전역 규칙 뒤지기 금지 · 단일 원본 참조).

모드 변경: /subagent-dispatch auto(상시 허용) | off(차단). 현재=manual.'''
  }
}))
"
exit 0
