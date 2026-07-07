---
description: 서브에이전트(Task/Agent) 디스패치 모드 토글 — auto / manual / off (기본 manual)
argument-hint: auto | manual | off | status
allowed-tools: Bash, Read
---

<!-- CAVE-MAN-OUTPUT-ARM -->

# /subagent-dispatch — 서브에이전트 디스패치 모드 제어

서브에이전트 디스패치 정책 플래그를 `.claude/state/subagent-dispatch` 로 관리한다.
PreToolUse:Task 훅 [`subagent-dispatch-gate.sh`](../hooks/subagent-dispatch-gate.sh) 가 이 플래그를 읽어 강제한다.

| 모드 | 게이트 동작 |
|------|------------|
| `auto` | 디스패치 침묵 허용 (allow) |
| `manual` | 디스패치 전 사용자 승인 요구 (ask) — **기본값** |
| `off` | 디스패치 차단 (deny) — 메인이 codegraph→Read/Edit 직접 처리 |

배경: 서브에이전트 콜드스타트 토큰 세금(소형 작업 시 메인 대비 ~100배). 정책 [[main-context-zero-delegation]] · CLAUDE.md RULE-9.

## 수행 (메인 직접 — 서브에이전트 금지)

인자 `$ARGUMENTS` 를 소문자·trim 하여:

1. **auto | manual | off** → 그 값을 플래그에 기록하고 1줄 확인:
   `printf '%s' "<값>" > .claude/state/subagent-dispatch` 후 `서브에이전트 디스패치: <값>` 출력.
2. **status 또는 빈 값** → 현재 플래그 읽어 보고:
   `.claude/state/subagent-dispatch` 가 있으면 그 값을, 없으면 `manual (기본)` 을 `현재 모드: <값>` 으로 출력.
3. **그 외(무효값)** → `유효값: auto | manual | off | status` 안내(플래그 변경 없음).

출력은 1줄 확인만(Output Arm).
