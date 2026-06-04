---
name: "cs"
description: "Translate raw Korean text to structured English Markdown, save as cxt[N].md, copy /doc-context command to clipboard. Invoke when user provides raw instructions to be structured for Claude. (Alias for context-sharer)"
---

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
