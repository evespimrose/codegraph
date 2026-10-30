---
paths:
  - ".claude/memory-bank/**"
---

# RULE: RIPER 상태는 작업마다 파일 1개 (2026-10-20)

**우선순위**: 🔴 CRITICAL. 상태 파일 형식과 세션 묶음은 훅이 읽는다 (`riper-bind.sh`, `session-start.sh`, `state-doctor.sh`).

## 1. 위치와 이름

- 상태 파일: `.claude/memory-bank/<branch>/riper/<slug>.state` (`.gitignore` 의 `**/memory-bank/` 때문에 git 무시. 디스크에만 있음)
- slug: 플랜 파일 이름에서 `.md` 를 뺀 것. 예: `main-2026-10-20-feature-status`
- 조사·발상 문서는 같은 slug 에 `-research`, `-innovate` 를 붙인다.
- 옛 단일 파일 `.claude/memory-bank/.riper-state` 는 더 이상 쓰지 않는다. 원문은 `.claude/memory-bank/main/riper/_legacy-2026-10-20.md` 에 보존한다.

## 2. 형식

키 순서를 지킨다. 값은 한 줄로 쓴다.

```
MODE=PLAN
STATUS=active
TASK=<한 줄>
PLAN_FILE=.claude/memory-bank/main/plans/<slug>.md
RESEARCH_FILE=<경로 또는 빈칸>
INNOVATE_FILE=<경로 또는 빈칸>
BRANCH=main
STARTED=2026-10-20
UPDATED=2026-10-20
CURRENT=<진행 한 줄>
```

- `MODE`: `NONE`, `RESEARCH`, `INNOVATE`, `PLAN`, `APPROVAL`, `EXECUTE`, `REVIEW`, `BLOCKED` 중 하나.
  - `APPROVAL`: Plan 세션이 플랜을 끝냈고 루트 세션의 사용자 승인을 기다린다. `PLAN_FILE` 필수.
  - `BLOCKED`: 단계 세션이 멈췄다. 원인은 `CURRENT` 에 쓰고, 루트 세션이 이어받는다.
  - 작업이 끝나면 `MODE` 는 `REVIEW` 로 두고 `STATUS=done` 으로 바꾼다. `DONE` 이라는 MODE 값은 없다.
- `STATUS`: `active`(진행 중), `paused`(멈춤, `CURRENT` 에 멈춘 지점), `done`(REVIEW 까지 끝남).
- `PREV_*`, `PAUSED_*`, `PARALLEL_*`, `NEXT_ORDER`, `ANCHOR` 같은 메모를 상태 파일에 쌓지 않는다. 메모는 플랜 문서에 쓴다.

## 3. 세션 묶음 (자동)

- PostToolUse 훅 `riper-bind.sh` 가 `riper/<slug>.state` 쓰기를 보면 `.claude/state/riper-session/<sid8>` 에 상태 파일의 저장소 기준 상대 경로를 한 줄 쓴다. `<sid8>` 은 세션 id 앞 8자다.
- 세션 시작 때 `session-start.sh` 가 그 묶음 파일을 읽는다. 묶인 작업이 있으면 상태 파일 전문과 플랜 앞 80줄을 주입한다. 묶인 작업이 없으면 `active`·`paused` 작업 목록(최근 갱신순 최대 10줄)만 주입한다.
- 세션이 바뀌면 묶음이 끊긴다(이어 하기, 컴팩션). 이때는 `/riper:<모드> <slug>` 로 다시 묶는다.
- `.claude/state/` 는 git 무시 대상이다. 묶음 파일은 커밋되지 않는다.

## 4. 명령의 작업 지정 순서

1. 명령 인자에 slug 또는 플랜 경로가 있으면 그 작업을 쓴다.
2. 없으면 이 세션에 묶인 작업을 쓴다.
3. RESEARCH 만 해당: 새 slug 를 정한다. 형식은 `<branch>-<YYYY-MM-DD>-<주제>`.
4. 셋 다 없으면 작업 목록을 보여 주고 사용자에게 묻는다. 임의로 고르지 않는다.

## 5. 금지와 갱신

- 한 작업의 상태 파일은 여러 세션(카드)이 돌려 쓴다. 동시에 도는 카드는 쓰기 직전에 파일을 다시 읽고 `CURRENT` 의 자기 칸(`E1:`, `E2:`, `E3:` 등)만 고친다.
- 마지막으로 끝난 카드가 `MODE` 를 넘긴다. 모든 카드 칸이 `완료` 일 때만 `MODE=REVIEW` 로 바꾼다. 그 밖에는 `MODE=EXECUTE` 를 둔다. 칸 값은 `대기`, `실행 중`, `완료`, `멈춤 S#` 중 하나다.
- 다른 작업의 상태 파일을 고치지 않는다.
- EXECUTE 는 `PLAN_FILE` 이 있는 작업만 시작한다. `APPROVAL`, `EXECUTE`, `REVIEW` 에서 `PLAN_FILE` 이 없으면 `state-doctor.sh` 가 red 로 표시한다.
- REVIEW 가 끝나면 `STATUS=done` 으로 바꾼다.
- 상태 파일이 사라진 옛 `.riper-state` 가 남아 있으면 `state-doctor.sh` 가 yellow(`riper-legacy`)로 표시한다.

## 6. 작업 문서 경로

작업 문서는 모두 `.claude/memory-bank/<branch>/plans/` 에 두고 이름은 slug 에서 정한다. 작업 묶음 폴더는 쓰지 않는다.

| 문서 | 경로 | 쓰는 쪽 |
|---|---|---|
| 조사 | `<slug>-research.md` | RESEARCH (`RESEARCH_FILE`) |
| 발상 | `<slug>-innovate.md` | INNOVATE (`INNOVATE_FILE`) |
| 플랜 | `<slug>.md` | PLAN (`PLAN_FILE`) |
| 실행 기록 | `<slug>-exec-log.md` | EXECUTE. 카드마다 `## 실행 <YYYY-MM-DD HH:MM> (<카드 이름>)` 절을 끝에 덧붙인다. 다른 카드 절은 고치지 않는다. |
| 검수 (Review Pack) | `<slug>-review.md` | REVIEW. `pack.py build <slug>` 가 만든다. 모델이 직접 쓰지 않는다. 사람 확인 기록(§5 절)은 `pack.py confirm` 이 덧붙인다. |

## 7. 루트+카드 흐름의 MODE 전이

루트 세션(Sonnet 5.5)은 RESEARCH, INNOVATE, APPROVAL, REVIEW 를 직접 하고 PLAN, EXECUTE 는 세션 카드로 넘긴다.

`RESEARCH → INNOVATE → PLAN(Plan 세션) → G1(사람: 플랜과 수락 기준 승인) → EXECUTE(카드) → REVIEW(루트: pack.py build) → G2(사람: Review Pack 확인) → STATUS=done`. 멈추면 `BLOCKED`.

- **G1**: 사람이 플랜과 `acceptance` 블록을 승인한다. 이 승인이 플랜 범위 파일의 쓰기 승인을 겸한다.
- **G2**: 사람이 Review Pack 의 사람 확인 목록을 본다. 통과는 `python .claude/skills/review-pack/scripts/pack.py confirm <slug> pass`, 반려는 `... confirm <slug> fail --note "<사유>"` 로 기록한다. 모델이 대신 통과시키지 않는다.
- **확인 대기 큐**: `pack.py queue` 가 `verdict: pending` 인 Review Pack 을 낸다. `session-start.sh` 가 세션 시작 때 이 큐를 주입한다. 큐가 비어 있지 않으면 마지막 줄에 일괄 통과 명령 `python .claude/skills/review-pack/scripts/pack.py confirm --all pass` 가 보인다. 자동 기준 실패가 있는 Review Pack 은 `--force` 없이 건너뛴다.
- 멈추면 `MODE=BLOCKED` 로 두고 원인을 `CURRENT` 에 쓴다.
