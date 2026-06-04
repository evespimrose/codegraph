---
description: Execute full RIPER workflow for a feature
---

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

## Codebase Navigation (전 단계 공통 — CAVE-MAN PROTOCOL)

모든 단계에서 코드베이스·지식 수집 시:
```
codegraph_context / search → callers / impact → node / explore → (보완) Read/Grep
```
❌ bash find/grep -r/ls -r/rg/fd / codegraph 미사용 후 소스 Read → hook 자동 차단

## Starting Workflow

Let me begin with the RESEARCH phase for: $ARGUMENTS

[The appropriate agent will be invoked based on the current phase]