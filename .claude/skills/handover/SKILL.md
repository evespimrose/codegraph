---
name: handover
description: Use when the user invokes /handover to prepare Claude for cross-session continuity on the YourProject project; reads the required docs then responds "숙지 완료". NOT for actual coding/debugging or doc authoring — read-only internalization.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# Handover — YourProject 세션 인수인계 숙지 루틴

## Overview

새 Claude 세션이 YourProject 프로젝트를 끊김 없이 이어받기 위해 필수 문서를 순서대로 읽고 내재화하는 루틴.

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
D:\Projects\YourProject\docs\specs\pathfinding\generic-3tier-setup-prompt.md
```

### Step 2 — Work History & Context
```
D:\Projects\YourProject\docs\work.md
D:\Projects\YourProject\memory\MEMORY.md
```
> `docs\contextmd\` 폴더의 최신 cxt파일 1~2개 (가장 높은 번호 기준)도 추가로 확인

### Step 3 — Explicit Rules
```
D:\Projects\YourProject\SKILL.md
D:\Projects\YourProject\CLAUDE.md
```

### Step 4 — doc-context Workflow
```
D:\Projects\YourProject\docs\distribution\README.md
D:\Projects\YourProject\docs\distribution\context-instruction.md
```

---

## 완료 후 규칙

- 읽은 내용을 요약·출력하지 않는다
- 추가 설명을 붙이지 않는다
- 오직 `숙지 완료` 만 응답한다
- 이후 사용자 지시를 기다린다

## 사용하지 말아야 할 때 (Negative Constraints)

- 실제 코드 구현·디버깅·리팩토링 — 본 스킬은 읽기 전용 내재화(완료=`숙지 완료`).
- 새 문서·플랜 생성 — 작성 금지.
- YourProject이 아닌 프로젝트 — 경로·역할 구조가 YourProject 전용.
