#!/bin/bash
# violation-pattern-digest.sh: SessionStart 체인 말미 — 위반 로그 → 룰 후보 최소 파이프라인 (A1 축소판)
# violation-count.log 를 패턴(도구명·차단사유)별 집계 → 동일 패턴 임계값(기본 3)↑ 시 룰 후보 1줄을
#   rule-candidates.log(강화 후보) 또는 relaxation-candidates.log(완화 후보)에 append.
#   override-used 패턴은 "규칙이 과잉일 수 있다"는 반대 신호이므로 완화 후보로 분리 집계함.
# 자동 승격 없음 — /rule-review 스킬을 통해 사람이 승인/기각/보류(수동 게이트). 실체화는 /rule-review 몫.
# 근거: Instinct_기반_학습_파이프라인 "채택 시 최소 형태", 맥락_오염_방지 "프로젝트 경계를 통한 자동 격리"(강제 아님 참조).

set -uo pipefail

VIOLATION_LOG=".claude/state/violation-count.log"
CANDIDATE_LOG=".claude/state/rule-candidates.log"
RELAXATION_LOG=".claude/state/relaxation-candidates.log"
THRESHOLD="${RULE_CANDIDATE_THRESHOLD:-3}"

case "$THRESHOLD" in ''|*[!0-9]*) THRESHOLD=3 ;; esac
[ -f "$VIOLATION_LOG" ] || exit 0

# 패턴 = 타임스탬프(첫 필드) 제거한 나머지("<CTX> <tool>:<detail>"). override-used: 접두는 완화 후보로 분리.
SUMMARY=$(python3 - "$VIOLATION_LOG" "$CANDIDATE_LOG" "$RELAXATION_LOG" "$THRESHOLD" << 'PYEOF'
import sys, os, datetime

violation_log, candidate_log, relaxation_log, threshold = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])

reinforce_counts = {}
relax_counts = {}
try:
    with open(violation_log, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)  # 첫 공백에서 분리 → [epoch, 나머지]
            if len(parts) < 2:
                continue
            pattern = parts[1].strip()
            if not pattern:
                continue
            if "override-used:" in pattern:
                relax_counts[pattern] = relax_counts.get(pattern, 0) + 1
            else:
                reinforce_counts[pattern] = reinforce_counts.get(pattern, 0) + 1
except Exception:
    print("0 0")
    sys.exit(0)

# 패턴이 '|' 를 품을 수 있어(Grep 정규식 등) 첫 '|' 분리는 키를 잘라 dedup 을 뚫음.
# 메타 시작 토큰 ' | count=' 로만 잘라야 패턴 원문이 온전히 복원됨.
# 이 구분자는 rule-review/scripts/mark_status.py 의 META_SEP 과 한 쌍 — 함께 바꿀 것.
def existing_patterns(log_path):
    found = set()
    if os.path.isfile(log_path):
        try:
            with open(log_path, encoding="utf-8") as f:
                for line in f:
                    head = line.split(" | count=", 1)[0].strip()
                    if head:
                        found.add(head)
        except Exception:
            pass
    return found

def append_candidates(log_path, counts, today):
    existing = existing_patterns(log_path)
    new_lines = []
    for pattern, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        if n >= threshold and pattern not in existing:
            new_lines.append(f"{pattern} | count={n} | first_seen={today} | status=candidate")
    if new_lines:
        with open(log_path, "a", encoding="utf-8") as f:
            for ln in new_lines:
                f.write(ln + "\n")
    return len(new_lines)

today = datetime.date.today().isoformat()
added_reinforce = append_candidates(candidate_log, reinforce_counts, today)
added_relax = append_candidates(relaxation_log, relax_counts, today)

def pending_count(log_path):
    n = 0
    if os.path.isfile(log_path):
        try:
            with open(log_path, encoding="utf-8") as f:
                for line in f:
                    if "status=candidate" in line:
                        n += 1
        except Exception:
            pass
    return n

pending_reinforce = pending_count(candidate_log)
pending_relax = pending_count(relaxation_log)
print(f"{pending_reinforce} {pending_relax}")
PYEOF
)

PENDING_REINFORCE=$(echo "$SUMMARY" | awk '{print $1}')
PENDING_RELAX=$(echo "$SUMMARY" | awk '{print $2}')

# 대기 후보가 있을 때만 1줄 알림 (없으면 침묵 — 매 세션 노이즈 방지)
if [ "${PENDING_REINFORCE:-0}" -gt 0 ] || [ "${PENDING_RELAX:-0}" -gt 0 ]; then
  python3 -c "
import json, sys
r, x = sys.argv[1], sys.argv[2]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
  'additionalContext': f'[rule-candidates] 강화 후보 {r}건 · 완화 후보 {x}건 대기 — /rule-review 로 검토'}}))
" "$PENDING_REINFORCE" "$PENDING_RELAX"
fi

exit 0
