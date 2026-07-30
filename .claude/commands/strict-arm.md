---
description: Strict Arm(sonnet 내구형 출력 억제 오버레이) 토글 — on / off / status (기본 on)
argument-hint: on | off | status
allowed-tools: Bash, Read
---

<!-- CAVE-MAN-OUTPUT-ARM -->

# /strict-arm — Strict Arm 토글

`.claude/state/strict-arm` (기본 `on`)을 관리한다. `PreToolUse`(매처 없음) 훅 [`strict-arm-reminder.sh`](../hooks/strict-arm-reminder.sh)가 이 플래그를 읽어, ON일 때 도구 호출 N회(기본 10, env `STRICT_ARM_REMINDER_INTERVAL`)마다 output-arm 5개 조항 요약을 강제 재주입한다.

배경: output-arm/subagent-dispatch/codegraph-first는 텍스트 컨벤션 의존도가 높아 sonnet 계열에서 세션이 길어지면 이탈(attention drop)이 잦다. Strict Arm은 그 텍스트 규칙을 훅으로 주기 재주입해 hook-enforced 신뢰도를 높인다. 정책 근거: `docs/try/Try_SelfEvolvingRulePipeline.md`, WIKI [[L1_Hard_Gate_훅체계]] "L1+L3+L5 매 턴 reminder" 참조.

## 수행 (메인 직접 — 서브에이전트 금지)

인자 `$ARGUMENTS`를 소문자·trim 하여:

1. **on | off** → 값을 플래그에 기록: `printf '%s' "<값>" > .claude/state/strict-arm` 후 `Strict Arm: <값>` 출력.
2. **status 또는 빈 값** → `.claude/state/strict-arm`이 있으면 그 값을, 없으면 `on (기본)`을 `현재 상태: <값>`으로 출력.
3. **그 외** → `유효값: on | off | status` 안내(변경 없음).

출력은 1줄 확인만(Output Arm).

## 사용하지 말아야 할 때 (Negative Constraints)

- output-arm 자체의 on/off — `/output-arm` 커맨드.
- 서브에이전트 디스패치 모드 — `/subagent-dispatch` 커맨드(strict-arm은 그 정책을 재주입할 뿐, 별도 게이트를 두지 않음).
