---
name: strict-arm
description: RETIRED (2026-10-29). Strict Arm 주기 재주입 훅은 등록 해제됨. 필요하면 /rule-review 로 복귀를 검토. Do not invoke for new work.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(답 먼저 · 증거는 Review Pack 링크 · 사람 확인 항목 · codegraph-first · 서브에이전트·Workflow 게이트 승인 · Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-8.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Strict Arm — 은퇴 (2026-10-29)

## 상태

- 주기 재주입 훅 `strict-arm-reminder.sh` 는 `.claude/settings.json` 에서 등록 해제한다(N3, 2026-10-29 플랜).
- 이 스킬은 더 이상 아무것도 주입하지 않는다.
- 서브에이전트 제한은 문구 재주입이 아니라 게이트 훅 `subagent-dispatch-gate.sh` 로만 강제한다(훅 > 프롬프트).

## 은퇴 이유

- 한 번 훅으로 주입해도 모델이 규칙을 따랐는지 확인하지 못했다. 같은 규칙이 CLAUDE.md, 출력 규약 헤더, 훅에 중복되어 컨텍스트만 늘렸다.
- 제한 문구의 중복을 줄이고, 강제가 필요한 항목은 게이트 훅에 둔다.

## 복귀 조건

모델이 게이트 훅으로 막을 수 없는 규칙을 반복해서 어길 때만 복귀를 검토한다. 그 경우 `/rule-review` 에서 후보로 올린 뒤 사용자가 승인한다.

## 관련 정책

- 출력 규약: `output-arm` 스킬 (CLAUDE.md RULE-8)
- 위임 게이트: `/subagent-dispatch` (CLAUDE.md RULE-9)
