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

# HR5 CacheAligner: RULE-1~5 는 session-start.sh 의 CORE_RULES 와 byte-equal 로 유지할 것
#   (두 SessionStart 진입점이 동일 불변 prefix 를 산출 → KV 캐시 재사용).
#   RULE-6 만 진입점별로 다름: 최초 세션 = /memory:save, 컴팩션 후 = /memory:recall.
CORE_RULES = """
=== CORE_RULES (컴팩션 후 자동 복원) ===

RULE-1 [SONAR PROTOCOL - DEADLY · L1 Hook 강제]:
  ❌ 자동 차단: find/grep -r/ls -r/rg/fd · PowerShell -Recurse · 소스 코드 Read (codegraph 미사용 시)
  ✅ 순서: codegraph_context → codegraph_search → codegraph_node → (보완) Read/Grep
  위반 로그: .claude/state/violation-count.log

RULE-2 [RIPER STATE]: .claude/memory-bank/.riper-state
RULE-3 [GATE]: 플랜 파일 존재 = 중·대형 작업
RULE-4 [WRITE APPROVAL]: 소스 코드 수정 전 사용자 승인
RULE-5 [DOC-CONTEXT]: /doc-context 수신 시 즉시 작업 (재확인 금지)
RULE-6 [MEMORY]: 컴팩션 발생 — /memory:recall 즉시 실행하여 claude-mem 기억 복원
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
