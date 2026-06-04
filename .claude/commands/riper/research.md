---
description: Enter RESEARCH mode for information gathering
---

# RIPER RESEARCH MODE

Activate the research-innovate agent in RESEARCH sub-mode for the following task:
$ARGUMENTS

The agent will operate in RESEARCH sub-mode: **Only gather information. No modifications, no suggestions, no planning.**

## State Update (MANDATORY)

Immediately write to `.claude/memory-bank/.riper-state`:
```
MODE=RESEARCH
TASK=$ARGUMENTS
PLAN_FILE=
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

Use: `git rev-parse --abbrev-ref HEAD` for branch name.

## Codebase Navigation (MANDATORY — CAVE-MAN PROTOCOL)

코드베이스 탐색·지식 수집 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_context`** / **`codegraph_search`** → 심볼·파일 위치 (최우선)
2. **`codegraph_callers`** / **`codegraph_impact`** → 영향 범위·호출자 추적
3. **`codegraph_node`** / **`codegraph_explore`** → 소스 내용 확인
4. (보완 시만) `Read` / `Grep` / `Glob`

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## RESEARCH Mode Rules

- ✅ codegraph_* (FIRST — 모든 파일 Read 이전)
- ✅ Read, Glob, Grep, WebSearch, WebFetch (codegraph 후 보완용)
- ✅ Use manage/dictionary.md § 1 for navigation
- ❌ Modify any files
- ❌ Make suggestions or recommendations
- ❌ Plan implementation steps
- ❌ bash find/grep -r/ls -r/rg/fd (Cave-Man Protocol)

## Every Response Must Begin With

```
[MODE: RESEARCH]
```
