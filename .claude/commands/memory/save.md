---
description: Save context to branch-aware memory bank
---

# memory:save

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

# Saving to Memory Bank

## ⚠️ Memory Bank Location Requirements

**CRITICAL PATH POLICY**: 
- Memory-bank MUST be at repository root: Use `git rev-parse --show-toplevel` to find root, then `[ROOT]/.claude/memory-bank/`
- NEVER create package-level memory-banks: `packages/*/.claude/memory-bank/` ❌
- In monorepos: ONE memory-bank at root serves entire project

### Correct vs Incorrect Paths
✅ **Correct**: `[ROOT]/.claude/memory-bank/main/session.md` (where ROOT = `git rev-parse --show-toplevel`)
❌ **Wrong**: `[ROOT]/packages/react/.claude/memory-bank/main/session.md`
❌ **Wrong**: `packages/react/.claude/memory-bank/main/session.md`

I'll save the following information to the branch-aware memory bank:

## Context Information
- **Date**: !`date +%Y-%m-%d`
- **Time**: !`date +%H:%M:%S`
- **Branch**: !`git branch --show-current`
- **Latest Commit**: !`git log -1 --oneline`
- **Working Directory Status**: !`git status --short`

## Memory Content
$ARGUMENTS

## Storage Location
The memory will be saved to:
1. First run: `git rev-parse --show-toplevel` to get repository root
2. Save to: `[ROOT]/.claude/memory-bank/!`git branch --show-current`/!`date +%Y%m%d`-session.md`

This ensures memories are:
- Branch-specific (won't conflict when switching branches)
- Date-organized (easy to find recent work)
- Persistent across sessions
- Shareable with team (can be committed if desired)
