# PLAN — Markdown Vector DB 통합 (codegraph.db + MCP output 편입)

- **Branch**: `mdAddOn`
- **Date**: 2026-06-02
- **Mode**: PLAN (RIPER) — 본 문서 승인 전 소스 수정 금지
- **통합 원본**: `D:\Fork\codegraph-mdast` (`db/embed/parse/search/watch/mcp` 6개 `.mjs`; **`scan.mjs`·`cli.mjs` 누락** → TS 재구현)
- **호스트**: `D:\Fork\codegraph` (`@colbymchenry/codegraph`)

---

## 목표 (Goal)

마크다운 문서를 `sqlite-vec`(vec0) + 로컬 MiniLM(384d) 임베딩으로 인덱싱하여 **`codegraph.db` 단일 파일**에 통합하고, codegraph MCP 커맨드가 문서를 **질의·출력에 활용**하도록 편입한다. 코드 그래프 본연의 동작·성능은 무회귀(no-regression).

## 확정 결정 (사용자 승인됨)

1. **DB 토폴로지**: `codegraph.db` 단일 파일에 통합 (별도 `mdast.db` 사이드카·ATTACH 아님).
2. **의존성/배포**: `sqlite-vec` + `@xenova/transformers`를 `optionalDependencies`로, **lazy require**, **옵트인**(`CODEGRAPH_DOCS=1` 환경변수 + `--with-docs` CLI 플래그). 미설치/미활성 시 **벡터검색만 graceful skip**, 코드 그래프는 정상.
3. **출력 노출 범위**: `codegraph_docs`(신규 전용) + `codegraph_context`(1차 노출) + `codegraph_node`·`codegraph_impact`(**governing 문서 존재 시에만** 관련성 게이트). `search`/`callers`/`callees`/`trace` **제외**.

## 출력 비용 분석 결론 (근거)

관련성 게이팅 = governing 문서(BLK/code_refs가 해당 파일을 지배) 있을 때만 첨부 → 대다수 호출 0% 증가, 표적 호출에서만 비용 발생. 첨부 시 추정 증가: context +6~12%, node(+코드) +14~28%, impact +18~35%. 정밀 구조 툴(search/callers/callees)·0-Read 튜닝된 trace는 노이즈 위험으로 제외 (프로젝트 철학 "silent beats wrong" / "정밀 답변 희석 금지"와 정합).

---

## 단계별 구현 (Scope Lock, ≤10 steps)

### Step 1 — Optional deps + 옵트인 플래그 plumbing
- **Symbol**: `optionalDependencies`, `resolveDocsEnabled()`(신규)
- **CodeGraph**: project_metadata 테이블(schema.sql:147), CLI commander(src/bin/codegraph.ts)
- **File**: `package.json`; **[NEW-BLK]** `D:\Fork\codegraph\src\docs\config.ts`; `src/bin/codegraph.ts`(init/index 커맨드)
- **Scope**: package.json deps 블록; config.ts 전체; codegraph.ts init/index 옵션 추가부
- **BLK target**: [인프라] package.json·codegraph.ts / [NEW-BLK] src/docs/config.ts
- **Action**: insert
- **Success criterion**: optional deps 미설치 상태에서 `npm i`·`npm run build` 정상. `CODEGRAPH_DOCS=1` 또는 `--with-docs` → `resolveDocsEnabled()` true, 미지정 시 false. 활성 상태는 `project_metadata(key='docs_enabled')`에 영속.

### Step 2 — DB 어댑터 확장 로드 경로
- **Symbol**: `NodeSqliteAdapter`(constructor, +`loadExtension`), `SqliteDatabase`(interface), `loadVecExtension()`(신규)
- **CodeGraph**: src/db/sqlite-adapter.ts:43-139, configureConnection src/db/index.ts:29
- **File**: `src/db/sqlite-adapter.ts`; **[NEW-BLK]** `D:\Fork\codegraph\src\docs\vec.ts`
- **Scope**: sqlite-adapter.ts Lines [13-118](interface+adapter); vec.ts 전체
- **BLK target**: [인프라] sqlite-adapter.ts / [NEW-BLK] src/docs/vec.ts
- **Action**: replace(생성자 `{ allowExtension: true }` 추가) + insert(`loadExtension` 메서드, interface optional 메서드)
- **Success criterion**: deps 설치 시 `loadVecExtension(db)` → `sqlite-vec` getLoadablePath 로드 후 `vec0` 가상테이블 생성 가능. 미설치 시 false 반환·throw 없음. `allowExtension:true`가 코드 인덱싱 경로에 부작용 없음.

### Step 3 — 스키마 + 마이그레이션 v5 (mdast_metadata)
- **Symbol**: `CURRENT_SCHEMA_VERSION`(4→5), migrations[] v5 항목
- **CodeGraph**: schema.sql:147(말미), migrations.ts:12·29-68
- **File**: `src/db/schema.sql`, `src/db/migrations.ts`
- **Scope**: schema.sql 말미 mdast_metadata CREATE; migrations.ts Lines [12](버전)·[29-67](배열 v5 추가)
- **BLK target**: [인프라]
- **Action**: insert(plain table만; **vec0는 schema.sql에 넣지 않음** — 런타임 Step 5에서 생성)
- **Success criterion**: 신규 `init` → `mdast_metadata` 존재. 기존 codegraph.db `open` → v4→v5 마이그레이션 적용, `mdast_metadata` 추가. `select count(*) from nodes` 등 코어 무영향, node count 불변.

### Step 4 — 마크다운 parse + embed (원본 포팅)
- **Symbol**: `parseDoc()`, `BLK_RE`; `embed()`, `getEmbedder()`, `EMBED_DIM=384`
- **CodeGraph**: 원본 codegraph-mdast/src/parse.mjs·embed.mjs (별도 repo, 직접 포팅)
- **File**: **[NEW-BLK]** `D:\Fork\codegraph\src\docs\parse.ts`, `D:\Fork\codegraph\src\docs\embed.ts`
- **Scope**: parse.ts·embed.ts 전체
- **BLK target**: [NEW-BLK]
- **Action**: create (parse: 순수·무IO; embed: `@xenova/transformers` **lazy dynamic import**, mean-pool+L2)
- **Success criterion**: `parseDoc`가 포팅 유닛테스트 4종(line-2 BLK, frontmatter code_refs, no-blk, inline-400자 fallback) 통과. deps 설치 시 `embed()` → `Float32Array(384)`; dim 불일치 throw.

### Step 5 — 마크다운 인덱서 (누락 scan.mjs 재구현) + 파이프라인 훅
- **Symbol**: `indexMarkdown()`(신규, 반환 `{indexed,skipped,scanned,warnings}`), indexAll 훅
- **CodeGraph**: indexAll src/extraction/index.ts:595, storeExtractionResult:1251, 파일 스캐너(scanDirectoryAsync)
- **File**: **[NEW-BLK]** `D:\Fork\codegraph\src\docs\indexer.ts`; `src/extraction/index.ts`(indexAll 말미 + sync)
- **Scope**: indexer.ts 전체; index.ts indexAll 코드-인덱싱 **이후** docs phase(게이트), sync 증분 경로
- **BLK target**: [NEW-BLK] indexer.ts / [인프라] index.ts
- **Action**: create + insert
- **Success criterion**: docs 활성 시 .md 스캔→content_hash 미변경 skip→parse→embed→`mdast_metadata`+`mdast_vectors`(BigInt rowid, floatBlob) upsert. vec0 미존재 시 생성(ext 로드 후). 재인덱싱이 mdast 테이블을 **drop하지 않고** 증분 갱신. docs 비활성 시 완전 no-op. 코드 인덱싱 결과·시간 무회귀.

### Step 6 — 하이브리드 검색 (search.mjs 포팅, 단일 DB)
- **Symbol**: `searchDocs()`, `findGoverningDocs(filePaths)`(게이트용 신규)
- **CodeGraph**: 원본 search.mjs(KNN→meta→code_refs→nodes), nodes 테이블(schema.sql:20)
- **File**: **[NEW-BLK]** `D:\Fork\codegraph\src\docs\search.ts`
- **Scope**: search.ts 전체
- **BLK target**: [NEW-BLK]
- **Action**: create (**ATTACH 제거** — 동일 DB JOIN; 압축 페이로드 summary≤200 + 심볼 포인터)
- **Success criterion**: `searchDocs(q,topk)` → 랭킹된 문서 + code_refs/BLK 경유 관련 코드심볼. `findGoverningDocs([file])` → 해당 파일 지배 문서 배열 또는 `[]`(게이트 핵심).

### Step 7 — 신규 codegraph_docs MCP 툴
- **Symbol**: `handleDocs()`(신규), `tools`(배열 항목 추가), 디스패치
- **CodeGraph**: ToolDefinition src/mcp/tools.ts:374, tools배열:418, getStaticTools:639, getTools:736, allowlist:716·725, handleSearch:1136(인접 배치)
- **File**: `src/mcp/tools.ts`
- **Scope**: tools배열 Lines [418+] 항목 1개; handleDocs 메서드(handleSearch 근방); name→handler 디스패치 1줄
- **BLK target**: [인프라]
- **Action**: insert
- **Success criterion**: `codegraph_docs`(query, projectPath?, topk?, codeLimit?) 하이브리드 결과 반환. docs 비활성/deps 미설치 → 명확·실행가능 안내 메시지. `getTools()`·allowlist에 정상 노출. 기존 툴 동작 불변.

### Step 8 — context / node / impact 보강 (관련성 게이트)
- **Symbol**: `handleContext`, `handleNode`+`formatNodeDetails`, `handleImpact`+`formatImpact`
- **CodeGraph**: tools.ts handleContext:1170, handleNode:2923, formatNodeDetails:3538, handleImpact:1497, formatImpact:3488
- **File**: `src/mcp/tools.ts`
- **Scope**: context:1170 말미 "## Related docs"(시맨틱); node 2923/3538 "### Related docs"(governing 시에만, cap 1-2); impact 1497/3488 affected-files governing 문서(cap 2-3)
- **BLK target**: [인프라]
- **Action**: insert (모두 docs 활성 + governing 존재 조건; 아니면 침묵)
- **Success criterion**: governing 문서 존재 시 섹션 출현. **부재 시 출력 byte-identical(무회귀)**. search/callers/callees/trace 출력 완전 불변. 비활성 시 전부 침묵.

### Step 9 — server-instructions + 빌드/자산 + CHANGELOG
- **Symbol**: server-instructions 본문, copy-assets
- **CodeGraph**: src/mcp/server-instructions.ts(에이전트 가이드 단일 소스), package.json build/copy-assets
- **File**: `src/mcp/server-instructions.ts`, `CHANGELOG.md`, (`package.json`/`scripts/copy-assets` — 점검만)
- **Scope**: server-instructions에 codegraph_docs + context/node/impact 문서노출 가이드; CHANGELOG `## [Unreleased]` New Features 1불릿(유저향·내부경로/수치 금지)
- **BLK target**: [인프라]
- **Action**: insert
- **Success criterion**: instructions에 docs 툴 가이드 반영(단일 소스). schema.sql 여전히 dist 복사 확인. sqlite-vec 네이티브는 optional dep node_modules 런타임 로드(기본 번들 비포함)임을 문서화. CHANGELOG 항목 존재.

### Step 10 — 테스트 + 검증
- **Symbol**: 신규 테스트 스위트
- **CodeGraph**: 기존 __tests__ 패턴(sqlite-backend.test.ts, mcp-*); 원본 parse.test.mjs·db-smoke.mjs
- **File**: **[NEW-BLK]** `D:\Fork\codegraph\__tests__\docs-parse.test.ts`, `docs-db.test.ts`, `docs-search.test.ts`, `docs-tool-gating.test.ts`
- **Scope**: parse 4종; db(vec0 로드+KNN+마이그v5, deps 유무 runIf 게이트); search; tool 게이트(governing 부재 시 byte-identical, 존재 시 섹션)
- **BLK target**: [NEW-BLK]
- **Action**: create
- **Success criterion**: `npm run build` + `npm test` green. 옵트인 비활성 경로 no-op 증명. vec0 KNN·마이그v5 검증. 수동: 이 repo 문서 `CODEGRAPH_DOCS=1` 인덱싱 → `codegraph_docs` 질의 + node/impact 게이트 확인.

---

## 성공 기준 (전체)

1. `codegraph.db` 단일 파일에 `mdast_metadata` + `mdast_vectors(vec0 float[384])` 공존, 마이그레이션 v4→v5 무손실.
2. 옵트인(`CODEGRAPH_DOCS=1`/`--with-docs`) 시에만 문서 인덱싱·노출; **비활성/deps 미설치 시 코드 그래프 완전 무회귀**.
3. `codegraph_docs` 하이브리드 검색 동작; `context` 1차 노출; `node`/`impact`는 governing 문서 있을 때만 게이트 노출(부재 시 byte-identical).
4. `search`/`callers`/`callees`/`trace` 출력 불변.
5. `npm test` green + 신규 docs 테스트 통과.

## 비목표 (Non-goals / 범위 제외)

- 릴리스 번들(`build-bundle.sh`)에 transformers/sqlite-vec **상시 번들링** (옵트인 한정; always-on은 후속).
- `mdast.db` 사이드카 / `watch.mjs` / 별도 `mcp.mjs` MCP 서버 (in-process 통합으로 대체·폐기).
- `search`/`callers`/`callees`/`trace`에 문서 노출.
- code_refs/BLK + 직접 경로매칭 이외의 동적 문서-코드 링크(리액티브 런타임 등).
- content_hash 이상의 재임베딩 최적화, 마크다운 외 문서 포맷.

## 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| `node:sqlite` `loadExtension`/`allowExtension` API 시그니처 | EXECUTE Step 2에서 실제 API 확인 후 어댑터 확정 |
| `@xenova/transformers` v2(Xenova) vs v3(@huggingface) | 원본대로 v2 핀; lazy import |
| vec0 rowid: node:sqlite가 number를 REAL 바인딩 | BigInt 바인딩(원본 db-smoke 검증 패턴 준수) |
| `init` 재빌드가 codegraph.db 신규 생성 → 벡터 재생성 필요 | 통합 결정의 수용된 트레이드오프; content_hash 증분으로 비용 최소화, reindex가 mdast 테이블 drop 안 함 |
| Windows 네이티브 sqlite-vec | `sqlite-vec-windows-x64` 존재 확인됨; 플랫폼 테스트 runIf 게이트 |

## EXECUTE 진입 조건

- 본 플랜 사용자 승인.
- `RULE-7`: 각 소스 파일 수정 전 승인(write-approval).
- 규모 = 중·대형(멀티파일·신규 시스템·플랜 존재) → EXECUTE 후 quality-sentinel + reporter 게이트 필수.

## 권장

- 컴팩션 안전을 위해 `/memory:save` 실행 권장.
