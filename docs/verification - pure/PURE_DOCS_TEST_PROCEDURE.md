# 순수 문서/Obsidian Vault 테스트 절차 및 성공 기준

## 📌 개요

이 문서는 CodeGraph Markdown-AST 통합 기능의 **순수 문서 프로젝트(Obsidian vault)** 실데이터 검증을 위한 상세 테스트 절차와 성공 기준을 정의합니다.

---

## 🔬 테스트 환경

### 사전 준비:
- [ ] CodeGraph 최신 버전 빌드 완료
- [ ] 대상 문서 프로젝트(예: D:\Fork\BLADE) 준비
- [ ] Node.js 18+ 환경 구성
- [ ] CODEGRAPH_DOCS=1 환경 변수 설정
- [ ] 대상 프로젝트에 Markdown 문서가 존재하는지 확인

---

## 🧪 테스트 케이스

### 테스트 1: BLK Concept 노드 인덱싱

**목표**: 문서 내의 BLK 태그가 concept 노드로 정상 인덱싱되는지 확인

**절차**:
1. 대상 프로젝트 루트에서 `codegraph index --with-docs` 실행
2. 인덱싱 완료 후 `codegraph status`로 노드 수 확인
3. MCP 클라이언트에서 `codegraph_node "BLK-001"` 실행 (BLK 태그가 있는 경우)
4. concept 노드가 정상적으로 생성되었는지 확인

**성공 기준**:
- [ ] nodes 테이블에 `kind='concept'` 인 레코드가 존재함
- [ ] `codegraph_node` 결과에 BLK concept 노드가 상위에 표시됨
- [ ] concept 노드의 metadata에 올바른 file_path가 연결됨

---

### 테스트 2: 문서 간 링크 추적 (Zettelkasten 링크)

**목표**: Markdown 문서 내의 `[[...]]` Zettelkasten 링크가 정상 추적되는지 확인

**절차**:
1. 대상 프로젝트에서 Zettelkasten 링크가 포함된 문서 확인
2. `codegraph index` 실행
3. 특정 문서(예: `note.md`)의 `codegraph_node` 실행
4. edges 테이블에서 문서 간 링크 확인

**성공 기준**:
- [ ] 문서 A → 문서 B로의 링크 edge가 존재함
- [ ] `codegraph_node` 결과에서 링크 관계가 표시됨
- [ ] 링크 resolution이 정상적으로 완료됨

---

### 테스트 3: codegraph_backlinks 재귀 탐색

**목표**: depth 파라미터를 사용한 재귀적 백링크 탐색이 정상 작동하는지 확인

**절차**:
1. 특정 Markdown 파일(예: `index.md`)의 백링크 검색
2. `codegraph_backlinks "docs/index.md" --depth 1` 실행
3. `codegraph_backlinks "docs/index.md" --depth 3` 실행
4. 두 결과의 차이 비교

**성공 기준**:
- [ ] depth=1일 때 직접 참조하는 문서만 반환됨
- [ ] depth=3일 때 3단계 깊이의 백링크가 반환됨
- [ ] 순환 참조가 무한 루프 없이 처리됨

---

### 테스트 4: Frontmatter 파싱

**목표**: Markdown 문서의 frontmatter(YAML/TOML)가 정상 파싱되는지 확인

**절차**:
1. frontmatter가 포함된 문서 확인
2. `codegraph index` 실행
3. 해당 문서의 `codegraph_node` 실행
4. metadata에 frontmatter 내용이 포함되는지 확인

**성공 기준**:
- [ ] frontmatter의 key-value 쌍이 metadata에 저장됨
- [ ] YAML 형식이 정상 파싱됨
- [ ] TOML 형식이 정상 파싱됨 (지원하는 경우)

---

### 테스트 5: concept 노드 검색 랭킹

**목표**: concept 노드가 검색 결과에서 적절한 우선순위로 표시되는지 확인

**절차**:
1. `codegraph_search "BLK-001"` 실행 (BLK 태그가 있는 경우)
2. `codegraph_context "특정 키워드"` 실행
3. concept 노드가 상위에 위치하는지 확인

**성공 기준**:
- [ ] BLK ID 검색시 concept 노드가 결과 상위에 위치함
- [ ] 관련 키워드로도 concept 노드가 검색됨
- [ ] kindBonus가 정상 적용됨

---

## 🎯 종합 성공 기준

### 필수 조건 (All Must Pass):
- [ ] 모든 테스트 1~5가 전부 성공
- [ ] 인덱싱 과정에서 오류가 발생하지 않음
- [ ] MCP 툴이 정상적으로 응답함
- [ ] 문서 검색, 링크 추적 등 기본 기능이 회귀 없이 작동함

### 선택 조건 (Nice to Have):
- [ ] `codegraph_node` 결과에서 링크 관계가 시각적으로 명확히 표시됨
- [ ] 인덱싱 성능이 허용 범위 내에 있음
- [ ] 메모리 사용량이 허용 범위 내에 있음
- [ ] Obsidian 특정 기능(canvas, dataview 등)이 지원됨

---

## 📝 검증 완료 확인

검증자: _______________
검증 날짜: _______________
전체 결과: [ ] 성공 [ ] 실패
비고: _________________________
