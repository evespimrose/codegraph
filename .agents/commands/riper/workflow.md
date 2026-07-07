---
description: Execute full RIPER workflow for a feature
---

# riper:workflow

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

# Full RIPER Workflow

I'll guide you through the complete RIPER workflow for: $ARGUMENTS

## Workflow Phases

### Phase 1: RESEARCH
First, I'll use the research-innovate agent in RESEARCH sub-mode to understand the current state of the codebase and gather all necessary information.

### Phase 2: INNOVATE  
Next, I'll use the research-innovate agent in INNOVATE sub-mode to brainstorm different approaches and explore possibilities.

### Phase 3: PLAN
Then, I'll use the plan-execute agent in PLAN sub-mode to create detailed technical specifications that you can review.

**⚠️ APPROVAL GATE**: I will pause here for your explicit approval before proceeding.

### Phase 4: EXECUTE
Once approved, I'll use the plan-execute agent in EXECUTE sub-mode to implement exactly what was planned.

### Phase 5: REVIEW
Finally, I'll use the review agent to validate the implementation against the plan.

## Codebase Navigation (전 단계 공통 — SONAR PROTOCOL)

모든 단계에서 코드베이스·지식 수집 시:
```
codegraph_context / search → callers / impact → node / explore → (보완) Read/Grep
```
❌ bash find/grep -r/ls -r/rg/fd / codegraph 미사용 후 소스 Read → hook 자동 차단

## Starting Workflow

Let me begin with the RESEARCH phase for: $ARGUMENTS

[The appropriate agent will be invoked based on the current phase]
