---
name: visualize-graph
description: >
  Use this skill whenever the user wants to visualize the codegraph, generate an HTML dependency graph,
  see the architecture as a graph, or asks for "visualize-graph". Reads the existing .codegraph/codegraph.db
  SQLite index and generates (or overwrites) docs/codegraph-viz.html — an interactive Cytoscape.js graph
  showing class-level dependencies aggregated from method-level call relationships.
  Trigger on: "visualize-graph", "codegraph 시각화", "아키텍처 그래프 만들어줘", "dependency graph", "HTML 그래프 생성".
---

# visualize-graph

codegraph.db의 메서드 레벨 호출 관계를 부모 클래스로 집계하여 **클래스 의존성 HTML 그래프**를 생성한다.

## 전제 조건

- `.codegraph/codegraph.db` 존재 (없으면 `codegraph init -i` 안내 후 중단)
- Node.js 22+ (`node:sqlite` 내장 모듈 필요)

## 실행 프로토콜

```
1. 전제 조건 확인
2. SCRIPT_PATH 결정 (이 스킬의 scripts/generate-graph.mjs 절대 경로)
3. 옵션 결정 (--methods 여부)
4. node <SCRIPT_PATH> [옵션] 실행
5. 결과 보고
```

### Step 1. 전제 조건 확인

프로젝트 루트에서 `.codegraph/codegraph.db` 파일 존재 여부를 확인한다.

```powershell
Test-Path ".codegraph/codegraph.db"
```

없으면:
```
⚠️ .codegraph/codegraph.db 가 없습니다.
먼저 codegraph init -i 를 실행하세요.
```
이후 중단.

### Step 2. SCRIPT_PATH 결정

이 SKILL.md가 위치한 디렉터리 기준 `scripts/generate-graph.mjs` 의 절대 경로를 사용한다.

Windows 예시:
```
C:\Users\<USERNAME>\.claude\skills\visualize-graph\scripts\generate-graph.mjs
```

### Step 3. 옵션 결정

| 조건 | 옵션 |
|------|------|
| 기본 (class/interface/struct/enum) | 옵션 없음 |
| 사용자가 "메서드 포함" 또는 "--methods" 요청 | `--methods` |
| 출력 경로 지정 | `--out <경로>` |
| DB 경로 지정 | `--db <경로>` |

### Step 4. 실행

```powershell
node "<SCRIPT_PATH>" [--methods] [--out <path>] [--db <path>]
```

실행 디렉터리: 반드시 **프로젝트 루트**에서 실행해야 한다 (상대 경로 기준).

### Step 5. 결과 보고

성공 시 출력 예시:
```
[visualize-graph] ✅ D:\...\docs\codegraph-viz.html
[visualize-graph]    nodes: 76  edges: 92
```

사용자에게 다음을 안내:
- 출력 파일 경로
- 노드 수 · 엣지 수
- 브라우저로 열어 확인하도록 안내

## 그래프 집계 방식

```
method A (class X) --calls--> method B (class Y)
          ↓ 집계
class X --calls--> class Y
```

- `calls`, `instantiates`, `implements`, `imports` 엣지만 포함 (`contains` 제외)
- 동일 (source, target, kind) 쌍 중복 제거

## HTML 기능 요약

| 기능 | 설명 |
|------|------|
| 레이아웃 | CoSE / Dagre / Grid / Circle / BFS |
| 검색 | 심볼 이름 실시간 필터 + 자동 줌 |
| 노드 클릭 | 파일·라인·시그니처 + 연결 노드 목록 |
| 레전드 토글 | 노드 종류 · 엣지 종류 on/off |
| 스크롤 줌 | 마우스 휠로 확대/축소 |

## 재생성

아무때나 재실행하면 HTML이 덮어써진다. 코드 변경 후 codegraph.db가 갱신되면 재실행으로 그래프 최신화.
