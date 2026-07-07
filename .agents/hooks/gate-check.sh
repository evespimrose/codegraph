#!/bin/bash
# gate-check.sh: PostToolUse:Write|Edit — 결론/플랜 파일 저장 후 게이트 체크리스트 주입
# HANDOVER-MANAGED
# conclusion, 결론, plans/ 경로 파일 감지 → 게이트 절차 리마인더 출력

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path', d.get('tool_input',{}).get('path','')))" 2>/dev/null || echo "")

# 결론·플랜 파일 감지
IS_GATE_FILE=0

if echo "$FILE_PATH" | grep -qiE '(conclusion|결론|/plans/|_plan\.|plan_)'; then
  IS_GATE_FILE=1
fi

if [ "$IS_GATE_FILE" -eq 1 ]; then
  python3 -c "
import json
msg = '''📋 GATE CHECK REMINDER

플랜 또는 결론 파일이 저장되었습니다: $FILE_PATH

규모별 게이트 절차:

┌─────────────────────────────────────────────────────┐
│ 소형 (단일 함수·버그픽스, 플랜 파일 없음)           │
│   → quality-sentinel 선택 사항                       │
│   → reporter 기본 모드만 수행                        │
├─────────────────────────────────────────────────────┤
│ 중·대형 (플랜 파일 존재)                            │
│   → quality-sentinel 필수 (RIPER 감사 + 컨벤션)     │
│   → reporter 필수 (work.md 기록)                     │
│   → /memory:save 권장                               │
└─────────────────────────────────────────────────────┘

체크리스트:
  [ ] 플랜 파일이 .claude/memory-bank/{branch}/plans/ 에 저장됨
  [ ] .claude/memory-bank/.riper-state 업데이트됨
  [ ] quality-sentinel 호출 여부 결정됨
  [ ] reporter 호출 여부 결정됨'''

print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PostToolUse',
    'additionalContext': msg
  }
}))
"
fi
