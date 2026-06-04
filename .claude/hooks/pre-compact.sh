#!/bin/bash
# pre-compact.sh: /compact 실행 전 핵심 상태 보존
# HANDOVER-MANAGED
# 1. .riper-state + active_context.md → pre_compact_backup.md
# 2. /memory:save 실행 요청 (systemMessage로 Claude에 전달)
# 3. 현재 플랜 파일 경로 백업

echo "--- CCGS Pre-Compaction Hook Started ---"

MEMORY_BANK=".claude/memory-bank"
BACKUP_FILE="$MEMORY_BANK/pre_compact_backup.md"
RIPER_STATE="$MEMORY_BANK/.riper-state"

# 백업 파일 초기화
echo "# Pre-Compact Backup — $(date '+%Y-%m-%d %H:%M')" > "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

# 1. .riper-state 백업
if [ -f "$RIPER_STATE" ]; then
    echo "## RIPER State" >> "$BACKUP_FILE"
    echo '```' >> "$BACKUP_FILE"
    cat "$RIPER_STATE" >> "$BACKUP_FILE"
    echo '```' >> "$BACKUP_FILE"
    echo "" >> "$BACKUP_FILE"

    # 플랜 파일 경로 추출
    PLAN_FILE=$(grep "^PLAN_FILE=" "$RIPER_STATE" | cut -d'=' -f2)
    if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
        echo "## Current Plan: $PLAN_FILE" >> "$BACKUP_FILE"
        echo '```markdown' >> "$BACKUP_FILE"
        cat "$PLAN_FILE" >> "$BACKUP_FILE"
        echo '```' >> "$BACKUP_FILE"
        echo "" >> "$BACKUP_FILE"
    fi
fi

# 2. active_context.md 백업
if [ -f "$MEMORY_BANK/active_context.md" ]; then
    echo "## Active Context" >> "$BACKUP_FILE"
    cat "$MEMORY_BANK/active_context.md" >> "$BACKUP_FILE"
    echo "" >> "$BACKUP_FILE"
fi

echo "Pre-compact backup saved to: $BACKUP_FILE"

# 3. Claude에게 /memory:save 실행 요청 출력
python3 -c "
import json
msg = '''⚠️ PRE-COMPACT: /compact 실행 전 필수 단계

다음을 즉시 수행하세요:
  1. /memory:save 실행 — 현재 세션 핵심 내용을 claude-mem에 저장
  2. .riper-state 확인 — 현재 RIPER 모드 기억
  3. 이후 /compact 실행

백업 저장됨: .claude/memory-bank/pre_compact_backup.md
복원 방법: 컴팩션 후 /memory:recall 실행 후 session-start.sh 자동 주입 확인'''

print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'additionalContext': msg
  }
}))
"

echo "--- CCGS Pre-Compaction Hook Finished ---"
