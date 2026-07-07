# CodeGraph 포크 개발 핸드오프 (Obsidian-Graph-Vector-DB)

> **대상 독자:** 이 포크를 처음 여는 다른 세션 / 개발자
> **목적:** `main` 대비 이 브랜치에서 **무엇을, 어디에, 왜** 추가했는지 한 장으로 인계
> **기준일:** 2026-06-11 · **로컬 버전:** `0.9.8.1` · **브랜치:** `Obsidian-Graph-Vector-DB` (main +19 커밋)

이 문서는 *코드 개발 인계*용이다. 루트의 `OnBoarding.md`(Trae-Claude 워크플로 방법론)와 `docs/codegraph-analysis.md`(BLADE 프로젝트 분석 보고서)와는 다른 문서다.

---

## 0. 한 줄 요약

업스트림 codegraph(코드 심볼 그래프)에 **마크다운 문서 지식 그래프 레이어**를 더했다. 핵심은 두 가지다.

1. **문서 벡터 인덱스** — 프로젝트의 `.md`(설계 문서·스펙·ADR)를 의미 기반으로 검색(`codegraph_docs`). 로컬 임베딩, 완전 opt-in.
2. **governs 엣지 파이프라인** — 설계 문서의 `<!-- BLK: BLK-XXX -->` 태그와 코드의 `// [BLK-XXX]` 마커를 잇는 `concept → code` 방향 엣지. "구현 ↔ 의도"를 그래프로 연결.

두 서브시스템은 **하나의 `codegraph.db`**를 공유한다(ATTACH 없음, 병합 토폴로지). **BLK/문서 기능을 쓰지 않는 프로젝트는 전혀 영향받지 않는다**(모든 경로에 no-op 배리어).

---

## 1. 큰 그림 — 데이터 흐름

```text
                    codegraph index --with-docs   (또는 CODEGRAPH_DOCS=1)
                                  │
        ┌─────────────────────────┴────────────────────────┐
        ▼                                                  ▼
[코드 그래프 파이프라인 (기존)]                      [문서 파이프라인 (이 포크 신규)]
 tree-sitter 추출                                   src/docs/scan-files  (git ls-files, 비-ASCII 안전)
        │  + // [BLK-XXX] 마커 →                            │
        │    governs unresolved_ref 발생                    ▼
        ▼                                                src/docs/parse  (BLK·title·summary·codeRefs·wikilinks)
 resolveReferencesBatched                                   │
        │  ⚠ governs ref는 SKIP (삭제 안 함)                 ▼
        ▼                                                src/docs/embed  (@xenova MiniLM, 384d, 로컬)
      nodes / edges / unresolved_refs                       │
        │                                                   ▼
        │                                          indexMarkdown → mdast_metadata + mdast_vectors
        │                                                   │  + GOVERNED_DIRS 문서의 BLK → concept 노드 INSERT
        └──────────────┬────────────────────────────────────┘
                       ▼
            linkGovernsEdges  (indexMarkdown 이후 실행)
              보존된 governs ref ─매칭→ concept 노드 ─생성→ edges(kind='governs')
                       │
                       ▼
            codegraph_docs / codegraph_backlinks / context·node·impact 에 노출
```

핵심 통찰(인계 시 가장 중요): **`resolveReferencesBatched`가 `indexMarkdown`보다 먼저 돈다.** 그래서 governs ref가 해소되려는 시점엔 concept 노드가 아직 없다. 해결책 = 리졸버가 governs ref를 **보존**하고, concept 노드가 생긴 **뒤에** 전용 링커가 잇는다. (`src/index.ts`의 `indexAll`에서 `indexMarkdown` → `linkGovernsEdges` 순서가 이 때문에 고정되어 있다.)

---

## 2. 신규 모듈 — `src/docs/` (8파일)

| 파일 | 역할 | 핵심 심볼 |
|---|---|---|
| [config.ts](../src/docs/config.ts) | opt-in 게이트 + 상수 | `resolveDocsEnabled`, `setDocsEnabled`, `EMBED_DIM=384`, `DOCS_ENV_VAR='CODEGRAPH_DOCS'` |
| [scan-files.ts](../src/docs/scan-files.ts) | `.md` 파일 탐색(git 우선) | `listMarkdownFiles` |
| [parse.ts](../src/docs/parse.ts) | 문서 1건 파싱 | `parseDoc` → `ParsedDoc{blk,title,summary,codeRefs,docLinks}`, `extractBlkTags` |
| [embed.ts](../src/docs/embed.ts) | 로컬 임베딩 | `embed`, `embedBatch`, `getEmbedder`, `isEmbedAvailable` |
| [vec.ts](../src/docs/vec.ts) | sqlite-vec 로딩 | `loadVecExtension`, `floatBlob` |
| [indexer.ts](../src/docs/indexer.ts) | 문서 인덱싱(쓰기 경로) | `indexMarkdown`, `ensureVectorTable`, `GOVERNED_DIRS` |
| [search.ts](../src/docs/search.ts) | 의미 검색(읽기 경로) | `searchDocs`, 백링크 헬퍼 |
| [governs-linker.ts](../src/docs/governs-linker.ts) | BLK→concept 엣지 링커 | `linkGovernsEdges`, `GovernsLinkResult` |

### 활성화 모델 — 3중 게이트 (graceful)

문서 기능은 **기본 OFF**. 켜져도 의존성이 없으면 조용히 비활성(코드 그래프는 그대로 동작). 모든 진입점이 동일한 3게이트를 통과한다:

1. **opt-in** — `CODEGRAPH_DOCS` env(`1/true/on`) **또는** `project_metadata.docs_enabled` 영속 플래그(`--with-docs`가 설정). env가 우선.
2. **sqlite-vec** — 확장 로드 실패 시 warn 후 no-op(throw 안 함).
3. **@xenova/transformers** — 미설치 시 `npm i @xenova/transformers` 안내 후 no-op.

세 게이트 모두 통과해야 `available=true`. 한 번 `--with-docs`로 인덱싱하면 플래그가 DB에 영속되어, env 없는 MCP 서버 실행도 이를 이어받는다.

### 임베딩

- 모델: `all-MiniLM-L6-v2`, 384차원, **완전 로컬 실행**(원격은 모델 캐시 최초 1회만).
- `@xenova/transformers`는 **optional dependency** — 미설치 프로젝트는 영향 없음.

---

## 3. DB 스키마 변경

신규 테이블 2개 + 노드/엣지 종류 2개. 모두 같은 `codegraph.db` 안.

| 객체 | 위치 | 비고 |
|---|---|---|
| `mdast_metadata` 테이블 | [schema.sql:163](../src/db/schema.sql) | `file_path·blk_tags·code_refs·doc_links·content_summary·content_hash`. content_hash로 **증분 스캔**(해시 동일 시 skip). |
| `mdast_vectors` (vec0 가상테이블) | **런타임 생성** (`ensureVectorTable`) | `vec0(embedding float[384])`. sqlite-vec 로드 전엔 `vec0`가 미지의 타입이라 `schema.sql`에 선언하지 않음 — `db.exec(schema)`가 터지지 않도록 의도적 분리. `rowid === mdast_metadata.id`. |
| NodeKind `'concept'` | [types.ts:41](../src/types.ts) | 마크다운 BLK 태그에서 생성되는 노드. |
| EdgeKind `'governs'` | [types.ts:62](../src/types.ts) | `concept → code` 방향. |

마이그레이션은 [migrations.ts](../src/db/migrations.ts)에서 스키마 v5로 올린다.

---

## 4. governs 파이프라인 (BLK 마커 → concept 연결)

이 포크의 가장 복잡한 부분. **구현(코드) ↔ 의도(설계 문서)**를 그래프로 잇는다.

### 코드 측 — BLK 마커 추출 → governs ref

[tree-sitter.ts](../src/extraction/tree-sitter.ts)의 `extractBlkReferences`가 `// [BLK-XXX]` 주석을 3계층에서 잡는다:

- **파일 헤더** — 첫 선언 이전(주석 노드 건너뛰고 첫 비주석 선언의 `startIndex`까지) → **file 노드**에 귀속.
- **클래스 헤더** — `[node.startIndex, body.startIndex]` 범위 스캔(본문 마커와 중복 귀속 방지) → **class 노드**.
- **메서드/함수 본문** — 기존 경로 → 해당 함수 노드.

각 마커는 `reference_kind='governs'`인 `unresolved_ref`로 적재된다.

### 문서 측 — concept 노드 생성

`indexMarkdown`이 **GOVERNED_DIRS 문서**의 `<!-- BLK: BLK-XXX -->`만 concept 노드로 만든다:

```ts
export const GOVERNED_DIRS = ['cxt/', 'docs/contextmd/', 'manage/'];  // indexer.ts:41
```

- 정규 디렉터리로 제한 → 검증 문서·메모리뱅크의 *예시* BLK 문자열이 노이즈 노드를 만드는 것을 차단(분석 보고서가 지적한 false-positive 원인).
- `blkTags`가 비면 루프가 안 돎 → **BLK 미사용 프로젝트는 no-op**.
- 노드 id = `sha1(rel::tag)` (안정적·재현 가능).

### 링커 — `linkGovernsEdges`

`indexMarkdown` **이후** 실행([index.ts](../src/index.ts) `indexAll` & sync 경로 둘 다):

1. `getUnresolvedReferencesByKind('governs')` — governs ref가 **0이면 즉시 반환**(배리어).
2. 각 ref의 BLK 태그로 concept 후보 조회 → `pickCanonical`로 1개 선택:
   **GOVERNED_DIRS 우선 → 최단 경로 → 알파벳 → 최소 라인**.
3. `edges(kind='governs', source=concept, target=code, provenance='heuristic')` INSERT,
   `metadata.synthesizedBy='governs-linker'`, `metadata.blk='BLK-XXX'`.
4. 소비한 ref는 `unresolved_refs`에서 삭제. 매칭 concept이 없으면 **보존**(다음 재인덱싱 때 재시도).

### 리졸버 변경 (단계 순서 버그 수정)

[resolution/index.ts](../src/resolution/index.ts):
- `resolveOne` — governs ref는 최상단에서 `return null`(여기서 풀지 않음).
- `resolveAndPersistBatched` — 미해소 ref 삭제 시 governs를 **제외**(`filter(r => r.referenceKind !== 'governs')`). 이게 빠지면 링커가 돌기 전에 ref가 지워져 governs=0이 된다.

### impact 도달

[graph/traversal.ts](../src/graph/traversal.ts)의 `getImpactRecursive`가 incoming 엣지(종류 무관) + outgoing governs를 따라가므로, 함수에 `codegraph_impact`를 걸면 그를 지배하는 설계 스펙(concept)이 같이 뜬다.

---

## 5. MCP 도구 (신규/확장)

| 도구 | 위치 | 설명 |
|---|---|---|
| `codegraph_docs` | [tools.ts:472](../src/mcp/tools.ts) | 마크다운 의미 검색. 랭크된 문서 + 각 문서가 지배하는 코드 심볼(frontmatter `code_refs`) 반환 → 의도에서 구현으로 점프. opt-in. |
| `codegraph_backlinks` | [tools.ts:659](../src/mcp/tools.ts) | 특정 `.md`의 forward link + backlink(Zettelkasten 구조 탐색). `depth`로 재귀(최대 5). |
| context·node·impact 확장 | tools.ts | 문서 기능 ON이면 파일을 지배하는 문서가 `codegraph_context`·`codegraph_node`·`codegraph_impact` 안에 자동 노출. |

`tools.ts`에는 mdast 메타데이터 기반 검색 폴백도 들어가 있다(코드 심볼 매칭이 없을 때 문서명으로 검색). 에이전트 가이드는 [server-instructions.ts](../src/mcp/server-instructions.ts)가 단일 출처.

---

## 6. CLI / 부수 변경

- **`codegraph index --with-docs`** ([bin/codegraph.ts](../src/bin/codegraph.ts)) — 문서 기능을 켜고 인덱싱, 플래그 영속. 수동 `codegraph index`도 문서 기능 ON이면 코드와 함께 문서를 갱신하고 재인덱싱 수를 보고.
- **`codegraph status`** — 인덱싱된 문서 수 표시.
- **비-ASCII 파일명 수정** — [scan-files.ts:31](../src/docs/scan-files.ts)에서 `git ls-files`에 `-c core.quotepath=false`(+`-z` NUL 종단). 한글/한자/일어 파일명이 octal 이스케이프되어 누락되던 버그 해결. (분석 보고서 §3.1에서 확진했던 그 버그.)
- **`sync-global-codegraph` 스킬** — `npm pack` + `npm install -g`로 이 PC의 전역 `codegraph`를 프로젝트 빌드로 교체(junction 불안정 회피). 소스 수정 때마다 재실행 필요.
- **패키지명** — `@evespimrose/codegraph` → `@evespimrose/codegraph`.

---

## 7. 검증 상태

- **유닛/통합 테스트** — `__tests__/docs-db.test.ts`, `docs-parse.test.ts`, `docs-search.test.ts`, `docs-tool-gating.test.ts`, `governs-linking.test.ts`(8 테스트: 링커·정규성 선택·보존·no-op 배리어·calls 무영향 + 적대적 3건), `extraction.test.ts`(BLK 추출).
- **실증 보고서** — `docs/verification - RX_1/`(코드+문서 혼합 레포), `docs/verification - pure/`(순수 문서 레포). 각 핸드오버·테스트 절차·가이드·결과 포함.
- **governs 8 테스트 통과**, 기존 19개 실패는 이 변경과 무관(플랫폼 의존 — CLAUDE.md "Known pre-existing Windows failures" 참조).

---

## 8. 타 세션을 위한 빠른 시작

```bash
# 1) 빌드
npm run build

# 2) (선택) 문서 기능 의존성
npm i @xenova/transformers

# 3) 문서까지 인덱싱
codegraph index --with-docs        # 또는: CODEGRAPH_DOCS=1 codegraph index

# 4) 확인
codegraph status                   # 문서 수 표시
```

DB를 직접 들여다볼 때:
```sql
SELECT count(*) FROM mdast_metadata;                 -- 인덱싱된 문서
SELECT count(*) FROM edges WHERE kind='governs';     -- BLK 연결 수
SELECT kind, count(*) FROM nodes GROUP BY kind;      -- concept 노드 확인
```

### 인계 시 주의 (gotcha)

1. **단계 순서 불변식** — `indexMarkdown` → `linkGovernsEdges` 순서를 깨지 말 것. 리졸버의 governs 보존(§4)도 함께 유지해야 governs>0이 나온다.
2. **GOVERNED_DIRS가 concept 생성의 유일 관문** — 다른 디렉터리의 BLK는 concept 노드가 안 된다(의도된 설계). 정규 디렉터리를 늘리려면 [indexer.ts:41](../src/docs/indexer.ts) 한 줄.
3. **벡터 테이블은 런타임 생성** — `schema.sql`에 `mdast_vectors`가 없는 건 버그가 아니다(vec0 미지 타입 회피).
4. **모든 것이 opt-in** — 문서 기능을 안 쓰는 프로젝트에서 동작이 바뀌면 그건 배리어가 새는 것 = 회귀.
5. **빌드 자산** — 새 `.sql`/`.wasm`은 `copy-assets`가 `dist/`로 복사해야 배포에 들어간다.

### 아직 열린 것

- `concept ↔ concept` 엣지는 없다(governs는 `concept → code` 단방향). 문서 간 재귀 탐색은 `codegraph_backlinks`의 `depth`로 한다(별개 메커니즘).
- 분석 보고서(`docs/codegraph-analysis.md`)의 권고 중 ②~⑥(토폴로지 명문화·링크 오염 차단 등)은 *문서 양식* 측 작업으로 도구 코드와 분리됨.
