# 세션 원장: serena-cli 리모트 세션 (2026-11-04)

리모트(클라우드) 세션이 한 일을 한곳에 모은 기록이다. 로컬 PC 세션이 이 파일 하나로 이어받도록 `/memory:save` 형식을 따른다.

- **Session**: https://claude.ai/code/session_01DBP46Y5rMnj2dhDe3yFSGN (클라우드 컨테이너, Linux. `D:` 드라이브 없음)
- **Saved**: 2026-11-04 14:08 KST (serena-cli), 14:35 KST (sync-speed 묶음 1 PLAN 덧붙임)
- **Branch**: `claude/keen-carson-turtwr` (두 저장소 모두 같은 이름)
- **Base**: codegraph `5e290af`(사용자 push), claude-personal-integrated-workflow `11c3ac3`(GitHub main, 2026-06-04)
- **Commits made**: workflow `c7e6b5b`, `8350073` / codegraph `d4541f3`(원장 첫판), 그리고 sync-speed 플랜·상태 파일·이 원장 갱신을 넣은 커밋
- **Not changed**: KIT(`D:\Fork\KIT`), 로컬 `D:\Fork\claude-personal-integrated-workflow`, serena-cli 플랜 3개와 상태 파일, 이 저장소의 `source/`

## 한 줄 요약

실행 카드는 클라우드에서 돌리지 못했다. 세 플랜이 고치는 파일이 모두 로컬에만 있기 때문이다. 대신 hooks 플랜 10단계 전체와 kit 플랜 1·2단계를 스크래치 사본에서 리허설했고 모두 통과했다. KIT 배포 스크립트는 workflow 브랜치에 올렸다. 덧붙여 멈춰 있던 codegraph-sync-speed 의 묶음 1 플랜을 써서 APPROVAL 로 올렸다(코드 단계 리허설과 시험 통과).

## 작업 상태

| 작업 (slug) | 플랜 사본 | 리허설 결과 | 로컬에서 할 일 |
|---|---|---|---|
| `main-2026-11-04-serena-cli-kit` | `docs/main-2026-11-04-serena-cli-kit.md` (9단계) | 1·2단계 통과(시험 15/15). 3~9단계는 KIT 와 PowerShell 이 없어 못 함. 정적 점검 결함 0 | Execute 카드 |
| `main-2026-11-04-serena-cli-hooks` | `docs/main-2026-11-04-serena-cli-hooks.md` (10단계) | 10/10 DONE, A1~A4 통과. A5·H1 은 배포 뒤 | Execute 카드 (kit 와 동시) |
| `main-2026-11-04-serena-cli-guidance` | `docs/main-2026-11-04-serena-cli-guidance.md` (10단계) | 대상이 모두 KIT 파일이라 못 함. 정적 점검 결함 0 | kit 결과 확인 뒤 Execute 카드 |

상태 파일 3개는 push 되지 않아 MODE 를 보지 못했다. 세 플랜의 `## 승인 기록` 에는 G1 승인(2026-11-04)이 적혀 있다.

| 작업 (slug) | 플랜 | 결과 | 로컬에서 할 일 |
|---|---|---|---|
| `main-2026-11-04-codegraph-sync-speed` | `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-1.md` (묶음 1, 10단계) | 이 세션이 씀. 상태 파일 `docs/main-2026-11-04-codegraph-sync-speed.state` 를 `MODE=APPROVAL` 로 바꿈. 코드 단계 3~8 리허설 통과, 수락 기준 A1~A3 통과 | `D:\Fork\codegraph` 루트 세션에서 G1 승인 |

## 로컬 세션이 할 일

`D:\Fork\claude-personal-integrated-workflow` 루트 세션(Sonnet 5.5)에서 한다.

1. 실행 카드 두 장을 연다. 파일이 겹치지 않아 동시에 돌려도 된다.
   - `/riper:workflow main-2026-11-04-serena-cli-kit`
   - `/riper:workflow main-2026-11-04-serena-cli-hooks`
2. kit 카드 결과를 확인한 뒤 `/riper:workflow main-2026-11-04-serena-cli-guidance` 로 안내문 카드를 연다. `rules/RULES.md` 는 `~/.claude/rules` 정션이라 고치는 즉시 모든 세션에 반영된다(guidance 플랜의 결정).
3. 세 카드가 끝나면(상태 파일 3개가 모두 `MODE=REVIEW`) KIT 를 배포한다(kit 플랜 H1). 아래 "KIT 배포 스크립트" 절을 따른다.
4. 배포 뒤 작업마다 `/riper:workflow <slug>` 로 REVIEW 를 잇는다. kit 의 A4~A6 과 hooks 의 A5 는 배포 뒤에만 통과한다. kit 의 `pack.py build` 는 H1 뒤에 돌린다(kit 플랜 수락 기준).

선택: 카드 전에 아래 "리허설 해시" 로 로컬 파일이 리허설 기준과 같은지 보면, 리허설 결과를 그대로 믿어도 되는지 알 수 있다.

codegraph-sync-speed 는 `D:\Fork\codegraph` 루트 세션에서 한다.

1. 사용자가 08a6b23 에서 상태 파일을 `docs/` 로 옮겼으므로, 훅(`riper-bind.sh`, `session-start.sh`, `state-doctor.sh`)이 보도록 `docs/main-2026-11-04-codegraph-sync-speed.state` 를 `.claude/memory-bank/main/riper/` 로 되돌린다(옮길지는 사용자가 정한다).
2. `/riper:workflow main-2026-11-04-codegraph-sync-speed` 로 APPROVAL 을 잇는다. 루트가 플랜을 직접 읽고 요약한 뒤 승인을 묻는다(G1).
3. 승인하면 Execute 카드가 1~9단계를 하고, 10단계(빌드·전역 설치·저장소 맞추기)는 카드가 따로 승인을 묻는다.

## 로컬 세션에 줄 프롬프트

루트 세션은 Sonnet 5.5 여야 한다(`riper:workflow` 0절). ①②는 지금 함께 붙여 넣는다. ③은 kit 카드가 끝난 뒤, ④는 세 카드가 모두 끝난 뒤 붙여 넣는다. ①~④는 `D:\Fork\claude-personal-integrated-workflow` 루트 세션, ⑤는 `D:\Fork\codegraph` 루트 세션이다.

① kit Execute 카드

```text
/riper:workflow main-2026-11-04-serena-cli-kit
이 작업의 Execute 카드를 연다. G1 승인은 2026-11-04 에 받았다(플랜의 "## 승인 기록").
- MODE 가 APPROVAL 이면 riper:workflow 2.1절을 따르고, EXECUTE 면 바로 카드를 연다.
- hooks 카드(main-2026-11-04-serena-cli-hooks)와 동시에 돌려도 된다. 두 플랜의 파일은 겹치지 않는다.
- 카드 background 끝에 다음 문장을 넣는다: "리모트 세션이 이 플랜의 1·2단계를 스크래치 사본에서 리허설했다(1단계 검증 ok, 2단계 시험 15/15 를 unittest 로 확인). 3~9단계는 정적 점검만 했고 결함은 0이다. 상세는 D:/Fork/codegraph 의 claude/keen-carson-turtwr 브랜치 docs/main-2026-11-04-serena-cli-remote-ledger.md 에 있다."
- 카드가 끝나 MODE=REVIEW 가 되어도 REVIEW 를 시작하지 않는다. kit 의 pack.py build 는 KIT 배포(H1) 뒤에 한다(플랜 수락 기준). exec-log 의 단계별 상태만 보고한다.
```

② hooks Execute 카드

```text
/riper:workflow main-2026-11-04-serena-cli-hooks
이 작업의 Execute 카드를 연다. G1 승인은 2026-11-04 에 받았다(플랜의 "## 승인 기록").
- MODE 가 APPROVAL 이면 riper:workflow 2.1절을 따르고, EXECUTE 면 바로 카드를 연다.
- kit 카드와 동시에 돌려도 된다.
- 카드 background 끝에 다음 문장을 넣는다: "리모트 세션이 이 플랜 10단계를 codegraph 저장소의 하네스 사본에서 리허설했다. 10단계 모두 DONE, 수락 기준 A1~A4 통과(gate 19/0, outcome 27/0, sonar 28/0). 대상 파일 8개의 카드 전·뒤 해시는 D:/Fork/codegraph 의 claude/keen-carson-turtwr 브랜치 docs/main-2026-11-04-serena-cli-remote-ledger.md 에 있다."
- 카드가 끝나 MODE=REVIEW 가 되어도 REVIEW 를 시작하지 않는다. A5 는 KIT 배포 뒤에만 통과한다(플랜 수락 기준). exec-log 의 단계별 상태만 보고한다.
```

③ guidance Execute 카드 (kit 카드가 끝난 뒤)

```text
/riper:workflow main-2026-11-04-serena-cli-guidance
kit 카드의 결과를 확인한 뒤 이 작업의 Execute 카드를 연다(플랜의 "## 승인 기록").
- 먼저 main-2026-11-04-serena-cli-kit 의 상태 파일이 MODE=REVIEW 이고, kit exec-log 의 모든 단계가 DONE 또는 DONE_WITH_CONCERNS 인지 확인한다. 아니면 카드를 열지 않고 확인한 내용을 보고한다.
- MODE 가 APPROVAL 이면 riper:workflow 2.1절을 따르고, EXECUTE 면 바로 카드를 연다.
- 카드 background 끝에 다음 문장을 넣는다: "리모트 세션은 이 플랜의 대상인 KIT 파일이 없어 리허설하지 못했다. 검증 문자열과 변경 블록을 대조하는 정적 점검만 했고 결함은 0이다."
- 카드가 끝나 MODE=REVIEW 가 되어도 REVIEW 를 시작하지 않는다. H1 은 KIT 배포 뒤에 확인한다. exec-log 의 단계별 상태만 보고한다.
```

④ KIT 배포와 REVIEW (세 카드가 모두 끝난 뒤)

```text
serena-cli 세 작업의 Execute 카드가 모두 끝났다. KIT 를 배포하고(kit 플랜 H1) REVIEW 를 잇는다.
1. 상태 파일 3개(.claude/memory-bank/main/riper/main-2026-11-04-serena-cli-{kit,hooks,guidance}.state)의 MODE 를 한 줄씩 보여 준다. 셋 다 REVIEW 가 아니면 멈추고 보고한다.
2. 배포 스크립트를 받는다. 브랜치는 바꾸지 않는다.
   git fetch origin claude/keen-carson-turtwr
   git restore --source origin/claude/keen-carson-turtwr -- scripts/serena-cli-kit-deploy.ps1
3. AskUserQuestion 으로 배포할지, 그리고 Codex 도 쓰는지 묻는다.
4. 승인하면 PowerShell 도구로 직접 실행한다. Bash 에서 pwsh -Command 로 부르지 않는다.
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serena-cli-kit-deploy.ps1
   Codex 를 쓰면 끝에 -Codex 를 붙인다. 종료 코드는 0 완료, 2 카드 미완료, 4 shim 없음, 그 밖은 설치 실패다. 0 이 아니면 멈추고 출력을 보고한다.
5. 배포가 끝나면 main-2026-11-04-serena-cli-kit, main-2026-11-04-serena-cli-hooks, main-2026-11-04-serena-cli-guidance 순서로 riper:workflow 를 불러 REVIEW 를 잇는다(pack.py build). kit 의 A4~A6 과 hooks 의 A5 는 이제 통과해야 한다. G2 는 사람이 한다.
```

⑤ codegraph-sync-speed: G1 과 Execute 카드

```text
/riper:workflow main-2026-11-04-codegraph-sync-speed
리모트 세션이 이 작업의 묶음 1 플랜을 썼다. G1 승인을 받은 뒤 Execute 카드를 연다.
1. 준비 (D:\Fork\codegraph):
   - git fetch origin claude/keen-carson-turtwr 를 한다. 지금 브랜치가 main 이고 추적 중인 파일에 바뀐 것이 없을 때만 git merge --ff-only origin/claude/keen-carson-turtwr 로 받는다. 조건이 맞지 않거나 fast-forward 가 안 되면 멈추고 보고한다.
   - 상태 파일은 docs/main-2026-11-04-codegraph-sync-speed.state 에 있다(MODE=APPROVAL). .claude/memory-bank/main/riper/ 에 같은 이름의 파일이 없거나 그 파일의 MODE 가 PLAN 이면, docs 쪽 파일을 그 자리에 복사한다. 훅(riper-bind.sh, state-doctor.sh)과 이 명령은 riper/ 쪽을 읽는다.
2. riper:workflow 2.1절을 따라 플랜(.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-1.md)을 직접 읽고 요약한 뒤 승인을 묻는다. 요약에 다음 세 가지를 넣는다.
   - 측정 대상은 Arcyn, RX_1, BLADE 세 곳이다. plan-notes 의 "다섯 곳" 중 이름이 적힌 곳만 넣었다.
   - 측정은 전역 설치본이 아니라 KIT 소스의 CLI 로 한다. 그래서 2단계 기준선은 3단계보다 먼저 잰다.
   - R2 가 저장된 문서 판별을 다시 쓸 때 바이너리 확장자는 빼고 다시 판별한다(R4 와 맞춤).
3. 승인하면 Execute 카드를 연다. 카드 background 끝에 다음 문장을 넣는다: "리모트 세션이 3~8단계를 이 저장소 source/ 사본(KIT 빌드 8e92ff564f22 와 다이제스트가 같음)에 그대로 적용해 단계 검증, 새 시험 3/3, 회귀 46/46, watcher 29/29 를 통과시켰다. 1·2·9단계(측정)는 합성 프로젝트로만 돌렸고, 10단계(배포)는 돌리지 않았다. 10단계는 카드가 따로 승인을 묻는다."
4. 카드가 끝나면 riper:workflow 2절 표대로 이어 간다.
```

## 이 세션의 사용자 지시

1. 첫 메시지: 플랜 세션의 보고를 붙여 넣고 "실행 카드 두 장 시작". 카드가 끝나면 KIT 배포를 지시하는 스크립트를 남기고, git 설명에 넣어 로컬 머신에 전달.
2. 플랜을 git 으로 올림. codegraph `08a6b23` 에는 sync-speed 문서와 `.serena/` 만 있었고, `5e290af` 에 serena-cli 플랜 3개와 kit 의 research·innovate 문서가 들어옴.
3. "할 수 있는 만큼 ㄱㄱ", 번호는 지정하지 않음. 이 세션의 작업 전부를 원장 하나로 `docs/` 에 두고, 커밋에 넣고, 커밋 설명에서 언급.
4. Execute 세션을 각각 열게 하는 프롬프트 작성. 로컬 머신 세션에 전달용(위 "로컬 세션에 줄 프롬프트" 절).

## 확인한 사실

- 플랜 대상 경로: kit·guidance 는 `D:/Fork/KIT/...` 이고 KIT 는 GitHub 저장소가 없다(`list_repos` 로 확인). hooks 는 `D:\Fork\claude-personal-integrated-workflow\...` 인데, 이 저장소의 GitHub main 은 2026-06-04 판이라 `.claude/hooks/lib/outcome.py` 와 `.claude/hooks/tests/` 가 없다.
- 이 세션이 쓸 수 있는 Remote Control 폴더가 없다(`list_computer_folders` 빈 목록). 그래서 로컬 파일에 닿을 수 없다.
- 플랜의 검증 명령은 `D:/Fork/...` 절대 경로와 `powershell.exe`·Pester 를 쓴다. 실행 카드는 플랜을 적힌 그대로만 실행하므로, 경로를 바꿔 돌리는 것은 G1 범위 밖이다.
- codegraph 의 `.claude` 하네스 사본에서 hooks 플랜의 '변경 전' 10곳이 각각 정확히 한 번 나온다. hooks 리허설은 이 사본으로 했다.
- codegraph `source/` 의 다이제스트(파일 363개)가 `manifest.json` 의 `sourceTreeSha256`(`122d32cc87b5…`)과 같다. 빌드 sha256 `8e92ff564f22…` 는 sync-speed 조사의 대상 빌드(`1.1.2-8e92ff564f22`)와 같다.

## 리허설: hooks

방법: codegraph `5e290af` 를 스크래치 폴더에 clone 하고 `riper:execute` 규칙대로 적용했다. replace 와 insert-after 는 '변경 전' 이 정확히 한 번 나올 때만 바꿨다. 단계마다 플랜의 검증 명령을 그대로 돌렸다. 저장소 파일은 바꾸지 않았다.

기준선(변경 전): `codegraph-gate-matrix` PASS=15 FAIL=0, `outcome-matrix` PASS=21 FAIL=0, `sonar-guard-matrix` PASS=28 FAIL=0. 모두 exit 0.

| 단계 | 파일 | 동작 | 검증 출력 (= 기대 출력) |
|---|---|---|---|
| 1 | `.claude/hooks/tool-history-recorder.sh` | replace | `0 1` |
| 2 | `.claude/hooks/tool-history-recorder.sh` | replace | `1 1` |
| 3 | `.claude/hooks/codegraph-gate.sh` | replace | `1` |
| 4 | `.claude/hooks/lib/outcome.py` | replace | `1` |
| 5 | `.claude/hooks/lib/outcome.py` | replace | `1` |
| 6 | `.claude/hooks/tests/outcome-matrix.sh` | insert-after | `PASS=27 FAIL=0` |
| 7 | `.claude/hooks/tests/codegraph-gate-matrix.sh` | insert-after | `PASS=19 FAIL=0` |
| 8 | `CLAUDE.md` | replace | `1 1` |
| 9 | `.claude/hooks/session-start.sh` | replace | `1` |
| 10 | `.claude/hooks/post-compact.sh` | replace | `1` |

10단계 모두 DONE. 바뀐 파일은 플랜의 `## 바뀔 파일` 8개와 같다(98줄 추가, 16줄 삭제).

수락 기준:

| id | 결과 |
|---|---|
| A1 `bash .claude/hooks/tests/codegraph-gate-matrix.sh` | exit 0, PASS=19 FAIL=0 |
| A2 `bash .claude/hooks/tests/outcome-matrix.sh` | exit 0, PASS=27 FAIL=0 |
| A3 `bash .claude/hooks/tests/sonar-guard-matrix.sh` | exit 0, PASS=28 FAIL=0 |
| A4 CORE_RULES 의 RULE-1 줄 비교 | exit 0 |
| A5 `serena-cli find_symbol ...` | 안 돌림. `serena-cli` 는 KIT 배포 뒤에 생김 |
| H1 | 사람 확인 (새 세션) |

추가 확인: 바뀐 셸 스크립트 6개 `bash -n` 통과, `outcome.py` `py_compile` 통과, 두 훅의 `CORE_RULES` 블록(9줄)이 바이트까지 같음.

### 리허설 해시

sha256 앞 12자, LF 기준이다. 로컬에서는 줄바꿈을 LF 로 바꿔 계산한다. 아래 명령은 workflow 폴더 루트에서 돌린다.

```bash
python3 -c "import hashlib,sys; [print(hashlib.sha256(open(f,'rb').read().replace(b'\r\n',b'\n')).hexdigest()[:12], f) for f in sys.argv[1:]]" .claude/hooks/tool-history-recorder.sh .claude/hooks/codegraph-gate.sh .claude/hooks/lib/outcome.py .claude/hooks/tests/outcome-matrix.sh .claude/hooks/tests/codegraph-gate-matrix.sh CLAUDE.md .claude/hooks/session-start.sh .claude/hooks/post-compact.sh
```

| 파일 | 카드 전 (codegraph 사본) | 카드 뒤 (리허설) |
|---|---|---|
| `.claude/hooks/tool-history-recorder.sh` | `4ea9ab135b1d` | `e1c334d137ef` |
| `.claude/hooks/codegraph-gate.sh` | `1fefab4b976e` | `f1880cfeed71` |
| `.claude/hooks/lib/outcome.py` | `fd51ef7928bd` | `0ba2f9897ece` |
| `.claude/hooks/tests/outcome-matrix.sh` | `5ad139f9894b` | `30574fbe17ea` |
| `.claude/hooks/tests/codegraph-gate-matrix.sh` | `4ee6cabcc5bd` | `9c2f8a4250de` |
| `CLAUDE.md` | `5fa2a962c124` | `91f4f9bb9f53` |
| `.claude/hooks/session-start.sh` | `003d59e00d38` | `1c07c62f8be6` |
| `.claude/hooks/post-compact.sh` | `d5ab33ff3dff` | `67d0c5c178e4` |

카드 전 값이 같으면 로컬 카드 결과도 "카드 뒤" 값과 같아야 한다. `CLAUDE.md` 는 프로젝트마다 다른 부분이 있어 카드 전 값이 다를 수 있다.

## 리허설: kit 1·2단계

- 1단계(create `tools/serena/serena_cli.py`, 247줄): 검증 `ast.parse` 출력 `ok`. DONE.
- 2단계(create `test/test_serena_cli.py`, 173줄): 이 컨테이너에 pytest 가 없어 플랜의 검증 명령은 exit 1(`No module named pytest`)이었다. 같은 시험을 `python3 -m unittest discover -s test -p test_serena_cli.py` 로 돌려 15개 모두 통과했다(exit 0). 플랜의 기대 "15 passed" 와 개수가 같다.
- KIT 모듈 `shared_client`, `shared_runtime` 은 import 만 되게 가짜 파일을 두었다. 호출을 기록해 보니 `shared_runtime.configuration` 14회뿐이었다. 시험이 `Session` 과 `cache_path` 를 가짜로 바꿔 끼우기 때문이다. 그래서 이 결과는 CLI 로직(인자 처리, `-j` 출력, 종료 코드)의 검증이고, KIT 공유 데몬 연동의 검증은 아니다.
- 만든 파일의 해시(앞 12자): `serena_cli.py` `0ae557071b8f`, `test_serena_cli.py` `a3b7ee0262bd`. 카드가 같은 파일을 만들면 값이 같아야 한다.
- 3~9단계(`install.ps1`, Pester 시험, Export-Dist, README): KIT 파일과 PowerShell 이 없어 못 했다.
- Python 3.13.18 (Linux) 로 돌렸다. 로컬 Python 판과 다를 수 있다.

## 정적 점검: kit 3~9단계, guidance 1~10단계

검증 명령이 실제로 돌릴 Python 소스를 그대로 뽑아서, `t.count('<문자열>')` 의 기대값이 '변경 전'·'변경 후' 블록과 모순되지 않는지 봤다.

- 결함 0. 지워져야 하는 문자열(기대 0)은 모두 '변경 전' 에만 있고 '변경 후' 에는 없다. 새 문자열(기대 1·2)은 '변경 후' 에 기대 개수만큼 있다.
- guidance 1단계: '변경 전' 의 `mcp__serena` 9개가 '변경 후' 에서 빠지고 `Bash(serena-cli:*)`, `PowerShell(serena-cli:*)` 가 들어간다.
- guidance A2 조건: 8개 파일 모두 '변경 후' 블록에 `serena-cli` 가 있고 `mcp__serena` 는 없다.
- 한계: 파일의 다른 곳에 같은 문자열이 남아 있는지는 KIT 파일이 없어 확인하지 못했다. PowerShell 블록은 파싱하지 못했다.

## KIT 배포 스크립트

- 위치: evespimrose/claude-personal-integrated-workflow, 브랜치 `claude/keen-carson-turtwr`, `scripts/serena-cli-kit-deploy.ps1` (`c7e6b5b` 에서 추가, `8350073` 에서 갱신)
- 하는 일: serena-cli 상태 파일 3개가 모두 `MODE=REVIEW` 인지 확인 → `D:\Fork\KIT\install.ps1` 실행 → `-Codex` 를 주면 `install-codex.ps1` 실행 → H1 확인(`%USERPROFILE%\.local\bin` 에 `serena-cli`, `serena-cli.cmd` 가 있는지).
- 종료 코드: 0 완료, 2 카드 미완료(`-Force` 로 건너뜀), 4 shim 없음, 그 밖은 설치 실패.
- 실행: workflow 폴더 루트에서 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serena-cli-kit-deploy.ps1` (Codex 를 쓰면 `-Codex`).
- 브랜치를 바꾸지 않고 파일만 받기(작업 트리에만 쓰고 index 는 그대로):

```bash
git fetch origin claude/keen-carson-turtwr
```

```bash
git restore --source origin/claude/keen-carson-turtwr -- scripts/serena-cli-kit-deploy.ps1
```

- 검증 한계: Windows PowerShell 로 실행하거나 파싱해 보지 못했다(이 컨테이너에 PowerShell 이 없음). ASCII 전용, LF, 괄호와 따옴표 짝만 확인했다.
- `c7e6b5b` 의 커밋 설명 중 "플랜이 GitHub 에 없다" 는 옛 내용이다. `8350073` 의 설명이 대신한다.

<details>
<summary>스크립트 전문 (8350073)</summary>

```powershell
# serena-cli execute cards -> KIT deploy (kit plan H1). Run on the local PC after the cards finish.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serena-cli-kit-deploy.ps1 [-Codex] [-Force]
# Card order (from the plan approval notes): kit + hooks cards, then the guidance card after the kit result, then this script.
# -Codex : also run install-codex.ps1 (only when Codex is used)
# -Force : deploy even if a serena-cli state file is not MODE=REVIEW yet
# Session ledger: evespimrose/codegraph, branch claude/keen-carson-turtwr, docs/main-2026-11-04-serena-cli-remote-ledger.md
param(
    [string]$KitRoot = 'D:\Fork\KIT',
    [string]$WorkflowRoot = 'D:\Fork\claude-personal-integrated-workflow',
    [string]$BinRoot = (Join-Path $env:USERPROFILE '.local\bin'),
    [switch]$Codex,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'

# 1. Cards finished? Each serena-cli state file must read MODE=REVIEW.
$riperDir = Join-Path $WorkflowRoot '.claude\memory-bank\main\riper'
$pending = @()
foreach ($part in @('kit', 'hooks', 'guidance')) {
    $stateFile = Join-Path $riperDir "main-2026-11-04-serena-cli-$part.state"
    $mode = 'MISSING'
    if (Test-Path -LiteralPath $stateFile) {
        $modeLine = Get-Content -LiteralPath $stateFile | Where-Object { $_ -like 'MODE=*' } | Select-Object -First 1
        if ($modeLine) { $mode = $modeLine.Substring(5).Trim() } else { $mode = 'NO-MODE' }
    }
    Write-Host ("serena-cli-{0}: MODE={1}" -f $part, $mode)
    if ($mode -ne 'REVIEW') { $pending += $part }
}
if ($pending.Count -gt 0 -and -not $Force) {
    Write-Host ("Not finished: {0}. Deploy skipped (exit 2). Add -Force to deploy anyway." -f ($pending -join ', '))
    exit 2
}

# 2. KIT deploy, then the Codex installer when -Codex is given.
$installers = @('install.ps1')
if ($Codex) { $installers += 'install-codex.ps1' }
foreach ($name in $installers) {
    $installer = Join-Path $KitRoot $name
    if (-not (Test-Path -LiteralPath $installer)) {
        Write-Host "Not found: $installer"
        exit 1
    }
    Write-Host "> powershell -NoProfile -ExecutionPolicy Bypass -File $installer"
    $ErrorActionPreference = 'Continue'  # installer stderr must not abort this script
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) {
        Write-Host "$name failed (exit $code)"
        exit $code
    }
}

# 3. H1 expects the serena-cli shims in BinRoot after the install.
$missing = @()
foreach ($shim in @('serena-cli', 'serena-cli.cmd')) {
    $shimPath = Join-Path $BinRoot $shim
    if (Test-Path -LiteralPath $shimPath) {
        Write-Host "[H1] ok: $shimPath"
    } else {
        Write-Host "[H1] MISSING: $shimPath"
        $missing += $shimPath
    }
}
if ($missing.Count -gt 0) {
    Write-Host 'KIT installed, but the serena-cli shims are missing (exit 4).'
    exit 4
}
Write-Host 'KIT deploy done. Next: kit A4-A6 and hooks A5, then REVIEW with /riper:workflow <slug>.'
```

</details>

## codegraph-sync-speed 묶음 1 PLAN

innovate 12절의 사용자 결정(묶음 1 을 먼저 PLAN 으로)과 plan-notes 의 설계 결정을 따라 이 세션이 플랜을 썼다. 형식은 `/riper:plan` 을 따랐다.

- 플랜: `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-1.md` (10단계, 하위 변경 26개, 수락 기준 auto 4개와 human 2개, 미결 질문 없음)
- 상태 파일: `docs/main-2026-11-04-codegraph-sync-speed.state` 를 `MODE=APPROVAL`, `PLAN_FILE=` 위 플랜, `CURRENT=승인 대기: ...` 로 바꿨다.
- 대상: KIT `D:/Fork/KIT/tools/codegraph/source`. 이 저장소 `source/` 는 KIT 빌드 `8e92ff564f22` 와 다이제스트가 같아서(파일 363개), 이 사본에서 '변경 전' 원문을 잘랐다. 모든 '변경 전' 블록은 원본 파일에서 줄 범위로 그대로 잘라 썼고, 파일 안에서 유일한지 확인했다.

| 단계 | 내용 | 리허설 |
|---|---|---|
| 1 | 측정 도구 `D:/Fork/.AI/context/search-eval/sync-speed.cjs` 만들기 | 검증 통과. 합성 프로젝트 2곳으로 baseline·after 를 끝까지 실행(아래) |
| 2 | 기준선 측정 (코드를 바꾸기 전) | 로컬 전용 (Arcyn, RX_1, BLADE) |
| 3 | R4 `BINARY_EXT`·`hasBinaryExtension`, R3 realpath 순서와 `gitVisibleFiles` 무시 규칙 선거름 (scan-files) | DONE `null true true 2` |
| 4 | R2 `createDocumentClassifier`, `classifyFile` 여섯째 인자 (classifier) | DONE `function 6` |
| 5 | R2 연결 (docs/indexer, inventory/index) | DONE `1 1` |
| 6 | K1 `computeDominantFile`·`refreshDominantFile`, 지문 `COUNT(*)`·`MAX(rowid)` (queries) | DONE `1 1 1` |
| 7 | sync 가 판별기를 만들어 넘기고, sync·indexAll 끝에서 K1 저장 (lib/index.js) | DONE `1 2 2` |
| 8 | 새 시험 `test/sync-speed.test.cjs` 3개 | DONE `# pass 3 # fail 0` |
| 9 | 뒤 측정과 비교 | 로컬 전용 |
| 10 | 빌드, 전역 설치, 저장소 맞추기 (안 A 10단계와 같음, 승인 필요) | 안 돌림 |

수락 기준 (리허설 사본, Linux, Node 22.23.4):

| id | 결과 |
|---|---|
| A1 새 시험 | exit 0, 3/3 |
| A2 freshness, cli, indexing-regression, indexing-resolution, indexing-lock, indexing-revision | exit 0, 46/46 (바꾸기 전 기준선도 46/46) |
| A3 watcher, watcher-cli-edge, watcher-daemon | exit 0, 29/29 |
| A4 측정 비교 `passed` | 로컬 전용 (9단계 뒤) |
| H1, H2 | 사람 확인 |

추가 확인:

- 새 시험은 바꾸기 전 코드에서 3개 모두 실패한다(0/3). 시험이 바뀐 동작을 실제로 잡는다.
- 옛 코드로 색인한 프로젝트를 새 코드로 sync 하면, 텍스트 내용의 `fake.png` 가 `document.text` 에서 `metadata-only`·`application/octet-stream` 으로 바뀐다.
- 측정 도구: 합성 프로젝트 2곳에서 baseline(옛 CLI)과 after(새 CLI)가 끝까지 돌았고 결과 파일 3개가 생겼다. 파일 목록 차이는 "없음" 이었다. 합성 프로젝트는 한 번에 0.4초 정도라 시간 비교가 잡음에 묻혀 `passed: false` 였다. 느려지면 exit 1 을 내는 것도 이때 확인됐다. 결과가 없는 `query` 도 exit 0 이다(RX_1, BLADE 에는 `DamageHitJob` 이 없음).
- 안 B·C 플랜의 '변경 전' 블록(B 9개, C 31개)은 묶음 1 적용 전후로 소스에 나오는 개수가 같다. 지금 소스에 없는 4개는 search-eval 도구 파일을 가리키는 것(B 7a·7b, C 1a)과 안 B 가 만들 문구(C 2a)다.

리허설 중 찾아 고친 결함: 처음 판에서는 R2 가 저장된 문서 판별을 그대로 다시 써서, 옛 코드가 문서로 분류한 바이너리 확장자 파일이 계속 문서로 남았다(R4 와 어긋남). 저장된 문서 판별은 바이너리 확장자가 아닐 때만 다시 쓰도록 고쳤고, 시험 2 에 그 경우를 넣었다.

plan-notes 와 다른 점:

- 측정 대상은 조사 문서에 이름이 있는 세 곳(Arcyn, RX_1, BLADE)이다. "다섯 곳" 중 나머지 두 곳은 문서에 이름이 없다.
- 측정은 전역 설치본이 아니라 KIT 소스의 CLI(`lib/bin/codegraph.js`)를 직접 부른다. 그래서 기준선은 3단계 전에, 뒤 측정은 8단계 뒤에 잰다(배포와 상관없음).
- R2 의 재사용 조건에 바이너리 확장자 제외를 더했다(위 결함).

의존성: 이 컨테이너에서 시험을 돌리려고 스크래치 사본에 `npm install --ignore-scripts --no-audit --no-fund --omit=dev` 를 했다(exit 0, 패키지 63개). 저장소에는 넣지 않았다.

## 커밋, push, 차단 기록 (명령 = 종료 코드)

| 명령 | 결과 |
|---|---|
| workflow `git push -u origin claude/keen-carson-turtwr` (`c7e6b5b`) | 0 |
| 스크래치 clone 에서 `git restore --source origin/claude/keen-carson-turtwr -- scripts/serena-cli-kit-deploy.ps1` | 0 (파일만 생기고 index 는 그대로) |
| codegraph `git merge --ff-only origin/main` 뒤 `git push -u origin claude/keen-carson-turtwr` | 0 (`5e290af`, main 과 같음) |
| workflow `git push origin claude/keen-carson-turtwr` (`8350073`) | 0 |
| hooks 리허설: 단계 검증 10개, A1~A4 | 모두 0 |
| kit 1단계 검증 | 0 |
| kit 2단계 검증 (pytest) | 1 (pytest 없음). unittest 로 다시 돌려 0 |
| PowerShell 7 내려받기 (스크립트 문법 검사용) | 권한 분류기가 막음 (외부 코드 실행) |
| `c7e6b5b` amend 와 force push | 권한 분류기가 막음 (git 파괴 동작). 새 커밋 `8350073` 로 대신함 |
| codegraph `git push origin claude/keen-carson-turtwr` (`d4541f3`, 원장 첫판) | 0 |
| 스크래치 사본에서 `npm install --ignore-scripts --no-audit --no-fund --omit=dev` | 0 |
| 시험 기준선(바꾸기 전): 6개 묶음 46/46, watcher 8/8, watcher-cli-edge 1/1, watcher-daemon 20/20, watcher-hooks 는 Linux 에서 건너뜀 | 모두 0 |
| sync-speed 리허설: 1·3~8단계 검증, A1~A3 | 모두 0 |
| 바꾸기 전 코드로 새 시험 실행 | 1 (0/3, 의도한 실패) |
| 측정 도구 합성 실행: baseline / after | 0 / 1 (합성 프로젝트의 시간 잡음, 위 설명) |

## 남은 것과 한계

- 실행 카드 3장, KIT 배포(H1), REVIEW, G2 는 로컬에서 한다.
- hooks 리허설은 codegraph 의 하네스 사본으로 했다. 로컬 workflow 폴더의 파일이 이 사본과 다르면 결과가 다를 수 있다. 위 해시로 확인한다.
- 리허설에 쓴 스크래치 파일(clone, 가짜 모듈, 점검 스크립트)은 세션이 끝나면 사라진다. 저장소에는 넣지 않았다.
- codegraph-sync-speed: 묶음 1 플랜은 G1 승인 대기다. 1·2·9단계(측정)와 10단계(배포)는 로컬 전용이라 실제 프로젝트에서 돌려 보지 않았다. 묶음 2 플랜은 아직 없다(innovate 12절: 묶음 1 의 EXECUTE, REVIEW, G2 를 마친 뒤 시작).

## 사람 확인 항목

- 로컬 루트 세션에서 "로컬 세션이 할 일" 1번부터 진행한다.
- `install-codex.ps1` 이 `D:\Fork\KIT` 에 있다고 가정했다. 다르면 스크립트에 `-KitRoot` 를 주거나 직접 실행한다.
- 배포 스크립트는 Windows PowerShell 에서 처음 실행된다. 첫 실행 출력을 확인한다.
- codegraph-sync-speed 묶음 1 플랜의 G1: 측정 대상 세 곳, 측정을 KIT 소스 CLI 로 하는 방식, R2 재사용 조건(바이너리 확장자 제외)을 확인한다.
- sync-speed 상태 파일을 `docs/` 에서 `.claude/memory-bank/main/riper/` 로 되돌릴지 정한다.
