# 속도 묶음 1, 2 PLAN 작성 메모 (미완성, 2026-11-04)

> 끝남(2026-11-04 PLAN 세션): 플랜은 `main-2026-11-04-codegraph-sync-speed.md`(묶음 1)와 `main-2026-11-04-codegraph-sync-speed-2.md`(묶음 2)다. 아래 메모와 다른 결정(K1 갱신 시점, R2 의 바이너리 판별 재사용 범위, R5 추가, W5 시험)은 플랜의 설계 메모와 innovate 12절이 우선한다.

PLAN 도중 사용량 한도로 멈춤. 다음 세션은 이 메모로 묶음 1 플랜(`main-2026-11-04-codegraph-sync-speed-1.md`)부터 쓴다. 정확한 변경 전/후 문구는 아직 없다.

## 묶음 1 설계 결정

- R4: `lib/docs/scan-files.js` 61줄 뒤에 `BINARY_EXT` 를 두고 `classifyTextDocument` 첫 줄에서 바로 null 을 돌려줌. 목록: png jpe?g gif bmp tga psd exr hdr tiff? ico webp dds ktx2? wav mp3 ogg flac aiff? m4a mp4 mov avi webm mkv ttf otf woff2? zip 7z rar gz tgz bz2 xz unitypackage dll exe pdb so dylib wasm pdf docx xlsx pptx fbx blend1?. 다섯 프로젝트의 `file_inventory` 를 확인함: 이 확장자 중 문서로 분류된 파일은 없음. obj, dae, svg, ma, bytes 는 텍스트일 수 있어 뺌.
- R3: `listTextDocumentFiles` 에서 `isPathWithinRootReal` 을 비밀 경로, 소스 파일 거르기 뒤로 옮김(지금은 소스 2197개에도 realpath 함). `gitVisibleFiles(root, ig)` 가 `statSync` 전에 무시 규칙으로 거름. 코드 추출 walk 와 문서 walk 합치기는 하지 않음: 서브모듈(`--recurse-submodules`)과 심볼릭 링크 처리가 달라 색인 파일 집합이 바뀜.
- R2: `lib/inventory/classifier.js` 에 `createDocumentClassifier(db, projectRoot)` 추가. `file_inventory` 의 path, size, modified_at, mime_type, adapter_id, adapter_version 을 읽어, 크기와 수정 시각이 같고 (adapter_id 가 `document.*` 이고 adapter_version '1') 이거나 mime 이 `application/octet-stream` 이면 열지 않고 그 판별을 씀. 그 밖은 지금처럼 realpath + 판별. 한 sync 안에서는 경로별로 결과를 기억해 문서 스캔과 파일 목록 갱신이 같은 결과를 씀. `lib/index.js` `sync` 가 만들어 `indexMarkdown`(opts.classify → `listTextDocumentFiles` 넷째 인자)과 `refreshFileInventory`(opts.classify → `classifyFile` 여섯째 인자)에 넘김. `indexAll` 은 바꾸지 않음. 근거: `indexer.js:129-135` 도 크기와 수정 시각으로 다시 읽기를 건너뜀.
- K1: `db/queries.js` `getDominantFile` 을 계산부(`computeDominantFile`)와 읽기부로 나눔. 지문 = `SELECT COUNT(*) AS c, MAX(rowid) AS m FROM edges` (Arcyn 6~7ms, 차가울 때 116ms). `refreshDominantFile()` 은 `project_metadata` 의 `dominant_file` 에 `{fingerprint, dominant}` 를 저장하고, `sync` 끝(인벤토리 갱신 뒤)과 `indexAll` 끝에서 부름. 읽기부는 지문이 같으면 저장값, 다르면 계산만 하고 저장하지 않음(읽기 경로는 쓰지 않음). 집계 SQL 은 Arcyn 에서 0.74~3.3초.
- 측정 스크립트: `D:/Fork/.AI/context/search-eval/sync-speed.cjs` baseline/after. 프로젝트 다섯 곳에서 워밍업 1번 + `query` sync 포함 3번 중앙값, Arcyn 은 `context` 도. `file_inventory` 의 status, adapter_id 별 개수 스냅샷을 전후 비교.
- 시험: `test/sync-speed.test.cjs`. (1) 바뀐 것 없는 sync 에서 루트 아래 `fs.openSync` 호출 0, 문서 고치면 다시 색인됨 (2) 텍스트 내용의 `fake.png` 는 문서 아님 (3) `dominant_file` 저장값 사용과 코드 변경 뒤 갱신.
- 회귀 시험 기준선(2026-11-04): freshness, cli, indexing-regression, indexing-resolution, indexing-lock, indexing-revision 46/46 통과. watcher, watcher-cli-edge, watcher-daemon 통과. `watcher-hooks.test.cjs` 는 변경 전부터 3건 실패("PowerShell session hook selects nearest index without crossing a nested Git root" 하위 2건)라 수락 기준에서 뺌.
- 배포 단계는 안 A 10단계(고친 판, PowerShell 도구)와 같음. 사용자 승인 필요.

## 묶음 2 에서 아직 읽을 것

- `lib/sync/watcher.js` 의 `scheduleSync` 와 sync 호출부(약 340~420줄), `lib/index.js` 의 `watch`, `lib/watch/worker.js` 요청 처리(85~110줄)와 `persist`, `lib/watch/protocol.js` 의 `request`, `extraction/index.js` `sync`(1243~1400줄), `install.ps1` `Upgrade-Watchers`(139줄 부근)와 `test/Codegraph-Installer.Tests.ps1` 의 감시 이전 시험.
