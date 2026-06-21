#!/bin/bash
# session-start.sh: 세션 시작 시 핵심 컨텍스트 자동 주입
# - CORE_RULES (하드코딩 — 컴팩션 후에도 유지)
# - CLAUDE.md 전체
# - .riper-state (현재 RIPER 모드·플랜 경로)
# - 최신 플랜 파일 (있는 경우)
# - 최신 cxt 파일 2개

python3 - << 'PYEOF'
import json, os, glob, re

parts = ["[SESSION-START] 세션 시작 컨텍스트 자동 주입\n"]

# ─────────────────────────────────────────────────────────
# 1. CORE_RULES (하드코딩 — 절대 생략 불가)
# ─────────────────────────────────────────────────────────
CORE_RULES = """
=== CORE_RULES (컴팩션 후 자동 복원됨) ===

RULE-1 [SONAR PROTOCOL - DEADLY]:
  bash find/grep -r/ls -r/rg/fd 로 파일 탐색 금지.
  반드시 manage/dictionary.md § 1 조회 또는 Glob/Grep 도구 사용.
  위반 시 sonar-guard.sh가 차단.

RULE-2 [RIPER STATE]:
  현재 RIPER 모드는 .claude/memory-bank/.riper-state 파일에서 확인.
  모드 전환 시 해당 RIPER 커맨드 파일 참조 (/riper:plan, /riper:execute 등).

RULE-3 [GATE]:
  플랜 파일 존재 = 중·대형 작업 → quality-sentinel + reporter 필수.
  플랜 파일 없음 = 소형 작업 → quality-sentinel 선택, reporter 기본 모드만.

RULE-4 [WRITE APPROVAL]:
  소스 코드 파일(.cs, .py, .ts 등) 수정 전 반드시 사용자 승인 확인.
  Collaboration Protocol Step 5 준수.

RULE-5 [DOC-CONTEXT]:
  /doc-context 수신 시 재확인·요약·질문 금지. 즉시 작업 착수.
  No content echo. No re-confirmation.

RULE-6 [MEMORY]:
  /compact 실행 전 반드시 /memory:save 수행.
  세션 복원은 /memory:recall 후 .riper-state 파일 확인.
"""
parts.append(CORE_RULES)

# ─────────────────────────────────────────────────────────
# 2. CLAUDE.md
# ─────────────────────────────────────────────────────────
if os.path.isfile("CLAUDE.md"):
    with open("CLAUDE.md", encoding="utf-8") as f:
        parts.append(f"\n=== CLAUDE.md ===\n{f.read()}")

# ─────────────────────────────────────────────────────────
# 3. .riper-state
# ─────────────────────────────────────────────────────────
riper_state_path = ".claude/memory-bank/.riper-state"
if os.path.isfile(riper_state_path):
    with open(riper_state_path, encoding="utf-8") as f:
        state_content = f.read()
    parts.append(f"\n=== .riper-state ===\n{state_content}")

    # 플랜 파일 경로 파싱
    plan_match = re.search(r"^PLAN_FILE=(.+)$", state_content, re.MULTILINE)
    if plan_match:
        plan_file = plan_match.group(1).strip()
        if plan_file and os.path.isfile(plan_file):
            with open(plan_file, encoding="utf-8") as f:
                parts.append(f"\n=== 현재 플랜: {plan_file} ===\n{f.read()}")

# ─────────────────────────────────────────────────────────
# 4. 최신 cxt 파일 2개 (docs/contextmd/ 또는 cxt/)
# ─────────────────────────────────────────────────────────
cxt_candidates = (
    sorted(glob.glob("docs/contextmd/cxt*.md"),
           key=lambda p: int(''.join(filter(str.isdigit, os.path.basename(p))) or '0'))
    + sorted(glob.glob("cxt/*.md"),
             key=lambda p: int(''.join(filter(str.isdigit, os.path.basename(p))) or '0'))
)
seen = set()
cxt_files = []
for c in reversed(cxt_candidates):
    if c not in seen:
        seen.add(c)
        cxt_files.append(c)
    if len(cxt_files) >= 2:
        break

for cxt in reversed(cxt_files):
    with open(cxt, encoding="utf-8") as f:
        parts.append(f"\n=== {cxt} (최신 컨텍스트) ===\n{f.read()}")

context = "\n".join(parts)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
PYEOF
