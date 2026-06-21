---
name: "cs"
description: "Translate raw Korean text to structured English Markdown, save as cxt[N].md, copy /doc-context command to clipboard. Invoke when user provides raw instructions to be structured for Claude. (Alias for context-sharer)"
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


# Context Sharer (cs Alias)

**⚠️ DEADLY LEVEL ENFORCEMENT**: Translate raw Korean text to structured English Markdown ONLY. Always include mandatory footer.

## Core Purpose (Explicit)
- **Translate &amp; Structure**: Convert raw Korean text to concise, structured English Markdown
- **Optimize Tokens**: Use clear headers/bullets to minimize token count
- **Footer Mandatory**: Always include the compliance footer

## Workflow (DEADLY ENFORCED)

When the user provides a raw instruction to be structured into a context file:

1.  **Read &amp; Understand**: Fully comprehend the original Korean text
2.  **Generate File**: Create or update the context file in `docs/contextmd/cxt[N].md`.
3.  **Format Content**:
    - Translate Korean to natural English
    - Structure with headers/lists for readability
    - **ALWAYS include the mandatory footer**:
        All work must deadly and strictly follow the rules defined in SKILL.md and CLAUDE.md.
4.  **Clipboard Injection**: Automatically execute the following command to copy the handover command to the clipboard:
    ```powershell
    Set-Clipboard -Value "/doc-context docs\contextmd\cxt[N].md"
    ```
5.  **Notify User**: "복사 완료"

## Core Principles (DEADLY ENFORCEMENT)

- **Clear Translation**: Natural English that preserves 100% original intent
- **Token Efficiency**: Concise structure to minimize Claude's token usage
- **Footer Mandatory (DEADLY)**: NEVER omit the compliance footer
- **Zero Friction**: User only presses Ctrl + V in Claude

## Non-Negotiable Rules

1. ❌ **NEVER DO**: Keep original Korean text
2. ❌ **NEVER DO**: Omit the mandatory footer
3. ✅ **ALWAYS DO**: Translate to structured English
4. ✅ **ALWAYS DO**: Include the compliance footer
5. ✅ **ALWAYS DO**: Copy /doc-context command to clipboard
6. ✅ **ALWAYS DO**: Respond with "복사 완료"
