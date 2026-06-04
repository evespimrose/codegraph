---
description: Enable strict RIPER protocol enforcement and display current state
---

# RIPER STRICT MODE ACTIVATED

From this point forward, RIPER protocol is strictly enforced.

## Current State (from .riper-state)

Read `.claude/memory-bank/.riper-state` and display:

```
MODE=<value>          ← current RIPER phase
TASK=<value>          ← active task description
PLAN_FILE=<value>     ← path to approved plan (empty if none)
BRANCH=<value>        ← git branch
STARTED=<value>       ← session start date
```

If `.riper-state` does not exist or MODE=NONE:
→ No active RIPER session. Use `/riper:research` to begin.

## Codebase Navigation (전 단계 공통 — CAVE-MAN PROTOCOL)

모든 모드에서 코드베이스 탐색 순서:
```
codegraph_context / search  →  callers / impact  →  node / explore  →  (보완) Read/Grep
```
❌ bash find/grep -r/ls -r/rg/fd / codegraph 미사용 후 소스 Read → hook 자동 차단

## Protocol Rules

1. **Mode Declaration**: Every response begins with `[MODE: X]` or `[NO MODE]`
2. **Mode Transitions**: Only the user can authorize mode changes
3. **Mode Restrictions**: Each mode has specific allowed actions (see table below)
4. **Violation Handling**: Any out-of-mode action triggers a block warning
5. **Cave-Man Protocol (DEADLY)**: 모든 모드에서 codegraph_* 우선 — bash find/grep -r/rg/fd 차단

## Available Commands

- `/riper:research` — Enter RESEARCH sub-mode (read-only)
- `/riper:innovate` — Enter INNOVATE sub-mode (brainstorming)
- `/riper:plan` — Enter PLAN sub-mode (specifications + .riper-state write)
- `/riper:execute` — Enter EXECUTE sub-mode (requires PLAN_FILE in .riper-state)
- `/riper:review` — Enter REVIEW mode (validation)
- `/riper:strict` — Display this status + current state

## Mode Capabilities

| Mode | Read | Write Source | Execute | Plan Docs | Validate |
|------|------|-------------|---------|-----------|----------|
| RESEARCH | ✅ | ❌ | ❌ | ❌ | ❌ |
| INNOVATE | ✅ | ❌ | ❌ | ❌ | ❌ |
| PLAN | ✅ | 📄 plans only | ❌ | ✅ | ❌ |
| EXECUTE | ✅ | ✅ | ✅ | ❌ | ❌ |
| REVIEW | ✅ | 📄 review docs | ✅* | ❌ | ✅ |

*Only for running tests, not modifications

## Violation Response Format

```
⚠️ ACTION BLOCKED: Currently in [CURRENT MODE]
Attempted action: [WHAT WAS ATTEMPTED]
Required mode: [WHAT MODE IS NEEDED]
To proceed: Switch to [REQUIRED MODE] mode
```

## Additional Context

$ARGUMENTS

RIPER Strict Mode is now ACTIVE. Awaiting mode assignment or displaying current state.
