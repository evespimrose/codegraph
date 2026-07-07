#!/bin/bash
# write-approval-reminder.sh: PreToolUse:Write|Edit — 소스 코드 파일 쓰기 전 승인 절차 리마인더
# HANDOVER-MANAGED
# .cs, .py, .ts, .js, .go, .rs, .cpp, .h, .java, .kt 등 감지 → Collaboration Protocol Step 5 리마인더

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path', d.get('tool_input',{}).get('path','')))" 2>/dev/null || echo "")

# 소스 코드 확장자 감지
IS_SOURCE=0

if echo "$FILE_PATH" | grep -qiE '\.(cs|py|ts|tsx|js|jsx|go|rs|cpp|cc|cxx|c|h|hpp|java|kt|swift|rb|php|lua|shader|hlsl|glsl|vert|frag|asmdef)$'; then
  IS_SOURCE=1
fi

if [ "$IS_SOURCE" -eq 1 ]; then
  python3 -c "
import json
msg = '''✍️ WRITE APPROVAL REMINDER

소스 코드 파일 쓰기 감지: $FILE_PATH

Collaboration Protocol Step 5 확인:
  → 파일 쓰기 전 사용자 승인 완료됐는가?
  → \"이를 [파일경로]에 작성해도 될까요?\" 질문을 했는가?

RIPER 모드 확인:
  → 현재 EXECUTE 모드인가? (PLAN/RESEARCH 모드에서 코드 쓰기 금지)
  → .claude/memory-bank/.riper-state 확인 권장

승인이 이미 완료된 경우 이 메시지는 무시해도 됩니다.'''

print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'allow',
    'additionalContext': msg
  }
}))
"
fi
