# 실행 기록: 묶음 2 (main-2026-11-04-codegraph-sync-speed-2)

## 실행 2026-11-04 16:54 (sync-speed-2-exec)

### 단계 1, 2 진입 확인
- 플랜 전문 읽음(1310줄). 상태 파일 MODE=EXECUTE 확인.
- 1단계(`watch-speed.cjs` 만들기)는 아직 하지 않음. 2단계의 원본 확인이 먼저 막혀서 멈춤.

### 2a 소스 확인
- 명령: `node D:/Fork/.AI/context/search-eval/sync-speed.cjs verify; echo exit=$?`
- 출력: `6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3`, `exit=0`
- 기대 출력과 일치: 예

### 2b 설치기 확인
- 명령: `python -c "import hashlib; h=lambda p: hashlib.sha256(open(p,'rb').read().replace(bytes([13,10]), bytes([10]))).hexdigest(); print(h(r'D:/Fork/KIT/tools/codegraph/install.ps1'), h(r'D:/Fork/KIT/tools/codegraph/install.sh'))"`
- 출력: `716513e6d97268dbd8c64dc766a4be90e0834f66dc8ca0c78a5832b7f8c1ed4a fde3e8c3d4bb4f2eff8ee8cabd3a0df2bff492b037dbb7224456f9690338f863`
- 기대 출력과 일치: 예

### 2c 시험 폴더 확인 (불일치)
- 명령: `ls D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer.Tests.ps1`
- 출력: `No such file or directory`, `ls exit=2`. `D:/Fork/KIT/tools/codegraph/test/` 폴더 자체가 없음.
- 기대 출력과 일치: 아니오
- 추가 확인: `D:/Fork/KIT/test/Codegraph-Installer.Tests.ps1` 은 존재함. KIT 저장소 루트의 `test/` 폴더에 있음.
- 판정: 플랜 2c 조건에 따라 멈춤. 플랜 경로(`tools/codegraph/test/`)를 고쳐 진행하지 않음.

### 중단 결정
- 멈춘 단계: S2 (2c)
- 이유: 플랜의 시험 위치 가정과 실제 KIT 구조가 다름. 8b(새 Pester 시험 생성 위치)와 V7(기존 시험 위치) 두 곳에 영향.
- 아직 바꾼 파일 없음. 이 저장소, KIT 저장소 모두 변경 없음(상태 파일과 이 실행 기록만 씀).
- 지킬 상태: 1단계 `watch-speed.cjs` 와 측정(2d) 은 실행하지 않음. 감시기 프로세스 없음(측정을 시작하지 않음).

### 사람이 정할 것
- 새 Pester 시험(8b)과 기존 시험(V7)을 `D:/Fork/KIT/test/` 기준으로 고쳐 진행할지 결정 필요. 플랜 개정 뒤 다시 실행.
- 한 가지 더 확인할 것: KIT 저장소는 `M` 상태 파일이 많음(hooks, rules, tools/codegraph/source 등). 묶음 2 는 그 위에서 시작하게 됨. 상태 확인은 승인 전에 할 것.

## 실행 2026-11-04 16:57 (root)

- 2c 멈춤 원인: 플랜이 Pester 시험 폴더를 `D:/Fork/KIT/tools/codegraph/test/` 로 적었으나 KIT 에는 그 폴더가 없음. 시험은 모두 `D:/Fork/KIT/test/` 에 있음.
- 함께 찾은 결함: 이 PC 의 Pester 는 3.4.0 뿐인데 플랜의 8b 는 Pester 5 문법(`Should -Match`), 8h 는 `-MinimumVersion 5.0`, `-Path`, `-Output Detailed` 를 씀. 8b 의 설치기 경로(`Split-Path -Parent $PSScriptRoot` + `install.ps1`)도 새 위치에서는 KIT 루트 설치기를 가리킴.
- 플랜 수정: 새 시험 경로 4곳, 첫머리 범위, 2c, 8b(`$kitRoot` + `tools/codegraph/install.ps1`, Pester 3 문법), 8h(`Invoke-Pester -Script`, 기대 `passed=2 failed=0`), V7 명령. 2c 아래에 수정 기록을 남김.
- 확인: 고친 8b 를 지금 설치기 사본(스크래치)에 Pester 3.4.0 으로 돌림. 시험 2건이 실행되고 W5 전이라 둘 다 실패함(`passed=0 failed=2`). 문법과 경로가 맞음.
- 2a, 2b 는 실행 세션이 이미 통과함. 2c 부터 다시 시작함.

## 실행 2026-11-04 17:30 (sync-speed-2-exec, 재개)

- 2c 통과: `D:/Fork/KIT/test/Codegraph-Installer.Tests.ps1` 존재 확인(루트 세션이 플랜 경로를 고침).
- 1단계: `D:/Fork/.AI/context/search-eval/watch-speed.cjs` 생성. `node --check` 종료 코드 0.
- 2d: `node watch-speed.cjs baseline` 종료 코드 0. 기준선 `ready 3231 ms, edit query 20412 ms (found true), bulk ready 12309 ms, missed 0, idle writes 21`. 검증 출력 `True True 0`.
- 3단계(watcher.js): 마커 개수 `1 1 1 2 1 1 1 1`, d.ts `1`, 로드 `load ok`.
- 4단계(index.js, index.d.ts): 마커 `1 1 3 1 1 1 1 1`, d.ts `1 1 1`, 로드 `load ok`.
- 5단계(extraction, docs/indexer, inventory): 검증 1~6 개수 모두 기대와 같음, 로드 `load ok`.
- 6단계(worker.js, manager.js, freshness.js): 마커 `1 1 1 1 3 1 1 1`, `1 1`, `1 1`, 로드 `load ok`.
- 7단계(install.ps1, install.sh): 줄 끝이 CRLF 라 CRLF 를 유지하며 치환. 검증 `1 1 0 0`, `1 0`. ps1 안 JS 블록 파싱 통과, `bash -n install.sh` 통과.
- 8a: `source/test/watch-speed.test.cjs` 생성. 8b: `D:/Fork/KIT/test/Codegraph-Installer-WatcherStop.Tests.ps1` 생성. 8c, 8d: `freshness.test.cjs` 두 곳 수정.
- 8e 실패: `node --test test/watch-speed.test.cjs` 종료 코드 1. `tests 5, pass 2, fail 3`.
  - 'watcher passes pending paths after the first full reconcile...': `waitFor` 시간 초과. 대기 항목 기대 202, 실제 203.
  - 'sync with known paths reconciles only those files...': 시험 뒤 임시 폴더 삭제가 `EPERM` (Windows, `codegraph-targeted-*`).
  - 'a flush request makes the watcher publish a pending edit...': 시험 뒤 임시 폴더 삭제가 `EPERM` (`cg-watch-flush-*`).
  - 'flushNow reconciles...', 'watcher state is written...' 두 건은 통과.
- 8f: `node --test` 회귀 10개 파일 종료 코드 0. `tests 82, pass 82, fail 0`.
- 8g: 문서·검색 8개 파일 종료 코드 0. `tests 55, pass 50, skipped 5, fail 0`.
- 8h: `Invoke-Pester -Script D:/Fork/KIT/test/Codegraph-Installer-WatcherStop.Tests.ps1` `passed=2 failed=0`. 종료 코드 0.
- 8i: `node watch-speed.cjs verify` 출력 `1d99f2f9…`, `install.ps1 0051db8d…`, `install.sh 352215fb…`, 종료 코드 0.

## 중단 결정

- 멈춘 단계: S8 (8e)
- 이유: 플랜의 8e 기대 출력은 `exit=0` (pass 5) 이다. 실제는 3건 실패.
- 제품 코드(`watcher.js`, `index.js` 등)는 고치지 않음. 실패 원인이 시험 기대값(202 대 203)과 Windows 임시 폴더 삭제 실패라서 플랜의 시험 코드 쪽 문제로 보임. 원인 확정과 수정은 사람이 정함.
- 9단계와 10단계는 시작하지 않음. 감시기 측정(9단계)은 시험 통과 뒤에 해야 함.
- 측정 기록: `D:/Fork/.AI/context/search-eval/work/s8e.log`, `step8-tests.log`.

## 실행 2026-11-04 17:28 (root, 8e 멈춤 해결)

- 실패 1 (`watcher passes pending paths ...`, 202 대신 203): 재현 3회 모두 대기 목록에 `Hold.cs`, Bulk 201개 외에 이미 맞춘 `Edit.cs` 가 다시 들어옴. Windows chokidar 가 같은 폴더에 파일이 늘 때 바뀌지 않은 `Edit.cs` 의 change 를 다시 보냄. 시험이 확인하려는 동작(잡힌 맞추기는 `['Hold.cs']`, 다음은 경로 없는 전체 sync)은 그대로 성립. 정확한 개수 대신 포함 여부를 보도록 시험을 고침. 제품 영향은 바뀌지 않은 파일 하나의 크기·수정 시각 확인뿐임.
- 실패 2 (`sync with known paths ...`, EPERM): `temporaryRoot` 의 폴더 삭제 훅이 `graph.close()` 훅보다 먼저 등록되어 먼저 돎(node:test 의 after 는 등록 순서). 닫기와 삭제를 훅 하나에 넣음.
- 실패 3 (`a flush request ...`, EPERM): 제품 결함. `lib/watch/worker.js` 의 flush 처리가 `Promise.race([flushed, delay(FLUSH_WAIT_MS)])` 를 쓰는데, flush 가 먼저 끝나도 30초 타이머가 ref 상태로 남아 `stopWatcher` 가 stopped 를 받은 뒤에도 감시 프로세스가 최대 30초 살아 있음. 재현: 멈춘 뒤 20초 동안 pid 가 살아 있고 폴더 삭제 EPERM. W5(설치기가 멈춘 뒤 옛 런타임을 지움)에도 걸리는 문제임. `delay(FLUSH_WAIT_MS, undefined, { ref: false })` 로 고침. 고친 뒤 재현: 멈추자마자 pid 종료, 폴더 삭제 성공. 시험은 멈춘 뒤 pid 종료를 기다리게 함.
- 시험 결과: `node --test test/watch-speed.test.cjs` 2회 모두 tests 5, pass 5, fail 0, exit 0 (6.1초, 5.6초).
- 사본 지문: 위 두 파일이 바뀌어 `watch-speed.cjs` 의 `EXPECTED_AFTER_DIGEST` 와 플랜 8i 기대값을 `5121af91...` 로 고침(실행 세션의 8i 는 고치기 전 `1d99f2f9...` 와 일치했었음). 설치기 해시 두 개는 그대로. `verify` exit 0.
- 플랜 수정: 6단계의 worker.js 변경 후 문구, 8a 시험 내용(실제 파일과 187줄 같음을 확인), 8i 기대값.
- worker.js 가 바뀌었으므로 8e 부터 8i 까지 다시 돌린 뒤 9단계로 감.

## 실행 2026-11-04 17:40 (sync-speed-2-exec, 8e 재실행)

- 8e: `node --test test/watch-speed.test.cjs` 종료 코드 0. `tests 5, pass 5, fail 0` (root 가 고친 worker.js flush 타이머와 시험 2건 반영 뒤).
- 8f: `node --test` 회귀 10개 파일 종료 코드 0. `tests 82, pass 82, fail 0`.
- 8g: 문서·검색 8개 파일 종료 코드 0. `tests 55, pass 50, skipped 5, fail 0`.
- 8h: Pester `passed=2 failed=0`, 종료 코드 0.
- 8i: `node watch-speed.cjs verify` 출력 `5121af914838dd2fc5b02de4cbb7ededbc605bbb4cdbe4a54f1c8cbf3abae01c`, `install.ps1 0051db8d…`, `install.sh 352215fb…`, 종료 코드 0.
- 9단계: `node watch-speed.cjs after` 백그라운드 실행 시작.
- 9단계 결과: `node watch-speed.cjs after` 종료 코드 0. 검증 `True 0 True` (passed, 놓친 변경 0, 쉬는 중 상태 파일 쓰기 4회 이하).
  - 기준선 대 바꾼 뒤: 준비까지 3231 ms 대 6668 ms, 고친 직후 query 중앙값 20412 ms 대 1049 ms, 반영됨 true 대 true, 300개 대량 변경 뒤 준비까지 12309 ms 대 5293 ms, 놓친 변경 0 대 0, 20초 동안 watcher.json 쓰기 21회 대 4회.
  - 참고: 감시기 시작부터 준비까지는 늘었음(3231 대 6668 ms). 측정 한 번의 값이라 원인은 확정하지 않음.

## 실행 2026-11-05 10:20 (sync-speed-2-exec, 10단계와 V1~V6)

- 사용자 승인: AskUserQuestion 에서 10단계 "진행" 선택. 다른 KIT 배포 프로세스 확인(`Get-CimInstance` 로 kit-deploy, install.ps1 검색): 없음.
- 10a 빌드: `node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model` 종료 코드 0. zip 수정 시각 `2026-11-04 17:42:14`, 빌드 시작 `17:39:27` 뒤.
- 10b 설치: `install.ps1` 종료 코드 0, `install_ok=True`. 경고: 이전 릴리스 `1.1.2-015c21ba4c3d` 를 `libvips-42.dll` 사용 중이라 지우지 못함. 설치기는 새 CLI 준비 완료로 보고하고 정리를 나중에 다시 시도함.
- 10c 저장소 맞추기: robocopy 종료 코드 `1, 0, 1` (성공 범위 8 미만). `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`, `LICENSE` 는 `cmp` 로 같음 확인.
- 10 검증 (Bash): shim 해시 `d2765b11d20d`, `manifest.json` 일치 개수 `1`, `codegraph --help` 의 docs-batch `1`, KIT 와 저장소 source diff `0`, 저장소 `install.ps1` 의 Stop-ActiveWatchers `2`. 기대값 `1 1 0 2` 와 같음.

### V1~V6

| 항목 | 명령 | 종료 코드 | 마지막 줄 / 핵심 |
|---|---|---|---|
| V1 | `node --test ...watch-speed.test.cjs` | 0 | `tests 5, pass 5, fail 0` |
| V2 | `node --test` freshness, cli, indexing-regression, indexing-resolution, indexing-lock, indexing-revision, sync-speed | 0 | `tests 53, pass 53, fail 0` |
| V3 | `node --test` watcher, watcher-cli-edge, watcher-daemon | 0 | `tests 29, pass 29, fail 0` |
| V4 | `node --test` docs 8개 파일 | 0 | `tests 55, pass 50, skipped 5, fail 0` |
| V5 | `node watch-speed.cjs verify` | 0 | `install.sh 352215fb…` (지문 일치) |
| V6 | `node -e` `watch-speed.json` 의 `passed === true` | 0 | `True` |

- 로그: `D:/Fork/.AI/context/search-eval/work/v-runs/V1.log` ~ `V4.log`, `v5.log`.

### 측정 결과 (`results/watch-speed.md`)

| 항목 | 기준선 | 바꾼 뒤 |
|---|---|---|
| 감시기 시작부터 준비까지 ms | 3231 | 6668 |
| 고친 직후 query 중앙값 ms | 20412 | 1049 |
| 고친 내용이 query 에 반영됨 | true | true |
| 300개 대량 변경 뒤 준비까지 ms | 12309 | 5293 |
| 감시기가 놓친 변경 수 | 0 | 0 |
| 쉬는 20초 동안 watcher.json 쓰기 횟수 | 21 | 4 |

- 참고: 준비까지 시간은 늘었음(3231 → 6668 ms). 측정 한 번 값이라 원인은 확정하지 않음.

### 남은 감시기 프로세스

- 9단계 측정 도구는 임시 프로젝트 감시기를 `stopWatcher` 로 멈추고 임시 폴더를 지움. 프로세스 목록 확인은 아직 하지 않음. 10단계 뒤 확인 필요.

### 사람이 확인할 항목 (V7, V8)

- V7: `D:/Fork/KIT/test/Codegraph-Installer.Tests.ps1` 의 감시 이전 시험을 고친 뒤 `Invoke-Pester -Script` 로 두 파일 모두 돌림. 변경 전부터 실패하던 시험 이름을 Review Pack 에 적음. 이 실행에서는 확인하지 않음.
- V8: 위 표를 봄. 놓친 변경 0/0, 반영 true/true, 쉬는 중 쓰기 21 → 4(절반 이하), 고친 직후 query 중앙값이 줄었음. 준비까지 시간 증가는 사람이 판단.
- 남은 감시기 프로세스 확인(PowerShell Get-CimInstance, cg-watch-speed/cg-watch-flush/watch-speed): 0개.

## REVIEW 2026-11-05 (sync-speed-2-review)

- Review Pack: `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-2-review.md` (`pack.py build`: auto PASS 6/6, human 2, scope-out 830). `pack.py confirm` 은 부르지 않음(G2 는 사람).
- 플랜 대 diff: KIT 미스테이지 diff(묶음 1 은 스테이지됨)의 `source/lib` 파일 9개와 `watcher.js`(스테이지)가 플랜의 "바뀔 파일"과 일치. 새 시험 `watch-speed.test.cjs`, `Codegraph-Installer-WatcherStop.Tests.ps1` 있음. `Codegraph-Installer.Tests.ps1` 은 안 바뀜(V7 사람 몫과 일치). 플랜 밖 변경(확인 필요): KIT `test/Serena-Installer.Tests.ps1`, `Export-Dist`, `Install-Claude`, `Skill-LazyLoading` 시험, `hooks/`, `rules/RULES.md`, `settings.template.json`, `codex/AGENTS.md`, `distribution/`. 이 작업 것이 아닌 다른 세션 변경으로 보임. 이 저장소 scope-out 830 은 더티 작업 트리 때문.
- 코드 리뷰(W1 W2 W3 W5): 확실한 결함 없음.
  - 확인 필요 1: 국소 sync 는 `file_inventory` 에 있는 경로만 믿음(`index.js resolveSyncTargets`). inventory 에 gitignore 대상 행이 있을 수 있다면 국소 sync 가 전체 sync 와 달리 그 파일을 색인할 수 있음. inventory 가 보이는 파일만 담는지 확인 필요.
  - 확인 필요 2: `watcher.js flush` 의 `lastFullSyncAt` 초기값 0 이라 시작 뒤 첫 맞추기는 항상 전체 sync(의도에 부합). 시작 때 전체 sync 가 이미 돌았는지는 확인 안 함. 낭비일 뿐 결함은 아님.
  - 경미: `install.ps1` 의 `$restartProjects`(359, 377줄)는 W5 뒤 읽는 곳이 없음. 무해.
  - 측정: 감시기 시작부터 준비까지 3231 → 6668 ms 증가, 원인 미확정(사람이 V8 에서 판단).
- V1~V6 재실행: V1 5/5, V2 53/53, V3 29/29, V4 55 중 50 통과 5 건너뜀, V5 지문 `5121af91…` 일치, V6 `passed===true`. 종료 코드 모두 0. 실행 기록과 같음.
- 사람 확인: V7(Pester 감시 이전 시험 고치기와 두 파일 실행), V8(watch-speed.md 표 판단, 준비 시간 증가 포함).

## 검수 2026-11-05 11:38 (root, REVIEW)

리뷰 세션(sync-speed-2-review)의 결과를 루트가 다시 확인하고, 묶음 1 에서 미룬 주석 어투(W1)를 이번에 고침.

### 리뷰 세션의 "확인 필요" 판정

| 항목 | 루트 확인 | 판정 |
|---|---|---|
| 1. 국소 sync 가 `file_inventory` 경로만 믿음 | `resolveSyncTargets`(`lib/index.js:769`)는 모든 경로가 `file_inventory` 에 있어야 국소 sync 를 함. 그 표는 지난 전체 sync 의 보이는 파일 목록에서만 채워짐(`inventory/index.js`). 이름이 `.gitignore`, `.codegraphignore` 인 경로는 전체 sync 로 감. 남는 틈: `.git/info/exclude` 나 전역 gitignore 처럼 프로젝트 트리 밖에서 바뀐 무시 규칙은 이벤트가 없어, 그 파일을 고치면 다음 전체 맞추기 전까지 다시 색인될 수 있음 | 받아들임(드문 경우, 다음 전체 맞추기가 바로잡음) |
| 2. `lastFullSyncAt` 초기값 0 | `start()` 가 `fullSyncPending = true` 로 두고(`watcher.js:163`), 준비 뒤 첫 `flush` 가 전체 sync 를 한 뒤 `lastFullSyncAt` 을 기록함(`watcher.js:395-396`). 시작 때 전체 sync 는 한 번뿐임 | 결함 아님 |
| 경미: `install.ps1` 의 `$restartProjects` | W5 뒤 읽는 곳이 없는 대입이 남음(기준 11, 이 변경이 만든 고아 변수) | 바로 고침: `$restartProjects = @()` 줄을 지우고 `$null = Stop-TargetWatchers $staged $target` 로 바꿈. 멈추는 동작은 그대로 |
| 측정: 시작부터 준비까지 3231 → 6668 ms | 같은 임시 프로젝트(C# 400, md 100)로 지금 코드를 3번 잼: 2398, 2636, 2837 ms (CPU 평균 13%). 기준선 3231 ms 보다 짧음. 측정표의 6668 ms 는 부하가 높을 때 한 번 잰 값 | 회귀 아님 |

### 고친 것

- W1(묶음 1 에서 미룸) + 묶음 2 의 같은 문제: 묶음 1, 2 가 더한 한국어 주석 41줄(16개 파일)의 해라체를 저장소 규칙인 음슴체로 바꿈. 바이트 단위 정확 치환이라 줄바꿈은 그대로임. 안 B, C 플랜의 변경 전 문구가 이 41줄을 인용하지 않음을 확인함. 바뀐 파일 모두 `node --check` 통과. 플랜 본문의 주석 문구는 고치지 않았으므로 코드와 어투만 다름.
- `install.ps1` 고아 대입(위 표).
- 주석과 설치기가 바뀌어 `watch-speed.cjs` 의 기대 지문을 고침: 소스 `75bb11d5…`, `install.ps1` `43a5f31f…`. 플랜 8i 기대값도 같이 고침. `verify` exit 0.
- 이 저장소 `source/` 와 `install.ps1` 을 KIT 와 다시 맞춤(robocopy exit 1, `diff -rq` 0줄, `install.ps1` cmp 같음).

### 검증

| 확인 | 명령/형식 | 핵심 출력 |
|---|---|---|
| 배포본 | 전역 shim 끝 12자를 `manifest.json` sha256 에서 찾음 | `082970d3aae9`, 일치 1. 옛 릴리스 폴더 정리됨, 도는 감시 프로세스 0 |
| 주석 수정 뒤 Review Pack | `pack.py build main-2026-11-04-codegraph-sync-speed-2` | auto PASS 6/6 |
| 설치기 수정 뒤 | PowerShell 파서 오류 0, `Invoke-Pester -Script ...WatcherStop.Tests.ps1` | passed=2 failed=0 |
| 시작 시간 재측정 | ready-time 스크립트 3회 | 2398, 2636, 2837 ms |

- 배포된 설치본(`082970d3aae9`)은 주석과 설치기 고아 대입 수정 전 빌드임. 동작 차이는 없음. 다음 빌드(안 B)에서 함께 들어감.

## 재설치 뒤 확인 2026-11-05 15:27 (root)

| 확인 | 명령/형식 | 핵심 출력 |
|---|---|---|
| 설치본 | 전역 shim 끝 12자와 `manifest.json` | `082970d3aae9`, 일치 1. shim 11-05 11:22, zip 11-05 10:44 (사용자 재설치는 같은 zip 을 설치함) |
| 설치본과 KIT source | `diff` 설치 `lib/dist` 와 KIT `source/lib`, 다른 줄 분류 | 16개 파일, 다른 줄 84줄 모두 주석(REVIEW 의 어투 수정). 동작은 같음 |
| 릴리스와 감시 프로세스 | 설치 폴더 목록, `worker.js` node 프로세스 | 릴리스 1개, 감시 프로세스 0. 레지스트리 18건 |
| 임시 폴더 | `%TEMP%\cg-*` | 892개, 184.8MB. 2026-06-11 부터 쌓임(KIT 시험 묶음이 Windows 에서 남김). 11-04~05 에 308개 |
| V7 | `Invoke-Pester -Script test/Codegraph-Installer.Tests.ps1` 상태 | 파일 그대로(09-08). 4건 중 3건 실패(`Upgrade-Watchers` 없음). 사람 몫으로 남음 |
| 설치본 동작 | `codegraph --version`, `--help` 의 docs-batch, Arcyn query | 1.1.2, 1, 결과 나옴 |
| Arcyn query 시간(CPU 8%) | sync 포함 / `--no-sync` 각 3회 | 2353·2351·2141 / 1551·1683·1768 ms. sync 몫 약 0.4~0.8초 |
| query 의 모델 로딩 | `--no-sync`, `CODEGRAPH_DISABLE_EMBEDDINGS=1` 과 비교 각 2회 | 끔 341·484 ms, 켬 1964·1726 ms. query 마다 관련 문서 부분의 임베딩 모델 로딩에 약 1.3~1.5초 (innovate K2 와 같은 비용) |

## V7 2026-11-05 15:30 (root, 사용자 승인 "Rewrite V7 here")

- 대상: KIT `test/Codegraph-Installer.Tests.ps1`. 플랜의 바뀔 파일 목록 밖이라 사용자가 채팅에서 승인함(RULE-4).
- 바꾼 것: 지운 `Upgrade-Watchers` 를 부르던 3건을 W5 의 `Stop-ActiveWatchers` 시험 4건으로 바꿈. (1) 목록의 감시기를 모두 `stopWatcher` 로 멈추고 `ensureWatcher` 는 부르지 않음 (2) 멈춘 뒤에도 active 면 실패 (3) stopPending 이면 실패 (4) `CODEGRAPH_NO_WATCH=1` 이면 감시기를 건드리지 않음. `Stop-TargetWatchers` 시험 1건과 fixture 구성은 그대로. Pester 3 문법, 줄바꿈 LF(HEAD 와 같음).
- 실행: `Invoke-Pester -Script test/Codegraph-Installer.Tests.ps1, test/Codegraph-Installer-WatcherStop.Tests.ps1 -PassThru` → passed=7 failed=0. 변경 전부터 실패하던 시험 없음. 남은 fixture 폴더 0.
