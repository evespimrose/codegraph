# RX_1 검증 보고서

**프로젝트**: RX_1  
**검증 일자**: 2026-06-10  
**검증자**: Claude Code  
**CodeGraph 버전**: [버전 입력]  
**Git 커밋 해시**: 170f77b0aca09233de77afb490c7f9d2d505b267

---

## 1. 개요

이 보고서는 CodeGraph Markdown-AST 통합 기능의 RX_1 실데이터 검증 결과를 요약합니다.

---

## 2. 테스트 결과 요약

| 테스트 케이스 | 결과 | 비고 |
|-------------|------|------|
| 1. BLK Concept 노드 인덱싱 | [ ] 성공 [x] 실패 | Concept 노드 미생성 |
| 2. 코드 → BLK governs 관계 생성 | [ ] 성공 [x] 실패 | Concept 노드 부재로 인해 governs 관계 미생성 |
| 3. codegraph_impact governs 추적 | [ ] 성공 [x] 실패 | Impact 결과에 BLK concept 미포함 |
| 4. codegraph_backlinks 재귀 탐색 | [x] 성공 [ ] 실패 | depth 파라미터 정상 작동, 하지만 backlink 0개 |
| 5. concept 노드 검색 랭킹 | [ ] 성공 [x] 실패 | Concept 노드 미존재로 검색 불가 |

**전체 결과**: [ ] 🟢 모든 테스트 성공 [x] 🟡 일부 성공 [ ] 🔴 실패

---

## 3. 상세 테스트 결과

### 테스트 1: BLK Concept 노드 인덱싱

**목표 달성 여부**: ❌ 실패

**체크항목**:
- [x] concept 노드 검색 시도 → `codegraph_search "BLK-001"` **결과: 없음**
- [x] dictionary.md 인덱싱 확인 → **80개 markdown 인덱싱됨 (정상)**
- [x] BLK 주석이 C# 코드에 있는지 확인 → **있음** (예: `// [BLK-001]` in TurnAwareAStar.cs:21)

**현재 인덱싱 상태** (codegraph_status):
```
Files indexed: 51
Total nodes: 1,302
Total edges: 2,564
Docs indexed: 80 markdown
```

**발견된 문제**:
- ❌ Concept 노드가 생성되지 않음
- ❌ dictionary.md의 BLK 태그에서 concept 노드로 추출되는 로직이 작동하지 않음
- ❌ `codegraph index --with-docs`의 concept 노드 생성 기능이 미구현 또는 오작동

---

### 테스트 2: 코드 → BLK governs 관계 생성

**목표 달성 여부**: ❌ 실패

**검증 절차**:
- [x] `// [BLK-001]` 주석 존재 확인
  - 위치: Assets/Core/Scripts/Pathfinding/Domain/TurnAwareAStar.cs:21
  - 내용: `// [BLK-001][1][1]`
- [x] `codegraph_impact "TurnAwareAStar"` 실행
  - 결과: 영향 범위에 BLK concept 노드 **미포함**
  - 결과에 포함된 것: C# 심볼만 (SolveUseCase 등)

**발견된 문제**:
- ❌ BLK 주석이 있어도 governs edge가 생성되지 않음
- ❌ 테스트 1의 concept 노드 미생성이 원인
- ❌ 코드 주석 → concept 노드 매핑 로직이 작동하지 않음

---

### 테스트 3: codegraph_impact governs 추적

**목표 달성 여부**: ❌ 실패

**검증 절차**:
- [x] `codegraph_impact "TurnAwareAStar"` 실행 (depth=2)
  - 결과: 영향 범위에 **BLK concept 노드 미포함**
  - 반환된 심볼 (22개): TurnAwareAStar 내부 구조 + SolveUseCase만 포함

**예상 결과**:
- TurnAwareAStar의 변경이 BLK-001 concept에 영향
- BLK-001이 dictionary.md 파일 포함

**발견된 문제**:
- ❌ codegraph_impact가 governs 관계를 따라가지 않음
- ❌ BLK concept 노드 자체가 없어서 불가능
- ❌ governs edge 생성 실패의 직접적 영향

---

### 테스트 4: codegraph_backlinks 재귀 탐색

**목표 달성 여부**: ⚠️ 부분 성공

**검증 절차**:
- [x] `codegraph_backlinks "manage/dictionary.md"` (depth=1) 실행
  - **Forward Links**: Registry.md, Management.md, modular-architecture.md (정상)
  - **Backlinks**: 0개 (아무도 dictionary.md를 참조하지 않음)

- [x] depth 파라미터 정상 작동 확인
  - depth 1, 3 모두 처리 가능
  - 순환 참조 처리 정상

**발견된 문제**:
- ⚠️ dictionary.md를 참조하는 문서가 없음
- ⚠️ BLK 개념 노드가 생성되어 dictionary.md와 C# 코드를 연결하지 못함
- ✅ depth 파라미터와 백링크 기능 자체는 정상 작동

---

### 테스트 5: concept 노드 검색 랭킹

**목표 달성 여부**: ❌ 실패

**검증 절차**:
- [x] `codegraph_search "BLK-001"` 실행
  - 결과: **0 results found** — concept 노드 미존재
  
- [x] `codegraph_search "BLK"` 실행
  - 결과: **0 results found** (concept 노드 미존재)
  
- [x] C# 심볼 검색은 정상
  - `codegraph_search "TurnAwareAStar"` → 10개 결과 (정상)
  - `codegraph_search "dictionary"` → 2개 C# 필드만 반환 (정상)

**발견된 문제**:
- ❌ Concept 노드 미생성으로 인해 검색 불가
- ❌ kindBonus 적용 확인 불가 (concept 노드가 없음)
- ✅ C# 심볼 검색과 Markdown 문서 인덱싱은 정상

---

## 4. "진짜 Tree-sitter Markdown 전환" 여부 판단

### 현재 구현 상태 평가

| 항목 | 현재 상태 | 필요성 |
|-----|---------|-------|
| BLK 태그 추출 | **미구현** (concept 노드 생성 안 됨) | [x] **필요** |
| Markdown 구조 분석 | 미구현 | ⚠️ 보류 |
| Zettelkasten 링크 추적 | regex 기반 (백링크 기능 정상) | 불필요 |
| frontmatter 파싱 | 미구현 | 보류 |

### 검증을 통한 발견

1. **Markdown 인덱싱은 정상**: 80개 파일 감지됨
2. **BLK 태그 파싱은 미구현**: 
   - dictionary.md의 `BLK-001` 같은 태그가 concept 노드로 변환되지 않음
   - Regex로는 충분하지만, 현재 코드에 로직이 없음
3. **Backlinks는 정상**: `codegraph_backlinks`가 Markdown 링크를 추적함

### 최종 판단

**Tree-sitter Markdown 전환**: [ ] 즉시 진행 [ ] 다음 단계로 미룸 [x] 불필요

**근거**:
- **Regex로 충분함**: BLK 태그 `<!-- BLK: BLK-XXX -->` 패턴은 regex로 쉽게 추출 가능
- **Tree-sitter 필요 없음**: 향후 복잡한 AST 분석이 필요할 때까지 미룰 수 있음
- **우선순위**: BLK 태그 파싱 로직 구현 → concept 노드 생성 → (나중에) Tree-sitter 검토

---

## 5. 성능 측정

| 측정 항목 | 결과 | 비고 |
|---------|------|------|
| 전체 인덱싱 시간 | ~5초 | 51개 파일, 80개 Markdown |
| 메모리 사용량 | ~50MB | 추정 (명시적 측정 생략) |
| 인덱스 크기 | 4.67 MB | SQLite DB |
| codegraph_search 응답시간 | <100ms | C# 심볼 검색 기준 |
| codegraph_impact 응답시간 | <50ms | TurnAwareAStar 기준 |
| codegraph_backlinks 응답시간 | <50ms | dictionary.md 기준 | |

---

## 6. 발견된 버그/이슈

1. **[CRITICAL] Concept 노드 미생성**:  
   - 설명: `codegraph index --with-docs` 실행 후에도 BLK concept 노드가 생성되지 않음
   - 재현 방법: `codegraph_search "BLK-001"` 실행 → 검색 결과 없음
   - 영향 범위: 테스트 1, 2, 3, 5 모두 실패의 근본 원인
   - 심각도: [x] 치명적 [ ] 주요 [ ] 경미 [ ] 기능개선

2. **[CRITICAL] Governs 관계 미생성**:  
   - 설명: C# 코드의 `// [BLK-XXX]` 주석이 concept 노드와 연결되지 않음
   - 원인: Concept 노드 미생성으로 인해 불가능
   - 재현 방법: `codegraph_impact "TurnAwareAStar"` 실행 → BLK concept 미포함
   - 심각도: [x] 치명적 [ ] 주요 [ ] 경미 [ ] 기능개선

3. **[MAJOR] Markdown-AST 통합 로직 미구현**:  
   - 설명: dictionary.md의 BLK 태그에서 concept 노드를 추출하는 로직이 작동하지 않음
   - 영향: Markdown 파일(80개)은 인덱싱되었으나, 문서 구조 분석과 concept 추출이 미구현
   - 심각도: [ ] 치명적 [x] 주요 [ ] 경미 [ ] 기능개선

---

## 7. 제안 사항

### 긴급 (즉시 조치 필요)
1. **Concept 노드 생성 로직 구현**
   - `src/mcp/tools.ts`에서 `codegraph_node` 시 concept 노드 반환 확인
   - `src/graph/traversal.ts`에서 dictionary.md의 BLK 태그 파싱 로직 추가
   - Regex 기반으로 `<!-- BLK: BLK-XXX -->` 패턴 감지 및 노드 생성

2. **Governs 관계 생성 로직 구현**
   - C# 코드의 `// [BLK-XXX]` 주석 감지
   - 해당 concept 노드와 governs edge 생성
   - `src/graph/edges.ts`에 해당 로직 추가

### 중단기 (테스트 후 진행)
3. **Tree-sitter Markdown 전환 검토**
   - 현재 regex 기반으로 충분한지 판단
   - 향후 복잡한 Markdown 구조 분석 필요시 고려

4. **성능 및 안정성 테스트**
   - 실제 RX_1 데이터로 재검증
   - 대규모 프로젝트에서의 성능 측정

---

## 8. 결론

### 검증 결과 요약

**전체 테스트: 5개 중 4개 실패, 1개 부분 성공**

✅ **성공한 것**:
- RX_1 C# 코드베이스 정상 인덱싱 (1,302 노드, 2,564 엣지)
- Markdown 파일 인덱싱 (80개 문서)
- 코드에 BLK 주석 올바르게 삽입됨 (`// [BLK-001]` 등)
- dictionary.md 구조 정상
- CodeGraph 기본 기능 정상 (검색, impact, backlinks)

❌ **실패한 것 (근본 원인: Concept 노드 미생성)**:
1. Concept 노드 추출 기능 미구현
2. Governs 관계 생성 실패
3. Impact 분석에서 markdown 링크 추적 불가
4. BLK 검색 불가능

### 기술적 원인

`codegraph index --with-docs` 실행 시:
- ✅ Markdown 파일 인덱싱은 정상 (80개 문서 감지)
- ❌ dictionary.md의 BLK 태그에서 concept 노드 추출 로직이 작동 안 함
- ❌ C# 코드 주석의 BLK 참조 해석 로직이 구현되지 않음

### 다음 단계

1. **CodeGraph의 Markdown-AST 통합 기능 검토**
   - 파일: `src/mcp/tools.ts`, `src/search/query-utils.ts`
   - 확인 사항: BLK 태그 파싱, concept 노드 생성 로직
   
2. **Concept 노드 생성 로직 구현/디버깅**
   - `codegraph index --with-docs` 플래그의 실제 작동 확인
   - Markdown 파서가 BLK 태그를 감지하는지 확인

3. **다시 검증**
   - 수정 후 `codegraph index -f` 재실행
   - 테스트 1~5 재수행

---

**검증자**: Claude Code  
**검증 일자**: 2026-06-11  
**CodeGraph 버전**: [검증 불가 - 도구 미구현]  
**Git 커밋**: 170f77b (현재)
