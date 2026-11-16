# 실행 기록: 안 B (main-2026-11-03-codegraph-search-b)

## 실행 2026-11-05 16:11 (search-b-exec)

선행 조건: `main-2026-11-03-codegraph-search-a.state` 가 `STATUS=done` 임을 확인함 (MODE=REVIEW, CURRENT=E1: 완료. G2 통과 2026-11-04).

결과 요약: 1~6단계 통과. 6단계 시험 1건 실패. 7단계 편집은 6단계 실패를 읽기 전에 끝났음(아래 참고). 8단계와 9단계, V1~V3 은 실행하지 않음. 상태 파일 `MODE=BLOCKED`.

### 1단계: 조정값 키 추가 (통과)
- 조회: `CODEGRAPH_NO_WATCH=1 codegraph query "loadSearchTuning" -p D:/Fork/KIT --no-sync -l 2`, 결과 `tools/codegraph/source/lib/search-tuning.js:10`
- 변경: `search-tuning.js` 의 `cached` 객체 끝에 `codeVectors`, `codeVectorWeight`, `codeVectorScore` 세 줄 추가
- 검증: `node -e "...loadSearchTuning()..."` 출력 `false 1 20`. 기대 `false 1 20` 과 일치.

### 2단계: 코드 벡터 모듈 (통과)
- 변경: `lib/search/code-vectors.js` 새 파일 생성 (플랜 내용 그대로)
- 검증: `node -e "...m.CODE_VECTOR_KINDS.length..."` 출력 `9 2`. 기대 `9 2` 와 일치.

### 3단계: index.js 진입점과 연결 (통과)
- 조회: `codegraph callers` 와 `codegraph query` 로 `searchNodes` 위치 확인
- 3a(require 줄), 3b(`searchNodesHybrid`), 3c(`indexAll` 벡터 동기화), 3d(`sync` 벡터 동기화), 3e(`index.d.ts` 선언) 적용
- 검증: `require('./lib/index.js')` 로드 성공. 개수 검사 출력 `2 1 1`. 기대 `2 1 1` 과 일치.
- 참고: `index.d.ts` 읽기 전 Cave-Man 가드가 차단함. 그 뒤 `codegraph query "searchNodes"` 를 실제 조회로 한 번 돌리고 읽음.

### 4단계: query 명령의 하이브리드 검색 (통과)
- 변경: `lib/bin/codegraph.js` 의 `cg.searchNodes(search, {` 를 `await cg.searchNodesHybrid(search, {` 로 바꿈
- 검증: 개수 검사 출력 `1`. 기대 `1` 과 일치.

### 5단계: 맥락 검색의 벡터 채널 (통과)
- 조회: `codegraph context "findRelevantContext symbol search channels" -p D:/Fork/KIT --no-sync -f json`
- 5a(require 두 줄), 5b(`vectorSearch` 시작), 5c(최종 정렬 전 벡터 보너스) 적용
- 검증: 개수 검사 출력 `1 1`. 기대 `1 1` 과 일치. `require('./lib/context/index.js')` 로드 성공.

### 6단계: 시험 (실패, 멈춤)
- 파일: `source/test/code-vectors.test.cjs` 새 파일 (플랜 내용 그대로)
- 실행: `node --test code-vectors.test.cjs search-tuning.test.cjs indexing-regression.test.cjs cli.test.cjs` (백그라운드, 로그는 scratchpad `step6.log`)
- 결과: `ℹ tests 37`, `ℹ pass 36`, `ℹ fail 1`, 종료 코드 1
- 실패 시험: `symbol text carries kind, qualified name, path and signature`
  - 실제: `'method Loadout::Rebuild\na/Loadout.cs\nvoid Rebuild()\n rebuilds slots'`
  - 기대: `'method Loadout::Rebuild\na/Loadout.cs\nvoid Rebuild()\nrebuilds slots'`
- 원인 분석: `symbolText` 의 `docstring` 은 `replace(/\s+/g, ' ')` 뒤에 앞뒤 공백이 남음(`' rebuilds slots '`). 이 값을 줄바꿈 뒤에 이어 붙이면 줄 머리에 공백이 남음. 최종 `.trim()` 은 문자열 전체의 앞뒤만 자르므로 중간 줄의 공백은 지우지 못함. 플랜의 2단계 코드와 6단계 기대값이 서로 맞지 않음.
- 판단: 플랜 기대값을 바꾸거나 2단계 코드를 바꾸는 일은 사용자 결재 범위라 고치지 않고 멈춤.
- 나머지 35개 시험은 통과함. 실패는 EPERM 정리 오류가 아님.

### 7단계: 측정 도구 (6단계 실패 뒤에 편집이 끝남, 검증은 통과)
- 7a: `run.cjs` 의 `codeOnce` 키워드 검색을 `searchNodesHybrid` 쪽으로 바꿈 (`cg.searchNodesHybrid ? ... : ...`)
- 7b: `run.cjs` 끝의 `main()` 호출을 `require.main === module` 으로 감싸고 `module.exports` 추가
- 7c: `search-eval/run-b.cjs` 새 파일 생성 (플랜 내용 그대로)
- 검증: `node -e "const r=require('./run.cjs'); ..."` 출력 `function function 2`. 기대 `function function 2` 와 일치.
- 참고: 7단계는 플랜 순서상 6단계 뒤에 와야 함. 6단계 실패를 읽기 전에 실행했음. 루트 세션이 되돌릴지 정해야 함.

### 8단계, 9단계, V1~V3
- 실행하지 않음. 8단계는 `run-b.cjs` 를 실행하는 측정이라 6단계 결정 뒤에 해야 함. 9단계는 승인 질문 전이라 시작하지 않음.

### 바뀐 파일 (이 실행 기준)
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js` (수정)
- `D:/Fork/KIT/tools/codegraph/source/lib/search/code-vectors.js` (새 파일)
- `D:/Fork/KIT/tools/codegraph/source/lib/index.js` (수정)
- `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts` (수정)
- `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js` (수정)
- `D:/Fork/KIT/tools/codegraph/source/lib/context/index.js` (수정)
- `D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs` (새 파일)
- `D:/Fork/.AI/context/search-eval/run.cjs` (수정, 7단계)
- `D:/Fork/.AI/context/search-eval/run-b.cjs` (새 파일, 7단계)
- 상태 파일 `main-2026-11-03-codegraph-search-b.state`: `MODE=BLOCKED`, `CURRENT` 의 E1 칸 갱신

커밋, 브랜치 전환, stash, git add 는 하지 않음.

## 실행 2026-11-05 16:15 (root, S6 멈춤 해결)

- 원인: 플랜 2단계의 `symbolText` 가 docstring 의 공백을 하나로 줄이기만 하고 앞뒤를 자르지 않음. `'  rebuilds\n slots '` 가 `' rebuilds slots '` 가 되어 줄바꿈 뒤에 붙으면 줄 머리에 공백이 남음. 마지막 `.trim()` 은 문자열 전체의 앞뒤만 자름. 시험 기대값(`rebuilds slots`)이 의도이고 코드가 틀림. 플랜을 쓴 루트 세션의 결함임.
- 수정: `lib/search/code-vectors.js` 18줄을 `.replace(/\s+/g, ' ').trim().slice(0, 300)` 으로 고침(자른 뒤 300자를 셈). 플랜 2단계 코드도 같게 고침.
- 확인: 6단계 검증 명령(`code-vectors`, `search-tuning`, `indexing-regression`, `cli` 시험) 결과 tests 37, pass 37, fail 0, exit 0.
- 7단계는 6단계 결과를 읽기 전에 실행됐지만 6단계 결과에 기대지 않는 측정 도구 편집이고 검증도 통과해 그대로 둠.
- 8단계부터 다시 함.

## 실행 2026-11-05 16:21 (search-b-exec, 재개)

### 6단계 재확인 (통과)
- 명령: 6단계 검증과 같은 `node --test` 네 파일. 로그는 scratchpad `step6-rerun.log`
- 결과: `ℹ tests 37`, `ℹ pass 37`, `ℹ fail 0`, `exit=0`. 기대 `fail 0` 과 일치.
- `code-vectors.js` 18줄이 `.replace(/\s+/g, ' ').trim().slice(0, 300)` 인지 Grep 으로 확인함.

### 8단계: 측정 (무효, 멈춤)
- 실행: `node run-b.cjs` (백그라운드). 로그 `results-sweep-b.log`: 마지막 줄 `codeVectors=true`, `exit=0`.
- 검증 명령 `t['codeVectors'] == (r['passed'] is True)` 는 `True` 를 냈음.
- 그러나 결과가 무효임:
  - `sweep-b.json` 의 `builds` 에서 rx1, arcyn 모두 `enabled: False`, `total: 0`. 벡터가 한 개도 안 만들어짐.
  - 그래서 켠 쪽 측정이 끈 쪽과 같음. 9개 후보 모두 rx1 kw report Hit@1 40, nl report Hit@1 0 으로 같음.
  - 그래도 `pick` 이 `winner` 0.5/10 을 골라 `passed` 가 참이 됨. 같은 점수의 후보가 이긴 것처럼 기록됨.
- 원인: `run.cjs` 14~15줄 `MODEL_ROOT` 기본값이 `C:/Users/JANGHYEONGTAEK/.local/share/team-tech-support-harness/codegraph/1.1.2-345c0b4f3c8e/win32-x64/lib/models` 인데 이 경로가 없음. 자식 프로세스 `ENV` 가 이 값을 덮어써서 `isEmbedAvailable()` 가 false 가 됨. 셸 기본 환경(모델 경로 미지정)에서는 `isEmbedAvailable()` 가 true 임을 확인함.
- 재현: 임시 복사본(`work/diag-b`)에서 build 자식을 같은 env 로 돌려 `{"enabled":false,"total":0,...}` 을 확인함. 임시 폴더는 지움.
- 조치:
  - `search-tuning.json` 에서 `codeVectors: true`, `codeVectorWeight`, `codeVectorScore` 세 키를 빼서 원래 상태로 되돌림. 무효 측정으로 기능이 기본 켜짐이 되는 것을 막기 위함.
  - `run.cjs` 의 모델 경로와 `sweep-b.json` / `sweep-b.md` 는 건드리지 않음. 루트가 정함.
- 따라서 V3(`t.codeVectors === (r.passed === true)`)는 지금 `False` 가 됨. `sweep-b.json` 의 `passed` 가 무효 결과라서 생긴 불일치임.

### 9단계, V1~V3, V4·V5
- 9단계는 승인받았으나(사용자 응답: 실행 승인, 배포 세션 없음) 8단계 결과가 무효라 시작하지 않음. 배포할 값이 없음.
- V1~V3 은 실행하지 않음. V3 은 위와 같은 이유로 실패할 것임.
- V4, V5 는 사람 확인 항목으로 남김.

### 상태
- 상태 파일 `MODE=BLOCKED`, `CURRENT` 의 E1 칸 `멈춤 S8`.
- 루트가 할 일: `run.cjs` 모델 경로를 실제 모델 위치로 고치거나 환경 변수를 비우고, 8단계를 다시 돌림. 그 뒤 9단계 승인과 V1~V3 을 진행함.

## 실행 2026-11-05 16:26 (root, S8 멈춤 해결)

- 원인: `run.cjs` 14~15줄의 `CODEGRAPH_MODEL_ROOT` 기본값이 옛 설치본 `1.1.2-345c0b4f3c8e` 의 `lib/models` 임. 그 폴더는 2026-11-03 안 A 배포 때 지워짐. 자식 프로세스가 이 값을 받아 `isEmbedAvailable()` 이 false 가 되고 코드 벡터가 0개 만들어짐. `run-b.cjs` 는 빌드 결과를 확인하지 않아 같은 점수의 후보로 `codeVectors=true` 를 씀. 실행 세션이 이를 찾아 `search-tuning.json` 을 되돌린 판단은 맞음.
- 안 A 결과 영향 없음: 안 A 의 baseline(11-03 13:22), sweep(13:43)은 옛 설치본이 지워지기 전(13:59 배포)에 돌았음. 묶음 1 의 `sync-speed.cjs` 는 shim 으로 모델을 찾고, 묶음 2 는 임베딩을 끈 채 잼.
- 수정: `run.cjs` 는 전역 shim 이 가리키는 설치 폴더의 `lib/models` 를 쓰고 `model-manifest.json` 이 없으면 멈춤(`installedModelRoot`, `sync-speed.cjs` 와 같은 방식). `run-b.cjs` 는 빌드가 비활성이거나 벡터 0개면 `search-tuning.json` 을 쓰기 전에 멈춤. 플랜 7c 내용과 8단계 수정 기록도 고침.
- 확인: 두 파일 `node --check` 통과. `run.cjs` 의 모델 경로가 `1.1.2-082970d3aae9/win32-x64/lib/models` 로 풀림. 그 경로로 KIT 소스의 `isEmbedAvailable` true, 질의 임베딩 384차원. 임시 C# 3개 프로젝트에서 `node run-b.cjs build` → `{"enabled":true,"total":6,"embedded":6,...}`.
- 그대로 둔 것: `pick` 은 켠 쪽이 끈 쪽과 같은 점수여도 켬. G1 승인 기준(V4 "이상")과 같으므로 바꾸지 않음. 사람이 V4 에서 판단함.
- 8단계부터 다시 함.

## 실행 2026-11-05 17:05 (search-b-exec, 8단계 재실행과 9단계 시작)

### 8단계: 측정 (통과)
- 실행: `node run-b.cjs` (백그라운드, 로그 `results-sweep-b.log`). 마지막 줄 `codeVectors=true`, `exit=0`.
- `builds`: rx1 `enabled: true`, `total: 2471`, `embedded: 2471`, 첫 임베딩 122698 ms. arcyn `enabled: true`, `total: 22418`, `embedded: 22418`, 첫 임베딩 953573 ms.
- 선택: `codeVectorWeight` 1, `codeVectorScore` 40, 판정 `ok` (`passed: true`).
- report 표 (끔 → 켬):
  - rx1 kw Hit@1 40 → 50, rx1 nl Hit@1 0 → 40, rx1 kw Hit@5 50 → 100, rx1 nl Hit@5 0 → 40
  - arcyn kw Hit@1 40 → 40, arcyn nl Hit@1 0 → 0, arcyn kw Hit@5 40 → 60, arcyn nl Hit@5 10 → 10
- 시간 (끔 → 켬): query rx1 2019 → 2426 ms, arcyn 512 → 2880 ms. context rx1 2196 → 4180 ms, arcyn 1935 → 3595 ms.
- 검증 명령: `search-tuning.json` 의 `codeVectors` 와 `passed === true` 를 비교 → `True` (기대 `True`). `search-tuning.json` 에는 `codeVectors: true`, `codeVectorWeight: 1`, `codeVectorScore: 40` 이 들어감.
- 참고: arcyn 벡터 첫 생성이 약 16분, rx1 이 약 2분 걸림. `pick` 은 끈 쪽과 같은 점수여도 켬을 고르는 기준을 그대로 둠. 사람이 V4 에서 판단함.

### 9단계: 승인과 10a 빌드 (멈춤)
- 승인: AskUserQuestion 응답 "실행 승인" (재측정 결과를 보여 준 뒤 받음).
- 10a 빌드 (PowerShell 도구, 백그라운드): `node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model`
  - 시작 2026-11-05 17:04:59
  - 출력: `Rerank model manifest does not match manifest.json rerankModel.manifestSha256.`
  - 종료 코드 1. `artifacts/codegraph-win32-x64.zip` 수정 시각은 2026-11-05 10:44:32 로 이번 실행보다 이전임.
- 판정: 종료 코드가 0 이 아니므로 멈춤. 10b(설치)와 10c(저장소 맞추기)와 V1~V3 은 실행하지 않음.
- 원인 후보: `D:/Fork/.AI/context/rerank-model` 의 manifest 해시가 `manifest.json` 의 `rerankModel.manifestSha256` 과 다름. 모델 파일이 바뀌었거나 `manifest.json` 이 옛 값임. 이 실행은 원인을 고치지 않음.
- 상태 파일: `MODE=BLOCKED`, `CURRENT` 의 E1 칸 `멈춤 S9`.

### 이번 실행에서 바뀐 파일
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`: 8단계 명령이 `codeVectors: true`, `codeVectorWeight: 1`, `codeVectorScore: 40` 을 씀 (플랜 대로).
- `D:/Fork/.AI/context/search-eval/results/sweep-b.json`, `sweep-b.md`, `results-sweep-b.log`: 8단계 재실행 결과로 덮어씀.
- 상태 파일과 이 실행 기록.

## 실행 2026-11-05 17:22 (search-b-exec, 9단계 완료)

### 10a 빌드 (통과)
- 명령(PowerShell 도구): `node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model-06baca28`
- 시작 17:17:31, 종료 코드 0. zip 수정 시각 17:19:47 (이번 실행 뒤).
- zip sha256 `99de15b7550062bfa937de8594bc76af03bb60270f170770e9b89856b8429cd9` = manifest `artifacts.win32-x64.sha256`.
- 이전 실패(옛 `rerank-model` 폴더, 종료 코드 1)의 원인: 그 폴더의 manifest sha256 이 `16a37ea7…` 로 KIT manifest `06baca28…` 과 다름. 조사 결과는 이전 답변 참고.

### 10b 설치 (통과)
- 명령: `$env:CODEGRAPH_NO_WATCH='1'; & D:/Fork/KIT/tools/codegraph/install.ps1`
- 시작 17:20:03, 종료 코드 0, `exit_ok=True`.
- 전역 shim `C:\Users\JANGHYEONGTAEK\.local\bin\codegraph.cmd` 가 `1.1.2-99de15b75500\win32-x64` 를 가리킴. 끝 12자 `99de15b75500` = zip sha256 앞 12자.

### 10c 저장소 맞추기 (통과, 백그라운드 실패 표시는 robocopy 코드 때문)
- robocopy 종료 코드: source 1, grammars 0, artifacts 1. 플랜 기준 8 미만이 성공이므로 복사 성공.
- 백그라운드 명령이 `failed` 로 보고된 것은 마지막 `Copy-Item` 뒤 `$?` 상태가 남은 것으로 보임. 복사 결과는 아래로 확인함.
- 확인: `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`, `LICENSE` 의 sha256 앞 16자가 KIT 와 같음. `diff -rq` 로 `source`, `artifacts` 차이 0.

### 검증 명령 (plan 10 검증)
- `S=99de15b75500`; `grep -c "\"sha256\": \"$S" manifest.json` → `1` (기대 `1`)
- `codegraph --help | grep -c docs-batch` → `1` (기대 `1`)
- `diff -rq KIT/source repo/source --exclude=node_modules | wc -l` → `0` (기대 `0`)

### 수락 기준 V1~V3 (auto)
- V1 `node --test code-vectors.test.cjs search-tuning.test.cjs` → `ℹ tests 9 / pass 9 / fail 0`, exit 0 (로그 scratchpad `V1.log`)
- V2 `node --test indexing-regression.test.cjs cli.test.cjs docs-batch.test.cjs` → `ℹ tests 30 / pass 30 / fail 0`, exit 0 (로그 scratchpad `V2.log`)
- V3 `sweep-b.json` 의 `passed` 와 `search-tuning.json` 의 `codeVectors` 비교 → exit 0

### 사람이 확인할 항목
- V4: `D:/Fork/.AI/context/search-eval/results/sweep-b.md` 의 표. 선택 값이 끈 쪽 이상인지. 이번 결과는 대체로 그렇고, arcyn nl 은 0→0.
- V5: 실제 Arcyn 에서 `codegraph sync` 뒤 `codegraph context` 가 오류 없이 끝나는지. 벡터는 Arcyn 에서 첫 생성에 약 16분 걸림.

### 상태
- 상태 파일 `MODE=REVIEW`, `CURRENT` E1 `완료`. STATUS 는 active 로 둠. REVIEW 는 루트 세션이 함.

## 확인 2026-11-05 17:12 (root, S9 빌드 실패 원인)

- 오류: `build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model` 가 "Rerank model manifest does not match manifest.json rerankModel.manifestSha256." 로 종료 코드 1.
- `D:/Fork/.AI/context/rerank-model/rerank-model-manifest.json` 은 2026-10-30 그대로이고 sha256 `16a37ea7…`(모델 150,328,157 바이트). KIT HEAD(`e88354d`)의 `manifest.json` 도 `16a37ea7…`.
- 지금 KIT `manifest.json`(작업 트리와 index 가 같음, 2026-11-05 10:44:32)은 다른 빌드의 결과임: `baseArtifactSha256` `015c21ba…` → `703f42dd…`, 임베딩 manifest `d20ca1de…` → `f7e8d972…`, 리랭커 manifest `16a37ea7…` → `06baca28…`, 배포 zip 406,018,173 → 401,527,756 바이트, zip sha256 `082970d3aae9…`(지금 설치본). 이 저장소의 `manifest.json`(2026-11-04 17:42, 묶음 2 의 빌드)은 옛 값임.
- 이 빌드는 이 세션과 이 세션이 띄운 실행 세션의 기록에 없음. `build.mjs` 는 2026-10-30 그대로이고 `rerankModel` 값을 입력 `manifest.json` 에서 그대로 옮기므로, 10:44 빌드는 `06baca28…` manifest 를 가진 다른 리랭커 폴더를 썼음.
- 지금 디스크에서 `06baca28…` manifest 를 가진 곳은 설치본 `1.1.2-082970d3aae9/win32-x64/lib/models` 뿐임(sha256 확인).
- 사용자 결정 필요: 안 B 빌드를 지금 `manifest.json` 의 모델(설치본 `lib/models` 를 `--rerank-model-root` 로)로 할지, 다른 방법을 쓸지.

## 실행 2026-11-05 17:17 (root, S9 해결)

- 사용자 결정: 2026-11-05 10:44 빌드는 사용자가 직접 한 것이며 그 빌드를 기준으로 함(채팅 "10:44 빌드는 내가 직접 한거야. 이거 기준으로 해.").
- 조치: 설치본 `1.1.2-082970d3aae9/win32-x64/lib/models` 의 리랭커(`rerank-model-manifest.json`, `nlpai-lab/`)를 `D:/Fork/.AI/context/rerank-model-06baca28` 로 복사함(145MB). 설치가 옛 릴리스 폴더를 지워도 다음 빌드가 쓸 수 있게 하려는 것임.
- 확인: 복사한 manifest sha256 `06baca28…` = KIT `manifest.json` `rerankModel.manifestSha256`. manifest 의 파일 5개 크기·sha256 모두 일치. `build.mjs` 의 식별 확인(모델 id, revision, license) 일치.
- 플랜 수정: 안 A 10a 명령의 `--rerank-model-root` 를 새 폴더로 바꾸고 이유를 적음. 안 B 9단계와 안 C 10b 는 안 A 10단계를 따르므로 같이 바뀜.
- 9단계 승인은 실행 세션이 재측정 결과를 보여 준 뒤 이미 받았음. 10a 부터 다시 함.

## 검수 2026-11-05 17:27 (root, REVIEW)

### code-review (14개 기준, KIT 변경: `lib/search/code-vectors.js`(새), `lib/index.js`, `lib/index.d.ts`, `lib/bin/codegraph.js`, `lib/context/index.js`, `lib/search-tuning.js`, `test/code-vectors.test.cjs`(새), 측정 도구 `run.cjs`, `run-b.cjs`)

- Critical: 0건.
- 실행 중 고친 결함(앞 절): `symbolText` 의 docstring 앞 공백(S6), 측정 도구의 옛 모델 경로와 벡터 0개 확인 없음(S8), 리랭커 폴더(S9).
- 미룬 경고:

| 표시 | 기준 | 내용 | 미룬 이유 |
|---|---|---|---|
| W1 | 13 | `syncCodeVectors` 가 모든 sync(감시기의 국소 sync 포함)에서 코드 심볼 전체를 다시 훑고 해시함. Arcyn 에서 바뀐 것 없는 sync 마다 238~248 ms 더 듦 | 바뀐 파일의 심볼만 보도록 좁히려면 sync 경로와 인자 계약을 바꿔야 함. 별도 작업 |
| W2 | 13 | 캐시에 없는 프로젝트의 첫 sync 는 심볼 벡터를 sync 안에서 계산함(심볼당 약 50 ms, rx1 측정 기준). 이 저장소 2,450개면 약 2분, KIT 3,595개면 약 3분을 첫 질의가 한 번 기다림 | 백그라운드로 미루거나 한 번에 계산할 양을 제한하려면 설계 변경이 필요함. 별도 작업 |
| W3 | 8 | `searchCodeVectors` 의 `catch` 가 모든 오류를 빈 결과로 바꾸고 주석이 없음. 벡터 검색이 실패해도 어휘 검색 결과만 남아 정확도만 떨어짐 | 동작은 맞음. 주석만 빠짐. 소스를 다시 바꾸면 배포본과 달라져 다음 빌드 때 함께 고침 |

### 검증

| 확인 | 명령/형식 | 핵심 출력 |
|---|---|---|
| 배포본 | 전역 shim 끝 12자와 KIT `manifest.json` | `99de15b75500`, 일치 1. 옛 릴리스 지워짐(리랭커 복사본 덕에 다음 빌드 가능) |
| 설치본·저장소 사본 = KIT | `diff -rq` 설치 `lib/dist` 와 KIT `source/lib`, 이 저장소 `source/` 와 KIT | 0줄, 0줄 |
| 모델 | KIT `manifest.json` 의 manifestSha256 | 임베딩 `f7e8d972…`, 리랭커 `06baca28…` (사용자의 10:44 빌드 기준) |
| 조정값 | `search-tuning.json` | `codeVectors` true, `codeVectorWeight` 1, `codeVectorScore` 40 |
| 실제 Arcyn 첫 벡터 비용 | Arcyn 색인 사본에 `run-b.cjs build` | 22,418개, 10,152 ms(모두 측정 때 채운 캐시에서 옴). 다시 부르면 238, 248 ms |
| V5 | 실제 Arcyn `codegraph sync` 뒤 `codegraph context "damage calculation on hit"` | sync exit 0, 5,517 ms, 벡터 22,418개. context 코드 블록 7개, 2,814 ms, stderr 없음 |
