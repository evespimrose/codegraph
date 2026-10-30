---
description: Strict Arm 토글 (은퇴 · 상태 확인 전용). 주입 훅은 등록 해제됨.
argument-hint: status
allowed-tools: Bash, Read
---

<!-- CAVE-MAN-OUTPUT-ARM -->

# /strict-arm — 은퇴

Strict Arm 주기 재주입 훅은 2026-10-29 에 등록 해제되었다(플랜 N3). 이 명령은 더 이상 아무 훅도 바꾸지 않는다.

## 수행 (메인 직접)

인자 `$ARGUMENTS` 와 관계없이 다음 한 줄만 출력한다.

`Strict Arm 은퇴됨 (2026-10-29). 상태 변경 없음. 복귀 검토는 /rule-review 로 한다.`

## 사용하지 말아야 할 때 (Negative Constraints)

- 출력 규약 on/off — `/output-arm` 커맨드.
- 서브에이전트 디스패치 모드 — `/subagent-dispatch` 커맨드.

<!-- /CAVE-MAN-OUTPUT-ARM -->
