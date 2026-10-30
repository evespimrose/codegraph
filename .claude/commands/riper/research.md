---
description: RESEARCH 단계를 메인 세션에서 실행한다. 사실만 모아 작업의 research 문서에 쓴다. 새 작업이면 slug와 상태 파일을 만든다.
allowed-tools: Read, Glob, Grep, Write, Bash(git:*), Bash(codegraph:*), Bash(python3:*), Bash(mkdir:*), WebSearch, WebFetch
---

# riper:research

<!-- CAVE-MAN-OUTPUT-ARM -->
## 실행 규칙 (메인 직접 실행, Cave-Man Output Arm)

이 명령은 메인 에이전트가 직접 수행한다. 서브에이전트로 디스패치하지 않는다.

- 메인이 도구로 직접 작업한다. codegraph를 먼저 쓰고 Read로 보완한다. 훅이 이 순서를 강제한다.
- 과정을 서술하지 않는다. 단독 실행이면 끝에 `RESEARCH 완료` 한 줄만 쓴다.
- Auto-Clarity 예외: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 정상 출력한다.
<!-- /CAVE-MAN-OUTPUT-ARM -->

## 작업 정의 (메인 직접 수행)

과제: $ARGUMENTS

RESEARCH는 사실만 모은다. 파일을 고치지 않고, 방안을 제안하지 않고, 단계를 계획하지 않는다.

### 1. 작업 준비

1. 인자의 첫 단어가 기존 `riper/<slug>.state`의 slug와 같으면 그 작업을 이어간다. 아니면 새 작업이다.
2. 새 작업의 slug는 `<branch>-<YYYY-MM-DD>-<주제>`다. 주제는 영문 소문자, 숫자, 하이픈으로 40자 이내다. 과제가 한국어면 핵심 영어 단어 2~4개로 만든다. branch는 `git rev-parse --abbrev-ref HEAD` 결과다.
3. `mkdir -p .claude/memory-bank/<branch>/riper .claude/memory-bank/<branch>/plans`를 실행한다. `<DOCS>`는 `.claude/memory-bank/<branch>/plans`다.
4. `.claude/rules/riper-state.md` 를 먼저 Read 한다. 이 규칙은 조건부 적재라 새 상태 파일을 쓰기 전에는 실리지 않는다. 그다음 상태 파일 `.claude/memory-bank/<branch>/riper/<slug>.state`를 그 문서 2절 형식으로 쓴다.

       MODE=RESEARCH
       STATUS=active
       TASK=<과제 한 줄>
       PLAN_FILE=
       RESEARCH_FILE=<DOCS>/<slug>-research.md
       INNOVATE_FILE=
       BRANCH=<branch>
       STARTED=<YYYY-MM-DD>
       UPDATED=<YYYY-MM-DD>
       CURRENT=조사 중

   이 쓰기가 `riper-bind.sh`를 통해 이 세션에 작업을 묶는다. 기존 작업을 이어갈 때는 `MODE`, `STATUS=active`, `UPDATED`, `CURRENT`만 고친다.

### 2. 조사 (Sonar Protocol)

1. `codegraph context "<의도>" -p .` 또는 `codegraph query "<심볼>" -p .`로 위치를 찾는다.
2. 영향 범위가 필요하면 `codegraph callers "<심볼>" -p .`나 `codegraph impact "<심볼>" -p .`를 쓴다.
3. 좌표를 얻은 뒤 `Read`의 `offset`과 `limit`로 그 구간만 읽는다.
4. `find`, `grep -r`, `ls -R`, `rg`, `fd`, codegraph 없이 하는 소스 Read는 훅이 차단한다.

버그를 조사할 때는 증상에 패치를 붙이기 전에 루트 원인을 확정한다. 조사, 패턴 찾기, 가설 수립, 인계 순서로 간다. 같은 증상에 패치가 3번 실패했으면 국소 버그가 아니라 아키텍처 문제로 기록한다.

### 3. research.md 쓰기

`<DOCS>/<slug>-research.md`에 다음 형식으로 쓴다. 파일이 이미 있으면 덮어쓴다.

    # Research: <TASK>

    ## 확인된 사실
    - <사실>. 근거: `<파일:줄>` 또는 `<명령>`

    ## 파일 좌표
    - `<경로>:<시작줄>-<끝줄>` <심볼> [<BLK 태그 또는 인프라>]

    ## 제약
    - <지켜야 할 규칙, 호환성, 범위 경계>

    ## 미결 질문
    - <사실로 확정하지 못한 것. 없으면 "없음">

Plan 단계의 Opus는 대화 이력 없이 이 파일만 읽는다. 대화에서 확인한 사실도 빠짐없이 옮긴다.

### 4. 마무리

상태 파일의 `MODE`를 `INNOVATE`로, `UPDATED`를 오늘로, `CURRENT`를 `발상 대기`로 쓴다. 응답은 `[MODE: RESEARCH]`로 시작한다.
