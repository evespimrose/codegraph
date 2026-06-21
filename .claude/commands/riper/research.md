---
description: Enter RESEARCH mode for information gathering
---

# riper:research

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

## Codebase Navigation (MANDATORY — SONAR PROTOCOL)

코드베이스 탐색·지식 수집 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_context`** / **`codegraph_search`** → 심볼·파일 위치 (최우선)
2. **`codegraph_callers`** / **`codegraph_impact`** → 영향 범위·호출자 추적
3. **`codegraph_node`** / **`codegraph_explore`** → 소스 내용 확인
4. (보완 시만) `Read` / `Grep` / `Glob`

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## 디버깅 모드 분기 (버그·장애 조사 시)

버그/장애 원인 조사로 진입했을 때, 증상에 패치를 덧대기 전에 **루트 원인**을 먼저 확정한다:

1. **조사(Investigate)** — codegraph로 증상 발생 지점·관련 심볼·호출 경로 수집 (추측 금지, 사실만)
2. **패턴(Pattern)** — 재현 조건·공통 인자·경계값을 찾아 증상을 좁힌다
3. **가설(Hypothesis)** — 단일 루트 원인 가설 수립 + 그것을 검증할 관찰(로그·테스트) 정의
4. **구현 인계(Handoff)** — 확정된 루트 원인을 PLAN으로 넘긴다 (RESEARCH는 수정하지 않음)

- **3회 수정 실패 규칙**: 같은 증상에 3회 패치가 실패하면 국소 버그가 아니다 — 아키텍처 문제로 에스컬레이션한다.
- **규모 게이팅**: 소형 버그(단일 파일·1곳, 플랜 파일 없음)는 [[작업_규모별_워크플로]] 기준 4단계를 면제하고 직접 수정으로 진행한다. 4단계 강제는 중·대형(멀티파일·재현 어려움)에 한정.

## RESEARCH Mode Rules

- ✅ codegraph_* (FIRST — 모든 파일 Read 이전)
- ✅ Read, Glob, Grep, WebSearch, WebFetch (codegraph 후 보완용)
- ✅ Use manage/dictionary.md § 1 for navigation
- ❌ Modify any files
- ❌ Make suggestions or recommendations
- ❌ Plan implementation steps
- ❌ bash find/grep -r/ls -r/rg/fd (Sonar Protocol)

## Every Response Must Begin With

```
[MODE: RESEARCH]
```
