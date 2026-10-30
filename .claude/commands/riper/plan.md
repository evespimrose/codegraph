---
description: PLAN 단계. Opus 5.5 세션에서 작업의 research 문서와 innovate 문서를 읽고 Haiku 5.5가 판단 없이 실행할 수 있는 plan.md를 쓴다. 루트 세션의 /riper:workflow가 세션 카드로 연다.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git:*), Bash(codegraph:*), Bash(python3:*), AskUserQuestion
---

# riper:plan

<!-- CAVE-MAN-OUTPUT-ARM -->
## 실행 규칙 (이 세션 직접 실행, Cave-Man Output Arm)

이 명령은 이 세션이 직접 수행한다. 서브에이전트로 디스패치하지 않는다.

- codegraph를 먼저 쓰고 Read로 보완한다. 훅이 이 순서를 강제한다.
- 과정을 서술하지 않는다. 끝에 플랜 경로, 미결 질문 수, 수락 기준 블록 줄 수를 쓴다.
- Auto-Clarity 예외: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 정상 출력한다.
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의

추가 지시: $ARGUMENTS

### 0. 모델 확인

시스템 프롬프트에 적힌 이 세션의 모델 이름을 확인한다. Opus 5.5(`claude-opus-5-5`)가 아니면 아무것도 쓰지 않는다. 다음 한 줄만 출력하고 끝낸다.

    PLAN은 Opus 5.5 세션에서 실행합니다. 루트 세션의 /riper:workflow가 올리는 Plan 카드로 시작하세요.

### 1. 입력

1. 작업을 정한다. 인자의 첫 단어가 slug면 그 작업이다. 없으면 세션 시작 때 주입된 "이 세션의 RIPER 작업"이다. 둘 다 없으면 `active`·`paused` 작업 목록을 보이고 AskUserQuestion으로 묻는다. 임의로 고르지 않는다.
2. 상태 파일은 `.claude/memory-bank/<branch>/riper/<slug>.state`다. 문서 폴더 `<DOCS>`는 `.claude/memory-bank/<branch>/plans`다. 경로 규칙은 `.claude/rules/riper-state.md` 6절을 따른다.
3. 상태 파일에서 `TASK`, `RESEARCH_FILE`, `INNOVATE_FILE`을 읽는다.
4. `RESEARCH_FILE`이나 `INNOVATE_FILE`이 비어 있거나 파일이 없으면 플랜을 쓰지 않는다. 원인을 한 줄로 보고하고 끝낸다.
5. 상태 파일의 `MODE`를 `PLAN`으로, `UPDATED`를 오늘로, `CURRENT`를 `플랜 작성 중`으로 쓴다. 이 쓰기가 이 세션에 작업을 묶는다.

이 세션은 루트 세션의 대화를 보지 못한다. 필요한 사실은 두 문서에 있다.

### 2. 코드 확인 규칙

- 소스를 읽기 전에 Bash로 `codegraph query "<심볼>" -p .` 또는 `codegraph context "<의도>" -p .`를 먼저 실행한다.
- 파일 전체를 읽지 않는다. 좌표 주변만 `Read`의 `offset`과 `limit`로 읽는다.
- `find`, `grep -r`, `ls -R`, `rg`, `fd`, `cat <소스>`는 훅이 막는다. 쓰지 않는다.

### 3. 플랜 작성 규칙

Execute 단계는 Haiku 5.5가 판단 없이 실행한다. 그래서 다음을 지킨다.

- 단계마다 파일 경로, 위치, 동작, 변경 전 원문, 변경 후 내용, 검증 명령, 기대 출력을 적는다.
- 변경 전 원문은 파일에서 그대로 복사한다. 원문은 파일 안에서 유일해야 한다. 유일하지 않으면 앞뒤 줄을 더 붙인다.
- 변경 후 내용은 그대로 붙여 넣을 수 있는 완성 형태로 쓴다. "적절히", "필요하면", "비슷하게" 같은 판단 위임 표현을 쓰지 않는다.
- 판단이 필요한 일은 기계적인 작은 단계로 쪼갠다. 쪼갤 수 없으면 AskUserQuestion으로 사용자에게 직접 묻는다. 답은 `innovate.md`의 `## 사용자 결정` 끝에 덧붙이고 플랜에 반영한다.
- 검증은 Python 한 줄로 문자열 개수를 세는 형식으로 쓴다. 예: `python3 -c "print(open('경로', encoding='utf-8').read().count('새 문자열'))"`, 기대 출력 `1`. 소스를 화면에 출력하는 명령은 훅이 막으므로 쓰지 않는다.
- Unity 프로젝트(`Assets/`와 `ProjectSettings/`가 있는 루트)에서는 단계 검증을 정적 검사로 한정한다. Unity 컴파일과 테스트는 `## Review 검증`에 적는다. Review 단계가 실행한다.
- 단계는 10개 이하로 쓴다.
- 플랜마다 `## 수락 기준` 절을 쓴다. 한 줄에 JSON 객체 하나인 ` ```acceptance ` 블록이다. `kind` 가 `auto` 면 `id`, `cmd`, `expect`(`exit0`)를 쓴다. `kind` 가 `human` 이면 `id`, `how`, `expect` 를 쓴다. `cmd` 는 저장소 루트에서 실행된다. 사람만 확인할 수 있는 항목은 `human` 으로 쓴다(예: 육안 확인, 에디터 실행).
- 수락 기준 블록이 없으면 플랜을 끝냈다고 보지 않는다.
- 소스 파일은 고치지 않는다. 이 세션이 쓰는 파일은 `plan.md`, 상태 파일, `innovate.md`(사용자 결정 덧붙임)뿐이다.

### 4. plan.md 형식

`<PLAN_FILE>`에 아래 형식을 그대로 쓴다. 꺾쇠 괄호 부분만 채운다. 파일이 이미 있으면 덮어쓴다.

    # 플랜: <TASK>

    ## 목표
    <한 문장>

    ## 바뀔 파일
    - `<경로>`: <무엇을 바꾸는지 한 줄>

    ## 단계

    ### 단계 1: <제목>
    - 파일: `<경로>`
    - 위치: `<심볼>` 또는 `<시작줄>-<끝줄>`
    - 동작: <create | replace | insert-after | delete | append>
    - 변경 전:
      ```
      <원문. create와 append일 때는 "없음">
      ```
    - 변경 후:
      ```
      <새 내용. delete일 때는 "없음">
      ```
    - 검증: `<명령>`
    - 기대 출력: `<출력>`

    ## 수락 기준
    ```acceptance
    {"id":"V1","kind":"auto","cmd":"<저장소 루트에서 실행할 명령>","expect":"exit0"}
    {"id":"V2","kind":"human","how":"<사람이 할 절차>","expect":"<기대 결과>"}
    ```

    ## 미결 질문
    - <질문. 없으면 "없음">

| 동작 | 뜻 |
|---|---|
| create | "변경 후" 내용으로 새 파일을 만든다 |
| replace | "변경 전"을 "변경 후"로 바꾼다 |
| insert-after | "변경 전" 바로 뒤에 "변경 후"를 넣는다 |
| delete | "변경 전"을 지운다 |
| append | 파일 끝에 "변경 후"를 붙인다 |

### 5. 마무리

- `## 미결 질문`이 "없음"이고 `## 수락 기준`의 acceptance 블록이 있으면 상태 파일의 `MODE`를 `APPROVAL`로, `PLAN_FILE`을 `<DOCS>/<slug>.md`로, `UPDATED`를 오늘로, `CURRENT`를 `승인 대기`로 쓴다. 승인(G1)은 루트 세션에서 사람이 한다.
- 미결 질문이 남았으면 `MODE`를 `BLOCKED`로, `CURRENT`를 `플랜 미결 질문`으로 쓰고 남은 질문을 보고한다.

응답은 `[MODE: PLAN]`으로 시작한다. 승인은 루트 세션이 받는다. 이 세션에서 승인을 묻지 않는다.
