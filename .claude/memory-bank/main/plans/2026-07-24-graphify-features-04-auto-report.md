# 세부 플랜 04: 자동 생성 내러티브 리포트

**마스터 플랜**: [00-master.md](2026-07-24-graphify-features-00-master.md)
**의존성**: 01(provenance 표준화), 02(시맨틱 엣지), 03(커뮤니티 탐지) 완료 필요
**후행 의존**: 없음

## 목표

graphify `GRAPH_REPORT.md`에 상당하는 `docs/output/YYYY-MM-DD-graph-report.md`를 생성하는 **신규 스킬**을 추가한다. 기존 `visualize-graph` 스킬은 SKILL.md에 "정적 HTML 전용"을 명시하고 있으므로(부정 제약 위반 방지), 별도 스킬 `graph-report`로 분리한다(00-master.md 1.6절 결정).

## 이식 대상 알고리즘 (graphify `analyze.py` + `report.py` 원본 대조)

| graphify 함수 | 이 repo 대응 | 비고 |
|---|---|---|
| `god_nodes`(차수 랭킹, 파일/개념/노이즈 노드 제외) | `godNodes` | `kind IN ('file','import','concept')` 제외로 대체 |
| `surprising_connections` + `_surprise_score`(신뢰도/파일유형/커뮤니티/의미유사도/주변부→허브 가중합) | `surprisingConnections` | provenance(01)·semantic edge(02)·community(03) 전부 소비 |
| `suggest_questions`(5개 전략: ambiguous/bridge/god-with-inferred/isolated/low-cohesion) | `suggestQuestions` | `heuristic` 다수 엣지를 ambiguous 대응으로 사용 |
| `find_import_cycles`(파일 레벨 유향 그래프 simple cycle) | `findImportCycles` | 기존 `imports` kind 엣지 재사용 |
| `generate`(마크다운 조립) | `renderReport` | Mermaid flowchart 임베드로 대체(00-master.md 1.6절) |

## 단계

**1. god node 랭킹**
- Symbol: `godNodes(nodes, edges, topN=10): {label, degree}[]`
- CodeGraph: `codegraph_explore "queries.ts node degree getOutgoingEdges getIncomingEdges"`
- File: 신규 `.claude/skills/graph-report/scripts/lib/analyze.mjs`
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: `kind IN ('file','import','concept')` 노드를 제외한 차수 상위 N개 반환. `analyze.py:101-122`의 노이즈 제외 사상과 동일(단 이 repo는 `_BUILTIN_NOISE_LABELS` 같은 언어 내장어 필터는 스코프 밖 — codegraph 추출기가 애초에 내장 타입 노드를 만들지 않는지 먼저 확인 후 필요시만 추가)

**2. 신뢰도 요약**
- Symbol: `summarizeProvenance` (01번 계획 산출물 재사용)
- File: `.claude/skills/graph-report/scripts/lib/analyze.mjs`
- Scope: import 후 호출
- BLK target: [인프라]
- Action: insert
- Success criterion: extracted/inferred/heuristic 비율(%)이 리포트 Summary 섹션에 반영

**3. surprising connections**
- Symbol: `surprisingConnections(graph, communities, topN=5)`
- CodeGraph: (신규 로직, `analyze.py:125-329` 이식)
- File: `.claude/skills/graph-report/scripts/lib/analyze.mjs`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: 점수 요소 4가지(신뢰도 가중치, 커뮤니티 교차, 시맨틱 유사도 보너스, 주변부→허브) 이식 확인. `_cross_language`/`_suppress_structural`(cross-language phantom 억제, `analyze.py:217-229`)은 이 repo의 `provenance` 어휘로는 직접 대응 안 되므로 **간소화**: `heuristic` + 언어 상이 조합만 억제(전체 rubric 이식 아님, 과도 엔지니어링 방지)

**4. suggested questions**
- Symbol: `suggestQuestions(graph, communities, communityLabels, topN=7)`
- CodeGraph: (신규 로직, `analyze.py:420-545` 이식)
- File: `.claude/skills/graph-report/scripts/lib/analyze.mjs`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: 5개 전략(heuristic 다수 엣지/betweenness 브릿지 노드/god-node-with-heuristic/고립 노드/저cohesion 커뮤니티) 각각 최소 1개 fixture 케이스로 동작 확인. betweenness는 03에서 들여온 `graphology-metrics` 재사용.

**5. import cycle 탐지**
- Symbol: `findImportCycles(edges, maxLength=5, topN=20)`
- CodeGraph: `codegraph_search "imports"` (기존 EdgeKind 값 확인)
- File: `.claude/skills/graph-report/scripts/lib/analyze.mjs`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: `imports` kind 엣지로 파일-레벨 유향 그래프를 구성해 simple cycle 탐지(`graphology`의 cycle 탐지 유틸 또는 소규모 자체 DFS). `analyze.py:632-741`과 동일하게 최단 순환 우선 정렬 + 중복(회전) 제거.

**6. 리포트 조립 (Mermaid 임베드)**
- Symbol: `renderReport(data): string`
- File: `.claude/skills/graph-report/scripts/generate-report.mjs`
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: 출력 마크다운에 다음 섹션 포함 — Corpus Check / Summary(노드·엣지·커뮤니티 수, provenance 비율) / God Nodes / Surprising Connections / Import Cycles / Communities(각 커뮤니티 cohesion + 노드 목록 + **주요 커뮤니티 상위 N개만** Mermaid flowchart 임베드) / Knowledge Gaps / Suggested Questions. 전체 파일이 400줄을 넘으면 커뮤니티 나열을 요약(+N more)으로 축약(이 repo 문서 길이 관례 준수).

**7. 출력 경로 및 스킬 등록**
- Symbol: N/A
- File: `.claude/skills/graph-report/SKILL.md` (신규), `.claude/skills/graph-report/scripts/generate-report.mjs`
- Scope: 신규 파일들
- BLK target: [인프라]
- Action: insert
- Success criterion: `docs/output/YYYY-MM-DD-graph-report.md`로 저장(RULE-9 컨벤션). SKILL.md에 "정적 마크다운 리포트 전용, HTML 생성은 `visualize-graph`가 담당"이라는 상호 부정 제약을 명시해 두 스킬의 책임 경계를 문서화.

**8. 실측 검증**
- Symbol: N/A
- File: (실행만, 코드 변경 없음)
- Scope: N/A
- BLK target: [인프라]
- Action: (검증)
- Success criterion: 이 repo 자신에 대해 리포트를 실제로 생성해, God Nodes 상위 항목이 실제로 연결이 많은 핵심 클래스(예: `CodeGraph`, `QueryBuilder`)와 일치하는지 육안 스팟체크

**9. 테스트**
- Symbol: 신규 테스트
- File: `__tests__/graph-report.test.ts` (신규, 또는 스킬 스크립트 특성상 `.claude/skills/graph-report/scripts/__tests__/`에 배치할지 00-master 참조해 결정)
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: 소규모 fixture 그래프에서 각 섹션 함수의 출력이 스펙 테이블과 일치

## 검증 (완료 조건)

- 신규 스킬이 기존 `visualize-graph`의 SKILL.md 부정 제약과 충돌하지 않음
- 생성된 리포트가 400줄 초과 시 축약 규칙이 적용됨
- `/code-review` 0 Critical
