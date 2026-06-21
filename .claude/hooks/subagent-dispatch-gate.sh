#!/bin/bash
# subagent-dispatch-gate.sh: PreToolUse:Task — 서브에이전트 디스패치 경고 게이트
# HANDOVER-MANAGED
# 서브에이전트(Task) 디스패치 시 콜드스타트 토큰 세금 경고.
# D4: 기본 ask — 초대형/병렬 작업임을 사용자가 확인 후 진행.

python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': '서브에이전트 디스패치 경고 — 콜드스타트 토큰 세금 확인 필요',
    'additionalContext': '''⚠️ SUBAGENT DISPATCH GATE

서브에이전트(Task) 호출 = 콜드스타트 토큰 세금:
  • 소형 작업 시 메인 컨텍스트 대비 ~100배 토큰 소모
  • 기본 정책: 서브에이전트 금지 (메인이 도구로 직접 처리)

허용되는 예외 (사용자 발의 필수):
  • 초대형 규모 변경 — 메인 컨텍스트 오염이 더 비쌀 때
  • 병렬 독립 작업 — 상태 공유 없는 복수 작업 동시 실행

진행하려면: 예외 사유를 명시하여 승인하세요.'''
  }
}))
"
