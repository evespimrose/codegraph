# RX_1 테스트 절차 및 성공 기준

## 📌 개요

이 문서는 CodeGraph Markdown-AST 통합 기능의 RX_1 실데이터 검증을 위한 상세 테스트 절차와 성공 기준을 정의합니다.

---

## 🔬 테스트 환경

### 사전 준비:
- [ ] CodeGraph 최신 버전 빌드 완료
- [ ] RX_1 프로젝트 클론
- [ ] dictionary.md 파일 존재 확인
- [ ] Node.js 18+ 환경 구성
- [ ] CODEGRAPH_DOCS=1 환경 변수 설정

---

## 🧪 테스트 케이스

### 테스트 1: BLK Concept 노드 인덱싱

**목표**: dictionary.md의 BLK 태그가 concept 노드로 정상 인덱싱되는지 확인

**절차**:
1. RX_1 프로젝트 루트에서 `codegraph index --with-docs` 실행
2. 인덱싱 완료 후 `codegraph status`로 노드 수 확인
3. MCP 클라이언트에서 `codegraph_node "BLK-001"` 실행

**성공 기준**:
- [ ] `nodes 테이블에 `kind='concept' 인 레코드가 존재함
- [ ] `codegraph_node` 결과에 BLK-001 concept 노드가 상위에 표시됨
- [ ] concept 노드의 metadata에 올바른 file_path가 연결됨

---

### 테스트 2: 코드 → BLK governs 관계 생성

**목표**: C# 코드 내의 `// [BLK-XXX]` 주석이 governs 관계로 정상 해석되는지 확인

**절차**:
1. 특정 C# 파일(예: `TurnAwareAStarPart.cs)에서 `// [BLK-001]` 주석 확인
2. `codegraph index` 실행
3. `codegraph_node "TurnAwareAStarPart"` 실행
4. edges 테이블에서 `kind='governs'` 레코드 확인

**성공 기준**:
- [ ] 해당 C# 노드 → BLK concept 노드로의 `governs` edge가 존재함
- [ ] `codegraph_node` 결과에서 governs 관계가 표시됨
- [ ] resolution이 정상적으로 완료됨

---

### 테스트 3: codegraph_impact governs 추적

**목표**: 코드 심볼의 impact 분석시 concept 노드가 포함되는지 확인

**절차**:
1. `codegraph_impact "TurnAwareAStarPart"` 실행
2. 결과에 BLK concept 노드가 포함되는지 확인
3. 여러 depth 옵션(2, 3)으로 변경하며 재실행

**성공 기준**:
- [ ] impact 결과에 해당 코드가 governs하는 BLK concept 노드가 포함됨
- [ ] depth 옵션 변경시 추적 범위가 정상적으로 변화함
- [ ] concept 노드의 파일도 impact에 포함됨

---

### 테스트 4: codegraph_backlinks 재귀 탐색

**목표**: depth 파라미터를 사용한 재귀적 백링크 탐색이 정상 작동하는지 확인

**절차**:
1. 특정 Markdown 파일(예: `dictionary.md`)의 백링크 검색
2. `codegraph_backlinks "docs/dictionary.md" --depth 1` 실행
3. `codegraph_backlinks "docs/dictionary.md" --depth 3` 실행
4. 두 결과의 차이 비교

**성공 기준**:
- [ ] depth=1일 때 직접 참조하는 문서만 반환됨
- [ ] depth=3일 때 3단계 깊이의 백링크가 반환됨
- [ ] 순환 참조가 무한 루프 없이 처리됨

---

### 테스트 5: concept 노드 검색 랭킹

**목표**: concept 노드가 검색 결과에서 적절한 우선순위로 표시되는지 확인

**절차**:
1. `codegraph_search "BLK-001"` 실행
2. `codegraph_context "BLK"` 실행
3. concept 노드가 상위에 위치하는지 확인

**성공 기준**:
- [ ] "BLK-001" 검색시 concept 노드가 결과 상위에 위치함
- [ ] "BLK" 키워드로도 concept 노드가 검색됨
- [ ] kindBonus가 정상 적용됨

---

## 🎯 종합 성공 기준

### 필수 조건 (All Must Pass):
- [ ] 모든 테스트 1~5가 전부 성공
- [ ] 인덱싱 과정에서 오류가 발생하지 않음
- [ ] MCP 툴이 정상적으로 응답함
- [ ] 기존 기능(코드 검색, impact 분석 등)이 회귀 없이 작동함

### 선택 조건 (Nice to Have:
- [ ] `codegraph_node` 결과에서 governs 관계가 시각적으로 명확히 표시됨
- [ ] 인덱싱 성능이 이전 버전과 비교해 유사하거나 개선됨
- [ ] 메모리 사용량이 허용 범위 내에 있음

---

## 📝 검증 완료 확인

검증자: _______________
검증 날짜: _______________
전체 결과: [ ] 성공 [ ] 실패
비고: _________________________
