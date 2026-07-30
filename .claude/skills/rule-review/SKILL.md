---
name: rule-review
description: Use when the user invokes /rule-review, or when SessionStart reports pending rule/relaxation candidates ("[rule-candidates] N건 대기"). Presents each candidate from rule-candidates.log / relaxation-candidates.log for approval, then routes approved items to a materialization destination (hook > rules-md > skill). Korean triggers - "룰 후보 검토", "규칙 승격". NOT for auto-promoting candidates without asking, and NOT for editing CLAUDE.md/RULES.md directly without going through this gate.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Rule Review — 룰 후보 승인 게이트

`violation-pattern-digest.sh`(A1)가 집계한 룰 후보를 사람이 검토·승인하는 유일한 통로. **자동 승격 없음** — 이 스킬의 AskUserQuestion을 거치지 않은 후보는 훅/규칙으로 실체화되지 않는다.

근거: WIKI [[Instinct_기반_학습_파이프라인]] "채택 시 최소 형태", [[맥락_오염_방지]] "3대 안전장치 — 저장 게이트", `docs/try/Try_SelfEvolvingRulePipeline.md`.

## 입력

| 로그 | 의미 | 처리 방향 |
|---|---|---|
| `.claude/state/rule-candidates.log` | 강화 후보 — 반복 위반(순수 차단) | 규칙/훅 강화 검토 |
| `.claude/state/relaxation-candidates.log` | 완화 후보 — 반복 `override-used`(사용자가 계속 우회 승인) | 규칙이 과잉인지 검토, 화이트리스트 완화 검토 |

두 로그 모두 `pattern | count=N | first_seen=DATE | status=candidate` 형식. `status=candidate`인 줄만 검토 대상.

## 절차

1. **수집**: 두 로그를 Read. `status=candidate` 줄만 추출.
2. 후보가 0건이면 "검토할 룰 후보 없음" 1줄만 출력하고 종료.
3. **제시**: 후보를 AskUserQuestion으로 제시 — 후보 1건당 1문항(다건이면 최대 4문항/콜, 초과분은 다음 콜). 옵션: `승인` / `기각` / `보류`. 강화 후보는 "차단 규칙 강화", 완화 후보는 "화이트리스트 완화"로 프레이밍.
4. **승인 시 목적지 결정**: 다음 우선순위로 자동 결정(추가 질문 없음, `Try_SelfEvolvingRulePipeline.md` §3-B 근거 — 훅=런타임 토큰 0, md=상주 비용 발생):
   - 1순위: 기존 훅에 패턴 1줄 추가로 흡수 가능하면 그 훅에 Edit.
   - 2순위: 기존 훅으로 흡수 불가하면 `.claude/rules/*.md`에 1줄 추가(md 규칙 예산: 자가학습 유래 줄 수 총 20줄 캡 — 초과 시 사용자에게 캡 초과를 알리고 재확인).
   - 3순위: 위 둘 다 부적합하면(행동 패턴이 아니라 지식/맥락 문제) 관련 스킬의 Negative Constraints에 1줄 추가.
   - 완화 후보 승인 시: 해당 훅의 화이트리스트 패턴에 예외 추가(예: `codegraph-gate.sh`의 `WHITELIST_PATTERN`).
5. **실체화**: 결정된 목적지 파일을 Edit. 변경 후 `bash -n`(셸) 또는 `python3 -c "import ast; ast.parse(open(f).read())"`(파이썬 임베드) 등으로 구문 검증.
6. **로그 갱신**: `python3 .claude/skills/rule-review/scripts/mark_status.py <로그파일> "<pattern>" materialized --dest <파일:라인>` 실행. 기각 시 `rejected --reason <사유>`, 보류 시 아무 것도 안 함(status=candidate 유지, 다음 리뷰 때 재제시). **pattern 문자열이 Sonar Protocol 트리거 어휘(`grep -r`, `ls -r` 등)를 포함해 CLI 인자로 직접 넘기면 sonar-guard.sh가 오탐 차단하는 경우**: 임시 JSON 파일에 `[{"log":..., "pattern":..., "status":..., "dest"|"reason":...}, ...]`로 적어(Write 도구) `mark_status.py --batch <json파일>`로 일괄 처리 — 다건 결정도 이 경로로 한 번에 반영 가능.
7. **KIT 파급 확인**: 목적지가 `.claude/hooks/`·`.claude/rules/`·`.claude/skills/` 등 sync 대상 경로이면, 전역 승격(다른 프로젝트로 sync)은 이 스킬의 범위 밖 — sync 스킬로 별도 발의하라고 1줄 안내만 하고 자동 실행하지 않음.
8. 전 항목 처리 후 `N건 승인·M건 기각·K건 보류 — 완료` 한 줄만 출력.

## 효과 검증 (재발 대조)

`violation-pattern-digest.sh`가 다음 세션에서 동일 패턴을 다시 만나면(이미 `materialized`라 dedup에 걸려 재후보화는 안 되지만), 원본 패턴이 `violation-count.log`에 실체화 이후에도 계속 쌓이는지는 이 스킬 호출 시 다음을 1회 확인:
- `materialized` 상태 항목의 pattern 문자열이 `violation-count.log`의 실체화 시점(`decided` 날짜) 이후 라인에도 등장하면 → `recurring`으로 재마킹 + "재발: 훅 매처 누락 가능성" 1줄 보고.
- 등장하지 않으면 → `verified`로 재마킹(침묵, 별도 보고 없음).

## 절대 금지

- 사용자 승인(AskUserQuestion 응답) 없이 CLAUDE.md/RULES.md/훅 파일을 수정
- `status=candidate`가 아닌 항목(이미 처리됨)을 재질문
- 완화 후보를 강화 후보와 같은 문항으로 뭉뚱그려 제시(반대 방향 신호이므로 프레이밍 구분 필수)
- md 규칙 예산 캡(20줄) 초과를 조용히 진행

## 사용하지 말아야 할 때 (Negative Constraints)

- 후보가 이미 없는데 주기적으로 자가발화 — 이 스킬은 사용자 호출 또는 SessionStart 알림 후에만 진입.
- 위반 로그 자체의 집계 로직 변경 — `violation-pattern-digest.sh` 직접 수정 대상(이 스킬은 소비자일 뿐).
- 전역(다른 프로젝트) 동기화 실행 — `sync` 스킬의 역할.
