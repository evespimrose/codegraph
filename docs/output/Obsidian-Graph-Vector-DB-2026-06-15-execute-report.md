# EXECUTE 리포트 — `.codegraphignore` 합집합/토글 + query 시멘틱 폴백 + docs CLI 표면

**Branch:** Obsidian-Graph-Vector-DB · **Date:** 2026-06-15 · **Mode:** RIPER EXECUTE
**Plan:** `.claude/memory-bank/Obsidian-Graph-Vector-DB/plans/Obsidian-Graph-Vector-DB-2026-06-15-hybrid-search-codegraphignore.md`

---

## 결과 요약

- **빌드: 그린** (`npm run build`, `tsc --noEmit` 무에러).
- **신규 테스트 7건 전원 통과** (extraction 6 + foundation 1).
- **회귀 0** — stash 베이스라인 대비 동일(아래 §검증).
- 구현 스텝 1–9 완료. Step 6(BLADE 재검증)·Step 10 글로벌 sync는 환경 의존(아래 §미완/주의).

## 변경 파일 (소스 6 + 테스트 2 + 문서 3)

| 파일 | 스텝 | 내용 |
|---|---|---|
| `src/extraction/index.ts` | 1·2 | `buildDefaultIgnore(rootDir, {respectGitignore})` + `.codegraphignore` 합집합(`tryAdd`); `ScanOptions` 신설; `scanDirectory/Async/Walk`·`getGitVisibleFiles`·orchestrator `indexAll/sync` 옵션 관통; 중첩 `.gitignore` 토글 게이팅 |
| `src/sync/watcher.ts` | 2 | `WatchOptions.respectGitignore` + 매처 빌드 시 전달 |
| `src/index.ts` | 2·4 | `IndexOptions.respectGitignore` + `indexAll`/`sync` → orchestrator 관통 |
| `src/docs/scan-files.ts` | 3 | `listMarkdownFiles`가 `buildDefaultIgnore`로 동일 제외 합집합 적용(docs 인덱싱도 `.codegraphignore` 존중) |
| `src/directory.ts` | 4 | `createDirectory`가 프로젝트 루트에 주석형 `.codegraphignore` 스캐폴드 생성 |
| `src/bin/codegraph.ts` | 4·7·8 | `index`/`sync`에 `--no-gitignore`; `query` thin-fallback→`searchDocs` 병합(THIN=3); `backlinks <file>`·`docs <query>` 신규 서브커맨드 |
| `__tests__/extraction.test.ts` | 5 | `.codegraphignore` 6 케이스(워크·git·negation·`respectGitignore:false`·docs 스캐너) |
| `__tests__/foundation.test.ts` | 5 | `.codegraphignore` 스캐폴드 생성 검증 |
| `CHANGELOG.md` | 5 | `[Unreleased] > New Features` 사용자향 항목 |
| `docs/design/doc-graph-gating.md` | 9 | doc-graph 게이트 매트릭스(BLADE auto / RX_1 override) — 정책 단일 진실 |

## 설계 메모

- **Chokepoint 이득**: `buildDefaultIgnore`가 항상 `.codegraphignore`를 합류시키므로 git·워크·watcher·docs **4경로**가 옵션 관통 없이도 자동으로 `.codegraphignore`를 존중. `respectGitignore` 토글만 명시 관통.
- **sync의 `.codegraphignore`**: `orchestrator.sync`가 `scanDirectory`로 현재 파일을 열거 → 자동 적용. `respectGitignore`도 관통.
- **`--no-gitignore` git 빠른경로 한계(§1.3-C)**: git ls-files/status는 자체적으로 .gitignore를 적용하므로 re-include는 불가(플랜 Non-Goal). 워크 폴백·후필터에는 반영됨.
- **query 폴백 콜드스타트 격리**: `searchDocs`는 내부에서 opt-in·sqlite-vec·임베딩 게이트를 무소음 처리. thin(<3)일 때만 호출 → 코드 프로젝트/ docs-off 무영향, JSON은 doc hit이 있을 때만 객체로 확장(하위호환).

## 검증 (회귀 0 증명)

`npx vitest run` 전체: **19 fail / 1039 pass / 9 skip**. 19건 전수 분류 — **전부 사전존재 또는 환경(Windows) 이슈, 내 변경과 무관**:

| 분류 | 건수 | 근거 |
|---|---|---|
| 스키마 버전 기대값 stale (foundation/pr19/docs-db) | 4 | 스키마가 v8로 진화했으나 테스트는 v5 기대. `git show HEAD:__tests__/foundation.test.ts`에 `toBe(5)` 동일 존재 → **HEAD에서도 실패**. schema.sql 미변경. |
| MCP initialize/roots EPERM | 5 | CLAUDE.md에 **알려진 사전존재 Windows quirk**로 명시(spawn된 `serve --mcp`가 temp/SQLite 점유) |
| JVM FQN·C/C++ 해석 | 4 | 실패 원인 = `afterEach` temp 정리 **EPERM**(해석 단언 아님) — Windows 파일락 |
| worktree-detection | 6 | Windows 8.3 단축경로(`JANGHY~1`) vs 롱패스 단언 차이 — 경로 정규화 환경 이슈 |

**결정적 확인**: 내 변경을 `git stash` 후 동일 6개 파일(docs-db·foundation·pr19·worktree·frameworks·resolution) 실행 → **베이스라인도 14 fail**. 변경 적용 시 동일 6개 파일 **14 fail**(+ MCP 5 = 19). **변경 전후 실패 수 동일 → 회귀 0.** extraction.test.ts(직접 관련, 기존 ~13 scanDirectory 단언 포함)는 **전원 통과**.

## 미완 / 주의 (사용자 판단 필요)

1. **Step 6 — BLADE 비-ASCII/엣지 재검증**: BLADE 프로젝트 경로·글로벌 0.9.8.1 인덱스 의존. 코드 변경 없는 검증 스텝이라 미수행. 필요 시 BLADE 경로 제공 요청.
2. **Step 10 — 글로벌 sync(`sync-global-codegraph`)**: 현재 세션이 codegraph MCP를 **구동 중**이라, Windows에서 실행 중 바이너리에 대한 `npm install -g`는 파일락(EEXIST/EBUSY) 위험. 본 EXECUTE에서는 보류 — 세션 종료 후 별도 실행 권장(스킬이 EEXIST 가드 내장).
3. **사전존재 스키마 테스트 stale(4건)**: 본 작업 범위 밖이라 미수정. 별도 처리 시 `toBe(5)`→`toBe(8)` 등 갱신 필요(스키마 의도 확인 후).
4. **플랜 미결**: THIN_THRESHOLD=3(기본 채택) · `.codegraphignore` 루트 위치(채택) · 병합 랭킹 표식(시멘틱 섹션 분리 표기로 처리).
