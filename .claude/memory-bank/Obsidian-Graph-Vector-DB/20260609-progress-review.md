# CodeGraph Markdown-AST Integration 진행 상황 정리 (2026-06-09)

## 분석 대상
- Git `HEAD`: `8dbf04b57c3948002ef8cae8d030d040343c3a44`
- 현재 `unstaged diff`
- `.claude/memory-bank/Obsidian-Graph-Vector-DB/20260608-session.md`
- `.claude/memory-bank/mdAddOn/plans/mdAddOn-2026-06-08-ast-integration.md`

## 한줄 결론
현재 상태는 **BLK를 `concept` 노드로 넣고, 코드 쪽에서 `governs` 참조를 생성하는 기반 작업은 대부분 구현된 상태**다. 다만 이것은 아직 **Tree-sitter Markdown 기반 완전 전환이 아니라 regex 하이브리드 구현**이며, 계획서의 성공 기준 중 `RX_1` 재인덱싱과 실제 MCP 질의 검증은 아직 끝나지 않았다. 또한 일부 보강(`codegraph_backlinks` 재귀 깊이, `impact`의 `governs` 추적, `concept` 검색 랭킹)은 아직 **unstaged** 상태다.

## 8dbf04b 커밋에서 이미 들어간 것

### 1. BLK 개념 노드 도입 기반
- `src/types.ts`
  - `NodeKind`에 `concept` 추가
  - `EdgeKind`에 `governs` 추가
- `src/db/migrations.ts`
  - v7/v8 마이그레이션 추가
  - 실제 DDL 변경이 아니라, `concept` / `governs`를 허용하는 방향이 타입/코드 레벨에서 유효하다는 확인용 no-op migration
- `src/db/schema.sql`
  - 별도 `concept` 전용 테이블 추가는 없음
  - 기존 `nodes` / `edges`의 자유 텍스트 `kind` 구조를 그대로 사용

### 2. Markdown 쪽 BLK 추출 및 인덱싱
- `src/docs/parse.ts`
  - `extractBlkTags()` 추가
  - 다음 패턴을 regex로 추출:
    - `<!-- BLK: BLK-001 -->`
    - `[BLK: BLK-001]`
    - `// [BLK-001]`
- `src/docs/indexer.ts`
  - Markdown 인덱싱 중 `extractBlkTags()` 호출
  - 추출된 태그를 `nodes` 테이블에 `kind='concept'`, `language='markdown'` 노드로 `INSERT OR REPLACE`
  - 노드 ID는 `sha1(filePath::tag)` 방식

### 3. 코드 쪽 `governs` 참조 생성
- `src/extraction/tree-sitter.ts`
  - 함수/메서드 본문에서 `// [BLK-XXX]` 패턴을 읽는 `extractBlkReferences()` 추가
  - 추출 결과를 `unresolvedReferences`에 `referenceKind: 'governs'`로 저장
  - 이 로직은 `extractFunction()` / `extractMethod()`에서 호출됨
- `src/resolution/name-matcher.ts`
  - 별도 `governs` 전용 분기는 없지만, exact-name 매칭 경로로 `BLK-001` 같은 이름을 가진 `concept` 노드에 resolve될 수 있는 구조
- `src/resolution/index.ts`
  - resolve된 `referenceKind`를 그대로 edge로 만들기 때문에, `governs`도 일반 edge 생성 흐름에 올라탈 수 있음

### 4. 세션 문서와의 일치 여부
- `20260608-session.md`에 적힌 내용과 실제 코드 상태는 대체로 일치한다.
- 특히 세션 문서가 말한 핵심인
  - Markdown indexer에서 `concept` 노드 등록
  - Tree-sitter 추출기에서 `governs` unresolved reference 생성
  는 현재 코드베이스에서 확인된다.

## 현재 unstaged diff 에서 추가로 진행된 것

### 1. Recursive Backlinks 강화
- `src/docs/search.ts`
  - `findBacklinks(filePath, maxDepth = 1)` 형태로 확장
  - SQLite `WITH RECURSIVE` 기반으로 backlink 체인 재귀 조회
- `src/mcp/tools.ts`
  - `codegraph_backlinks` 입력 스키마에 `depth` 추가
  - 실제 핸들러에서도 `depth`를 `1..5`로 clamp 후 전달

### 2. `codegraph_impact`가 `governs`를 따라가도록 보강
- `src/graph/traversal.ts`
  - impact 순회 시 incoming edge뿐 아니라 outgoing `governs` edge도 따라가도록 추가
  - 이 변경이 있어야 코드 심볼에서 markdown `concept` 노드 쪽으로 영향 반경이 확장된다

### 3. `concept` 검색 랭킹 보강
- `src/search/query-utils.ts`
  - `kindBonus()`에 `concept: 10` 추가
  - `codegraph_node "BLK-001"` 같은 질의에서 concept 노드가 검색 상위로 올라올 가능성을 높임

### 4. 기타 정리성 수정
- `src/db/migrations.ts`
  - 사용하지 않는 인자명을 `_db`로 변경
- `src/docs/parse.ts`
  - null-safe 처리 보강
- `.claude/memory-bank/mdAddOn/plans/mdAddOn-2026-06-08-ast-integration.md`
  - Phase A~E 체크박스를 로컬에서 `[x]`로 변경

## 계획 문서 기준 현재 단계 판정

### Phase A: 파서 확장
- **대체로 구현됨**
- 다만 이름과 달리 현재 구현은 `Tree-sitter Markdown` 파서가 아니라 **regex 기반 BLK 추출기**다.
- 즉, "BLK 태그를 읽는다"는 기능 목표는 달성에 가깝지만, "정규식 브릿지를 Tree-sitter Markdown으로 대체한다"는 큰 제목 수준 목표는 아직 미완료다.

### Phase B: 스키마/마이그레이션
- **사실상 구현됨**
- 하지만 실질적인 DB 제약 변경은 없다.
- 현재 구조는 원래 `kind TEXT` 기반이라, v7/v8은 "별도 DDL이 없어도 괜찮다"는 선언에 가깝다.

### Phase C: 인덱서 연동
- **구현됨**
- Markdown -> `concept` 노드 등록
- C#/코드 -> `governs` unresolved reference 생성
- resolve 경로도 일반 해석기 흐름상 연결 가능

### Phase D: MCP 툴 업데이트
- **부분 구현**
- `codegraph_impact` 측면:
  - unstaged 기준으로는 `governs` edge를 따라가도록 강화되어 방향성이 맞다.
- `codegraph_node` 측면:
  - `concept` 노드를 아예 못 찾는 구조는 아니다. 검색 자체는 일반 `nodes` 검색을 타므로 가능성이 있다.
  - 다만 계획서 성공 기준처럼 `codegraph_node "BLK-001"`에서 관련 C# 노드와 markdown 선언 블록이 함께 드러나는 경험은 아직 불확실하다.
  - 현재 `handleNode()`의 trail은 calls/callers 중심이라, `concept` 노드에서 `governs` 관계를 직접 보여주는 출력은 확인되지 않았다.

### Phase E: Recursive Backlink Traversal
- **unstaged 기준 구현 중**
- 재귀 CTE와 `depth` 파라미터는 들어갔다.
- 다만 계획서에 적힌 `visited` Set 기반 순환 참조 방지는 코드에 명시적으로 구현되어 있지 않다.
- 현재 쿼리는 `depth` 상한으로 무한 루프는 막지만, 순환 그래프에서 중복 경로 확산을 깔끔하게 제어하는 수준까지는 아니다.

## 성공 기준 대비 현재 상태

### 1. `codegraph_node "BLK-001"`
- **아직 미검증**
- `concept` 노드가 DB에 들어가고 검색 랭킹도 보강되고 있어, 노드 자체를 찾을 가능성은 높아졌다.
- 그러나 성공 기준에 적힌 "관련 C# 노드와 dictionary.md 선언 블록이 동시에 결과에 포함"되는 수준은 아직 코드상으로 확신하기 어렵다.
- 이유:
  - 검증 체크리스트가 아직 남아 있음
  - `handleNode()` 출력 경로에서 `governs` 관계를 적극적으로 보여주는 전용 포맷이 보이지 않음

### 2. `codegraph_impact "TurnAwareAStarPart"`
- **unstaged 기준으로는 성공 가능성이 높아졌지만 아직 미검증**
- `src/graph/traversal.ts` 변경 덕분에 코드 심볼 -> `governs` -> concept/document 방향 순회가 가능해진다.
- 하지만 이 로직은 아직 커밋되지 않았고, 실제 RX_1 데이터로 재인덱싱 테스트한 흔적도 없다.

### 3. `codegraph_docs`와의 공존
- **유지 중**
- 현재 변경은 `mdast_metadata` / vector 검색 레이어를 제거하지 않고, `nodes` / `edges` 기반 구조를 추가하는 방향이다.
- 따라서 계획의 "기존 vector 기반과 공존" 의도와는 일치한다.

## 중요한 해석 포인트

### 1. "AST Integration"이라는 이름과 실제 구현 사이 간극
- 이번 작업의 실체는 현재 시점 기준으로 **Markdown 전체를 Tree-sitter AST로 올린 것**이 아니라,
  - Markdown 인덱싱 시 BLK 태그를 regex로 뽑아 `concept` 노드화하고
  - 코드 주석의 BLK 마커를 `governs` edge 후보로 연결하는 것
  에 가깝다.
- 즉, Unified Brain 방향의 구조적 연결은 시작됐지만, 제목 그대로의 "Tree-sitter Markdown 통합"은 아직 아니다.

### 2. 세션 문서와 계획 문서의 차이
- 세션 문서(`20260608-session.md`)는 비교적 보수적으로 **Phase C 진행 중**으로 기록되어 있다.
- 반면 현재 plan 문서의 체크리스트는 로컬 수정으로 **Phase A~E 완료 표시**가 되어 있다.
- 실제 코드 상태를 보면:
  - A/C는 상당 부분 구현
  - E는 unstaged 기준 보강 중
  - D는 일부 성공 기준이 아직 미검증
  라서, 세션 문서보다 더 진척되긴 했지만 체크리스트를 전부 완료로 보기에는 검증 근거가 부족하다.

## 아직 남은 일
- `RX_1`의 `dictionary.md`를 실제로 재인덱싱
- `codegraph_node "BLK-001"` 실질 출력 검증
- `codegraph_impact "<C# symbol>"`에서 markdown concept/file이 실제 포함되는지 검증
- 필요하면 `codegraph_node` 출력에 `governs` 관계를 직접 노출하는 포맷 보강
- 필요하면 recursive backlink에 cycle/visited 처리 추가
- `tree-sitter-markdown`을 정말 도입할지, 현재 regex 하이브리드로 마감할지 결정

## 최종 판단
- **완료된 것**
  - BLK -> `concept` 노드화
  - 코드 주석 BLK -> `governs` 참조 생성
  - 일반 resolver 흐름을 통한 edge 생성 기반 확보
- **거의 된 것**
  - backlink 재귀 탐색
  - impact에서 markdown concept 방향 확장
  - concept 검색 우선순위 보강
- **아직 안 끝난 것**
  - RX_1 실데이터 검증
  - 성공 기준 만족 여부 확인
  - "진짜 Tree-sitter Markdown 전환" 여부

요약하면, 현재 브랜치는 **Unified Brain 구조의 뼈대는 거의 연결됐지만, 마지막 검증과 일부 사용자 가시성(MCP 출력 경험)은 아직 남아 있는 상태**로 보는 것이 가장 정확하다.
