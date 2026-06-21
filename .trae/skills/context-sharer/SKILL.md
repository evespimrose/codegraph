---
name: "context-sharer"
description: "Translate raw Korean text to structured English Markdown, save as cxt[N].md with mandatory BLK tag on line 2, validate with validate-cxt.ps1, copy /doc-context command to clipboard. Invoke when user provides raw instructions to be structured for Claude."
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

# Context Sharer

**⚠️ DEADLY LEVEL ENFORCEMENT**: Translate raw Korean text to structured English Markdown ONLY. Always include BLK tag on line 2 and mandatory footer.

## Core Purpose (Explicit)
- **Translate & Structure**: Convert raw Korean text to concise, structured English Markdown
- **BLK Tag (DEADLY)**: Every cxt file MUST have `<!-- BLK: BLK-XXX -->` on line 2
- **Optimize Tokens**: Use clear headers/bullets to minimize token count
- **Footer Mandatory**: Always include the compliance footer

## BLK 태그 추정 규칙

cxt 파일 저장 전, 원문 키워드로 BLK를 특정한다:

1. 원문의 핵심 작업 키워드 추출 (예: "pathfinding", "GPU renderer", "UI", "hook")
2. `manage/dictionary.md § 3 키워드 인덱스`에서 해당 키워드 매칭 → BLK 코드 확인
3. 매칭 BLK → `<!-- BLK: BLK-XXX -->` 태그 구성
4. 코드 대상 없는 인프라 작업(hook, skill, 문서화) → `<!-- BLK: 인프라 -->`
5. 여러 BLK 대상 → `<!-- BLK: BLK-001, BLK-002 -->`

## Workflow (DEADLY ENFORCED)

When the user provides a raw instruction to be structured into a context file:

1. **Read & Understand**: Fully comprehend the original Korean text
2. **BLK 특정**: 위 "BLK 태그 추정 규칙"에 따라 BLK 코드 결정
3. **Generate File**: Create or update `docs/contextmd/cxt[N].md` with this exact structure:
   ```markdown
   # [제목]
   <!-- BLK: BLK-XXX -->
   <!-- SONAR-REMINDER: codegraph 우선 (codegraph_context → search → node). find/grep -r/ls -r/rg/fd/cat .cs 자동 차단됨 -->

   ## Task
   ...
   ```
   **⚠️ 1행: 제목, 2행: BLK 태그, 3행: SONAR-REMINDER — 이 순서 절대 변경 금지**
   **⚠️ SONAR-REMINDER (3행)는 Claude L5 외부 이전 결과 — 모든 cxt에 의무 포함**
4. **Format Content**:
   - Translate Korean to natural English
   - Structure with headers/lists for readability
   - **ALWAYS include the mandatory footer**:
       All work must deadly and strictly follow the rules defined in SKILL.md and CLAUDE.md.
5. **Validate**: Run BLK tag validation:
   ```powershell
   & .trae\hooks\validate-cxt.ps1 "docs\contextmd\cxt[N].md"
   ```
   - exit 0 → 다음 단계 진행
   - exit 1 → "BLK 태그 오류 — 2행 수정 후 재검증" 출력, 클립보드 복사 중단
6. **Clipboard Injection** (검증 통과 시에만):
   ```powershell
   Set-Clipboard -Value "/doc-context docs\contextmd\cxt[N].md"
   ```
7. **Notify User**: "복사 완료 (BLK: [태그값])"

## Core Principles (DEADLY ENFORCEMENT)

- **BLK Tag Line 2 (DEADLY)**: 2행은 반드시 `<!-- BLK: BLK-XXX -->`. 없으면 파일 생성 중단
- **Clear Translation**: Natural English that preserves 100% original intent
- **Token Efficiency**: Concise structure to minimize Claude's token usage
- **Footer Mandatory (DEADLY)**: NEVER omit the compliance footer
- **Zero Friction**: User only presses Ctrl + V in Claude

## Non-Negotiable Rules

1. ❌ **NEVER DO**: Keep original Korean text
2. ❌ **NEVER DO**: Omit the mandatory footer
3. ❌ **NEVER DO**: Save cxt file without BLK tag on line 2
4. ❌ **NEVER DO**: Save cxt file without SONAR-REMINDER on line 3
5. ❌ **NEVER DO**: Copy to clipboard before validate-cxt.ps1 passes (exit 0)
6. ✅ **ALWAYS DO**: Determine BLK from dictionary.md § 3 before writing file
7. ✅ **ALWAYS DO**: Translate to structured English
8. ✅ **ALWAYS DO**: Include the compliance footer
9. ✅ **ALWAYS DO**: Include SONAR-REMINDER on line 3 (L5 외부 이전 책임)
10. ✅ **ALWAYS DO**: Run validate-cxt.ps1 after file creation
11. ✅ **ALWAYS DO**: Copy /doc-context command to clipboard only after validation passes
12. ✅ **ALWAYS DO**: Respond with "복사 완료 (BLK: [태그값])"
