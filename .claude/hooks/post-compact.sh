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
RIPER_STATE=$(ls -t "$MEMORY_BANK"/*/riper/*.state 2>/dev/null | head -1)

# 백업에서 RIPER 상태 복원 (파일이 존재하면)
RIPER_SECTION=""
if [ -f "$BACKUP_FILE" ]; then
    RIPER_SECTION=$(cat "$BACKUP_FILE")
fi

python3 - << PYEOF
import json, os

# HR5 CacheAligner: CORE_RULES 는 session-start.sh 의 것과 byte-equal 로 유지할 것
#   (두 SessionStart 진입점이 동일 불변 prefix 를 산출 → KV 캐시 재사용).
CORE_RULES = """
=== CORE_RULES (컴팩션 후 자동 복원 · CLAUDE.md RULE 번호와 같음) ===

RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
RULE-2 [RIPER]: 상태는 .claude/memory-bank/<branch>/riper/<slug>.state 파일 하나. 여러 세션이 돌려 쓰며, 동시에 도는 카드는 CURRENT 의 자기 칸만 고침.
RULE-3 [GATE]: 플랜 파일이 있으면 중·대형 작업. 플랜과 수락 기준 승인(G1), Review Pack 확인(G2)은 사람 몫.
RULE-4 [WRITE]: 소스 코드를 고치기 전 사용자 승인. 승인된 플랜의 범위 파일만 고침.
RULE-5 [DOC-CONTEXT]: /doc-context 호출 때만 cxt 본문을 읽고 즉시 작업. 재확인 금지.
RULE-6 [MEMORY]: /compact 전 /memory:save. 컴팩션 후에는 /memory:recall.
"""

backup_content = ""
backup_path = ".claude/memory-bank/pre_compact_backup.md"
if os.path.isfile(backup_path):
    with open(backup_path, encoding="utf-8") as f:
        backup_content = f.read()

riper_state = ""
import glob
_cands = sorted(glob.glob(".claude/memory-bank/*/riper/*.state"), key=os.path.getmtime, reverse=True)
riper_state_path = _cands[0] if _cands else ""
if riper_state_path and os.path.isfile(riper_state_path):
    with open(riper_state_path, encoding="utf-8") as f:
        riper_state = f.read()

context = CORE_RULES

if riper_state:
    context += f"\n=== 복원된 RIPER State ({riper_state_path}) ===\n{riper_state}\n"

if backup_content:
    context += f"\n=== Pre-Compact 백업 내용 ===\n{backup_content}\n"

context += """
=== 즉시 수행 필요 ===
1. /memory:recall 실행 — 로컬 memory-bank + auto-memory(MEMORY.md) 세션 기억 복원
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
echo "Suggestion: Run /memory:recall to restore local memory-bank + auto-memory."
