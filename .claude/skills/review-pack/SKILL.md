---
name: review-pack
description: Use when a RIPER task reaches REVIEW and needs a Review Pack (auto acceptance results plus a human check list), when a user records a G2 decision (pass or fail) with `confirm`, or when the session start needs the pending confirmation queue. Triggers - "Review Pack", "검수 문서 만들어", "확인 대기 큐", "pack.py", "통과 처리", "일괄 통과", "acceptance". Not for writing a free-form review by hand, not for running tests that are not in the plan's acceptance block, and not for PR review.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Review Pack — 결과물 확인 CLI

플랜의 `acceptance` 블록을 CLI 가 실행해 판정한다. 모델은 PASS 를 정하지 않는다. 사람 몫인 항목은 확인 목록이 된다. 결과는 `<slug>-review.md`(Review Pack)에 담긴다.

## 명령

| 명령 | 동작 |
|---|---|
| `pack.py build <slug> [--base <commit>] [--card-note "<text>"]` | 자동 기준을 실행하고 Review Pack 을 쓴다. 확인 기록 절은 보존한다 |
| `pack.py confirm <slug> pass\|fail [--note "<text>"] [--force]` | 한 Pack 의 판정과 확인 기록을 바꾼다 |
| `pack.py confirm --all pass\|fail [--note "<text>"]` | `verdict: pending` 인 Pack 전부에 같은 판정을 준다 |
| `pack.py queue [--brief]` | 확인 대기 Pack 을 최근순으로 낸다. 없으면 아무것도 내지 않는다 |

실행 위치는 저장소 루트다. `python .claude/skills/review-pack/scripts/pack.py <명령>` 로 호출한다.

## 플랜의 acceptance 블록

플랜에 정보 문자열이 `acceptance` 인 코드 블록을 둔다. 한 줄에 JSON 하나다.

```
{"id":"V1","kind":"auto","cmd":"bash .claude/hooks/tests/codegraph-gate-matrix.sh","expect":"exit0"}
{"id":"V9","kind":"human","how":"새 세션을 연다","expect":"확인 대기 큐 블록이 보임"}
```

- `auto`: `bash -c <cmd>` 를 저장소 루트에서 실행한다. 제한 시간은 300초이고 `PACK_CMD_TIMEOUT` 환경 변수로 바꾼다. `expect` 가 `exit0` 이면 종료 코드 0 이 PASS 다. `exit<N>` 도 된다.
- 판정은 네 가지다. PASS, FAIL, UNVERIFIED, 범위 이탈.
  - UNVERIFIED: 시간 초과, 명령 없음(종료 코드 127), 셸 실행 불가.
  - 범위 이탈: 변경 파일이 플랜 표의 백틱 경로 어디에도 없을 때.
- `human`: 사람이 확인할 항목이다. 확인 목록에 체크칸으로 나온다.

## 변경 파일 기준

- 기준 커밋은 `--base` 가 정한다. 없으면 현재 브랜치가 `main` 일 때 `HEAD`, 아니면 `main` 과의 공통 조상이다.
- 변경 파일은 기준 이후 추적 파일 변경과 추적 안 된 새 파일을 모두 센다.
- `.claude/memory-bank/`(작업 기록)과 `.claude/state/`(훅 상태)는 범위 검사에서 뺀다.

## 확인 기록과 상태 파일

- `confirm pass` 는 Pack frontmatter `verdict` 를 `pass` 로 바꾸고, 확인 기록 절에 한 줄을 덧붙인다. 상태 파일은 `STATUS=done`, `UPDATED`, `CURRENT=G2 통과 <날짜>: <메모>` 로 바꾼다.
- `confirm fail` 은 `verdict` 를 `fail`, 상태 파일을 `STATUS=active`, `CURRENT=G2 반려 <날짜>: <메모>` 로 바꾼다.
- 자동 기준에 FAIL 이 하나라도 있으면 `pass` 는 거부된다. `--force` 를 주면 강행한다. `--all` 은 이런 Pack 을 건너뛰고 slug 를 출력한다.
- 다른 상태 키는 건드리지 않는다.
- `build` 를 다시 실행하면 `verdict` 가 `pending` 으로 돌아간다. 확인 기록 절은 그대로 남는다.

## 확인 대기 큐

`session-start.sh` 가 `queue --brief` 를 호출한다. 한 줄에 slug, 사람 확인 수, 자동 실패 수, 경로가 나온다. 9건을 넘으면 나머지는 `외 N건` 한 줄로 줄인다. 마지막 줄은 일괄 통과 명령이다.

## 테스트

```bash
python -m pytest .claude/skills/review-pack/tests -q
```

테스트는 임시 폴더에 가짜 저장소, 상태 파일, 플랜을 만든다. 실제 작업 기록은 건드리지 않는다.
