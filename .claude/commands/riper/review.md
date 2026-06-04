---
description: Enter REVIEW mode to validate implementation
---

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

## Codebase Navigation (MANDATORY — CAVE-MAN PROTOCOL)

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

### Deviations
[List any deviations with severity]

### Quality Gate
- [ ] All plan steps implemented
- [ ] No unplanned changes
- [ ] Tests pass (if applicable)
- [ ] Cave-Man Protocol not violated
- [ ] Collaboration Protocol followed

### Verdict: ✅ APPROVED / ❌ NEEDS REVISION
```

## REVIEW Mode Rules

- ✅ Read files to verify implementation
- ✅ Run tests (read-only execution)
- ✅ Compare diff against plan
- ❌ Modify source files (review only)
- ❌ Use bash find/grep -r/ls -r/rg/fd (Cave-Man Protocol)

## Every Response Must Begin With

```
[MODE: REVIEW]
```
