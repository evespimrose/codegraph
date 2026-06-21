#!/bin/bash
# session-start.sh: 세션 시작 시 핵심 컨텍스트 자동 주입
# HANDOVER-MANAGED

python3 - << 'PYEOF'
import json, os, glob, re

# ── HR5 CacheAligner: 불변 PREFIX 우선, 가변 SUFFIX 후순위 ──
# KV 캐시 히트율을 위해 prefix 선두는 매 세션 byte-equal이어야 한다.
# [INVARIANT BLOCK] = 매 세션 동일(header → CORE_RULES → CLAUDE.md).
#   이 구역에 .riper-state·cxt·위반이력 등 가변 내용을 끼워넣지 말 것(캐시 churn).
# [VARIABLE BLOCK]  = 세션마다 달라짐(.riper-state → plan → cxt → 위반이력). 항상 INVARIANT 뒤.
parts = ["[SESSION-START] 세션 시작 컨텍스트 자동 주입\n"]

# ===== [INVARIANT BLOCK] 시작 — 캐시 prefix (편집 시 모든 세션에 동일 적용될 것만) =====
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
RULE-6 [MEMORY]: /compact 전 /memory:save
"""
parts.append(CORE_RULES)

if os.path.isfile("CLAUDE.md"):
    with open("CLAUDE.md", encoding="utf-8") as f:
        parts.append(f"\n=== CLAUDE.md ===\n{f.read()}")
# ===== [INVARIANT BLOCK] 끝 — 이 위까지가 캐시 prefix. 아래부터 [VARIABLE BLOCK]. =====

riper_mode = "NONE"
riper_state_path = ".claude/memory-bank/.riper-state"
if os.path.isfile(riper_state_path):
    with open(riper_state_path, encoding="utf-8") as f:
        state_content = f.read()
    parts.append(f"\n=== .riper-state ===\n{state_content}")
    mode_match = re.search(r"^MODE=(.+)$", state_content, re.MULTILINE)
    if mode_match:
        riper_mode = mode_match.group(1).strip() or "NONE"
    plan_match = re.search(r"^PLAN_FILE=(.+)$", state_content, re.MULTILINE)
    if plan_match:
        plan_file = plan_match.group(1).strip()
        if plan_file and os.path.isfile(plan_file):
            with open(plan_file, encoding="utf-8") as f:
                parts.append(f"\n=== 현재 플랜: {plan_file} ===\n{f.read()}")

# cxt 주입 (토큰 절감): 최근순(mtime) + HEAD 캡 + MODE 조건
#  - 활성(MODE != NONE): 최근 cxt 2개, 각 HEAD 60줄
#  - 유휴(MODE == NONE): 최근 cxt 1개, HEAD 25줄 (가벼운 힌트만)
# 전문은 /doc-context 로 필요 시 로드 → 대형 cxt 전문 매 세션 주입 방지
HEAD_LINES = 60 if riper_mode != "NONE" else 25
MAX_CXT = 2 if riper_mode != "NONE" else 1

cxt_candidates = glob.glob("docs/contextmd/cxt*.md") + glob.glob("cxt/*.md")
# HR5 안정 정렬: mtime 1차(최신 우선 — UX 유지) + 파일명 2차(동률/근접변경 churn 완화).
#   mtime을 정수 초로 양자화해 sub-second touch 흔들림을 흡수, 동일 초면 파일명으로 결정론 고정.
#   → 내용 무변경 touch만으로 prefix 순서가 뒤집히는 churn을 줄여 KV 캐시 재사용↑.
def _cxt_sort_key(p):
    return (-int(os.path.getmtime(p)), p)
cxt_candidates = sorted(set(cxt_candidates), key=_cxt_sort_key)
cxt_files = cxt_candidates[:MAX_CXT]

for cxt in cxt_files:
    try:
        with open(cxt, encoding="utf-8") as f:
            lines = f.readlines()
        head = "".join(lines[:HEAD_LINES])
        tail = ""
        if len(lines) > HEAD_LINES:
            tail = f"\n... (전문 {len(lines)}줄 중 {HEAD_LINES}줄만 표시 — 필요 시 /doc-context {cxt} 로 로드)\n"
        parts.append(f"\n=== {cxt} (최신 컨텍스트, HEAD {HEAD_LINES}) ===\n{head}{tail}")
    except Exception:
        pass

# L3 SessionStart 검증: 위반 통계 확인 + 도구 사용 이력 초기화
violation_log = ".claude/state/violation-count.log"
if os.path.isfile(violation_log):
    try:
        with open(violation_log, encoding="utf-8") as f:
            violations = f.readlines()
        if violations:
            recent_violations = violations[-10:]  # 최근 10개
            parts.append("\n=== ⚠️ SONAR PROTOCOL 누적 위반 이력 ===")
            parts.append(f"총 위반: {len(violations)}회 (최근 10개 표시)")
            for v in recent_violations:
                parts.append(f"  - {v.strip()}")
            parts.append("\n→ 새 세션에서는 codegraph_* 도구 우선 사용 강제됨")
    except Exception:
        pass

# 도구 사용 이력 초기화 (세션마다 새로 시작)
history_file = ".claude/state/tool-history.log"
try:
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    with open(history_file, "w", encoding="utf-8") as f:
        f.write(f"# Session started {os.popen('date').read().strip()}\n")
except Exception:
    pass

context = "\n".join(parts)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
PYEOF
