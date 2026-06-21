---
description: Recall memories from current branch's memory bank
---

# memory:recall

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

# Recalling from Memory Bank

I'll retrieve memories from the branch-aware memory bank.

## ⚠️ Memory Bank Location Requirements

**CRITICAL PATH POLICY**: 
- Memory-bank MUST be at repository root: Use `git rev-parse --show-toplevel` to find root, then `[ROOT]/.claude/memory-bank/`
- NEVER create package-level memory-banks: `packages/*/.claude/memory-bank/` ❌
- In monorepos: ONE memory-bank at root serves entire project

### Correct vs Incorrect Paths for Recall
✅ **Correct**: `[ROOT]/.claude/memory-bank/main/session.md` (where ROOT = `git rev-parse --show-toplevel`)
❌ **Wrong**: `[ROOT]/packages/react/.claude/memory-bank/main/session.md`
❌ **Wrong**: `packages/react/.claude/memory-bank/main/session.md`

## Current Context
- **Branch**: !`git branch --show-current`
- **Date**: !`date +%Y-%m-%d`

## Git History Since Last Session

Show commits since last memory save:
```bash
last_memory=$(ls -t $(git rev-parse --show-toplevel)/.claude/memory-bank/$(git branch --show-current)/sessions/*.md 2>/dev/null | head -1)
if [ -n "$last_memory" ]; then
    last_date=$(stat -c %y "$last_memory" | cut -d' ' -f1)
    git log -n 10 --oneline --since="$last_date"
fi
```

Show recent changes to memory bank:
```bash
git log -n 5 -p -- .claude/memory-bank/
```

## Search Scope
Looking for memories in: `[ROOT]/.claude/memory-bank/!`git branch --show-current`/` (where ROOT = `git rev-parse --show-toplevel`)

## Search Query
$ARGUMENTS

## Available Memories
!`ls -la $(git rev-parse --show-toplevel)/.claude/memory-bank/$(git branch --show-current)/ 2>/dev/null || echo "No memories found for current branch"`

I'll search for and display relevant memories based on your query, along with git history context since the last session.
