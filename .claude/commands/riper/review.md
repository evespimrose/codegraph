---
description: Enter REVIEW mode to validate implementation
---

# riper:review

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

# RIPER REVIEW MODE

Activate the review agent to validate the implementation:
$ARGUMENTS

## State Update (MANDATORY)

Write to `.claude/memory-bank/.riper-state`:
```
MODE=REVIEW
TASK=$ARGUMENTS
PLAN_FILE=<keep existing PLAN_FILE value>
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

## Codebase Navigation (MANDATORY — SONAR PROTOCOL)

구현 결과 검증 시 반드시 codegraph를 먼저 사용한다:

1. **`codegraph_impact`** → 변경된 심볼의 실제 파급 범위 확인
2. **`codegraph_callers`** → 예상치 못한 호출자 회귀 점검
3. (보완 시만) `git diff HEAD` / `Read(offset+limit)`

❌ `find` / `grep -r` / `ls -r` / `rg` / `fd` / codegraph 미사용 후 소스 `Read` → hook 자동 차단

## REVIEW Mode Actions

The agent will:
1. Load plan file from `.riper-state` `PLAN_FILE` path
2. Run `codegraph_impact` on changed symbols to verify regression scope
3. Compare implementation against each numbered plan step
4. Run all quality checks
5. Flag any deviations with severity levels (CRITICAL / WARNING / INFO)
6. Generate a comprehensive review report

## Review Report Format

```markdown
## RIPER Review Report

**Plan**: [plan file path]
**Implementation**: [changed files]

### Step-by-Step Verification
| Step | Status | Notes |
|------|--------|-------|
| 1. [step] | ✅ / ❌ | ... |

### 검증 증거 (Verification Evidence)
각 ✅는 *실행한 명령 + 그 핵심 출력 라인*을 근거로 첨부한다.
| 검증 항목 | 실행 명령 | 핵심 출력 |
|-----------|-----------|-----------|
| [무엇] | `[명령]` | `[출력 라인]` |

### Deviations
[List any deviations with severity]

### Quality Gate
- [ ] All plan steps implemented
- [ ] No unplanned changes
- [ ] Tests pass (if applicable)
- [ ] Sonar Protocol not violated
- [ ] Collaboration Protocol followed
- [ ] **각 ✅에 검증 증거(실행 명령 + 출력) 첨부됨** — 미실행 추정("should work" · "아마 통과")으로 완료 선언 금지. 증거 칸이 비면 APPROVED 불가.

### Verdict: ✅ APPROVED / ❌ NEEDS REVISION
```

## REVIEW Mode Rules

- ✅ Read files to verify implementation
- ✅ Run tests (read-only execution)
- ✅ Compare diff against plan
- ❌ Modify source files (review only)
- ❌ Use bash find/grep -r/ls -r/rg/fd (Sonar Protocol)

## Every Response Must Begin With

```
[MODE: REVIEW]
```
