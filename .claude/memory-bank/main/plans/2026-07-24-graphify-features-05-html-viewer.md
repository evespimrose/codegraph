# 세부 플랜 05: HTML 뷰어 적용 방안

**마스터 플랜**: [00-master.md](2026-07-24-graphify-features-00-master.md)
**의존성**: 01(provenance 표준화), 03(커뮤니티 탐지) 완료 필요
**후행 의존**: 없음

## 목표

기존 `.claude/skills/visualize-graph/scripts/generate-graph.mjs`(Cytoscape.js + dagre)를 확장한다. graphify `graph.html`(vis.js) 대비 원 비교문서(4.3절)가 제안한 저비용 항목만 적용하고, Mermaid 내러티브(원 문서 4.3-5번)는 04번 계획으로 이관했으므로(00-master.md 1.6절) 이 계획의 범위에서 제외한다.

## 라이브러리 선택 근거 (2026-07-27 추가 — Cytoscape/Sigma/force-graph 3안 비교 및 정정)

[뷰어 라이브러리 3안 비교 문서](../../../docs/output/2026-07-27-viewer-library-tradeoff.md)에서 Cytoscape.js(A안, 현행) · Sigma.js(B안) · force-graph(C안) 세 옵션을 구현 토큰·런타임·유지보수 세 프레임으로 비교했다. **결론은 A안(Cytoscape 확장) 유지 — 변경 없음.** 단, 최초 비교 시점에 "B·C 공통으로 Dagre 계층 레이아웃을 잃는다"고 판단했던 부분을 이후 조사로 **정정**했다: `force-graph`(C안)는 `dagMode('td'/'bu'/'lr'/'rl'/...)`를 자체 내장하고, 공식 예제가 실제 `dagre` 라이브러리를 직접 붙여 `fx`/`fy`로 고정하는 패턴까지 시연한다 — Dagre 상실은 C가 아니라 B(Sigma, 미확인 상태)에만 해당한다.

**이 정정이 이 계획에 미치는 영향**: A안을 유지하는 이유는 "라이브러리 전환 시 기능을 잃기 때문"이 아니라 **순수하게 구현 토큰 비용(A가 4~6배 낮음)과 현재 최대 실측 규모(BLADE 1347 노드)에서 WebGL/3D 전환의 런타임 이득이 없기 때문**이다. force-graph는 `numDimensions(2↔3)` + `d3ReheatSimulation()`으로 2D/3D를 물리 시뮬레이션 그대로 자연스럽게 전환할 수 있고(`cameraPosition(pos, lookAt, ms)`로 카메라 트랜지션도 tween 지원 확인), `onRenderFramePre(ctx, scale)` 훅으로 하이퍼엣지 오버레이도 A안보다 쉽게 붙일 수 있다는 점이 이번 조사로 확인됐다. 즉 **아래 "제외" 항목(하이퍼엣지, 3D)은 기술적으로 불가능해서가 아니라 이번 단계의 스코프 결정**이며, 3D·하이퍼엣지 요구가 실제로 생기면 A안이 아니라 force-graph 재검토가 선행돼야 한다(비교 문서 결론의 "조건부 후속 안건" 3가지 참조).

## 적용 항목 (원 문서 4.3절 대조)

| 원 문서 항목 | 이 계획 단계 | 비고 |
|---|---|---|
| 1. 노드 크기 = degree | 2단계 | 즉시 적용 가능, 최우선 |
| 2. 대형 그래프 안전장치 | 3단계 | BLADE급 문서모드 대비 |
| 3. 커뮤니티 레전드 | 4단계 | 03번 계획의 캐시 소비 |
| 4. 신뢰도 기반 엣지 스타일 | 5단계 | 01번 계획의 provenance 소비 |
| 5. Mermaid 내러티브 | (제외) | 04번 계획으로 이관 |
| 6. 하이퍼엣지/트리뷰 | (제외) | 00-master.md 2절, 스코프 밖. **기술적 불가능이 아니라 스코프 결정** — force-graph라면 `onRenderFramePre` 훅으로 더 쉽게 붙는다(위 "라이브러리 선택 근거" 참조) |

## 순수 마크다운 프로젝트(docs 모드, BLADE급) 호환성 확인

이 repo의 고유 기능인 "코드 없이 마크다운만 있는 프로젝트의 노드-엣지 그래프"(`DOCS_MODE`, `kind='doc'`/`doc_link`만 존재, BLADE 1347노드가 최대 실측치)에서 아래 4개 신규 기능이 실제로 의미 있게 동작하는지 단계별로 점검한 결과다.

| 단계 | 기능 | 코드 모드 | docs 모드(BLADE급) | 비고 |
|---|---|---|---|---|
| 2 | 노드 크기 = degree | 동작 | **동작** | `doc_link` 엣지도 일반 엣지이므로 degree 계산 로직에 차이 없음. 변경 불요. |
| 3 | 대형 그래프 안전장치 | 해당 없음(코드 모드는 소규모) | **동작 — 애초에 이 기능이 겨냥한 시나리오** | 3단계는 처음부터 `DOCS_MODE` 조건으로 설계됨(원문 그대로). |
| 4 | 커뮤니티 레전드 | 동작 | **동작, 단 03번 플랜 수정 필요** | 03번 플랜 2단계가 "코드 kind만 로드"를 암묵 가정하고 있었던 걸 이번에 명시적으로 고쳤다(`kind` 필터링 없이 전체 로드, `isPureMarkdownProject` 재사용). 그 수정이 선행돼야 이 4단계가 docs 모드에서 빈 레전드를 내지 않는다. |
| 5 | 신뢰도 기반 엣지 스타일 | 동작(코드는 이미 `extracted`/`inferred`/`heuristic` 혼재) | **수정 전에는 무의미, 01번 플랜 수정 후 동작** | 기존 `linkDocEdges`가 `doc_link` 엣지 전량에 `'heuristic'`을 대입해서, 01번 플랜을 그대로 두면 docs 모드에서 **모든 엣지가 점선**이 되어 대조군이 없다(구분 자체가 무의미). 01번 플랜 3단계에 "경로 정확 일치=extracted / basename 폴백=heuristic" 세분화를 추가했다 — 이 계획은 그 결과를 소비만 하면 된다(코드 변경 불요, 의존성 확인만). |

**결론**: 05번 플랜 자체는 코드 변경이 필요 없다(4개 기능 모두 코드/docs 모드에 공용으로 짠 기존 설계를 그대로 소비). 대신 **01번 플랜과 03번 플랜에 각각 1건씩 수정을 반영해야** docs 모드에서 4단계·5단계가 실제로 의미를 갖는다 — 이번 세션에서 두 플랜 모두 이미 수정 완료(각 파일의 2026-07-27 갱신 내역 참조).

## 단계

**1. 현황 재확인**
- Symbol: `cyNodes`, `cyEdges`, `aggEdges` (기존 변수)
- CodeGraph: `codegraph_node generate-graph.mjs` 또는 이미 읽은 파일 재확인
- File: `.claude/skills/visualize-graph/scripts/generate-graph.mjs`
- Scope: 라인 90-165 (기존 Cytoscape 데이터 변환부, 이전 조사에서 확인됨)
- BLK target: [인프라]
- Action: (확인만)
- Success criterion: 확장 지점(`cyNodes`/`cyEdges` 생성 직후) 확정

**2. 노드 크기 = degree**
- Symbol: `cyNodes` 생성 로직, cytoscape `style` 배열의 `node` 셀렉터
- File: `.claude/skills/visualize-graph/scripts/generate-graph.mjs`
- Scope: 라인 90-165(degree 계산 삽입), 라인 304-312(스타일 규칙)
- BLK target: [인프라]
- Action: insert (degree 계산) + replace (width/height 고정값 → `mapData(degree, min, max, 24, 64)`)
- Success criterion: 이 repo 자신을 재생성했을 때 연결이 많은 클래스(예: `CodeGraph`)가 시각적으로 더 크게 렌더링됨(스크린샷 확인)

**3. 대형 그래프 안전장치**
- Symbol: `DOCS_MODE` 분기 (기존 변수, 라인 94-117)
- File: `.claude/skills/visualize-graph/scripts/generate-graph.mjs`
- Scope: 라인 94-117 부근
- BLK target: [인프라]
- Action: insert
- Success criterion: `DOCS_MODE`이고 노드 수가 임계치(기본 800, `--max-nodes`로 조정 가능) 초과 시 차수 상위 N개만 `displayNodes`에 포함하고, 헤더 통계에 "나머지 M개 숨김" 문구 추가

**4. 커뮤니티 레전드**
- Symbol: `legendHtml` 조립 로직 (기존, 라인 172-195), `DatabaseSync` 로드부 (라인 36-44)
- File: `.claude/skills/visualize-graph/scripts/generate-graph.mjs`
- Scope: 라인 36-44(캐시 파일 로드 추가), 라인 172-195(레전드 조립 분기 추가), 스타일/스크립트부(토글 로직)
- BLK target: [인프라]
- Action: insert
- Success criterion: `.codegraph/communities.json`(03번 계획 산출물)이 존재하면 레전드에 "커뮤니티" 그룹 선택지가 추가되고, 클릭 시 해당 커뮤니티 멤버만 강조. 캐시 파일이 없으면 기존 동작(심볼종류/디렉토리 레전드)과 100% 동일(하위 호환).

**5. 신뢰도 기반 엣지 스타일**
- Symbol: `EDGE_COLOR` 매핑 (기존, 라인 88), cytoscape edge 스타일 셀렉터 (라인 309-311)
- File: `.claude/skills/visualize-graph/scripts/generate-graph.mjs`
- Scope: 라인 88(데이터 주입 시 provenance 필드 추가), 라인 309-311(스타일 규칙 추가)
- BLK target: [인프라]
- Action: insert
- Success criterion: `provenance='heuristic'` 또는 `'inferred'`인 엣지가 점선(`line-style: dashed`)으로, `'extracted'`는 기존 실선 그대로 렌더링됨

**6. SKILL.md 갱신**
- Symbol: N/A
- File: `.claude/skills/visualize-graph/SKILL.md`
- Scope: "HTML 기능 요약" 표 (기존 라인 99-107)
- BLK target: [인프라]
- Action: replace (표에 신규 행 3개 추가: 노드크기, 커뮤니티 레전드, 신뢰도 스타일)
- Success criterion: 표가 실제 구현된 기능과 일치

**7. 수동 검증**
- Symbol: N/A
- File: (실행만)
- Scope: N/A
- BLK target: [인프라]
- Action: (검증)
- Success criterion: 이 repo 자신의 `codegraph.db`로 `node generate-graph.mjs` 재실행 후 브라우저에서 열어 4가지 신규 기능(크기/캡/레전드/엣지스타일)이 실제로 동작하는지 스크린샷으로 확인. **BLADE(`--docs` 모드, 1347 문서)로도 1회 실행해 4가지 전부 확인** — 안전장치(3단계)뿐 아니라 (a) degree 기반 크기가 허브 문서 위주로 커지는지, (b) 커뮤니티 레전드가 빈 목록이 아닌지(03번 플랜 수정 반영 여부), (c) 엣지 스타일에 실선/점선이 **둘 다** 나타나는지(01번 플랜 수정 반영 여부 — 전부 점선이면 회귀)까지 확인.

## 검증 (완료 조건)

- 03번 계획의 캐시 파일이 없는 프로젝트에서도 기존 동작이 깨지지 않음(하위 호환)
- BLADE급 문서모드에서 브라우저가 멈추지 않고 렌더링됨
- **BLADE급 문서모드에서 4가지 신규 기능(크기/캡/레전드/엣지스타일) 전부가 코드모드와 동등하게 동작함** — "순수 마크다운 프로젝트 호환성 확인" 절의 표와 대조
- `/code-review` 0 Critical
