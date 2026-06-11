---
name: obsidian-doc-graph-hybrid-plan-20260611
description: 2026-06-11 하이브리드 doc-graph PLAN 완료 — doc_link kind, 승격 패스, 순수-MD 게이트, EXECUTE 대기 중
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

`.riper-state`: MODE=PLAN, 대기 중(사용자 승인 후 EXECUTE 착수)

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
