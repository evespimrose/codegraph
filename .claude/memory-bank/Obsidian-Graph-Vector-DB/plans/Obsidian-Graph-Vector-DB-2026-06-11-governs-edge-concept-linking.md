<!-- PLAN -->
<!-- BLK: BLK-GOVERNS-LINK -->
<!-- CAVE-MAN-REMINDER: codegraph_context → search → node → (보완)Read. 소스 직독 금지. -->

# PLAN — code `// [BLK-XXX]` → `governs` edge → canonical `concept` 노드 연결

**브랜치**: Obsidian-Graph-Vector-DB
**작성일**: 2026-06-11
**근거 문서**: `D:\Fork\RX_1\.claude\memory-bank\main\verification - RX_1\RX_1_VERIFICATION_REPORT.md` (CodeGraph 0476a03 기준 실증)
**RIPER**: PLAN (구현 금지 — 본 문서는 명세만)

---

## 1. 문제 정의 (Root Cause — 보고서 교정판)

검증보고서는 governs 실패를 "코드-개념 연결 **미구현**"으로 진단했으나, 코드 분석 결과 **추출·타입·이름매칭은 이미 구현**되어 있고 **두 파이프라인의 실행 순서(phase ordering)** 때문에 100% 실패한다. 즉 "미구현"이 아니라 **"구현됐으나 순서로 무력화 + 연결 패스 1개 누락"**.

### 1.1 실패 체인 (증거)

| 단계 | 위치 | 동작 | 결함 |
|---|---|---|---|
| ① 마커 추출 | `src/extraction/tree-sitter.ts:505` `extractBlkReferences` | `// [BLK-001]` → `UnresolvedReference{referenceKind:'governs', referenceName:'BLK-001', fromNodeId:코드심볼}` 푸시 | 호출처가 `extractFunction(621)`·`extractMethod(746)` **뿐** → 파일헤더·클래스 레벨 마커 미추출 |
| ② 코드 해소 | `src/index.ts:375` `resolveReferencesBatched` | governs ref를 이름으로 매칭 시도 | 이 시점 `BLK-001` concept 노드 **미존재** |
| ③ 사전필터 | `src/resolution/index.ts:592` `hasAnyPossibleMatch` | `knownNames`(warmCaches 스냅샷)에 'BLK-001' 없음 → `resolveOne` null | concept 미생성이라 영구 실패 |
| ④ 미해소 폐기 | `src/resolution/index.ts:758-766` `resolveAndPersistBatched` | 미해소 ref **DB 삭제** | governs ref가 edge도 못 되고 흔적 없이 증발 |
| ⑤ concept 생성 | `src/index.ts:405` → `src/docs/indexer.ts:94-98,152-155` | concept 노드 SQL INSERT | **해소 종료 후** 생성 → ②③④ 이미 실패 |

`src/index.ts:399-401` 주석이 버그를 자백: *"index .md ... **AFTER** code indexing + resolution, so a doc's code_refs/BLK resolve against real nodes."* — 이 순서는 **doc→code(`code_refs`, 쿼리시점 텍스트조회 `tools.ts:1372`)** 엔 무해하지만 **code→concept(`governs`, 그래프 엣지)** 엔 정확히 역방향.

### 1.2 데이터 모델은 정상 (수술 불필요 확인)

- `governs` ∈ EdgeKind (`src/types.ts:62`)
- `concept` ∈ NodeKind (`src/types.ts:41`), 마이그레이션 허용 확인 (`src/db/migrations.ts:101`)
- `matchByExactName`(`src/resolution/name-matcher.ts:68`)은 kind 필터 없음 → concept 노드도 매칭 가능 (단 cross-language 페널티 0.5)
- 따라서 **Tree-sitter Markdown 전환 불필요** (보고서 결론 동의). 병목은 파싱이 아니라 **오케스트레이션**.

### 1.3 부수 결함

- **중복(MAJOR)**: concept 노드 id = `sha1(rel::tag)` (`indexer.ts:153`) → 동일 BLK-001이 등장 .md마다 별도 노드(보고서 8개). 정본(canonical) 부재 → governs 타깃 모호.
- **노이즈(MINOR)**: `listMarkdownFiles`(`src/docs/scan-files.ts:19`)가 memory-bank·검증문서까지 스캔 → concept 노드 오염.
- **증분 누락**: `indexMarkdown` 단일 호출처(`index.ts:405`). `CodeGraph.indexFiles`(`index.ts:432`, watch/sync)는 docs 미갱신 → 수정 후 sync해도 governs 재생성 안 됨.
- **임팩트 미전파**: `GraphTraverser` callers/callees가 `['calls','references','imports']`로 필터(`src/graph/traversal.ts:251,296`) → governs 엣지가 있어도 impact가 안 따라갈 수 있음 (검증보고서 테스트 3). impact edgeKinds에 governs 포함 여부 확인·확장 필요.

---

## 2. 목표 / 성공 기준

### 2.1 Goal
`index -f --with-docs` 1회로 C# `// [BLK-XXX]` 마커가 **정본 concept 노드**로 향하는 `governs` 엣지를 생성하고, `codegraph_impact`가 코드심볼→concept를 전파한다. 보고서 **테스트 2·3을 PASS**로 전환.

### 2.2 Success Criteria (관찰 가능)
1. `index -f --with-docs` 후 `SELECT count(*) FROM edges WHERE kind='governs'` **> 0** (RX_1: 마커 82개 중 함수/메서드 내부분 ≥ 대다수).
2. concept↔edge 연결: `source 또는 target이 concept인 edge > 0` (보고서 0 → 양수).
3. `codegraph_impact "TurnAwareAStar"` 결과에 **BLK-001 concept 노드 포함** (보고서 테스트 3).
4. 동일 BLK id는 **정본 concept 노드 1개**로 수렴(governs 타깃 기준), 중복 mention 노드는 타깃 제외.
5. **회귀 없음**: docs-off(`--with-docs` 미사용) 시 동작·노드/엣지 수 불변; 기존 calls/imports/extends 해소 결과 불변; node 수 안정(governs 엣지만 증가).
6. `npm test` 그린 + 신규 테스트 통과.

### 2.3 Non-Goals (이번 범위 제외)
- ❌ Tree-sitter Markdown 파서 전환 (regex 추출 유지).
- ❌ frontmatter 전체 파싱 확장(`code_refs` 외).
- ❌ concept 노드의 의미적 임베딩 랭킹 개선(테스트 5 이미 PASS).
- ❌ C# 외 언어의 BLK 마커 컨벤션 신설(추출 정규식은 언어무관이라 자동 수혜되나 별도 검증 대상 아님).
- ⏸ 증분/watch 경로 완전 지원은 **Phase 3**(이번 PASS 기준은 `index -f`).

---

## 3. 설계 결정 (채택안)

- **연결 방식 = Option Y (전용 linker)**: 파이프라인 순서 유지. 일반 resolver는 governs를 **건너뛰고 보존**, `indexMarkdown` **후** 전용 `linkGovernsEdges`가 tag→정본 concept를 **결정적**으로 매칭해 엣지 삽입. (Option X=indexMarkdown 선행은 embedding-gated async를 해소경로에 결합시키고 docs-off 시 여전히 실패 → 기각.)
- **정본+노이즈 동시 해소 = 발생원 차단**: concept 노드 생성을 **governed/canonical 문서로 제한**(`indexer.ts` blkTags 루프 게이트). mdast_metadata·벡터는 전 문서 유지(검색 무영향). → BLK-001이 정본 문서에서만 노드화 → 중복·노이즈 동시 감소. linker의 canonical 선출은 안전망.
- **엣지 방향 = concept → code (`governs`)**: 타입 주석 의미("doc governs a symbol")에 맞춰 linker가 `source=concept, target=코드심볼`로 저장(추출이 만든 code→concept를 linker에서 뒤집음). impact가 양방향 전파하도록 traversal edgeKinds에 governs 포함.
- **provenance**: linker 생성 엣지는 `provenance:'heuristic'`, `metadata.synthesizedBy:'governs-linker'`, `registeredAt` — 기존 synthesized-edge 규약(CLAUDE.md) 준수.
- **canonical 선출 규칙**(결정적): tag별 concept 후보 중 (i) governed/canonical 디렉토리 소속 우선 → (ii) 경로 최단/사전순 → (iii) 라인 최소. 동률은 안정정렬.

> **사용자 결정 필요(1건)**: 정본 디렉토리 집합. 현재 `GOVERNED_DIRS=['cxt/','docs/contextmd/']`(`indexer.ts:37`). RX_1 정본은 `manage/dictionary.md`. → 정본 집합을 **프로젝트 설정(project_metadata)** 으로 빼고 기본값에 `manage/` 추가할지, 하드코딩 확장할지 EXECUTE 진입 전 확정.

---

## 4. 구현 단계 (Numbered Steps — Scope Lock)

> 각 스텝 EXECUTE 시 `Read(offset+limit)` 또는 codegraph_node로 **해당 좌표만** 로드. 파일 전체 Read 금지.

### Phase 1 — 핵심(테스트 2·3 PASS)

**STEP 1 — governs ref 보존(일반 resolver에서 제외)**
- **Symbol**: `ReferenceResolver.resolveOne`, `resolveAndPersistBatched`
- **CodeGraph**: `resolveOne` `src/resolution/index.ts:579`; 미해소 삭제 블록 `:758-766`
- **File**: `src/resolution/index.ts`
- **Scope**: `resolveOne` 진입부(≈580) + 삭제 루프(758-766)
- **BLK target**: [인프라]
- **Action**: insert — `resolveOne` 최상단에 `if (ref.referenceKind === 'governs') return null;`(명시적 skip); `resolveAndPersistBatched`의 unresolved 삭제 시 `referenceKind !== 'governs'` 인 것만 삭제(governs는 unresolved_refs에 보존).
- **Success criterion**: index 후 `SELECT count(*) FROM unresolved_refs WHERE reference_kind='governs'` = 추출된 governs 마커 수(삭제 안 됨).

**STEP 2 — concept 노드 생성을 정본 문서로 제한(중복·노이즈 발생원 차단)**
- **Symbol**: `indexMarkdown`(blkTags→concept 루프), `GOVERNED_DIRS`
- **CodeGraph**: 루프 `src/docs/indexer.ts:152-155`; `GOVERNED_DIRS` `:37`; 게이트 참고 `:121`
- **File**: `src/docs/indexer.ts`
- **Scope**: `:152-155` 루프에 가드 추가, `:37` 정본 집합 정의
- **BLK target**: [인프라]
- **Action**: insert — blkTags→concept INSERT 루프를 `isCanonicalDoc(rel)` 가드로 감쌈. mdast_metadata/벡터 upsert(`:137-149`)는 **전 문서 유지**. `isCanonicalDoc`=정본 디렉토리 prefix 매칭(§3 사용자 결정 반영).
- **Success criterion**: 동일 BLK-001 concept 노드 수가 8 → 1(정본 문서 1곳)으로 감소; memory-bank/검증문서發 concept 0.

**STEP 3 — `linkGovernsEdges` linker + 보조 쿼리 구현**
- **Symbol**: (신규) `linkGovernsEdges(db, queries)`, (신규) `QueryBuilder.getUnresolvedReferencesByKind`, (신규) `deleteUnresolvedByKindAndName` (또는 기존 `deleteSpecificResolvedReferences` 재사용)
- **CodeGraph**: 기존 패턴 `getUnresolvedReferences` `src/db/queries.ts:1496`; `insertEdges` `:1242`; concept 조회 `getNodesByName`(context) / `QueryBuilder.getNodesByName`
- **File**: 신규 `src/docs/governs-linker.ts` (또는 `indexer.ts` 말미); 쿼리 추가 `src/db/queries.ts`
- **Scope**: 신규 파일 ~60줄 + queries.ts 신규 메서드 2개
- **BLK target**: [NEW-BLK] `src/docs/governs-linker.ts`
- **Action**: append/create — 로직: ①`getUnresolvedReferencesByKind('governs')` ②tag별 그룹화 ③각 tag의 concept 후보(`getNodesByName(tag)` 중 kind='concept') 중 **canonical 선출**(§3 규칙) ④각 ref에 대해 `insertEdges([{source:정본concept.id, target:ref.fromNodeId, kind:'governs', provenance:'heuristic', metadata:{synthesizedBy:'governs-linker', registeredAt:'src/index.ts:linkGovernsEdges', blk:tag, confidence:0.5}, line:ref.line, column:ref.column}])` ⑤소비한 governs ref 삭제. concept 후보 0이면 ref 보존(다음 인덱싱서 재시도).
- **Success criterion**: 단위테스트 — governs ref 1 + concept 1 → governs 엣지 1(concept→code) 생성; concept 0 → 엣지 0·ref 보존.

**STEP 4 — linker 파이프라인 배선(indexMarkdown 후)**
- **Symbol**: `CodeGraph.indexAll` 래퍼(docs 블록)
- **CodeGraph**: `src/index.ts:403-418`(indexMarkdown try 블록)
- **File**: `src/index.ts`
- **Scope**: `:417` 직후(indexMarkdown 성공 분기 내부)
- **BLK target**: [인프라]
- **Action**: insert — `if (docs.enabled)` 분기에서 `indexMarkdown` 성공 후 `linkGovernsEdges(this.db.getDb(), this.queries)` 호출(best-effort try/catch, 코드인덱스 실패 비유발). 결과(생성 엣지 수)를 `result.docs`에 선택적 노출.
- **Success criterion**: `index -f --with-docs` 후 `edges.kind='governs' > 0`(성공기준 2.2-①).

**STEP 5 — impact/traversal governs 전파 확인·확장**
- **Symbol**: `GraphTraverser.getCallersRecursive`/`getCalleesRecursive`, `getImpactRadius` 경로의 edgeKinds
- **CodeGraph**: 필터 `src/graph/traversal.ts:251,296`; impact 진입 `CodeGraph.getImpactRadius`(`src/index.ts:883` 부근), `getAdjacentEdges` `:204`
- **File**: `src/graph/traversal.ts` (필요 시 `src/graph/queries.ts`)
- **Scope**: impact가 사용하는 traversal 옵션의 edgeKinds 정의부
- **BLK target**: [인프라]
- **Action**: replace — impact 경로 edgeKinds에 `'governs'` 추가(또는 impact 전용 기본 edgeKinds에 포함). callers/callees(순수 호출그래프)는 governs 미포함 유지(혼선 방지) — impact만 포함.
- **Success criterion**: `codegraph_impact "TurnAwareAStar"`(depth 2) 결과에 BLK-001 concept 포함(성공기준 2.2-③).

**STEP 6 — 테스트(단위+통합+회귀)**
- **Symbol**: 신규 테스트
- **CodeGraph**: 기존 패턴 `__tests__/extraction.test.ts`, `frameworks-integration.test.ts`(회귀 앵커)
- **File**: 신규 `__tests__/governs-linking.test.ts`
- **Scope**: 신규 ~150줄, `fs.mkdtempSync` 임시 프로젝트(코드 1 + .md 1, BLK 마커)
- **BLK target**: [NEW-BLK] `__tests__/governs-linking.test.ts`
- **Action**: create — (a)linker 단위(STEP3 기준) (b)통합: 임시 프로젝트 index→governs 엣지 존재·방향(concept→code) (c)dedup: 동일 BLK 2 .md→정본1 (d)skip: docs-off→governs 0·refs 보존 안 함 검증 (e)회귀: governs 추가 외 노드/엣지 수 불변.
- **Success criterion**: `npx vitest run __tests__/governs-linking.test.ts` 그린 + `npm test` 그린.

### Phase 2 — 추출 커버리지(마커 누락 해소)

**STEP 7 — 파일헤더·클래스 레벨 BLK 마커 추출**
- **Symbol**: `TreeSitterExtractor.extractClass`, `extract`(file 노드)
- **CodeGraph**: `extractClass` `src/extraction/tree-sitter.ts:706`; file 노드 생성 `:200-217`; `extractBlkReferences` `:505`; 현 호출처 `extractFunction:621`·`extractMethod:746`
- **File**: `src/extraction/tree-sitter.ts`
- **Scope**: `extractClass` 본문 + `extract()` file-노드 직후 헤더 스캔
- **BLK target**: [인프라]
- **Action**: insert — `extractClass`에 `this.extractBlkReferences(node, classNodeId)` 추가; file-헤더 마커는 첫 top-level 선언 이전 영역만 스캔해 file 노드에 귀속(메서드 내부 중복귀속 방지 가드 포함).
- **Success criterion**: `SolveUseCase.cs:1 // [BLK-001]`(파일헤더)·클래스 레벨 마커가 governs ref로 추출됨(추출 단위테스트).

### Phase 3 — 증분/watch + 마감

**STEP 8 — 증분 경로 concept 갱신 + 재링크**
- **Symbol**: `CodeGraph.indexFiles`, watch/sync 경로
- **CodeGraph**: `src/index.ts:432`; `indexMarkdown` 단일호출처 `:405`; FileWatcher `src/sync/`
- **File**: `src/index.ts` (+ `src/sync/` 필요 시)
- **Scope**: `indexFiles` 해소 후 분기
- **BLK target**: [인프라]
- **Action**: insert — 변경분에 .md 포함 시 해당 문서 `indexMarkdown`(증분) 후 `linkGovernsEdges` 재실행; 코드파일만 변경 시 governs ref 재생성→relink. (범위 큰 경우 별도 PLAN 분기 가능 — 본 스텝은 설계·후크 지점 명세까지.)
- **Success criterion**: 코드/문서 수정 후 sync 1회로 governs 엣지 재구성(수동 `index -f` 불필요).

**STEP 9 — CHANGELOG + 문서**
- **File**: `CHANGELOG.md`([Unreleased]), 필요 시 `docs/design/`
- **Action**: append — New Features/Fixes에 사용자 친화 1문장(내부 경로·수치 금지, "Markdown BLK 태그로 코드↔설계개념 연결" 취지). server-instructions는 **도구 사용법 변화 없으면 미수정**.
- **Success criterion**: CHANGELOG 항목 1건, prepare-release 규약 준수.

**STEP 10 — RX_1 실증 재검증 + 컨트롤 회귀**
- **Action**: build(`npm run build`) → 전역 동기화(/sync-global-codegraph) → RX_1 `index -f --with-docs` 재인덱싱 → 보고서 테스트 2·3 재실행(governs>0, impact가 concept 도달) → 컨트롤 레포 1곳 회귀(calls/imports 불변, 노드수 안정).
- **Success criterion**: 보고서 3성공/2실패 → **5성공**; 컨트롤 회귀 없음. 결과를 `verification - RX_1` 보고서에 갱신.

---

## 5. 영향 범위 / 리스크

| 변경 | 영향 | 리스크 | 완화 |
|---|---|---|---|
| resolver governs skip (S1) | 일반 해소 경로 | calls/imports 회귀 | governs만 분기, 회귀 테스트(S6-e) |
| concept 생성 게이트 (S2) | 검색·backlink 노드 | 정본외 BLK 검색 누락 | mdast_metadata/벡터 전유지 → FTS·backlink 무영향 |
| traversal edgeKinds (S5) | impact 결과 | impact 노이즈 증가 | impact 한정, callers/callees 불변 |
| extract 확대 (S7) | 노드/ref 수 | governs ref 급증·중복귀속 | 헤더 영역 한정 가드 |

**롤백**: 각 스텝 독립 커밋. Phase 1만으로 테스트 2·3 PASS 달성 가능(Phase 2·3 미적용도 안전).

---

## 6. 게이트 (RULE-6: 중·대형)

- 멀티파일·신규시스템 → **quality-sentinel 필수**, **reporter 필수**.
- EXECUTE 진입 전: §3 사용자 결정(정본 디렉토리 집합) 확정.
- 코드 쓰기 전 사용자 승인(RULE-7).

---

## 7. 다음 액션
1. 본 PLAN 사용자 검토·승인.
2. §3 정본 디렉토리 결정.
3. 승인 시 `/riper:execute` → Phase 1(STEP 1-6)부터.
4. (요청대로) 작성 후 `/memory:save` — 모델 전환은 사용자 액션.
