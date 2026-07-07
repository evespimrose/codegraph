---
name: obsidian-doc-graph-hybrid-plan-20260611
description: 하이브리드 doc-graph — PLAN(06-11) + EXECUTE 완료(06-12, 9/9, 빌드 그린, 신규 6/6, 회귀 0). regex 마감 확정([[try-treesitter-markdown-vs-regex]]).
metadata:
  type: project
---

# 2026-06-11 세션 — 하이브리드 doc-graph PLAN 작성 완료

## 작업 내용

try_002.md(분석 문서)를 기반으로 `mdast_metadata.doc_links` → `doc` 노드 + `doc_link` 엣지 승격 구현의 **RIPER PLAN**을 작성했다. 코드 수정 없음(PLAN 단계).

**PLAN 파일**: `.claude/memory-bank/Obsidian-Graph-Vector-DB/plans/Obsidian-Graph-Vector-DB-2026-06-11-doc-graph-hybrid.md`

## 실측으로 확정된 사실 (src/ 기준)

| 사실 | 좌표 |
|---|---|
| callers/callees 화이트리스트 `['calls','references','imports']` | `src/graph/traversal.ts:251,296` |
| impact는 kind 무필터 → 모든 kind 자동 포함 | `src/graph/traversal.ts:525` |
| `doc_links` 이미 `mdast_metadata`에 JSON 저장 | `src/docs/indexer.ts:87-94,146` |
| 일반 문서는 노드 없음(concept=GOVERNED_DIRS BLK만) | `src/docs/indexer.ts:159-166` |
| `MARKDOWN_EDGE_KINDS=['governs']`, `MARKDOWN_NODE_KINDS=['concept']` | `src/types.ts:70,76` |
| `getMarkdownGraphCounts` = language='markdown' + MARKDOWN_EDGE_KINDS | `src/db/queries.ts:1668-1676` |
| CLI 코드 엣지 브레이크다운에서 MARKDOWN_EDGE_KINDS 제외 | `src/bin/codegraph.ts:844` |
| 선례(governs-linker) = indexMarkdown 후 배선 | `src/index.ts:340,467` |
| 게이트 = `resolveDocsEnabled` (env CODEGRAPH_DOCS → project_metadata) | `src/docs/config.ts:69` |
| 백링크 헬퍼 baseName/parseRefs/normPath 재사용 대상 | `src/docs/search.ts:280-294,329` |

## 설계 결정 (사용자 확인)

- **엣지 kind = 전용 `doc_link`** (사용자가 "전용 kind 권고" 채택)
  - **Why**: MARKDOWN_EDGE_KINDS 파티션 인프라가 이미 존재 → 공짜로 깔끔한 집계 + 코드 참조 오염 0
- **노드 kind = `doc`**, language='markdown'
- **게이트 = 하이브리드**: 순수-MD 자동감지(`코드노드==0 && mdast>0`) OR `CODEGRAPH_DOC_GRAPH` override
- **엣지 방향**: citing→cited (callees=정방향, callers=백링크)
- **헬퍼 추출**: `links-util.ts`로 baseName/parseRefs/normPath 이동(governs-linker 패턴 복제)

## RIPER 상태

`.riper-state`: MODE=REVIEW — **EXECUTE 9/9 완료(2026-06-12)**. 빌드 그린, 신규 6/6 통과, 회귀 0(클린트리 stash 베이스라인과 동일 실패만 재현).

## 9개 STEP 요약

1. `types.ts`·`query-utils.ts` — `doc`/`doc_link` kind 등록 + 마크다운 파티션·랭킹
2. `docs/config.ts` — `CODEGRAPH_DOC_GRAPH` override 헬퍼
3. **신규** `docs/links-util.ts` — baseName/parseRefs/normPath 추출
4. **신규** `docs/doc-links-linker.ts` — `linkDocEdges` + 게이트(`isPureMarkdownProject`)
5. `graph/traversal.ts` — 화이트리스트 2곳에 `doc_link` 추가
6. `index.ts` — indexAll·sync 배선
7. **신규** `__tests__/doc-links-linking.test.ts` — seed 기반 단위·게이트·idempotent·회귀
8. `CHANGELOG.md` — `[Unreleased]` 항목
9. 빌드·전체 vitest 회귀

## EXECUTE 결과 (2026-06-12) — 구현 중 확정된 비자명 사실

**파일**: 수정 7(`types.ts`, `query-utils.ts`, `config.ts`, `search.ts`, `traversal.ts`, `index.ts`, `extraction/index.ts`) · 신규 4(`docs/links-util.ts`, `docs/doc-links-linker.ts`, `__tests__/doc-links-linking.test.ts`, CHANGELOG 항목).

구현 중 실측으로 드러난, 코드만 봐선 비자명한 사실:

- **`parse.ts`는 100% regex·무의존** — 헤더 "no heavy deps". `mdast_metadata`의 "mdast"는 포팅 레거시 테이블명일 뿐, 실제 AST 라이브러리 아님(remark/unified/micromark 의존성 0). → **tree-sitter 전환 반대·regex 마감 확정** (분석: `docs/Try_TreeSitterMarkdown전환.md`). BLK가 HTML주석/표셀(AST에 불투명)에 살아 전환해도 regex 안 사라짐.
- **doc 노드는 raw `INSERT OR REPLACE` SQL로 삽입** — `language='markdown'`이 `Language` 유니온 밖이라 `queries.insertNode`가 타입 거부(TS2322). indexMarkdown의 concept 노드 선례와 동일하게 우회.
- **idempotency = FK `ON DELETE CASCADE`** (`foreign_keys=ON` @ `src/db/index.ts:31`). edges 테이블엔 UNIQUE 제약 **없음** → INSERT OR IGNORE만으론 중복 방지 안 됨. 노드 REPLACE가 stale `doc_link` 엣지를 cascade 삭제→재생성으로 멱등. (test d가 이걸 검증: cascade 안 돌면 2회 후 4엣지)
- **`insertEdges`가 endpoint 노드 존재 검증**(`getExistingNodeIds`) → 미존재 엣지 silent drop. **노드를 엣지보다 먼저** 삽입 필수.
- **배선 = getMarkdownGraphCounts 뒤(Option 2)** — `conceptNodes` 라벨 오염 회피, 신규 `docLinkNodes?`/`docLinkEdges?` 필드로 분리 노출.

**회귀 베이스라인 사실**: 기존 실패(스키마버전 단언 stale: docs-db v5·foundation·pr19 v2 / JVM·C++ 해소 / git worktree / mcp-initialize·mcp-roots)는 **전부 내 변경 이전부터 존재** — `git stash` 클린트리에서 동일 재현. mcp 2종은 CLAUDE.md 문서화된 알려진 Windows 실패.

## 직전 완료된 작업(동일 브랜치)

governs edge pipeline 구현 완료 (커밋 `da10821`, `81cb725`):
- `src/docs/governs-linker.ts` 신규 — `linkGovernsEdges(db, queries)`
- `src/index.ts:340,467` 배선
- `src/docs/indexer.ts:159-166` concept 노드를 GOVERNED_DIRS로 제한
- `src/resolution/index.ts` governs ref 보존(resolver skip)
- `__tests__/governs-linking.test.ts` 신규

## 미결(Non-Goal/추후)

- `calls` 위장 옵트인(trace/explore/metrics 표면)
- `findBacklinks`를 edges 기반으로 통일
- 혼합 프로젝트 기본 활성화
- Q6: publish 0.9.9 vs 로컬 포크

**Why**: 이번 범위를 4대 질의(node/impact/callers/callees)로 제한하여 최소 범위 구현. 위장/통일은 Phase 4(try_002 §5).
**How to apply**: EXECUTE 중 Non-Goal 항목 편집 요청 오면 리마인드.
