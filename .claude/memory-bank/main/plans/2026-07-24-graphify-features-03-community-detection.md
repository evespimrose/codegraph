# 세부 플랜 03: 커뮤니티/클러스터 탐지 (Louvain)

**마스터 플랜**: [00-master.md](2026-07-24-graphify-features-00-master.md)
**의존성**: 없음 (01, 02와 병행 가능)
**후행 의존**: 04(자동 리포트)의 Communities 섹션·cohesion 점수, 05(HTML 뷰어)의 커뮤니티 레전드가 이 계획의 산출물(`.codegraph/communities.json`)을 소비한다.

## 목표

graphify `cluster.py`의 알고리즘(00-master.md 1.1/1.2절 결정에 따라 Leiden→Louvain 대체, 라벨링은 결정론적 hub 방식)을 이식한 그래프 커뮤니티 탐지를 추가하고, 결과를 `.codegraph/communities.json` 캐시로 저장한다.

## 이식 대상 알고리즘 (graphify `cluster.py` 원본 대조)

| graphify 함수 | 이 repo 대응 | 이식 여부 |
|---|---|---|
| `_partition`(Leiden/Louvain 실행) | `runLouvain(graph)` | 이식 (Louvain만) |
| `cluster()`(과대 커뮤니티 분할, `_MAX_COMMUNITY_FRACTION=0.25`, `_MIN_SPLIT_SIZE=10`) | `splitOversizedCommunities` | 이식 |
| `cohesion_score`(실제 엣지/가능한 엣지 비율) | `cohesionScore` | 이식 (수식 그대로) |
| `label_communities_by_hub`(최고차수 노드 이름을 라벨로) | `labelByHub` | 이식 |
| `community_member_sigs`(sha256 멤버십 지문) | 보류 | 스코프 밖 (00-master.md 2절) |
| `remap_communities_to_previous`(실행 간 ID 안정화) | 보류 | 스코프 밖 (00-master.md 2절) |
| `exclude_hubs_percentile`(허브 노드 파티셔닝 제외) | `excludeHubsPercentile` | 이식 (선택 파라미터로) — codegraph는 `contains`/`imports` 엣지가 많아 파일 허브가 커뮤니티를 오염시키는 문제가 동일하게 발생할 수 있음 |

## 단계

**1. 의존성 추가 및 배치 결정**
- Symbol: N/A
- CodeGraph: N/A (신규 의존성)
- File: `package.json`
- Scope: `dependencies` 또는 `optionalDependencies` 블록
- BLK target: [인프라]
- Action: insert (`graphology`, `graphology-communities-louvain`, `graphology-metrics` 추가)
- Success criterion: `npm install` 성공, 라이선스 MIT 확인(이 repo MIT와 호환). 04/05가 `graphology-metrics`의 betweenness도 쓰므로 이 3개 패키지는 03에서 한 번에 들여온다.

**2. 그래프 로더**
- Symbol: `loadGraphology(queries): Graph`
- CodeGraph: `codegraph_node getAllNodes`, `codegraph_node getAllEdges` (또는 대응하는 QueryBuilder 메서드명 확정)
- File: 신규 `src/graph/community.ts`
- Scope: 신규 파일 전체
- BLK target: [인프라]
- Action: insert
- Success criterion: `nodes`/`edges` 테이블 전체를 `graphology.Graph` 인스턴스로 변환. 방향성 엣지(`calls`, `imports` 등)는 무방향으로 취급(graphify도 Louvain 입력 전 무방향 변환, `cluster.py:157-158` 대응). **`kind` 필터링 없이 전체 노드/엣지를 로드한다** — 순수 마크다운 프로젝트(BLADE급)는 `kind='doc'` 노드와 `kind='doc_link'` 엣지만 존재하므로, 코드 전용 kind(`class`/`calls`/`imports` 등)를 하드코딩으로 가정하면 이런 프로젝트에서 빈 그래프가 만들어진다. `isPureMarkdownProject`(`src/docs/doc-links-linker.ts`)가 이미 이 판정 로직을 갖고 있으니 재사용 검토.

**3. Louvain 실행 + 과대 커뮤니티 분할**
- Symbol: `detectCommunities(graph, opts): Map<nodeId, communityId>`
- CodeGraph: N/A (신규 로직, graphify `cluster.py:134-236` 이식)
- File: `src/graph/community.ts`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: `_MAX_COMMUNITY_FRACTION=0.25`/`_MIN_SPLIT_SIZE=10` 규칙 이식 확인 — 전체 노드의 25% 초과하는 커뮤니티가 최소 10노드 이상이면 재귀적으로 재분할됨을 소규모 fixture로 검증

**4. cohesion score**
- Symbol: `cohesionScore(graph, nodeIds): number`
- File: `src/graph/community.ts`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: `actual / (n*(n-1)/2)` 수식이 `cluster.py:257-265`와 동일한 결과를 소규모 수동 계산 대비 산출

**5. 결정론적 허브 라벨링**
- Symbol: `labelByHub(graph, communities): Map<communityId, string>`
- File: `src/graph/community.ts`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert
- Success criterion: 각 커뮤니티에서 차수 최고 노드의 `label`(동률 시 노드 id 사전순, `cluster.py:105` 규칙과 동일)을 커뮤니티 이름으로 반환. LLM 호출 없음.

**6. 캐시 저장**
- Symbol: `writeCommunitiesCache(path, result)`
- File: `src/graph/community.ts` 또는 신규 CLI 진입점(`scripts/detect-communities.mjs`)
- Scope: 신규 함수/파일
- BLK target: [인프라]
- Action: insert
- Success criterion: `.codegraph/communities.json`에 `{ nodeId: communityId }`, `{ communityId: {label, cohesion, size} }` 두 맵이 저장됨. `.codegraph/.gitignore` 패턴에 이미 포함되는지 확인(신규 라인 필요 시 추가).

**7. 대형 그래프 안전장치**
- Symbol: `detectCommunities` 내부 상한 체크
- File: `src/graph/community.ts`
- Scope: 함수 진입부
- BLK target: [인프라]
- Action: insert
- Success criterion: 노드 수가 임계치(예: 20,000) 초과 시 계산을 건너뛰고 경고 반환(BLADE 1347 노드는 안전 범위 — 이 상한은 훨씬 큰 코퍼스에 대한 방어용)

**8. 테스트**
- Symbol: 신규 테스트
- File: `__tests__/community-detection.test.ts` (신규)
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: 알려진 소규모 그래프(예: 2개 뚜렷한 클러스터 + 1개 다리 노드)에서 커뮤니티 개수·cohesion·라벨이 기대값과 일치. **순수 마크다운 fixture 케이스 1개 추가** — 코드 노드 없이 `doc`/`doc_link`로만 구성된 소규모 그래프(예: 문서 6개, 2개 뚜렷한 링크 클러스터)에서도 동일하게 커뮤니티가 탐지되고 라벨이 문서 제목으로 붙는지 검증(BLADE 축소판). `npm run test` 그린.

## 검증 (완료 조건)

- 이 repo 자신(449파일, 4488노드)에 대해 `detectCommunities` 실행 시간이 수 초 이내
- `.codegraph/communities.json` 생성 확인, 05번 플랜의 `generate-graph.mjs`가 읽을 수 있는 형식인지 상호 확인
- **순수 마크다운 프로젝트(BLADE, 1347 doc 노드)에 대해서도 `detectCommunities`가 빈 결과 없이 동작함을 확인** — 코드 kind를 전제한 로직이 없는지 재확인
- `/code-review` 0 Critical
