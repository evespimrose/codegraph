---
name: "doc-context"
description: "Reads and processes context files from docs/contextmd/. Invoke when user requests context from a file or provides a relative path to a .md/.txt file for context."
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
