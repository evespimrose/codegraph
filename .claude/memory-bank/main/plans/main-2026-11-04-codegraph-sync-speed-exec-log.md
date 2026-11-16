- 주의: 이 실행 기록 파일은 실행 전에 없었음. 플랜은 "끝에 덧붙인다" 라고 썼으나 파일이 없어 새로 만듦. 앞 절은 없음.

## 실행 2026-11-04 (sync-speed-1-exec)
- 1단계: `D:/Fork/.AI/context/search-eval/sync-speed.cjs` 새로 씀. 검증 `node --check` → `exit=0`. 일치.
- 2a: `node sync-speed.cjs check` → `122d32cc87b51958633f78052c982b3f989a2bdcae2aa97559f96b4e7738b72c`, `exit=0`. 일치.
- 2b: `baseline` 를 백그라운드로 돌림. 끝난 뒤 `results-sync-baseline.log` 마지막 줄 `exit=0`. 검증 `5 True True`. 일치.
- 3: `scan-files.js` 3a~3f, `scan-files.d.ts` 3g 적용. 검증 1 `1 1 1 2 1 1 1 1`, 검증 2 `1 1 1`, 검증 3 `load ok`. 일치.
- 4: `classifier.js` 4a~4d, `classifier.d.ts` 4e~4f 적용. 검증 `1 1 1 1 1`, `1 1 1`, `load ok`. 일치.
- 5: `inventory/index.js` 5a, `index.d.ts` 5b, `docs/indexer.js` 5c, `indexer.d.ts` 5d 적용. 검증 `1`, `1`, `1`, `1`, `load ok`. 일치.
- 6: `queries.js` 6a~6b, `queries.d.ts` 6c 적용. 검증 `1 1 1 1 1`, `1 1 1`, `load ok`. 일치.
- 7: `index.js` 7a~7f, `index.d.ts` 7g, `freshness.js` 7h~7i, `bin/codegraph.js` 7j 적용. 검증 `1 1 1 2 1`, `1`, `1 1`, `1`, `load ok`. 일치.
- 8a: `sync-speed.test.cjs` 새로 씀. `node --test` 결과 `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`, exit=0. 일치.
- 8b: 회귀 9개 파일 결과 `ℹ tests 75`, `ℹ pass 75`, `ℹ fail 0`, `ℹ skipped 0`, exit=0. 일치.
- 8c: 문서·검색 8개 파일 결과 `ℹ tests 55`, `ℹ pass 50`, `ℹ fail 0`, `ℹ skipped 5`, exit=0. 일치(건너뜀 5건은 시험 파일의 조건부 건너뜀).
- 8d: `node sync-speed.cjs verify` → `6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3`, `exit=0`. 일치.
- 9: `node sync-speed.cjs after` → `results-sync-after.log` 마지막 줄 `exit=0`. `results/sync-speed.json` 의 `passed` = `True`, 프로젝트 5개. 표 요약(중앙값 ms):
  - query: arcyn 12665 → 1466, rx1 2059 → 1255, blade 4548 → 2783, zyxel 17621 → 9747, atom 2982 → 4312
  - context: arcyn 6675 → 3176
  - 새 판별 불일치 0, 기준선 불일치 0, 바이너리 확장자로 빠진 문서 0, 빠진 .codegraph 항목 0, 그사이 바뀐 파일 0, 감시기 모두 꺼짐
  - 주의: atom query 4312 ms 는 기준 2982 ms 보다 큼. 확인 재측정(같은 명령 3회, CODEGRAPH_NO_WATCH=1): 1440, 1615, 1574 ms. 한 번 잰 값의 잡음으로 보임. 플랜 V7 의 "모든 프로젝트 query 뒤 < 기준" 은 측정 1회 기준으로는 atom 이 어긋남. 사람 확인 항목으로 남김.
- 10 승인: AskUserQuestion 으로 "진행" 과 "다른 세션의 KIT 배포 없음" 을 받음.
- 10a: PowerShell 도구로 `node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model` 를 백그라운드로 돌림.
- 10a 빌드: exit=0. `artifacts/codegraph-win32-x64.zip` 수정 시각 2026-11-04 16:27:39. 일치.
- 10b 설치: `install.ps1` exit=0. 경고 한 줄: 옛 설치본 `1.1.2-8e92ff564f22` 의 `libvips-42.dll` 이 잠겨 삭제 못 함. 새 CLI 는 준비됨, 정리는 나중에 재시도됨. 검증: shim 해시 `015c21ba4c3d` 가 manifest 에 1건, `docs-batch` 1건. 일치.
- 10c 맞추기: robocopy 와 Copy-Item 실행, 오류 없음. 검증 `1`, `1`, `0`, `exit=0`, 그리고 `sync-speed.cjs verify` → `6a94b2980f69...`, `exit=0`. 일치.

## V1~V6 (수락 기준 auto 항목)
| 항목 | 명령 | 종료 코드 | 마지막 줄 / 요약 |
|---|---|---|---|
| V1 | node --test sync-speed.test.cjs | 0 | pass 6, fail 0 |
| V2 | node --test freshness, cli, indexing-regression, indexing-resolution, indexing-lock, indexing-revision | 0 | pass 46, fail 0 |
| V3 | node --test watcher, watcher-cli-edge, watcher-daemon | 0 | pass 29, fail 0 |
| V4 | node --test docs-batch 외 7개 | 0 | pass 50, skipped 5, fail 0 |
| V5 | node sync-speed.cjs verify | 0 | 6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3 |
| V6 | node -e 결과 passed 검사 | 0 | results/sync-speed.json passed = true |

사람 확인 항목(V7, V8)은 사용자가 본다. 실행 로그 요약은 `D:/Fork/.AI/context/search-eval/results/sync-speed.md`.

## 검수 2026-11-04 16:35 (root, REVIEW)

### code-review (14개 기준, KIT 변경 파일 13개와 새 시험 1개)

- Critical: 0건.
- 플랜 대조: R2(`createDocumentClassifier`, `reuseStoredVerdict`), R3(realpath 를 비밀·소스 거르기 뒤로), R4(`BINARY_EXT`, `isBinaryPath`), R5(`OWN_DATA_PATH`), K1(`getEdgeFingerprint`, `refreshDominantFile`, `computeDominantFile`) 모두 플랜과 같음.
- 신선도: 다시 쓰는 판별은 크기와 수정 시각이 같을 때만이며, 문서 확장자의 바이너리 판별, 형식이 바뀐 확장자, 바깥 경로, DSL 은 다시 판별함. K1 지문은 `edges.id` AUTOINCREMENT 라 삽입은 최댓값, 삭제는 개수를 바꿈. 읽기 경로는 쓰지 않음.
- 빈 `catch` 3곳(판별기의 표 읽기, `refreshDominantFile` 두 곳)은 주석이 있는 최선 노력 처리이고, 실패하면 지금처럼 새로 판별하거나 context 가 계산함. 받아들임.
- 줄바꿈: 바뀐 7개 파일의 원시 diff 와 줄바꿈 무시 diff 가 같음(111+/15-).
- 미룬 경고:

| 표시 | 기준 | 내용 | 미룬 이유 |
|---|---|---|---|
| W1 | 1 | 새 주석이 해라체이고 `createDocumentClassifier`, `refreshDominantFile` 에 여러 줄 `/** */` 가 붙음. 저장소 규칙은 인라인 음슴체 한 줄 | 묶음 2 플랜의 변경 전 문구가 `lib/index.js` 주석("같은 판별 결과를 쓴다 … 열지 않는다")을 2번 인용함. 지금 고치면 묶음 2 정확 일치 편집이 깨짐. 묶음 2 REVIEW 때 한 번에 고침 |
| W2 | 13 | `createDocumentClassifier` 와 `refreshFileInventory` 가 같은 sync 에서 `file_inventory` 를 각각 한 번씩 읽음 | 행 수 수천 개에 수 ms. 합치려면 두 함수의 인자 계약을 바꿔야 함 |

### 검증

| 확인 | 명령/형식 | 핵심 출력 |
|---|---|---|
| 배포본 | 전역 shim 끝 12자를 KIT `manifest.json` sha256 에서 찾음 | `015c21ba4c3d`, 일치 1 |
| 저장소 사본 | `diff -rq` KIT source 와 이 저장소 source (node_modules 제외) | 0줄 |
| atom 느려짐 확인 | 배포본 `codegraph query "사업 목표" -p <atom>` 6번 (CODEGRAPH_NO_WATCH=1) | 2163(워밍업) 2000 1836 2160 1736 2015 ms. 기준 2982 ms 보다 모두 빠름. 측정표의 4312 ms 는 한 번 잰 값의 잡음 |
| V8 미리 확인 | 배포본 `codegraph context "inventory grid layout" -p D:/Fork/Arcyn` 2번 | 6240, 5979 ms, 두 번 모두 코드 블록 4개. 둘째가 느리지 않음 |
| 부하 중 재측정 | Arcyn query sync / context --no-sync / context sync 각 2번, CPU 평균 34%(다른 세션 실행 중) | 4093·2521 / 2724·2379 / 4563·4230 ms. 부하에 따라 흔들림이 큼. 짝지어 잰 측정표와 V1(바뀐 것 없는 sync 에서 파일 열기 0)이 근거 |

## W1 처리 2026-11-05 11:38 (root)

- 묶음 1 검수의 W1(주석 어투)은 묶음 2 REVIEW 에서 고침. 상세: `main-2026-11-04-codegraph-sync-speed-2-exec-log.md` 의 `## 검수 ... (root, REVIEW)` 절.
