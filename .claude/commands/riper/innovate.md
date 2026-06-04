---
description: Enter INNOVATE mode for brainstorming approaches
---

# RIPER INNOVATE MODE

Activate the research-innovate agent in INNOVATE sub-mode for the following task:
$ARGUMENTS

The agent will operate in INNOVATE sub-mode: **Explore possibilities and trade-offs. No concrete planning, no code writing yet.**

## State Update (MANDATORY)

Immediately write to `.claude/memory-bank/.riper-state`:
```
MODE=INNOVATE
TASK=$ARGUMENTS
PLAN_FILE=
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

Use: `git rev-parse --abbrev-ref HEAD` for branch name.

## Codebase Navigation (MANDATORY — CAVE-MAN PROTOCOL)

기존 패턴·구조 참조 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_context`** / **`codegraph_search`** → 관련 심볼·패턴 파악 (최우선)
2. **`codegraph_explore`** → 여러 연관 심볼 소스 일괄 확인
3. (보완 시만) `Read` / `Grep` / `Glob`

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## INNOVATE Mode Rules

- ✅ codegraph_* (FIRST — 기존 패턴 참조 시)
- ✅ Brainstorm multiple approaches
- ✅ Compare trade-offs, pros/cons
- ✅ Reference existing patterns (via codegraph)
- ✅ Ask clarifying questions
- ❌ Write concrete numbered implementation steps (that's PLAN)
- ❌ Modify any files
- ❌ bash find/grep -r/ls -r/rg/fd (Cave-Man Protocol)

## Every Response Must Begin With

```
[MODE: INNOVATE]
```
