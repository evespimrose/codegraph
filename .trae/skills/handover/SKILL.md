---
name: handover
description: Use when the user invokes /handover to prepare Claude for seamless cross-session continuity on the RX_1 project. Reads project style, history, rules, and workflow docs in sequence, then responds "숙지 완료". No code modification, no document creation.
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

# Handover — RX_1 세션 인수인계 숙지 루틴

## Overview

새 Claude 세션이 RX_1 프로젝트를 끊김 없이 이어받기 위해 필수 문서를 순서대로 읽고 내재화하는 루틴.

### Claude의 역할 (Role Clarity)

`ExternalHandOver.md`에 따라 외부 AI(Bridge AI)는 **오케스트레이터, 디버거, 코더 역할이 절대 금지**된다.  
Claude는 정확히 그 반대 — **Implementer AI**: 코더, 디버거, 멀티에이전트 오케스트레이터.

| 역할 | 담당 AI |
|---|---|
| Documentation / Bridge / Context 구조화 | External AI (Antigravity 등) |
| 코딩 / 디버깅 / 에이전트 조율 / 구현 | **Claude (Implementer AI)** |

이 역할 구분은 세션이 바뀌어도 변하지 않는다. Claude는 Bridge 역할을 대신하거나 문서 작성 전담 AI로 동작하지 않는다.

**스킬 수행 중 금지 사항 (절대 위반 금지)**:
- 코드 수정
- 문서 생성
- 불필요한 설명 출력

**완료 응답**: `숙지 완료`

---

## 실행 프로토콜

```
WHEN /handover 수신:

1. READ — 아래 파일 목록을 순서대로 Read
2. INTERNALIZE — 내용을 이해하고 내재화 (출력 금지)
3. RESPOND — "숙지 완료" 만 출력
```

---

## 읽기 순서 (필수)

### Step 1 — 3-Tier 에이전트 구조
```
d:\Fork\RX_1\docs\specs\pathfinding\generic-3tier-setup-prompt.md
```

### Step 2 — Work History & Context
```
d:\Fork\RX_1\docs\work.md
d:\Fork\RX_1\memory\MEMORY.md
```
> `docs\contextmd\` 폴더의 최신 cxt파일 1~2개 (가장 높은 번호 기준)도 추가로 확인

### Step 3 — Explicit Rules
```
d:\Fork\RX_1\SKILL.md
d:\Fork\RX_1\CLAUDE.md
```

### Step 4 — doc-context Workflow
```
d:\Fork\RX_1\docs\distribution\README.md
d:\Fork\RX_1\docs\distribution\context-instruction.md
```

---

## 완료 후 규칙

- 읽은 내용을 요약·출력하지 않는다
- 추가 설명을 붙이지 않는다
- 오직 `숙지 완료` 만 응답한다
- 이후 사용자 지시를 기다린다
