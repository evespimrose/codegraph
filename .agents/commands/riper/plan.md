---
description: Enter PLAN mode to create detailed technical specifications
---

# riper:plan

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (메인 직접 실행 · Cave-Man Output Arm)

**이 명령의 작업은 메인 에이전트가 직접 수행한다. 서브에이전트로 디스패치하지 않는다.**
(이전 "전부 서브에이전트에서 수행" 방식은 콜드스타트 토큰세금 ~100배로 폐기 — 정책: [[main-context-zero-delegation]])

- **서브에이전트 디스패치 금지** — Agent/Task 호출 안 함. 예외: 초대형 규모·병렬 독립 작업을 사용자가 발의한 경우만
- **메인이 도구로 직접 작업** — codegraph→(보완)Read/Edit, hook 통제下 codegraph-first 강제
- **메인 컨텍스트 타이핑 금지** — 과정 narration 없이 도구로만, 끝에 `XX 완료`만
- **Auto-Clarity 예외** — 보안·비가역·모호 다단계·반복질문·하드블로커 → 정상 출력
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (메인 직접 수행)

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

## Codebase Navigation (MANDATORY — SONAR PROTOCOL)

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
- ❌ bash find/grep -r/ls -r/rg/fd (Sonar Protocol)

## Every Response Must Begin With

```
[MODE: PLAN]
```
