---
name: "doc-context"
description: "Reads and processes context files from docs/contextmd/. Invoke when user requests context from a file or provides a relative path to a .md/.txt file for context."
---
<!-- HANDOVER-MANAGED -->

# DocContext

This skill enables the agent to read external context files (Markdown or Text) and treat them as high-priority instructions or project context.

## Usage

When the user provides a relative path to a context file (e.g., `/DocContext docs\contextmd\cxt1.md`), the agent should:

1. **Read the File**: Use the `Read` tool to fetch the full content of the specified file.
2. **Ingest Context**: Treat the file's content as authoritative system-level instructions or project-specific history.
3. **Acknowledge**: Briefly summarize the key points read from the file.
4. **Execute**: Proceed with the task while adhering to the newly ingested context.

## Core Principle: Zero Distortion

- **Intent Preservation**: Always maintain 100% of the user's original intent and technical constraints found in the files.
- **Rule Adherence**: Every context file processed must culminate in the mandatory validation:
  > All work must strictly follow the rules defined in SKILL.md and CLAUDE.md.

## Example

**User**: `/DocContext docs\contextmd\cxt1.md`

**Agent**: (Reads file) "I have ingested the context from `cxt1.md`. I will now re-plan the Obstacle Preset implementation focusing on the updated UX rules (WASD rotation, right-click cancel) and ensuring the hierarchy binding policy is followed. All work will follow SKILL.md and CLAUDE.md."
