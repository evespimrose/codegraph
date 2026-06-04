---
description: Enter PLAN mode to create detailed technical specifications
---

# RIPER PLAN MODE

Activate the plan-execute agent in PLAN sub-mode for the following task:
$ARGUMENTS

The agent will operate in PLAN sub-mode: **Create exhaustive specifications with numbered steps. No code implementation.**

## State Update (MANDATORY — before writing plan)

Write to `.claude/memory-bank/.riper-state`:
```
MODE=PLAN
TASK=$ARGUMENTS
PLAN_FILE=<will be set after file is created>
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

Use: `git rev-parse --abbrev-ref HEAD` for branch name.

## Plan File Location

Save the plan to:
1. Run: `git rev-parse --show-toplevel` to get repository root
2. Save to: `[ROOT]/.claude/memory-bank/[branch]/plans/[branch]-[YYYY-MM-DD]-[feature].md`

IMPORTANT: Never create plans relative to current directory. Always use the repository root.

Example: If root is `/path/to/repo`, save to:
`/path/to/repo/.claude/memory-bank/main/plans/main-2026-05-20-feature-name.md`

## After Plan File is Written

Update `.claude/memory-bank/.riper-state` with the actual plan file path:
```
MODE=PLAN
TASK=$ARGUMENTS
PLAN_FILE=.claude/memory-bank/[branch]/plans/[filename].md
BRANCH=<branch>
STARTED=<date>
```

## Mandatory Save Checklist (Complete before signaling done)

- [ ] Plan file saved to `.claude/memory-bank/{branch}/plans/` with correct naming
- [ ] `.riper-state` updated with `MODE=PLAN` and `PLAN_FILE=<path>`
- [ ] Plan contains numbered steps (not vague descriptions)
- [ ] Success criteria defined
- [ ] Non-goals (scope exclusions) listed
- [ ] `/memory:save` recommended to user (for compaction safety)

## Codebase Navigation (MANDATORY — CAVE-MAN PROTOCOL)

플랜 작성 전 심볼·파일 위치·영향 범위 파악 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_context`** / **`codegraph_search`** → BLK 좌표 확정 (심볼·파일 위치)
2. **`codegraph_impact`** / **`codegraph_callers`** → 변경 파급 범위 파악
3. **`codegraph_node`** → 대상 시그니처·라인 번호 확인
4. (보완 시만) `Read(offset+limit)` — 전체 파일 Read 금지

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## PLAN Mode Rules

- ✅ codegraph_* (FIRST — BLK 좌표 확정 및 영향 범위 파악)
- ✅ Write detailed numbered implementation steps
- ✅ Define success criteria and non-goals
- ✅ Reference existing file paths from dictionary
- ✅ Write only to `.claude/memory-bank/` (plan files)
- ❌ Modify source code files
- ❌ Execute any implementation
- ❌ bash find/grep -r/ls -r/rg/fd (Cave-Man Protocol)

## Every Response Must Begin With

```
[MODE: PLAN]
```
