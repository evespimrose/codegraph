# CodeGraph Markdown-AST Integration 플랜

**프로젝트**: `d:\Fork\codegraph`  
**브랜치**: `mdAddOn`  
**작성일**: 2026-06-08  
**연관 RX_1 플랜**: `D:\Fork\RX_1\.claude\memory-bank\main\plans\main-2026-06-08-integrated-roadmap.md` (3단계)

## 목표 (Goal)
현재 정규식 기반의 임시 Zettelkasten 브릿지를 **Tree-sitter Markdown 파서**로 대체하고, 마크다운 `[BLK]` 태그를 코드와 동등한 일급 시민(First-class Citizen) AST 노드로 `nodes` 테이블에 등록한다. 최종적으로 `codegraph_impact` 가 코드와 마크다운 문서를 차별 없이 교차 탐색할 수 있는 **Unified Brain 구조**를 완성한다.

## 성공 기준 (Success Criteria)
- `codegraph_node "BLK-001"` 질의 시, `TurnAwareAStar.cs`의 C# 노드와 함께 RX_1 `dictionary.md`의 `[BLK-001]` 선언 블록이 동시에 결과에 포함될 것.
- `codegraph_impact "TurnAwareAStarPart"` 질의 시, 해당 코드에 `governs` 엣지로 연결된 마크다운 문서 경로까지 결과에 포함될 것.
- 기존 `codegraph_docs` (벡터 기반 시맨틱 탐색)와 충돌하지 않을 것. (두 탐색 방식은 상호 보완재로 공존)

## 비목표 (Non-goals)
- 기존 `mdast_metadata` 테이블 및 `codegraph_docs`, `codegraph_backlinks` 툴을 삭제하거나 교체하는 것. (본 작업은 AST 기반 구조적 탐색 레이어를 **추가**하는 것임)
- 마크다운 전체 문법을 Tree-sitter로 파싱하는 것. (오직 `[BLK: XXX]` 태그 패턴 인식에 집중)

---

## 상세 구현 계획

### Phase A: 인덱서 파서 확장 (`src/docs/parse.ts`)
1. `[BLK: BLK-001]` 또는 `// [BLK-001]` 패턴을 인식하는 전용 파서 함수 추가.
   - 마크다운 파일: `<!-- BLK: BLK-001 -->` 혹은 `[BLK: BLK-001]` 패턴 매칭.
   - C# 파일 (선택): `// [BLK-001][A][P]` 인라인 마커 패턴 매칭.
2. 추출된 `[BLK]` 태그를 파일 경로, 라인 번호와 함께 반환하는 구조체 정의.

### Phase B: 스키마 및 마이그레이션 (`src/db/schema.sql`, `src/db/migrations.ts`)
1. **Migration v7**: `nodes` 테이블에 `kind = 'concept'` 레코드 삽입을 허용하도록 검증.
   - `name`: BLK 태그 이름 (예: `BLK-001`)
   - `file_path`: 마크다운 파일 경로
   - `start_line`: 태그가 선언된 라인 번호
   - `kind`: `'concept'`
2. **Migration v8**: `edges` 테이블에 `kind = 'governs'` 엣지 타입 허용 확인.

### Phase C: 인덱서 연동 (`src/docs/indexer.ts`)
1. 마크다운 파일 인덱싱 시, 추출된 `[BLK]` 태그를 `nodes` 테이블에 `INSERT OR REPLACE`로 등록.
2. C# 파일 인덱싱 시 (`src/indexer.ts`), `// [BLK-XXX]` 마커를 파싱하여 해당 C# 함수 노드와 `concept` 노드 간 `governs` 엣지 생성.
   - Edge: `source = (C# method node id)`, `target = (concept node id)`, `kind = 'governs'`

### Phase D: MCP 툴 업데이트 (`src/mcp/tools.ts`)
1. `codegraph_node` 툴이 `kind: 'concept'` 노드를 결과에 포함하도록 쿼리 수정.
2. `codegraph_impact` 툴의 엣지 순회 로직이 `governs` 엣지 타입을 포함하도록 확장.

## Phase E: Recursive Backlink Traversal (취약점 보완)
> **대상**: `src/docs/search.ts` — `findBacklinks` 함수
> **보완 대상 취약점**: 현재 `findBacklinks`가 SQL `LIKE` 단일 쿼리로 Depth=1만 조회하여, 문서 A→B→C 같은 연쇄 참조(나비 효과)를 추적하지 못하는 문제.

### 구현 방향
1. **Recursive CTE 도입**: SQLite의 `WITH RECURSIVE` 문을 활용하여 `doc_links` 체인을 재귀적으로 순회.
   ```sql
   WITH RECURSIVE chain(file_path, depth) AS (
     -- Anchor: 직접 참조자 (depth=1)
     SELECT file_path, 1 FROM mdast_metadata
     WHERE doc_links LIKE '%target_file%'
     UNION ALL
     -- Recursive: 참조자의 참조자 (depth=N)
     SELECT m.file_path, c.depth + 1
     FROM mdast_metadata m
     JOIN chain c ON m.doc_links LIKE '%' || c.file_path || '%'
     WHERE c.depth < :max_depth  -- 무한 루프 방지
   )
   SELECT * FROM chain;
   ```
2. **`codegraph_backlinks` 툴 파라미터 확장**: `depth` 파라미터를 추가하여 에이전트가 탐색 깊이를 제어할 수 있도록 함. (기본값 `depth=1`, 최대 `depth=5`)
3. **순환 참조 방지**: `visited` Set을 통해 A→B→A 무한 루프를 차단.

---

## 구현 순서 (Checklist)
- [x] Phase A: `parse.ts` — `[BLK]` 태그 파서 함수 작성
- [x] Phase B: Migration v7/v8 스키마 검증 및 필요시 마이그레이션 추가
- [x] Phase C: `indexer.ts` — concept 노드 및 governs 엣지 등록 로직
- [x] Phase D: `tools.ts` — `codegraph_node`, `codegraph_impact` 쿼리 확장
- [x] Phase E: `search.ts` — `findBacklinks` 재귀 순회 강화
- [ ] 검증: `D:\Fork\RX_1\manage\dictionary.md` 재인덱싱 후 `codegraph_node BLK-001` 질의 테스트

## 의존성 (Dependencies)
- `RX_1` 2단계 완료 필수: 소스 코드 인라인 마커(`// [BLK-XXX]`)가 존재해야 C# ↔ 마크다운 `governs` 엣지 생성이 의미있음.
- `tree-sitter-markdown` npm 패키지 설치 여부 결정 (완전 AST 파싱 vs. 정규식 하이브리드 방식).

---