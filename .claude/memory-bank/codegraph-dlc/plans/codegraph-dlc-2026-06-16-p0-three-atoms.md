# PLAN — P0 3종 (CRG3 allowlist · HR7 정직한 시맨틱 폴백 · CRG1 3단계 엣지 신뢰도)

> MODE: PLAN · BRANCH: codegraph-dlc · STARTED: 2026-06-16
> 출처: docs/Try_AtomImport_DLC_vs_Workflow.md (P0 3종)
> 탐색: codegraph_context/search/node/explore + 보완 Read(offset) — Cave-Man 준수

---

## 0. 사전 정찰 결과 (착수 전 반드시 읽을 것)

codegraph 정찰로 드러난 **계획 변경 핵심**:

| 원자 | 정찰 결과 | 플랜 영향 |
|---|---|---|
| **CRG3 allowlist** | **이미 완전 구현됨.** `toolAllowlist()`(tools.ts:767)가 `CODEGRAPH_MCP_TOOLS` env 파싱 → `getTools()`(801)가 광고 필터 + `isToolAllowed()`(776)가 `execute()`(1131)에서 **호출 경로까지 강제**. 게다가 tiny-repo(<500파일) 5-도구 게이팅도 이미 작동(이 repo 217파일 → 이미 5도구만 노출). | **기능 코드 0. 검증+문서화만.** Step 1로 축소. |
| **HR7 정직한 폴백** | **실제 갭 확인.** `searchDocs()`(search.ts:111-211)는 vec0 KNN 결과를 거리 무관하게 topk 전부 반환(165행 `knn.length===0`만 bail, 거리 임계 없음). 가까운 문서가 없어도 "가장 가까운 먼 문서"를 매치인 양 반환 → 저신뢰 날조. | **실제 코드.** Step 2~4. |
| **CRG1 3단계 신뢰도** | **2단계뿐.** `Edge.provenance`(types.ts:211) = `'tree-sitter'|'scip'|'heuristic'`(옵셔널). grep 결과 **오직 'heuristic'만 실제 할당**(synthesizer·governs-linker·doc-links-linker). AST-추출·resolution 엣지는 provenance=undefined로 동일 버킷. | **실제 코드.** Step 5~8. |

→ **P0 실제 작업량은 HR7 + CRG1 뿐.** CRG3는 거의 끝나 있어 P0가 예상보다 더 싸다.

vec0 거리 메트릭: `indexer.ts:46`이 `vec0(embedding float[384])`를 **distance_metric 미지정 = L2(유클리드) 기본**으로 생성. 임베딩은 L2-정규화(embed.ts `normalize:true`) → `L2² = 2(1−cos)`. 즉 cos 0.3 ≈ 거리 1.18, cos 0.5 ≈ 거리 1.0, 직교(cos 0) ≈ 1.414. HR7 임계는 이 관계로 환산.

---

## 1. Success Criteria (전체)

- **CRG3**: `CODEGRAPH_MCP_TOOLS`가 server-instructions/README/CHANGELOG에 문서화됨. 기능 회귀 0.
- **HR7**: 의미적으로 무관한 질의 → `searchDocs`가 빈 hits 반환, `codegraph_docs`가 "No documentation matched", context "Related docs"·CLI query 폴백이 먼 문서로 오염되지 않음. 관련 질의는 기존대로 동작.
- **CRG1**: resolution 엣지가 `'inferred'`로 태깅되어 AST-직접 엣지와 구별됨. node/trace 출력이 3단계(direct / inferred / heuristic) 신뢰도를 표시. **노드·엣지 수 무폭증**(provenance만 추가, 새 엣지 0). 기존 'heuristic' synthEdgeNote 출력 무회귀.
- 전체: `npm run build` + `npm test` green. opt-in docs OFF 경로 byte-무회귀.

## 2. Non-Goals (스코프 제외)

- HR1 CCR / HR2 SmartCrusher / HR6 learn / Seq1 / HR5 (Try 문서상 P3 또는 워크플로우 프로젝트 몫).
- CRG2 턴예산 *강제* (저살리언스, 보류). minimal-context 모드 신규 안 함.
- 모든 extractor를 순회해 `'tree-sitter'` 명시 태깅하지 않음 — **undefined ⇒ direct(high)** 로 의미 정의해 스코프 한정.
- 새 MCP 도구 추가 안 함. 새 엣지 종류·노드 종류 추가 안 함.
- sqlite-vec 거리 메트릭을 cosine으로 재생성하지 않음(L2 유지, 임계로 환산).

---

## 3. 단계별 실행 (Plan Scope Lock · Max 10 steps)

### Step 1 — CRG3 검증 + 문서화 (기능 코드 0)
- **Symbol**: `ToolHandler.toolAllowlist` · `ToolHandler.isToolAllowed` · `ToolHandler.getTools`
- **CodeGraph**: toolAllowlist=tools.ts:767(env `CODEGRAPH_MCP_TOOLS`), isToolAllowed=tools.ts:776(called by execute:1131), getTools=tools.ts:801(tiny-repo 5-도구 게이팅 포함)
- **File**: `src/mcp/server-instructions.ts`, `README.md`, `CHANGELOG.md`
- **Scope**: server-instructions 환경변수 절 + README 1블록 + CHANGELOG [Unreleased]
- **BLK target**: [인프라] (문서)
- **Action**: ① execute 경로 강제 1회 확인(이미 wired) ② `CODEGRAPH_MCP_TOOLS=search,context,trace` 식 allowlist 사용법을 server-instructions.ts에 명문화(단일 진실원천) ③ README 도구-토큰비용 절 + CHANGELOG 항목
- **Success criterion**: 코드 변경 없이 사용자가 allowlist로 도구 스키마 토큰을 줄이는 법을 문서에서 발견 가능. `npm test` 무영향.

### Step 2 — HR7 거리 임계 옵션 추가
- **Symbol**: `SearchDocsOptions` · `DEFAULT_TOPK`(상수 블록)
- **CodeGraph**: search.ts 상수=33-40, SearchDocsOptions=search.ts(opts 타입), searchDocs=search.ts:111
- **File**: `src/docs/search.ts`
- **Scope**: Lines [33-40] 상수 + `SearchDocsOptions` 인터페이스
- **BLK target**: [인프라]
- **Action**: insert — `const DEFAULT_MAX_DISTANCE = 1.18;`(cos≈0.3 환산, 주석에 L2-정규화 근거 명기) + `SearchDocsOptions.maxDistance?: number` 추가
- **Success criterion**: 타입 컴파일 통과. 기본값 미전달 시 1.18 적용.

### Step 3 — HR7 폴백 거리 게이트 (핵심)
- **Symbol**: `searchDocs`
- **CodeGraph**: searchDocs=src/docs/search.ts:111-211 (KNN=156-165, hits push=192-208)
- **File**: `src/docs/search.ts`
- **Scope**: Lines [150-208] (topk clamp 직후 ~ hits push)
- **BLK target**: [인프라]
- **Action**: replace — `maxDistance = clamp(opts.maxDistance ?? DEFAULT_MAX_DISTANCE)` 도입 후 `knn`을 `distance <= maxDistance`로 필터; 전부 탈락 시 `result.hits=[]` 그대로 반환(정직한 무매치, throw 금지). 드롭 발생 시 `result.warnings`에 1줄(선택).
- **Success criterion**: 무관 질의 → hits 0. 관련 질의 → 기존 동등. `knn.length===0` 기존 bail과 일관.

### Step 4 — HR7 검증 프로브 (메트릭·임계 실측)
- **Symbol**: (런타임 검증)
- **CodeGraph**: 호출자 handleDocs=tools.ts:1298, buildRelatedDocsSection=tools.ts:1391, CLI main=bin/codegraph.ts:113
- **File**: (검증 전용, 코드 변경 없음)
- **Scope**: 이 repo 자체 문서 `CODEGRAPH_DOCS=1` 인덱싱 후 질의
- **BLK target**: [인프라]
- **Action**: ① vec0 L2 기본 메트릭 1회 확인 ② 무관 질의("바나나 가격") → hits 0, 관련 질의("semantic search") → 정상. 필요 시 DEFAULT_MAX_DISTANCE 미세조정(1.0~1.25 범위).
- **Success criterion**: 거짓양성 폴백 사라짐을 실측 1회 확인. 임계 확정.

### Step 5 — CRG1 provenance 3단계 union 확장
- **Symbol**: `Edge.provenance`
- **CodeGraph**: Edge=types.ts:191, provenance=types.ts:211 (`'tree-sitter'|'scip'|'heuristic'`)
- **File**: `src/types.ts`
- **Scope**: Lines [210-211]
- **BLK target**: [인프라]
- **Action**: replace — union에 `'inferred'` 추가 → `'tree-sitter'|'scip'|'inferred'|'heuristic'`. JSDoc에 3단계 신뢰도 의미 정의(**undefined/tree-sitter=direct·high, inferred=resolution·medium, heuristic=synthesis·low**).
- **Success criterion**: 타입 확장. rowToEdge(queries.ts:144) 캐스팅 무변경 통과.

### Step 6 — CRG1 resolution 엣지 'inferred' 태깅
- **Symbol**: `ReferenceResolver.createEdges`
- **CodeGraph**: createEdges=src/resolution/index.ts:643, resolveAndPersist=index.ts:687→insertEdges
- **File**: `src/resolution/index.ts`
- **Scope**: createEdges 내부 엣지 객체 생성부
- **BLK target**: [인프라]
- **Action**: replace — createEdges가 만드는 각 엣지에 `provenance: 'inferred'` 부여(import/name 해소 산물). synthesizer의 'heuristic'은 불변.
- **Success criterion**: 재인덱싱 후 `select provenance,count(*) from edges group by provenance`에서 inferred 버킷 출현, heuristic 수 불변, 엣지 총수 불변(태깅만).

### Step 7 — CRG1 신뢰도 출력 노출
- **Symbol**: `ToolHandler.synthEdgeNote` · `formatTrail`
- **CodeGraph**: synthEdgeNote=tools.ts:2109(현재 `provenance==='heuristic'`만), 소비처 handleTrace=1825 · buildFlowFromNamedSymbols=2250 · formatTrail=3246
- **File**: `src/mcp/tools.ts`
- **Scope**: synthEdgeNote 2109-2170 + 호출부 라벨 합성
- **BLK target**: [인프라]
- **Action**: replace — `provenance!=='heuristic'` 즉시 null 반환(2110행)을 완화: `inferred`면 "inferred — import/name 해소(medium)" 라벨, direct(undefined/tree-sitter)는 라벨 생략 또는 "direct". node trail·trace hop에 신뢰도 1단어 표기. heuristic 기존 라벨 무회귀.
- **Success criterion**: trace 출력에서 hop별 direct/inferred/heuristic 구분 가시. 기존 synthesized 라벨(react-render 등) 동일.

### Step 8 — CRG1 무폭증 프로브
- **Symbol**: (런타임 검증)
- **CodeGraph**: getStats=queries.ts:1682, getOutgoingEdges provenance 필터=queries.ts:1276(기존 지원)
- **File**: (검증 전용)
- **Scope**: 재인덱싱 전/후 node·edge count + provenance 분포
- **BLK target**: [인프라]
- **Action**: ① `count(*) from nodes` 전후 동일 ② provenance 분포에 inferred 출현·heuristic 불변 ③ 기존 trace 1건이 동일 경로 유지(라벨만 추가)
- **Success criterion**: 노드 폭증 0, 회귀 0.

### Step 9 — 테스트
- **Symbol**: `__tests__/docs-search.test.ts` · 엣지 provenance 테스트
- **CodeGraph**: 기존 docs-search.test.ts(`describe.skipIf(!isVecAvailable())`), 합성벡터 패턴 존재
- **File**: `__tests__/docs-search.test.ts` (+ 필요 시 resolution provenance 테스트 파일)
- **Scope**: HR7 임계 케이스 + CRG1 inferred 태깅 케이스
- **BLK target**: [인프라]
- **Action**: insert — ① 먼 합성벡터(거리>임계) → hits 0 ② 가까운 → hit 유지 ③ resolution 엣지 provenance==='inferred', synthesized==='heuristic' 단언. installer/tool-gating 테스트 무변경 확인.
- **Success criterion**: 신규 테스트 통과 + 기존 스위트 green(opt-in OFF byte-무회귀 포함).

### Step 10 — CHANGELOG + 빌드
- **Symbol**: (릴리스 문서)
- **CodeGraph**: —
- **File**: `CHANGELOG.md`
- **Scope**: `## [Unreleased]` 하위 `### New Features` / `### Fixes`
- **BLK target**: [인프라]
- **Action**: insert — 사용자향 1문장씩: (HR7) "관련 없는 질의에 엉뚱한 문서를 더는 반환하지 않습니다", (CRG1) "그래프 엣지가 직접/추론/휴리스틱 신뢰도로 구분되어 trace 출력에 표시됩니다", (CRG3) "`CODEGRAPH_MCP_TOOLS`로 노출 도구를 제한해 턴당 토큰을 줄일 수 있습니다". 내부 경로·심볼·수치 금지.
- **Success criterion**: `npm run build` green, CHANGELOG 규칙 준수([Unreleased]에만, 링크참조 수동추가 금지).

---

## 4. 순서·의존성

- 독립 3트랙: **CRG3(Step1)** ∥ **HR7(2→3→4)** ∥ **CRG1(5→6→7→8)**. Step 9(테스트)·10(CHANGELOG)은 합류.
- 권장 착수: CRG3 문서(즉시) → HR7(가장 명확한 단일 함수) → CRG1(union→tag→render→probe).
- 각 트랙 EXECUTE 진입 전 RULE-5: BLK 좌표 `Read(offset+limit)` 최소 로드, 파일 전체 Read 금지.

## 5. 리스크

- HR7 임계 과도 → 정당한 매치 누락. 완화: Step 4 실측 후 확정, 보수적 1.18(cos≈0.3)에서 시작.
- CRG1 synthEdgeNote 완화가 기존 'heuristic' 출력 회귀 유발. 완화: heuristic 분기 먼저 그대로 두고 inferred/direct 분기만 추가.
- resolution createEdges가 여러 종류 엣지를 만들면 일괄 'inferred'가 과도할 수 있음 → Step 6에서 createEdges 실체 확인 후 import/name 산물만 한정.

## 6. 미결
- Step 4에서 vec0 L2 기본 메트릭 가정 검증(아니면 임계 환산 재계산).
- `/memory:save` 권장 — 컴팩션 대비.
