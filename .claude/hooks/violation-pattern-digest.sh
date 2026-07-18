#!/bin/bash
# violation-pattern-digest.sh: SessionStart 체인 말미 — 위반 로그 → 룰 후보 최소 파이프라인 (A1 축소판)
# violation-count.log 를 패턴(도구명·차단사유)별 집계 → 동일 패턴 임계값(기본 3)↑ 시 룰 후보 1줄을
#   rule-candidates.log 에 append. 자동 승격 없음 — 사람이 보고 KIT rules 반영 여부 결정(수동 게이트).
# 근거: Instinct_기반_학습_파이프라인 "채택 시 최소 형태"(violation → 주기 리뷰 → 룰 후보 승격, 자동 승격 없음).

set -uo pipefail

VIOLATION_LOG=".claude/state/violation-count.log"
CANDIDATE_LOG=".claude/state/rule-candidates.log"
THRESHOLD="${RULE_CANDIDATE_THRESHOLD:-3}"

case "$THRESHOLD" in ''|*[!0-9]*) THRESHOLD=3 ;; esac
[ -f "$VIOLATION_LOG" ] || exit 0

# 패턴 = 타임스탬프(첫 필드) 제거한 나머지("<CTX> <tool>:<detail>"). 빈도 집계 후 임계 이상만 후보화.
python3 - "$VIOLATION_LOG" "$CANDIDATE_LOG" "$THRESHOLD" << 'PYEOF'
import sys, os, datetime

violation_log, candidate_log, threshold = sys.argv[1], sys.argv[2], int(sys.argv[3])

counts = {}
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
            if pattern:
                counts[pattern] = counts.get(pattern, 0) + 1
except Exception:
    sys.exit(0)

# 이미 후보로 기록된 패턴은 중복 append 안 함(세션마다 재발화해도 누적 폭주 방지)
existing = set()
if os.path.isfile(candidate_log):
    try:
        with open(candidate_log, encoding="utf-8") as f:
            for line in f:
                if "|" in line:
                    existing.add(line.split("|", 1)[0].strip())
    except Exception:
        pass

today = datetime.date.today().isoformat()
new_lines = []
for pattern, n in sorted(counts.items(), key=lambda kv: -kv[1]):
    if n >= threshold and pattern not in existing:
        new_lines.append(f"{pattern} | count={n} | first_seen={today} | status=candidate")

if new_lines:
    with open(candidate_log, "a", encoding="utf-8") as f:
        for ln in new_lines:
            f.write(ln + "\n")
PYEOF

exit 0
