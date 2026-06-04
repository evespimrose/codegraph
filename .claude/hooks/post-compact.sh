#!/bin/bash
# post-compact.sh: 컨텍스트 압축 후 핵심 정보 재주입
# HANDOVER-MANAGED
# 1. CORE_RULES 재주입 (하드코딩)
# 2. pre_compact_backup.md에서 RIPER 상태 복원
# 3. /memory:recall 실행 지시
# 4. 최신 플랜 파일 복원

echo "--- CCGS Post-Compaction Hook Started ---"

MEMORY_BANK=".claude/memory-bank"
BACKUP_FILE="$MEMORY_BANK/pre_compact_backup.md"
RIPER_STATE="$MEMORY_BANK/.riper-state"

# 백업에서 RIPER 상태 복원 (파일이 존재하면)
RIPER_SECTION=""
if [ -f "$BACKUP_FILE" ]; then
    RIPER_SECTION=$(cat "$BACKUP_FILE")
fi

python3 - << PYEOF
import json, os

CORE_RULES = """
=== CORE_RULES (컴팩션 후 재주입됨) ===

RULE-1 [CAVE-MAN PROTOCOL - DEADLY]:
  bash find/grep -r/ls -r/rg/fd 로 파일 탐색 금지.
  manage/dictionary.md § 1 조회 또는 Glob/Grep 도구 사용.

RULE-2 [RIPER STATE]:
  현재 RIPER 모드: .claude/memory-bank/.riper-state 파일 확인.

RULE-3 [GATE]:
  플랜 파일 존재 → quality-sentinel + reporter 필수.
  플랜 파일 없음 → 소형 작업, 선택적.

RULE-4 [WRITE APPROVAL]:
  소스 코드 쓰기 전 사용자 승인 필수. Collaboration Protocol Step 5.

RULE-5 [DOC-CONTEXT]:
  /doc-context 수신 시 재확인 금지. 즉시 착수.

RULE-6 [MEMORY]:
  컴팩션 발생했음. /memory:recall 즉시 실행하여 claude-mem 기억 복원.
"""

backup_content = ""
backup_path = ".claude/memory-bank/pre_compact_backup.md"
if os.path.isfile(backup_path):
    with open(backup_path, encoding="utf-8") as f:
        backup_content = f.read()

riper_state = ""
riper_state_path = ".claude/memory-bank/.riper-state"
if os.path.isfile(riper_state_path):
    with open(riper_state_path, encoding="utf-8") as f:
        riper_state = f.read()

context = CORE_RULES

if riper_state:
    context += f"\n=== 복원된 RIPER State ===\n{riper_state}\n"

if backup_content:
    context += f"\n=== Pre-Compact 백업 내용 ===\n{backup_content}\n"

context += """
=== 즉시 수행 필요 ===
1. /memory:recall 실행 — claude-mem에 저장된 세션 기억 복원
2. 위 RIPER State 확인 — 현재 작업 모드 파악
3. 현재 플랜 파일 로드 (PLAN_FILE 경로 참조)
"""

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
PYEOF

echo "--- CCGS Post-Compaction Hook Finished ---"
echo "Suggestion: Run /memory:recall to restore claude-mem long-term memory."
