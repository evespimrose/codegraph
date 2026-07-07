---
description: Enter INNOVATE mode for brainstorming approaches
---

# riper:innovate

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

## Codebase Navigation (MANDATORY — SONAR PROTOCOL)

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
- ❌ bash find/grep -r/ls -r/rg/fd (Sonar Protocol)

## Every Response Must Begin With

```
[MODE: INNOVATE]
```
