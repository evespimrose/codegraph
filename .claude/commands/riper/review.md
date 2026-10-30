---
description: REVIEW 단계를 메인 세션에서 실행한다. 플랜의 수락 기준, 실행 기록, git diff를 대조하고 pack.py 로 Review Pack 을 만든다.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(git:*), Bash(codegraph:*), Bash(python3:*), Bash(python:*), Skill
---

# riper:review

<!-- CAVE-MAN-OUTPUT-ARM -->
## 실행 규칙 (메인 직접 실행, Cave-Man Output Arm)

이 명령은 메인 에이전트가 직접 수행한다. 서브에이전트로 디스패치하지 않는다.

- 메인이 도구로 직접 작업한다. codegraph를 먼저 쓰고 Read로 보완한다. 훅이 이 순서를 강제한다.
- 과정을 서술하지 않는다. 끝에 판정, Review Pack 경로, 사람 확인 항목을 쓴다.
- Auto-Clarity 예외: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 정상 출력한다.
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (메인 직접 수행)

추가 지시: $ARGUMENTS

REVIEW는 구현을 검증한다. 검수에서 찾은 오류는 이 세션이 고친다(전역 규칙 `session-handoff.md`). 단 고치는 범위는 `plan.md`의 `## 바뀔 파일`로 한정한다. 범위 밖 오류는 고치지 않고 보고한다.

### 1. 준비

1. 작업을 정한다. 인자의 첫 단어가 slug면 그 작업이다. 없으면 세션 시작 때 주입된 "이 세션의 RIPER 작업"이다. 둘 다 없으면 `active`·`paused` 작업 목록을 보이고 AskUserQuestion으로 묻는다. 임의로 고르지 않는다.
2. 상태 파일은 `.claude/memory-bank/<branch>/riper/<slug>.state`다. 문서 폴더 `<DOCS>`는 `.claude/memory-bank/<branch>/plans`다. 경로 규칙은 `.claude/rules/riper-state.md` 6절을 따른다.
3. 상태 파일에서 `PLAN_FILE`과 `TASK`를 읽는다.
4. `PLAN_FILE`이나 `<DOCS>/<slug>-exec-log.md`가 없으면 멈추고 원인을 보고한다.

### 2. 대조

1. `plan.md`의 단계마다 `exec-log.md`에 적힌 상태를 확인한다.
2. `git diff --stat`의 파일 목록을 `plan.md`의 `## 바뀔 파일`과 비교한다. `.claude/memory-bank/` 아래 문서와 상태 파일, `.claude/state/`는 비교에서 뺀다. 플랜에 없는 파일이 바뀌었으면 Critical이다.
3. 단계마다 `plan.md`의 검증 명령을 직접 다시 실행한다. `exec-log.md`의 기록을 그대로 믿지 않는다. 출력이 기대 출력과 다르면 Critical이다.
4. `plan.md`의 `## 수락 기준` 블록에서 `kind: auto` 항목을 `cmd`로 실행하고 종료 코드를 `expect`와 비교한다. `kind: human` 항목은 실행하지 않는다. Review Pack 의 사람 확인 목록으로 넘긴다. Unity 컴파일이나 테스트가 있으면 `unity-debug-and-test` 스킬을 로드해 그 절차로 실행한다.
5. 바뀐 소스 파일이 있으면 `code-review` 스킬을 그 경로들에 실행한다. 그 결과의 Critical은 Critical로 옮긴다.
6. Critical이 `## 바뀔 파일` 안에 있으면 이 세션이 고친다. 고친 뒤 3번 재검증과 5번 code-review를 다시 실행한다. Critical이 0개가 될 때까지 반복한다. 같은 Critical이 2번 고쳐도 남으면 반복을 멈추고 판정을 NEEDS REVISION으로 둔다.
7. Critical이 `## 바뀔 파일` 밖에 있으면 고치지 않는다. 판정을 NEEDS REVISION으로 둔다.

### 3. Review Pack 만들기

모델이 검수 문서를 직접 쓰지 않는다. 다음 명령을 실행하고 출력 한 줄을 그대로 보고한다.

    python .claude/skills/review-pack/scripts/pack.py build <slug> --card-note "<판정 한 줄>"

- `<판정 한 줄>`에는 2번 대조의 결과를 넣는다. 예: `APPROVED. 범위 이탈 없음` 또는 `NEEDS REVISION. Critical 1 (바뀔 파일 밖)`.
- 명령이 만든 `<DOCS>/<slug>-review.md`가 Review Pack 이다. 자동 기준 결과, 범위 대조, 사람 확인 목록이 들어간다.
- 명령이 실패하면(종료 코드 2 등) 원인을 보고하고 멈춘다. 검수 문서를 손으로 쓰지 않는다.

판정 기준: Critical이 0개이고 자동 기준이 모두 PASS면 APPROVED다. 그 밖에는 NEEDS REVISION이다.

### 4. 마무리

- APPROVED면 상태 파일을 다시 읽고 `MODE`를 `REVIEW`로, `CURRENT`를 `G2 확인 대기: <slug>-review.md`로 쓴다. `STATUS`는 `active`로 둔다. `STATUS=done`은 사람이 G2 에서 `pack.py confirm` 으로 정한다.
- NEEDS REVISION이면 `MODE`를 `BLOCKED`로, `CURRENT`를 `검수 Critical`로 쓰고 Critical 목록을 보고한다.
- 마지막 응답에는 Review Pack 경로와 사람 확인 항목 수를 쓴다. 확인 목록은 Review Pack 에서 본다.

응답은 `[MODE: REVIEW]`로 시작한다.
