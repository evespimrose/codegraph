---
name: strict-arm
description: Use when the user invokes /strict-arm on|off|status, or asks about the sonnet-hardened output suppression overlay (default ON). Korean triggers - "strict arm", "sonnet 강제모드". NOT the base output-arm policy itself (use output-arm skill) — this is a periodic hook-enforced reinforcement layer on top of it.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Strict Arm — sonnet 내구형 출력 억제 오버레이 (기본 ON · 토글 가능)

## 정체성

`output-arm`(RULE-9)·`subagent-dispatch`·codegraph-first(RULE-1)는 전부 **텍스트 컨벤션**(SKILL.md·커맨드 헤더)에 의존한다. opus는 이 텍스트 규칙을 세션 전반에 걸쳐 안정적으로 유지하지만, sonnet 계열은 세션이 길어지거나 컴팩션을 지나면 동일 규칙을 쉽게 놓친다(attention drop) — 텍스트만으로는 "탈옥"(장황한 서술 재개·서브에이전트 임의 디스패치·codegraph 생략)이 빈번히 관찰됨.

Strict Arm은 이 3개 정책의 핵심 5개 조항을 **훅으로 주기 재주입**해 텍스트 의존도를 낮춘다. 정책 자체를 새로 만드는 게 아니라, 기존 정책의 **hook-enforced 신뢰도를 sonnet 대역까지 끌어올리는 오버레이**다.

WIKI [[L1_Hard_Gate_훅체계]]의 보장률 표 — "L1만 70% → L1+L3 92% → L1+L3+L5 매 턴 reminder 97%" — 에서 이 훅은 L3/L5 계층의 "매 턴(주기) reminder"에 해당한다.

## 5개 핵심 조항 (재주입 내용)

1. 메인 컨텍스트 타이핑 극최소화 — 서술 없이 도구로 작업
2. 서브에이전트 디스패치 금지 (예외: 사용자 발의 초대형/병렬)
3. 도구 사용은 허용 — Read/Edit/Bash/codegraph_* 등 정상 사용
4. codegraph 도구 우선 사용 (RULE-1과 정합)
5. 완료 시 `XX 완료` 한 줄만 — Auto-Clarity 예외(보안·비가역·모호·반복질문·블로커) 시에만 정상 출력

## 토글 명령

| 명령 | 동작 |
|---|---|
| `/strict-arm on` | `.claude/state/strict-arm` ← `on` |
| `/strict-arm off` | `.claude/state/strict-arm` ← `off` |
| `/strict-arm status` | 현재 상태 출력 |

상태파일: `.claude/state/strict-arm` (기본값 `on` — 파일 부재 시에도 `on`으로 간주, output-arm과 동일 컨벤션).

## 동작 메커니즘 (결정론 · PreToolUse)

`.claude/hooks/strict-arm-reminder.sh` (매처 없음 — 전 도구 호출 대상):

1. state=off면 즉시 침묵 allow(오버헤드 0).
2. state=on이면 `tool-history.log` 누적 라인 수를 카운터로 사용.
3. 누적 수가 `STRICT_ARM_REMINDER_INTERVAL`(기본 10)의 배수일 때만 5개 조항 요약을 `additionalContext`로 주입 — 매 호출 주입은 그 자체로 토큰 낭비이므로 주기화.
4. 항상 `permissionDecision: allow` — 절대 차단하지 않음. 오직 주기적 재주입만 수행.

## OFF일 때

output-arm·subagent-dispatch·codegraph-first 각자의 정책은 그대로 유지(이 오버레이만 비활성) — Strict Arm은 독자 정책이 아니라 기존 3개 정책의 재주입 보조 장치이므로, off라고 그 정책들이 사라지는 게 아니다.

## 절대 금지

- 리마인더 주입을 이유로 output-arm-gate.sh 등 기존 사후 검증 훅을 대체한다고 간주 — Strict Arm은 사전 재주입일 뿐, 사후 검증은 여전히 각 정책의 Stop/PostToolUse 훅 몫.
- interval을 1로 낮춰 매 호출 주입 — 토큰 비용이 절감 목적과 상충(cxt11 다이어트 참조).

## 사용하지 말아야 할 때 (Negative Constraints)

- output-arm 자체의 정의·on/off — `output-arm` 스킬.
- 서브에이전트 디스패치 3-모드 게이트 자체 — `subagent-dispatch` 스킬.
- codegraph 우선 규칙 자체(RULE-1/Sonar) — `codegraph-gate.sh`(L1 하드 게이트, 이 오버레이는 그 규칙을 강제하지 않고 재주입만 함).
