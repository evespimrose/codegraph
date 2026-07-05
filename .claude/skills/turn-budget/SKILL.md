---
name: turn-budget
description: Use when the user invokes /turn-budget <N>|off|status|<N>:block, or asks to set/limit/check the per-session turn (tool-call) budget — "턴 예산", "도구 호출 제한", "턴버짓", "턴 제한". NOT for precise token measurement or output suppression (use output-arm) — turn-count proxy only.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# turn-budget — 세션 턴/예산 강제 (CRG2강제)

## 정체성

토큰 비용의 **턴 축**. RULE-9(Output Arm)가 *출력 표현*을, RULE-1(Sonar)이 *입력 접근*을 통제한다면,
turn-budget은 한 세션의 **도구 호출 수(턴)** 를 통제한다. 같은 작업을 더 적은 턴으로 끝낼수록
누적 컨텍스트가 작아져 비용·지연이 함께 준다(CodeGraph 벤치마크가 입증한 "더 적은 턴 = 더 적은 비용"의 강제판).

- **턴 수 = 결정론적 프록시.** 토큰 정밀 측정은 훅 환경에서 비결정·비용↑ → **본 게이트는 채택하지 않는다**(미결, §미결1·2).
  세션 도구 호출 수만 센다(`.claude/state/tool-history.log`, session-start가 세션마다 초기화 → 라인 수 = 금세션 턴).

## 토글 / 설정 명령

상태파일: `.claude/state/turn-budget` (기본값 `off`).

| 명령 | `.claude/state/turn-budget` 값 | 동작 |
|------|------|------|
| `/turn-budget off` | `off` | 게이트 비활성 (기본) — 침묵 통과 |
| `/turn-budget <N>` | `<N>` (예 `50`) | N턴 도달/초과 시 **경고만** (차단 아님) |
| `/turn-budget <N>:block` | `<N>:block` | N턴 도달/초과 시 PreToolUse **차단(ask)** — 옵트인 |
| `/turn-budget status` | (읽기) | 현재 설정값 + 금세션 턴 수 출력 |

`status` 구현(턴 수 즉석 집계):
```bash
echo "config: $(cat .claude/state/turn-budget 2>/dev/null || echo off)"
echo "turns : $(grep -vE '^[[:space:]]*(#|$)' .claude/state/tool-history.log 2>/dev/null | wc -l | tr -d '[:space:]')"
```

## 정책 — 기본 경고, 차단은 옵트인

- **기본은 경고**(`<N>`): try 문서 §2 — "예산 강제는 저살리언스 벽"이라 강한 차단은 마찰만 키운다.
  경고는 에이전트/사용자에게 "작업을 쪼개라"는 신호를 주되 흐름을 끊지 않는다(output-arm-gate 선례).
- **차단은 옵트인**(`<N>:block`): 정말 하드 상한이 필요할 때만. 차단 시 `ask`로 떠서 사용자가 승인하면 계속.
- 두 진입점에서 발화:
  - **PreToolUse**(턴 누적 시점): 임계 도달 시 경고 1회 또는 ask.
  - **Stop**(세션 종료): 총 턴이 예산 초과면 사후 요약 경고(다음 세션 분할 권고). 항상 exit 0.

## 임계값(LIMIT) 가이드

- 기본값은 **off** — 사용자 운영 패턴에 의존하므로 임의 발명하지 않는다(§미결1).
- 켤 때 권장 출발점: 중간 작업 ~50, 대형 ~100. 자주 경고가 뜨면 작업을 RIPER 플랜으로 쪼개거나
  서브에이전트에 위임(메인 턴 절약)한다.

## 게이트 구현

`.claude/hooks/turn-budget-gate.sh` (PreToolUse no-matcher + Stop, settings.json 등록).
- `off`/빈값/설정오류 → **침묵 통과**(안전 기본).
- 카운트는 주석(`#`)·빈줄 제외. session-start의 history 초기화에 의존해 **금세션 한정**.

## 절대 금지

- 사용자 동의 없이 `:block`을 기본으로 켜기(흐름 차단은 옵트인이어야 함).
- 토큰 정밀 측정을 이 게이트에 끼워넣기(비결정·비용↑ — 본 PLAN 비-목표, §미결2).
- 턴 카운트를 이전 세션까지 누적하기(session-start 초기화 전제를 깨면 금세션 의미 상실).

## 사용하지 말아야 할 때 (Negative Constraints)

- 정밀 토큰 측정 — 턴 수는 *프록시*(토큰 측정은 비-목표).
- 출력 표현 압축 — `output-arm`.
- 입력 접근 통제 — RULE-1/Sonar.
- `:block`을 사용자 동의 없이 기본화 — 흐름 차단은 옵트인.
