# RX_1 검증 보고서 (재검증)

**프로젝트**: RX_1
**검증 일자**: 2026-06-11 (재검증)
**검증자**: Claude Code
**CodeGraph 백엔드**: node:sqlite (Node built-in) — WAL + FTS5
**DB 재인덱싱 시각**: 2026-06-11 10:14:26 (codegraph.db)
**Git 커밋 해시**: bd0662e54cbb1ab4c4219ddfa470e82c7d651faf (현재 HEAD)
**이전 검증 기준**: 170f77b (concept 노드 미생성 상태)

---

## 1. 개요

이 보고서는 CodeGraph Markdown-AST 통합 기능의 RX_1 실데이터 **재검증** 결과입니다.
이전 검증(170f77b) 이후 `5160475 코드그래프 daemon` 커밋과 DB 재인덱싱(06-11 10:14)을 거쳐
**Concept 노드 생성 기능이 활성화된 상태**에서 테스트 1~5를 다시 실행했습니다.

---

## 2. 테스트 결과 요약

| 테스트 케이스 | 이전(170f77b) | **현재(bd0662e)** | 변화 |
|-------------|-------------|------------------|------|
| 1. BLK Concept 노드 인덱싱 | ❌ 실패 | **✅ 성공** | concept 노드 29개 생성·검색됨 |
| 2. 코드 → BLK governs 관계 생성 | ❌ 실패 | **❌ 실패** | governs edge DB에 0개 (원인 변화) |
| 3. codegraph_impact governs 추적 | ❌ 실패 | **❌ 실패** | governs 부재 → concept 미포함 |
| 4. codegraph_backlinks 재귀 탐색 | ⚠️ 부분 | **✅ 성공** | backlink 존재 + depth 재귀 작동 |
| 5. concept 노드 검색 랭킹 | ❌ 실패 | **✅ 성공** | BLK 검색 시 concept 상위 반환 |

**전체 결과**: [ ] 🟢 모든 테스트 성공 [x] 🟡 일부 성공 (3/5) [ ] 🔴 실패
**이전 대비**: 1부분 4실패 → **3성공 2실패** (유의미한 진전)

---

## 3. 상세 테스트 결과

### 테스트 1: BLK Concept 노드 인덱싱 — ✅ 성공

**증거 (codegraph_status)**:
```
Files indexed: 51
Total nodes:   1,331   (이전 1,302)
Total edges:   2,556   (이전 2,564)
Database size: 4.82 MB
Docs indexed:  80 markdown
Nodes by kind: concept 29  ← 이전 0개에서 신규 생성
```

- [x] `codegraph_search "BLK-001"` → **8건, kind=concept** (이전: 0건)
- [x] concept 노드에 정상 `file_path` 연결 (예: `manage/dictionary.md:173`, `manage/modular-architecture.md:103`)
- [x] dictionary.md의 BLK 태그가 concept 노드로 추출됨

**판정**: 이전 보고서의 근본 원인이었던 **"Concept 노드 미생성"이 해소**됨. Markdown BLK 태그 파싱 로직이 동작.

---

### 테스트 2: 코드 → BLK governs 관계 생성 — ❌ 실패

**증거 (DB 직접 조회 — edges 테이블)**:
```
EDGE KIND 분포:
  contains      1251
  calls          670
  references     367
  imports        137
  instantiates   127
  implements       4
  → governs: 0개 (존재하지 않음)
```

**concept 노드 연결 edge 조회 결과**: source 또는 target이 concept인 edge = **0개**
→ concept 노드 29개 전부 **완전히 고립(isolated)** 상태.

**대조 (literal 검색)**: C# 코드에는 `// [BLK-XXX]` 인라인 마커가
**82개 occurrence / 41개 파일**에 실재함
(예: `SolveUseCase.cs:1 // [BLK-001]`, `CellRenderer.cs // [BLK-002]×5`, `CameraController.cs // [BLK-012]×7`).

**판정**: 마커는 풍부하게 존재하나, 코드 심볼 → concept 노드로의 `governs` edge가
**단 한 건도 생성되지 않음**. 실패 원인이 이전(concept 자체 부재)에서
**"concept은 있으나 코드-개념 연결 미구현"**으로 이동.

---

### 테스트 3: codegraph_impact governs 추적 — ❌ 실패

**증거**: `codegraph_impact "TurnAwareAStar"` (depth=2) → **22개 심볼, 전부 C# 심볼**
```
TurnAwareAStar.cs: TurnAwareAStar, Solve, EnumeratePaths, DfsFrame,
                   TransitionCost, TryGetGoalExit, Heuristic, BuildFoundPath ...
SolveUseCase.cs:   SolveUseCase, astar
→ BLK-001 concept 노드: 미포함
```

**판정**: `governs` edge 자체가 DB에 없으므로 impact가 개념 노드로 전파될 경로가 없음.
테스트 2 실패의 직접적 귀결.

---

### 테스트 4: codegraph_backlinks 재귀 탐색 — ✅ 성공

**증거**:
```
depth=1  manage/dictionary.md
  Forward: Registry.md, Management.md, modular-architecture.md
  Backlinks: Management.md, Registry.md, modular-architecture.md   (이전: 0개)

depth=3  manage/dictionary.md
  Forward: + Block.md, Function_Block_Archive.md  (재귀 1단계 더 확장됨)
  Backlinks: 동일 3건
```

- [x] depth 파라미터가 탐색 깊이를 실제로 변화시킴 (depth=3에서 forward link 2건 추가)
- [x] 순환 참조가 무한 루프 없이 처리됨
- [x] 백링크가 0개 → 3개로 개선 (Markdown 상호 참조가 정상 인덱싱됨)

**판정**: Zettelkasten 백링크 기능이 정상 작동. 이전 "부분 성공"에서 "성공"으로 승격.

---

### 테스트 5: concept 노드 검색 랭킹 — ✅ 성공

**증거**:
- [x] `codegraph_search "BLK-001"` → 8건 전부 kind=concept
- [x] `codegraph_search "BLK"` → 10건 (BLK-001/002/003 concept 노드 혼합 반환)
- [x] C# 심볼 검색 회귀 없음 (`TurnAwareAStar` 정상)

**판정**: concept 노드가 검색 인덱스(FTS5)에 정상 진입, 키워드로 상위 노출됨.

---

## 4. "진짜 Tree-sitter Markdown 전환" 여부 판단

| 항목 | 이전 상태 | **현재 상태** | 필요성 |
|-----|---------|-------------|-------|
| BLK 태그 추출 (concept 생성) | 미구현 | **✅ 구현됨 (29개)** | 완료 |
| 코드→concept governs edge | 미구현 | **❌ 여전히 미구현** | [x] **필요 (최우선)** |
| Markdown 구조 분석 | 미구현 | 미구현 | ⚠️ 보류 |
| Zettelkasten 백링크 | regex 기반 | **✅ 정상 작동** | 불필요 |
| frontmatter 파싱 | 미구현 | 미구현 | 보류 |

**Tree-sitter Markdown 전환**: [ ] 즉시 진행 [ ] 다음 단계로 미룸 [x] **불필요**

**근거**:
- concept 추출이 regex 기반으로 **이미 성공**했으므로 Tree-sitter 도입 동기 소멸.
- 다음 병목은 파싱이 아니라 **코드 인라인 마커 → concept governs edge 연결 로직**이며,
  이는 Markdown AST와 무관한 C# 주석 해석·노드 매핑 문제.
- 따라서 우선순위: **인라인 마커 → governs edge 생성 구현** ≫ Tree-sitter.

---

## 5. 성능 측정

| 측정 항목 | 결과 | 비고 |
|---------|------|------|
| 인덱스 노드 수 | 1,331 | concept 29 포함 |
| 인덱스 엣지 수 | 2,556 | governs 0 |
| 인덱스 크기 | 4.82 MB | SQLite (이전 4.67 MB) |
| Markdown 문서 | 80개 | 인덱싱 정상 |
| codegraph_search 응답 | 체감 <100ms | FTS5 |
| codegraph_impact 응답 | 체감 <100ms | depth=2 기준 |
| codegraph_backlinks 응답 | 체감 <100ms | depth=3 기준 |

---

## 6. 발견된 버그/이슈

1. **[CRITICAL] 코드→concept `governs` edge 미생성**
   - 설명: C# 코드의 `// [BLK-XXX]` 인라인 마커(82개/41파일)가 concept 노드와 연결되지 않음
   - 증거: edges 테이블에 `governs` kind 0건, concept 연결 edge 0건
   - 영향: 테스트 2·3 실패의 직접 원인, concept 노드가 그래프상 고립
   - 심각도: [x] 치명적

2. **[MAJOR] 동일 BLK ID의 concept 노드 중복(분산)**
   - 설명: `BLK-001`이 8개 노드로 중복 생성됨 (dictionary.md, modular-architecture.md,
     plans/*, verification/*, .trae/skills/* 등 BLK 텍스트가 등장하는 모든 .md에서 각각 추출)
   - 영향: "정본(canonical) BLK-001"이 모호 → 향후 governs 연결 시 어느 노드를
     타깃으로 할지 결정 필요 (dedup 또는 우선순위 규칙)
   - 심각도: [x] 주요

3. **[MINOR] concept 추출 대상에 메모리뱅크·검증 문서 포함**
   - 설명: 검증 보고서 자신(RX_1_VERIFICATION_REPORT.md)·세션 로그의 BLK 텍스트까지
     concept으로 인덱싱되어 노이즈 발생
   - 제안: concept 추출 화이트리스트를 `manage/` 등 정본 디렉토리로 제한 고려
   - 심각도: [x] 경미

---

## 7. 제안 사항

### 긴급 (최우선)
1. **인라인 마커 → governs edge 생성 구현**
   - C# 주석 `// [BLK-XXX]` 및 `// [BLK-XXX][n][m]` 패턴 감지
   - 해당 코드 노드(파일/심볼) → 정본 concept 노드로 `governs` edge 삽입
   - 마커가 파일 헤더(line 1)면 file 노드, 메서드 내부면 해당 메서드 노드로 매핑

2. **BLK concept 노드 dedup / 정본 결정**
   - `manage/dictionary.md`를 정본 소스로 지정, 동일 ID 중복 노드 병합 또는 우선순위 부여

### 중단기
3. **concept 추출 범위 제한** — 노이즈 .md 제외 (메모리뱅크·검증문서)
4. **회귀 검증** — governs 구현 후 테스트 2·3 재실행, impact가 concept 도달하는지 확인

---

## 8. 결론

### 검증 결과 요약 — **3성공 / 2실패** (이전 1부분 4실패에서 개선)

✅ **이번에 성공한 것 (진전)**:
- **Concept 노드 생성 기능 활성화** — BLK 태그 → concept 29개 (이전 0개)
- BLK 키워드 검색 정상 (FTS5 진입)
- Markdown 백링크 재귀 탐색 정상 (depth 1/3, backlink 존재)
- C# 코드베이스 인덱싱 회귀 없음 (1,331 노드)

❌ **여전히 실패한 것 (근본 원인: governs edge 미생성)**:
- 코드 인라인 마커(82개) ↔ concept 노드 연결 부재
- impact 분석이 코드↔개념을 추적 불가
- concept 노드 29개 전부 그래프상 고립

### 근본 원인 변화

| 구분 | 이전(170f77b) | 현재(bd0662e) |
|-----|-------------|-------------|
| 병목 | Markdown 파싱 자체 미구현 → concept 0개 | concept은 생성, **코드-개념 governs 연결 미구현** |
| 다음 작업 | BLK 태그 파서 구현 | **인라인 마커 → governs edge 생성** |

### 다음 단계
1. `governs` edge 생성 로직 구현 (C# 마커 → 정본 concept)
2. BLK concept dedup / 정본 규칙 수립
3. 구현 후 `codegraph index -f` 재인덱싱 → 테스트 2·3 회귀 검증

---

**검증자**: Claude Code
**검증 일자**: 2026-06-11 (재검증)
**Git 커밋**: bd0662e (현재 HEAD)
**핵심 결론**: Markdown→concept 파싱 ✅ 해결 / 코드→concept **governs 연결 ❌ 미구현 (다음 최우선 과제)**
