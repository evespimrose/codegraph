# 순수 문서/Obsidian Vault 실데이터 검증 가이드

이 가이드는 **순수 문서 프로젝트(Obsidian vault)**에서 CodeGraph Markdown-AST 통합 기능을 검증하는 절차를 설명합니다.

---

## 📋 전제 조건

- Node.js 18+ 환경
- 대상 문서 프로젝트가 준비된 상태 (예: D:\Fork\BLADE)
- 대상 프로젝트에 Markdown 문서가 존재하는 상태

---

## 🚀 검증 준비 (대상 프로젝트 루트에서 실행)

### 1. CodeGraph 초기화 (이미 유저가 실행 완료. 초기화 필요 없음)
```bash
# CodeGraph 설치 (이미 설치되어있음)
# 대상 문서 프로젝트로 이동
cd D:\Fork\BLADE

# CodeGraph 초기화
codegraph init -i
```

### 2. 문서 기능 활성화
```bash
# 환경 변수로 문서 기능 활성화
$env:CODEGRAPH_DOCS=1

# 또는 프로젝트별 설정 (영구적)
codegraph config set docs.enabled true
```

### 3. 전체 인덱싱 실행
```bash
# docs 기능과 함께 전체 인덱싱
codegraph index --with-docs

# 또는 환경 변수로 실행
$env:CODEGRAPH_DOCS=1; codegraph index
```

---

## 🔍 검증 절차

### 검증 1: BLK concept 노드 인덱싱 확인
```bash
# codegraph_node로 BLK-001 검색
# (실제로는 MCP 클라이언트나 Claude Desktop에서 실행)
# 예상 결과: BLK-001 concept 노드가 검색되고 관련 문서가 함께 표시되어야 함
```

### 검증 2: 문서 간 링크 추적 확인
```bash
# 특정 문서의 링크 확인
# 예: index.md
# 예상 결과: 해당 문서가 참조하는 다른 문서들이 링크로 표시되어야 함
```

### 검증 3: codegraph_backlinks 재귀 탐색 확인
```bash
# 백링크 검색 with depth 파라미터
# 예: depth=3
# 예상 결과: 지정된 깊이까지의 재귀적 백링크가 반환되어야 함
```

### 검증 4: Frontmatter 파싱 확인
```bash
# frontmatter가 포함된 문서 검색
# 예상 결과: frontmatter의 key-value 쌍이 metadata에 저장되어야 함
```

---

## ✅ 성공 기준

1. **BLK concept 노드 검색**: `codegraph_node "BLK-001"`로 concept 노드가 검색되고, 관련 문서가 함께 표시됨
2. **문서 간 링크 추적**: `codegraph_node`에서 문서 간 `[[...]]` 링크가 정상적으로 표시됨
3. **재귀 백링크**: `codegraph_backlinks`의 depth 파라미터가 정상 작동하여 지정된 깊이까지의 링크가 반환됨
4. **Frontmatter 파싱**: 문서의 frontmatter가 정상적으로 파싱되어 metadata에 저장됨
5. **concept 검색 랭킹**: concept 노드가 검색 결과 상위에 위치함

---

## 📊 검증 결과 보고

검증 완료 후 아래 양식에 결과를 기록해주세요: [PURE_DOCS_VERIFICATION_REPORT.md](./PURE_DOCS_VERIFICATION_REPORT.md)

---

## 🛠️ 트러블슈팅

### 인덱싱이 실패하는 경우
```bash
# 로그 레벨을 debug로 설정하여 재실행
$env:CODEGRAPH_LOG_LEVEL=debug; codegraph index --with-docs
```

### concept 노드가 검색되지 않는 경우
```bash
# 문서에 BLK 태그가 올바르게 형식화되어 있는지 확인
# 지원되는 형식:
# - <!-- BLK: BLK-001 -->
# - [BLK: BLK-001]
```

### 문서 간 링크가 추적되지 않는 경우
```bash
# Zettelkasten 링크 형식이 올바른지 확인
# 지원되는 형식:
# - [[문서제목]]
# - [[경로/문서제목]]
```
