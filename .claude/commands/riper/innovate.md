---
description: INNOVATE 단계를 메인 세션에서 실행한다. 방안을 비교하고 사용자 선택을 작업의 innovate 문서에 쓴다.
allowed-tools: Read, Glob, Grep, Write, Bash(git:*), Bash(codegraph:*), Bash(python3:*), AskUserQuestion
---

# riper:innovate

<!-- CAVE-MAN-OUTPUT-ARM -->
## 실행 규칙 (메인 직접 실행, Cave-Man Output Arm)

이 명령은 메인 에이전트가 직접 수행한다. 서브에이전트로 디스패치하지 않는다.

- 메인이 도구로 직접 작업한다. codegraph를 먼저 쓰고 Read로 보완한다. 훅이 이 순서를 강제한다.
- 과정을 서술하지 않는다. 단독 실행이면 끝에 `INNOVATE 완료` 한 줄만 쓴다.
- Auto-Clarity 예외: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 정상 출력한다.
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (메인 직접 수행)

추가 지시: $ARGUMENTS

INNOVATE는 방안을 비교하고 사용자가 고르게 한다. 구현 단계를 쓰지 않고, 작업 문서 밖의 파일을 고치지 않는다.

### 1. 준비

1. 작업을 정한다. 인자의 첫 단어가 slug면 그 작업이다. 없으면 세션 시작 때 주입된 "이 세션의 RIPER 작업"이다. 둘 다 없으면 `active`·`paused` 작업 목록을 보이고 AskUserQuestion으로 묻는다. 임의로 고르지 않는다.
2. 상태 파일은 `.claude/memory-bank/<branch>/riper/<slug>.state`다. 문서 폴더 `<DOCS>`는 `.claude/memory-bank/<branch>/plans`다. 경로 규칙은 `.claude/rules/riper-state.md` 6절을 따른다.
3. 상태 파일에서 `TASK`와 `RESEARCH_FILE`을 읽는다. 조사 파일이 없으면 멈춘다. `/riper:research`를 먼저 실행하라고 안내한다.
4. 상태 파일의 `MODE`를 `INNOVATE`로, `INNOVATE_FILE`을 `<DOCS>/<slug>-innovate.md`로, `UPDATED`를 오늘로 쓴다. 이 쓰기가 이 세션에 작업을 묶는다.

### 2. 방안 만들기

1. `research.md`를 근거로 방안을 2개나 3개 만든다. 더 단순한 방안이 있으면 반드시 넣는다.
2. 기존 패턴을 참조해야 하면 `codegraph query "<심볼>" -p .`를 먼저 쓴다.
3. 방안 이름은 내용을 드러내는 짧은 이름으로 쓴다. "A안", "B안" 같은 기호만 쓰지 않는다.
4. 방안마다 장점, 단점, 위험을 적는다.

### 3. 사용자 선택

AskUserQuestion으로 사용자가 고르게 한다. 추천 방안을 첫 선택지로 두고 이름 끝에 "(추천)"을 붙인다. 결정할 것이 더 있으면 같은 AskUserQuestion 호출에 질문을 함께 넣는다. 한 호출에 질문은 4개까지다. 이 호출이 이 단계의 유일한 사용자 질문이다.

### 4. innovate.md 쓰기

`<DOCS>/<slug>-innovate.md`에 다음 형식으로 쓴다. 파일이 이미 있으면 `## 사용자 결정`의 기존 내용은 보존하고 나머지를 갱신한다.

    # Innovate: <TASK>

    ## 검토한 방안
    ### <방안 이름>
    - 내용: <무엇을 어떻게 하는지>
    - 장점: <장점>
    - 단점과 위험: <단점, 위험>

    ## 선택
    - 선택한 방안: <방안 이름>
    - 선택 근거: <사용자 답과 근거>

    ## 사용자 결정
    - <질문>: <답>

Plan 단계의 Opus는 대화 이력 없이 이 파일과 research.md만 읽는다. 사용자가 대화에서 덧붙인 조건도 `## 사용자 결정`에 옮긴다.

### 5. 마무리

상태 파일의 `MODE`를 `PLAN`으로, `UPDATED`를 오늘로, `CURRENT`를 `플랜 대기`로 쓴다. 응답은 `[MODE: INNOVATE]`로 시작한다.
