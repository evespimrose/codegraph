---
description: Enable strict RIPER protocol enforcement and display current state
allowed-tools: Bash(codegraph:*), Read, Write, Bash(git:*)
---

# riper:strict

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (메인 직접 실행 · Cave-Man Output Arm)

**이 명령의 작업은 메인 에이전트가 직접 수행한다. 서브에이전트로 디스패치하지 않는다.**
(이전 "전부 서브에이전트에서 수행" 방식은 콜드스타트 토큰세금 ~100배로 폐기 — 정책: [[main-context-zero-delegation]])

- **서브에이전트 디스패치 금지** — Agent/Task 호출 안 함. 예외: 초대형 규모·병렬 독립 작업을 사용자가 발의한 경우만
- **메인이 도구로 직접 작업** — codegraph→(보완)Read/Edit, hook 통제下 codegraph-first 강제
- **출력** — 과정 narration 없이 도구로 작업. 끝에 결과 요약과 사람 확인 항목만 쓴다 (RULE-8)
- **Auto-Clarity 예외** — 보안·비가역·모호 다단계·반복질문·하드블로커 → 정상 출력
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (메인 직접 수행)

# RIPER STRICT MODE ACTIVATED

From this point forward, RIPER protocol is strictly enforced.

## Current State (riper/<slug>.state)

세션 시작 때 주입된 "이 세션의 RIPER 작업"을 보인다. 없으면 `.claude/memory-bank/*/riper/*.state` 중 `STATUS`가 `active`나 `paused`인 작업을 한 줄씩(slug, MODE, STATUS, CURRENT) 보인다.

```
MODE=<value>          <- current RIPER phase
STATUS=<value>        <- active | paused | done
TASK=<value>          <- active task description
PLAN_FILE=<value>     <- path to approved plan (empty if none)
BRANCH=<value>        <- git branch
UPDATED=<value>       <- last update date
```

active·paused 작업이 없으면:
-> No active RIPER session. Use `/riper:research <과제>` to begin.

## Codebase Navigation (전 단계 공통 — SONAR PROTOCOL)

모든 모드에서 코드베이스 탐색 순서:
```
codegraph context / query  →  callers / impact  →  (보완) Read(offset+limit)
```
❌ bash find/grep -r/ls -r/rg/fd / codegraph 미사용 후 소스 Read → hook 자동 차단

## Protocol Rules

1. **Mode Declaration**: Every response begins with `[MODE: X]` or `[NO MODE]`
2. **Mode Transitions**: Only the user can authorize mode changes
3. **Mode Restrictions**: Each mode has specific allowed actions (see table below)
4. **Violation Handling**: Any out-of-mode action triggers a block warning
5. **Sonar Protocol (DEADLY)**: 모든 모드에서 codegraph_* 우선 — bash find/grep -r/rg/fd 차단

## Available Commands

- `/riper:research` — Enter RESEARCH sub-mode (read-only)
- `/riper:innovate` — Enter INNOVATE sub-mode (brainstorming)
- `/riper:plan` — Enter PLAN sub-mode (specifications + 상태 파일 write)
- `/riper:execute` — Enter EXECUTE sub-mode (requires PLAN_FILE in 상태 파일)
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
