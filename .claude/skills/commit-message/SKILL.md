---
name: commit-message
description: Use when the user asks Claude to draft or generate a git commit message, or invokes /commit-message — analyzes changed content and writes a commit message following this project's Korean COMMIT_CONVENTION.md format (`말머리: 커밋메시지`). Presents the draft for review; does NOT run `git commit` on its own — actual commit execution requires the user's separate explicit approval after reviewing the draft. Korean triggers — "커밋 메시지 만들어줘", "커밋 메시지 생성", "커밋 양식대로", "/commit-message".
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# commit-message — 커밋 메시지 생성기 (커밋 실행 금지)

이 스킬은 **커밋 메시지 텍스트만 작성**한다. `git commit` 실행은 스킬의 책임 밖 — 사용자가 초안을 검토한 뒤 별도로 명시 승인해야 실제 커밋이 실행된다. 승인 없이 임의로 커밋하지 않는다.

## 정본 규약

[`D:\Unity\KIT\rules\conventions\COMMIT_CONVENTION.md`](D:/Unity/KIT/rules/conventions/COMMIT_CONVENTION.md) — 이미 전역 규칙으로 매 세션 주입되지만, 이 스킬은 그 규약을 **명시 트리거**로 강제 적용하는 진입점이다. 규약이 바뀌면 이 스킬이 아니라 원본 파일을 고칠 것(사본 금지).

## 절차

### 1. 변경 확인
- `git status` + `git diff`로 실제 변경 내용을 파악한다. staged가 있으면 staged 기준, 없으면 unstaged를 본다.
- staged가 비어 있고 unstaged만 있으면, 무엇을 스테이징할지 사용자에게 먼저 확인한다(임의 `git add` 금지 — 민감 파일 혼입 위험).

### 2. 말머리 분류

변경 성격에 따라 6종 중 하나를 고른다:

| 말머리 | 조건 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `secure` | 보안 패치 |
| `chore` | 기타(설정·잡무) |
| `docs` | 문서 파일만 변경 |
| `refactor` | 리팩토링(동작 불변) |

코드 변경에 문서 수정이 딸려오면 코드 쪽 말머리를 따른다(`docs`는 문서 전용 커밋에만).

### 3. 메시지 작성

- 형식: `말머리: 커밋메시지` — 말머리 소문자, 콜론 뒤 공백 한 칸. 대괄호 `[type]` 형식 아님.
- 명령형 현재시제("add" not "added"), 끝에 마침표 없음, 50자 이내 권장, 평범한 한국어(불필요한 외래어 지양).
- **기본은 subject 한 줄.** Body는 예외적으로만(breaking change, 또는 코드+제목만으론 알 수 없는 비자명한 제약) 1~2줄, **음슴체**(`~임`/`~함`/`~됨`) — diff 재설명·작업 과정 서술·미사여구 금지.
- Footer는 이슈를 닫거나 연결할 때만: `Fixes #123` / `Closes #456` / `Related to #789`.
- **절대 금지**: `Generated with [Claude Code]`, `Co-Authored-By: Claude <noreply@anthropic.com>` 등 어시스턴트 귀속 문구.

### 4. 제시 및 대기

초안을 그대로 보여주고 커밋 실행 여부를 묻는다. 다음 중 하나가 오기 전엔 `git commit`을 호출하지 않는다:
- 명시 승인("커밋해줘", "진행", "이걸로 커밋")
- 수정 요청 → 반영 후 다시 3으로

## 검증 체크리스트 (제시 전 자가검증)

- [ ] 말머리가 6종(`fix|feat|refactor|secure|chore|docs`) 중 하나인가
- [ ] `말머리: 메시지` 형식(대괄호 아님)이고 subject가 50자 이내·마침표 없음·명령형인가
- [ ] body를 달았다면 음슴체이고 비자명한 제약에 한정했는가
- [ ] Claude/Anthropic 귀속 문구가 전혀 없는가
- [ ] 커밋을 실제로 실행하지 않고 초안만 제시했는가

## 사용하지 말아야 할 때 (Negative Constraints)

- 사용자가 이미 완성된 커밋 메시지를 불러주며 "이걸로 커밋해"라고 한 경우 — 이 스킬 없이 바로 진행(재작성 불필요).
- PR 본문·릴리스 노트 작성 — 별도 범위.
- 실제 커밋 실행 그 자체 — 사용자 승인 후에도 이 스킬이 아니라 일반 git 커밋 절차(`git add`+`git commit`)를 따른다. 이 스킬은 메시지 작성까지만 책임진다.
