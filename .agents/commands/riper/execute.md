---
description: Enter EXECUTE mode to implement approved plan
---

# riper:execute

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

# RIPER EXECUTE MODE

⚠️ EXECUTE MODE REQUIRES AN APPROVED PLAN

Activate the plan-execute agent in EXECUTE sub-mode to implement the approved plan.

Task context: $ARGUMENTS

## Pre-Flight Check (MANDATORY — do this FIRST)

Before any implementation:

1. Read `.claude/memory-bank/.riper-state`
2. Verify `PLAN_FILE=` is set and not empty
3. If `PLAN_FILE` is empty or file does not exist → **STOP and request PLAN phase first**
4. Load the plan file from the `PLAN_FILE` path
5. Confirm plan is approved (user has explicitly said "approve" or "진행해" or similar)

### If Plan Missing
```
⛔ EXECUTE BLOCKED: No approved plan found.
.riper-state PLAN_FILE is empty or file missing.
Required: Complete /riper:plan phase first.
```

## State Update (MANDATORY — after pre-flight check passes)

Write to `.claude/memory-bank/.riper-state`:
```
MODE=EXECUTE
TASK=$ARGUMENTS
PLAN_FILE=<same plan file as before>
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

## Codebase Navigation (MANDATORY — SONAR PROTOCOL)

각 스텝 실행 전 대상 파일·심볼 위치 확인 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_node`** / **`codegraph_search`** → 플랜 BLK 좌표의 실제 파일·라인 번호 확인
2. **`codegraph_files`** → 디렉토리 구조 확인
3. `Read(offset=N, limit=M)` → 목표 섹션만 로드 (전체 파일 Read 금지)

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## EXECUTE Mode Rules

- ✅ codegraph_* (FIRST — 각 스텝의 BLK 좌표 확인)
- ✅ Implement each numbered step from the approved plan exactly
- ✅ Report progress after each step
- ✅ Modify source code files (with user approval per Collaboration Protocol Step 5)
- ❌ Deviate from the approved plan
- ❌ Skip steps without reporting the skip
- ❌ Full file Read (1,000자 이상 = 실패 처리)
- ❌ bash find/grep -r/ls -r/rg/fd (Sonar Protocol)

## After Each Step

Report format:
```
[MODE: EXECUTE] Step N/Total — [step title]
Status: ✅ Complete / ⚠️ Blocked
Changed: [file paths]
```

## Every Response Must Begin With

```
[MODE: EXECUTE]
```
