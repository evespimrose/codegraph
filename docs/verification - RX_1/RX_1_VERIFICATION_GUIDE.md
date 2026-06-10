# RX_1 실데이터 검증 가이드

이 가이드는 RX_1 프로젝트에서 CodeGraph Markdown-AST 통합 기능을 검증하는 절차를 설명합니다.

## 📋 전제 조건

- Node.js 18+ 환경
- RX_1 프로젝트가 클론된 상태
- dictionary.md 파일이 존재하는 상태

## 🚀 검증 준비 (RX_1 프로젝트 루트에서 실행)

### 1. CodeGraph 초기화 (최초 실행시)
```bash
# CodeGraph 설치 (아직 설치되지 않은 경우)
npm install -g @codegraph/cli

# 또는 로컬 빌드 사용 (codegraph 리포지토리에서)
cd /path/to/codegraph
npm run build
npm link

# RX_1 프로젝트로 이동
cd /path/to/RX_1

# CodeGraph 초기화
codegraph init
```

### 2. 문서 기능 활성화
```bash
# 환경 변수로 문서 기능 활성화
export CODEGRAPH_DOCS=1

# 또는 프로젝트별 설정 (영구적)
codegraph config set docs.enabled true
```

### 3. 전체 인덱싱 실행
```bash
# docs 기능과 함께 전체 인덱싱
codegraph index --with-docs

# 또는 환경 변수로 실행
CODEGRAPH_DOCS=1 codegraph index
```

## 🔍 검증 절차

### 검증 1: BLK concept 노드 인덱싱 확인
```bash
# codegraph_node로 BLK-001 검색
# (실제로는 MCP 클라이언트나 Claude Desktop에서 실행)
# 예상 결과: BLK-001 concept 노드가 검색되고 관련 C# 심볼이 함께 표시되어야 함
```

### 검증 2: codegraph_impact로 governs 관계 확인
```bash
# 특정 C# 심볼의 impact 분석
# 예: TurnAwareAStarPart
# 예상 결과: impact 결과에 해당 심볼이 governs하는 BLK concept 노드가 포함되어야 함
```

### 검증 3: codegraph_backlinks 재귀 탐색 확인
```bash
# 백링크 검색 with depth 파라미터
# 예: depth=3
# 예상 결과: 지정된 깊이까지의 재귀적 백링크가 반환되어야 함
```

## ✅ 성공 기준

1. **BLK concept 노드 검색**: `codegraph_node "BLK-001"`로 concept 노드가 검색되고, 관련 C# 노드와 dictionary.md 선언 블록이 함께 표시됨
2. **governs 관계 추적**: `codegraph_impact`에서 코드 심볼 변경시 관련 BLK concept 노드가 impact 범위에 포함됨
3. **재귀 백링크**: `codegraph_backlinks`의 depth 파라미터가 정상 작동하여 지정된 깊이까지의 링크가 반환됨
4. **concept 검색 랭킹**: concept 노드가 검색 결과 상위에 위치함

## 📊 검증 결과 보고

검증 완료 후 아래 양식에 결과를 기록해주세요: [RX_1_VERIFICATION_REPORT.md](./RX_1_VERIFICATION_REPORT.md)

## 🛠️ 트러블슈팅

### 인덱싱이 실패하는 경우
```bash
# 로그 레벨을 debug로 설정하여 재실행
CODEGRAPH_LOG_LEVEL=debug codegraph index --with-docs
```

### concept 노드가 검색되지 않는 경우
```bash
# dictionary.md에 BLK 태그가 올바르게 형식화되어 있는지 확인
# 지원되는 형식:
# - <!-- BLK: BLK-001 -->
# - [BLK: BLK-001]
# - // [BLK-001] (코드 내)
```
