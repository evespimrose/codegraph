---
description: RIPER 전 단계를 진행한다. 루트 세션(Sonnet 5.5, effort medium)이 Research, Innovate, Review를 직접 하고, Plan(Opus 5.5)과 Execute(Haiku 5.5)는 세션 카드로 새 세션에 넘긴다. 인자 없이 실행하면 멈춘 단계부터 이어간다.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git:*), Bash(codegraph:*), Bash(python3:*), Bash(mkdir:*), Skill, AskUserQuestion, ToolSearch, WebSearch, WebFetch, mcp__ccd_session__start_session
---

# riper:workflow

<!-- CAVE-MAN-OUTPUT-ARM -->
## 실행 규칙 (루트 세션 직접 실행, Cave-Man Output Arm)

이 명령은 루트 세션이 직접 수행한다. 서브에이전트로 디스패치하지 않는다. Plan과 Execute는 세션 카드로 새 세션에 넘긴다. 세션은 서브에이전트가 아니다(전역 규칙 `session-handoff.md`).

- 루트가 도구로 직접 작업한다. codegraph를 먼저 쓰고 Read로 보완한다. 훅이 이 순서를 강제한다.
- 단계 사이에 과정을 서술하지 않는다.
- Auto-Clarity 예외: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 정상 출력한다.
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (루트 세션 직접 수행)

과제: $ARGUMENTS

### 0. 모델 확인

시스템 프롬프트에 적힌 이 세션의 모델 이름을 확인한다. Sonnet 5.5(`claude-sonnet-5-5`)가 아니면 아무것도 바꾸지 않는다. 다음 한 줄만 출력하고 끝낸다.

    루트 세션은 Sonnet 5.5여야 합니다. 모델 메뉴에서 Sonnet 5.5를 고른 뒤 다시 실행하세요.

같은 세션에서 모델을 바꾸면 대화 전체가 새 모델의 캐시에 다시 기록된다. 그래서 루트는 모델을 바꾸지 않는다. 다른 모델이 필요한 단계는 처음부터 그 모델로 연 새 세션에 넘긴다.

### 1. 작업 지정

`.claude/rules/riper-state.md` 4절의 순서로 작업을 정한다. 상태 파일은 `.claude/memory-bank/<branch>/riper/<slug>.state`, 문서 폴더 `<DOCS>`는 `.claude/memory-bank/<branch>/plans`다.

- 인자의 첫 단어가 기존 slug와 같으면 그 작업을 이어간다.
- 인자가 과제 설명이면 새 작업이다. `riper:research`가 slug와 상태 파일을 만든다. 같은 과제로 보이는 `active`·`paused` 작업이 있으면 AskUserQuestion으로 "그 작업 이어가기"와 "새 작업" 중 고르게 한다.
- 인자가 없으면 이 세션에 묶인 작업(세션 시작 때 주입된 "이 세션의 RIPER 작업")을 이어간다. 없으면 `active`·`paused` 작업 목록을 보이고 AskUserQuestion으로 고르게 한다.

이어갈 작업은 상태 파일의 `MODE`를 읽어 시작한다. `STATUS=done`이면 5절 보고만 하고 끝낸다. `STATUS=paused`면 `STATUS=active`로 바꾸고 이어간다.

### 2. 단계 실행

`MODE` 값에 따라 아래 표의 행을 실행한다. 한 행을 마치면 `MODE`를 다시 읽고 다음 행으로 간다. 카드를 올렸거나 사용자 선택이 필요한 지점까지 멈추지 않는다.

| MODE | 할 일 | 다음 MODE를 쓰는 쪽 |
|---|---|---|
| RESEARCH | Skill 도구로 `riper:research`를 호출한다. 새 작업이면 과제 인자를, 이어가는 작업이면 slug를 넘긴다 | 루트: INNOVATE |
| INNOVATE | Skill 도구로 `riper:innovate <slug>`를 호출한다 | 루트: PLAN |
| PLAN | 3절에 따라 Plan 카드를 올리고 턴을 끝낸다 | Plan 세션: APPROVAL 또는 BLOCKED |
| APPROVAL | 2.1절을 따른다 | 루트: EXECUTE |
| EXECUTE | 3절에 따라 Execute 카드를 올리고 턴을 끝낸다 | Execute 세션: REVIEW 또는 BLOCKED |
| REVIEW | Skill 도구로 `riper:review <slug>`를 호출한다 | 루트: STATUS=done 또는 MODE=BLOCKED |
| BLOCKED | 2.2절을 따른다 | 사용자 선택에 따름 |
| (STATUS=done) | 5절에 따라 보고하고 끝낸다 | 없음 |

#### 2.1 APPROVAL

1. Plan 세션의 보고를 그대로 믿지 않는다. `PLAN_FILE`을 직접 읽어 세 가지를 확인한다. 파일이 있는가, `## 단계`에 단계가 하나 이상 있는가, `## 미결 질문`이 "없음"인가.
2. 하나라도 어긋나면 원인을 `<DOCS>/<slug>-innovate.md`의 `## 사용자 결정` 끝에 "플랜 재작성 사유: <원인>"으로 덧붙인다. `MODE=PLAN`으로 쓰고 Plan 카드를 다시 올린다.
3. 세 가지가 맞으면 플랜을 요약해 보여준다. 요약은 목표 한 줄, 바뀔 파일 목록, 단계 제목 목록이다.
4. AskUserQuestion으로 승인을 받는다. 선택지는 "승인", "수정 요청", "중단" 세 개다.
   - 승인: `MODE=EXECUTE`로 쓴다. 이 승인은 `plan.md`의 `## 바뀔 파일` 범위에 대한 소스 수정 승인(RULE-4)이다. 바로 Execute 카드를 올린다.
   - 수정 요청: 사용자가 적은 수정 내용을 `innovate.md`의 `## 사용자 결정` 끝에 덧붙인다. `MODE=PLAN`으로 쓰고 Plan 카드를 다시 올린다.
   - 중단: 2.3절을 따른다.

#### 2.2 BLOCKED

1. 멈춘 단계, 원인, 이미 바뀐 파일을 보고한다. 근거는 `<DOCS>/<slug>-exec-log.md`(없으면 `plan.md`의 `## 미결 질문`)와 `git diff --stat`이다.
2. AskUserQuestion으로 다음 조치를 묻는다. 선택지는 "플랜 수정 후 다시 실행", "직접 처리", "중단" 세 개다.
   - 플랜 수정 후 다시 실행: 사용자의 지시를 `innovate.md`의 `## 사용자 결정` 끝에 덧붙인다. `MODE=PLAN`으로 쓰고 Plan 카드를 올린다.
   - 직접 처리: `MODE=REVIEW`로 쓰고 끝낸다. 처리를 마친 뒤 인자 없이 `/riper:workflow`를 실행하라고 안내한다.
   - 중단: 2.3절을 따른다.

#### 2.3 중단

상태 파일의 `STATUS`를 `paused`로, `CURRENT`를 `<TASK> 중단 (<YYYY-MM-DD>)`으로 쓴다. 작업 문서는 지우지 않는다. `/riper:workflow <slug>`로 이어간다.

### 3. 세션 카드

전역 규칙 `session-handoff.md`의 절차로 카드를 올린다. 도구는 `mcp__ccd_session__start_session`이다. 지연 로드 상태면 먼저 ToolSearch로 `select:mcp__ccd_session__start_session`을 단독 호출한다. 이 프로젝트의 값은 다음과 같다.

| 항목 | Plan 카드 | Execute 카드 |
|---|---|---|
| title | `<TASK 앞 30자> PLAN` | `<TASK 앞 30자> EXECUTE` |
| name | `riper-plan` | `riper-exec` |
| model | `claude-opus-5-5` | `claude-haiku-5-5` |
| effort | `max` | `medium` |
| context | `fresh` | `fresh` |
| use_worktree | `false` | `false` |
| initiation | `own_initiative` | `own_initiative` |
| prompt | 3.1 | 3.2 |
| background | 3.3 | 3.3 |

`use_worktree`는 반드시 `false`다. 상태 파일과 작업 문서는 커밋되기 전까지 워크트리 세션에서 보이지 않는다.

#### 3.1 Plan 카드 prompt

    /riper:plan <slug>
    상태 파일: .claude/memory-bank/<branch>/riper/<slug>.state
    읽을 파일: <DOCS>/<slug>-research.md, <DOCS>/<slug>-innovate.md
    쓸 파일: <PLAN_FILE>
    지킬 것: 소스 파일을 고치지 않는다. 다른 세션과 폴더를 공유하므로 위 파일과 상태 파일, innovate.md의 사용자 결정 덧붙임만 쓴다. 커밋, 브랜치 전환, stash를 하지 않는다. 응답은 한국어로 한다.
    완료 기준: plan.md가 /riper:plan 형식을 따른다. 상태 파일의 MODE가 APPROVAL이고 PLAN_FILE이 <PLAN_FILE>다. 미결 질문이 남으면 MODE를 BLOCKED로 쓰고 질문 목록을 보고한다.

#### 3.2 Execute 카드 prompt

    /riper:execute <slug>
    플랜: <PLAN_FILE>
    실행 기록: <DOCS>/<slug>-exec-log.md
    지킬 것: 사용자가 루트 세션에서 이 플랜을 승인했다. plan.md의 "## 바뀔 파일"만 고친다. 커밋, 브랜치 전환, stash를 하지 않는다. 응답은 한국어로 한다.
    완료 기준: 단계마다 exec-log.md에 상태와 검증 출력이 있다. 상태 파일의 MODE가 REVIEW 또는 BLOCKED다. 마지막 응답은 STATUS, STEPS_DONE, CONCERNS, STOPPED_AT, REASON 다섯 줄이다.

#### 3.3 background

80자 이상으로 쓴다. 과제, 선택한 방안, 앞 단계가 만든 파일, 루트가 직접 확인한 사실을 넣는다. 이 대화를 보지 못한 세션이 읽고 바로 시작할 수 있어야 한다.

#### 3.4 카드를 올린 뒤

채팅에는 "카드를 눌러 <PLAN 또는 EXECUTE> 세션을 시작하세요." 한 줄만 쓰고 턴을 끝낸다.

#### 3.5 세션 카드 도구가 없을 때

3절 표의 title, model, effort와 prompt를 한 코드 블록으로 출력한다. 사용자는 새 세션을 열고 모델과 effort를 고른 뒤 prompt를 붙여 넣는다. 그 세션이 끝나면 사용자가 루트에서 인자 없이 `/riper:workflow`를 실행해 이어간다.

### 4. 넘긴 세션의 알림

Plan이나 Execute 세션의 턴이 끝나면 루트에 알림이 온다. 알림을 받으면 상태 파일의 `MODE`를 다시 읽는다.

- `MODE`가 `APPROVAL`, `REVIEW`, `BLOCKED` 중 하나면 2절 표의 해당 행부터 이어간다.
- `MODE`가 `PLAN`이나 `EXECUTE` 그대로면 넘긴 세션이 사용자 답을 기다리거나 아직 진행 중이다. "<단계> 세션 진행 중" 한 줄만 쓰고 턴을 끝낸다.

### 5. 응답 규칙

단계를 시작할 때 `[MODE: <단계>]` 한 줄을 쓴다. `DONE`에서 바뀐 파일, 리뷰 판정, `docs/output` 산출물 경로를 보고한다.

정상 흐름에서 루트가 사용자에게 묻는 지점은 INNOVATE의 방안 선택과 APPROVAL의 승인 두 곳뿐이다. 그 밖에서는 확인 질문을 하지 않는다. 예외는 BLOCKED, 진행 중 과제 충돌, Auto-Clarity 예외다.
