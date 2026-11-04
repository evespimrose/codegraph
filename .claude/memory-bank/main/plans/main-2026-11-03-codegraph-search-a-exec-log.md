
## 실행 2026-11-03 13:28 (search-a-exec)

- 단계 1: `code-sets.tsv` 작성. 검증 `python -c ...` 출력 `40`. 일치.
- 단계 2a/2b: `run.cjs`, `.gitignore` 작성.
- 단계 2c: `node run.cjs baseline` 종료 코드 0. 검증 키 `['arcyn-docs', 'atom', 'blade', 'zyxel'] ['arcyn', 'rx1']`. 일치.
- 단계 3: `search-tuning.json`, `search-tuning.js` 작성 (KIT source). 검증 출력 `{"docsFtsWeights":[1,1,1,1],"docsLexicalWeight":1,"docsLexicalWeightHangul":1,"docsMarkdownFirst":false,"docsMarkdownDepth":50,"nameTokensWeight":10}`. 기대와 일치.
- 단계 4: `lexical-search.js` (4a~4e), `lexical-search.d.ts` (4f) 수정. 검증 출력 `2 2 1`. 기대 `2 2 1`. 일치.
- 단계 5: `search.js` (5a~5f), `embed.js` (5g, 5h), `embed.d.ts` (5i) 수정. 검증 출력 `1 2 2 1 1`. 기대 `1 2 2 1 1`. 일치.
- 단계 6: `name-tokens.js`, `migration-v12.js` 작성, `migrations.js` (6c~6e), `migrations.d.ts` (6f) 수정. 검증 출력 `damage hit job | http server 2 | null | 12`. 기대와 일치.
- 단계 7: `schema.sql` (7a, 7b), `queries.js` (7c~7h) 수정. 검증 출력 `2 2 1 10`. 기대 `2 2 1 10`. 일치.
- 단계 8: `search-tuning.test.cjs` 작성. `node --test test/search-tuning.test.cjs` 결과 4개 통과, 2개 실패.
  - 실패 2개(`symbol search finds a name by inner words`, `markdown-first puts markdown hits ahead of other formats`): 오류는 테스트 정리 단계(`after` 훅)의 `fs.rmSync` EPERM. 열린 DB 파일이 있어 Windows 가 디렉터리 삭제를 막음.
  - 원인: 플랜 8단계 테스트 코드에서 `tempRoot` 의 정리 훅이 `graph.close()` 훅보다 먼저 등록되어 먼저 실행됨.
  - 플랜 기준 실패 단계이므로 테스트 코드를 고치지 않고 멈춤(BLOCKED).
- 단계 9, 10: 실행하지 않음.
- 수락 기준 V1~V4: 실행하지 않음(단계 8 멈춤 이후).

## 실행 2026-11-03 13:32 (root)

- 단계 8 멈춤 원인 재현: `node --test test/search-tuning.test.cjs` 에서 `fs.rmSync` EPERM 2건. node:test 가 `after` 훅을 등록 순서대로 돌려 열린 DB 폴더를 먼저 지우려 함.
- 수정: `search-tuning.test.cjs` 의 `tempRoot` 를 `tempGraph` 로 바꿈. 닫기와 삭제를 훅 하나에서 함(`docs-batch.test.cjs` 와 같은 방식). 플랜 8단계 코드와 기대 출력도 같이 고침.
- 단계 8 검증 다시 실행: 시험 32개 통과, 실패 0, 종료 코드 0.
- 단계 9부터 search-a-exec 세션이 이어서 함.

## 실행 2026-11-03 search-a-exec (단계 9 재개)

- 단계 9: `cd D:/Fork/.AI/context/search-eval && node run.cjs sweep` 종료 코드 0. 판정 `passed=True`, `nameTokensWeight` 일치. 검증 출력 `True True`. 기대와 일치.
- 선택 설정: docsFtsWeights [1,1,1,1], docsLexicalWeight 1, docsLexicalWeightHangul 1, docsMarkdownFirst false (기준과 같은 첫 후보). 선택 nameTokensWeight 2.
- 문서 Hit@1: 기준과 선택이 같음(blade 73.33/93.33, zyxel 53.33/46.67, atom 22.73/9.09, arcyn-docs 55/45 tune/report). Hit@5 도 같음.
- 코드 Hit@1 (kw): rx1 tune 20→40, report 30→40. arcyn tune 40→50, report 30→40. nl Hit@1 은 rx1 tune 10→10, arcyn 0→0.
- 단발 ms: 문서 묶음 모두 기준보다 낮음(blade 3550→1837, zyxel 6182→2030, atom 5898→1947, arcyn-docs 5578→1861). 질의당 ms: zyxel 160.63→177.87 (약 1.11배), 나머지는 낮음.
- 단계 10: AskUserQuestion 으로 승인 대기 중. 승인 전 실행하지 않음.

## 실행 2026-11-03 search-a-exec (단계 10, 사용자 승인: 진행)

- 10a 빌드: `pwsh ... node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model` 종료 코드 0.
- 10b 설치: `pwsh ... install.ps1` 실패. 설치 출력 끝부분: `/usr/bin/tar: Cannot connect to D: resolve failed`, `Bundled CodeGraph archive extraction failed with exit code 128.`, `exit=1`. 원인: install.ps1 이 Git Bash 의 tar(/usr/bin/tar) 를 D: 경로에 써서 실패함(플랜 10a 주석과 같은 문제). 전역 shim `/c/Users/JANGHYEONGTAEK/.local/bin/codegraph` 는 옛 설치본 `1.1.2-345c0b4f3c8e` 를 그대로 가리킴. 백그라운드 작업 알림은 종료 코드 0 이었으나 래퍼 출력이 잘못됨. 설치 출력을 확인하지 않고 10c 를 진행한 것은 잘못임.
- 10c 저장소 맞추기: robocopy 3회와 Copy-Item 실행, 종료 코드 0. 저장소 `source/` 는 KIT `source/` 와 같아짐(diff 줄 수 0).
- 10 검증: `codegraph --help | grep -c docs-batch` 출력 `0`. 기대는 1 이상. 전역 명령에 docs-batch 없음(옛 설치본). 기대와 불일치. KIT 소스 CLI `node .../lib/bin/codegraph.js --help` 는 `1` (docs-batch 있음).
- 수락 기준 V1: `node --test .../search-tuning.test.cjs` 종료 코드 0, tests 6, pass 6, fail 0.
- V2: 5개 시험 파일 `node --test` 종료 코드 0, tests 26, pass 26, fail 0.
- V3: `sweep.json` passed === true, 종료 코드 0.
- V4: nameTokensWeight 와 docsFtsWeights 가 sweep 선택값과 일치, 종료 코드 0.
- V5~V7: 사람 확인 항목. V7 은 전역 설치 실패로 통과 안 됨.
- 결론: 단계 10 멈춤(BLOCKED, S10). E1 완료 아님. 재시도는 PowerShell 의 tar(예: `C:/Windows/System32/tar.exe`)가 쓰이도록 PATH 를 맞춘 뒤 사용자 승인을 다시 받아야 함.

## 실행 2026-11-03 search-a-exec (단계 10 마무리, 사용자 수동 설치)

- 10b 전역 설치: 자동 설치(install.ps1)는 실패함(앞 절 참고). 사용자가 수동으로 설치 완료했다고 알림. 설치 결과 검증은 사용자 요청으로 하지 않음.
- 수락 기준 V1~V4: 앞 절에서 통과(종료 코드 0). 단계 10 뒤 다시 돌리지 않음.
- V5 (사람 확인, sweep.md 표): 단발 ms 는 모든 문서 묶음에서 기준 이하. G2 에서 확인.
- V6 (사람 확인, code-sets.tsv 정답): G1 에서 확인된 항목. 이 실행에서는 다시 보지 않음.
- V7 (사람 확인, 전역 codegraph --help): 사용자가 수동 설치를 마쳤다고 알림. 검증은 요청되지 않음.
- 상태: E1 완료. MODE=REVIEW, STATUS 는 active 유지(done 은 루트 세션의 G2 뒤에 씀).

## 실행 2026-11-03 14:01 (root, 단계 10 다시)

- 원인: 플랜 10a, 10b 명령을 Bash 에서 `pwsh -Command "..."` 로 부르면 Bash 가 `$env:`, `$LASTEXITCODE` 를 먼저 펼침. `exit $LASTEXITCODE` 가 `exit` 가 되어 실패가 0 으로 보고됨. PATH 도 Git 의 `/usr/bin/tar` 가 먼저 잡힘.
- 첫 10a 는 새 zip 을 만들지 못함(artifacts zip 이 2026-11-02 10:40 그대로). 첫 10b 재시도(PowerShell)는 그 옛 zip 을 설치함(1.1.2-6661d996d0af, 안 A 파일 없음).
- 10a 다시(PowerShell 도구에서 직접): `node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model` exit=0. zip 13:59 생성.
- 10b 다시: `install.ps1` (CODEGRAPH_NO_WATCH=1) exit=0. 전역 shim 이 `1.1.2-f0a9ee70351e` 를 가리킴. 설치본 `lib/dist` 에 `search-tuning.json`(nameTokensWeight 2), `db/migration-v12.js`, `search/name-tokens.js` 있음. `schema.sql` 의 name_tokens 10건.
- 10c 다시: robocopy source=0 grammars=0 artifacts=1(복사함, 성공), Copy-Item 성공. `diff -rq`(node_modules 제외) 줄 수 0, zip 과 manifest.json 같음.
- 10 검증: `codegraph --help | grep -c docs-batch` 출력 1, source diff 0. 기대와 일치.
- 플랜 결함 기록: 10단계 검증은 docs-batch 유무만 봐서 옛 빌드도 통과함. 설치본에 안 A 파일이 있는지 보는 검사가 필요함.

## 검수 2026-11-04 10:13 (root, REVIEW)

### code-review (14개 기준, KIT `tools/codegraph/source` 변경 9개 파일과 새 파일 5개)

- Critical: 0건.
- 바로 고침 1건: `lib/search-tuning.js` 의 `try/catch` 가 깨진 `search-tuning.json` 을 조용히 기본값으로 바꿨음(기준 4, 8). 빌드가 이 파일을 늘 넣으므로 막아 주는 실제 경우가 없음. 지움. 플랜 3단계 코드도 같이 고침.
- 실행 중 고침 1건(앞 절): 시험 정리 훅 순서(기준 14).
- 미룬 경고:

| 표시 | 기준 | 내용 | 미룬 이유 |
|---|---|---|---|
| W1 | 4 | `searchCandidates` 가 벡터 쓸 수 있는지 네 조건을 미리 데우기와 본 분기에서 두 번 검사함 | 네 조건 결과가 모두 캐시돼 비용이 거의 없음. 고치려면 기존 분기 순서를 다시 짜야 함 |
| W2 | 1 | `queries.js`, `migrations.js` 는 LF 로, `schema.sql` 은 CRLF 로 줄바꿈이 통일됨. 원본은 섞여 있었음. 원시 diff 288+/233-, 줄바꿈 무시 81+/26- | 의미 변화 없음. KIT 커밋 때 정함 |
| W3 | 10 | 새 모듈 `search-tuning.js`, `search/name-tokens.js`, `db/migration-v12.js` 에 `.d.ts` 가 없음 | 이 모듈을 가져다 쓰는 `.d.ts` 가 없어 타입이 깨지지 않음. 플랜 밖 파일 |
| W4 | 6 | `searchDocs` 가 약 37줄로 늘어남 | 원래도 20줄을 넘었음. 분리는 기존 코드 정리임 |

### 검증

| 확인 | 명령/형식 | 핵심 출력 |
|---|---|---|
| 시험(V1+V2 묶음) | `node --test` 시험 파일 6개 | tests 32, pass 32, fail 0, exit 0 |
| 다시 빌드 | PowerShell `node build.mjs --rerank-model-root ...` | build exit=0 |
| 다시 설치 | PowerShell `install.ps1` (CODEGRAPH_NO_WATCH=1) | install ok=True, shim 이 `1.1.2-8e92ff564f22` 를 가리킴 |
| 설치본이 새 빌드인지 | shim 끝 12자를 `manifest.json` sha256 에서 찾음 | `1` (sha256 `8e92ff564f22...`) |
| 설치본, 저장소 사본 = KIT | `cmp` `search-tuning.js` 세 곳 | installed-same, repo-same |
| 전역 명령 | `codegraph --help \| grep -c docs-batch` | `1` |
| 저장소 사본 | `diff -rq` (node_modules 제외) `\| wc -l` | `0` |

### 플랜 결함과 고친 곳

- 플랜 8단계 시험 정리 순서: 고침(앞 절).
- 플랜 10단계: Bash 에서 `pwsh -Command "..."` 로 불러 빌드 실패가 0 으로 보였고, 검증이 docs-batch 유무만 봐서 옛 빌드 설치를 놓쳤음. PowerShell 도구로 직접 실행하고 설치 폴더 이름과 `manifest.json` sha256 을 맞춰 보는 검증으로 고침. 안 B 9단계와 안 C 10b 는 안 A 10단계를 그대로 쓰므로 같이 고쳐짐.
