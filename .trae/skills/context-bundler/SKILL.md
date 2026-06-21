---
name: "context-bundler"
description: "Bundle multiple cxt[N].md files into a single archive file with numbering headers. Zero Distortion, Zero Omission deadly enforcement. Supports simple request format: 'Use Skill: context-bundler X ~ Y'."
---

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (Cave-Man Output Arm · 전 스킬 공통)

- **메인 컨텍스트 타이핑 금지** — 과정 narration·중간 요약·"이제 ~하겠습니다" 출력 안 함
- **도구 사용 허용** — codegraph→(보완)Read/Edit 등으로 메인이 직접 작업 (hook 통제下)
- **서브에이전트 디스패치 금지** — Agent/Task 호출 안 함 (콜드스타트 토큰세금 ~100배). 예외: 초대형 규모·병렬 독립 작업을 **사용자가 발의**한 경우만
- **완료 보고만 허용** — 끝에 `XX 완료` 1~2단어 간단 보고만 타이핑
- **Auto-Clarity 예외** — 보안·비가역·모호 다단계·반복질문·하드블로커 → 정상 출력 (correctness > brevity)

정책: [[main-context-zero-delegation]] · `/output-arm` · CLAUDE.md RULE-9
<!-- /CAVE-MAN-OUTPUT-ARM -->

<!-- HANDOVER-MANAGED -->

# Context Bundler

**⚠️ DEADLY LEVEL ENFORCEMENT**: Bundle cxt files with numbering ONLY. No interpretation, no modification, no rewriting. No omission, no distortion of a single character.

## Core Purpose
- Combine multiple cxt[N].md files into one archive
- Add `--- cxtN.md ---` headers before each file
- No changes to original content

## Request Format Recognition

**Two formats recognized:**

### Format 1: Explicit request
- "Bundle cxt1.md to cxt41.md into cxt0000141.md with numbering headers."
- "cxt42.md부터 cxt68.md까지 cxt0004268.md로 넘버링 헤더와 함께 묶어줘."

### Format 2: Simple skill request
- "Use Skill: context-bundler 1 ~ 41"
  - Bundle cxt1.md to cxt41.md
  - Output: cxt0000141.md
- "Use Skill: context-bundler 42 ~ 68"
  - Bundle cxt42.md to cxt68.md
  - Output: cxt0004268.md

**Output filename rule:**
- Range X ~ Y → `cxt` + (X padded to 4 digits) + (Y padded to 2 digits) + `.md`
- Example: 1 ~ 41 → cxt0000141.md
- Example: 42 ~ 68 → cxt0004268.md

## Workflow

1.  **PARSE REQUEST**: Extract X, Y, output filename
2.  **DOUBLE CHECK 1**: Read ALL cxtX.md to cxtY.md, confirm order
3.  **GENERATE FILE**: Create output file
4.  **FORMAT CONTENT**:
    - For each file in order:
      1. Add `--- cxtN.md ---` header
      2. Add entire file content (no changes)
    - Add mandatory footer at end:
        &gt; All work must strictly follow the rules defined in SKILL.md and CLAUDE.md.
5.  **DOUBLE CHECK 2**: Compare line by line, verify no missing/changed characters
6.  **NOTIFY USER**: "1~41 동작 수행 완료. cxt0000141.md 생성됨."

## Core Principles

- **Zero Distortion**: 100% original intent preserved. No character distorted.
- **Zero Omission**: No character omitted. All content included.
- **Double Check Mandatory**: Verify before and after.

## Non-Negotiable Rules

1. ❌ Never: Summarize, rewrite, interpret
2. ❌ Never: Omit any content
3. ❌ Never: Change any word/sentence
4. ✅ Always: Recognize "Use Skill: context-bundler X ~ Y"
5. ✅ Always: Generate filename with padding rule
6. ✅ Always: Add `--- cxtN.md ---` headers
7. ✅ Always: Transfer all content without changes
8. ✅ Always: Compare before and after

## Examples

### Example 1: Simple skill request
**User**: "Use Skill: context-bundler 1 ~ 41"

**Agent**:
1. Parse: X=1, Y=41 → output cxt0000141.md
2. Read all cxt1.md to cxt41.md
3. Create cxt0000141.md with headers + content
4. Compare line by line
5. "1~41 동작 수행 완료. cxt0000141.md 생성됨."

### Example 2: Simple skill request (another range)
**User**: "Use Skill: context-bundler 42 ~ 68"

**Agent**:
1. Parse: X=42, Y=68 → output cxt0004268.md
2. Read all cxt42.md to cxt68.md
3. Create cxt0004268.md with headers + content
4. Compare line by line
5. "42~68 동작 수행 완료. cxt0004268.md 생성됨."

All work must strictly follow the rules defined in SKILL.md and CLAUDE.md.
