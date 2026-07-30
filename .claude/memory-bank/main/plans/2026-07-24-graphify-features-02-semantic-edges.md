# 세부 플랜 02: 시맨틱 유사도의 그래프 영속화

**마스터 플랜**: [00-master.md](2026-07-24-graphify-features-00-master.md)
**의존성**: 없음 (01, 03과 병행 가능)
**후행 의존**: 04(자동 리포트)의 "surprising connections"·"semantically similar" 태깅이 이 계획의 산출물(엣지)을 소비한다.

## 목표

기존 `@xenova/transformers` 로컬 임베딩(`src/docs/embed.ts`, 이미 optionalDependency로 존재, LLM 아님)을 **질의 시점 KNN**(`searchDocs`, 기존 기능, 변경 없음)에 더해 **전량 사후처리 pairwise KNN**으로 한 번 더 돌려, 상위 유사도 쌍을 `semantically_related` 종류의 영속 엣지로 저장한다. graphify의 `semantically_similar_to` 관계(LLM subagent 기반, 토큰 비용 발생)와 동일한 그래프상 효과를, LLM 호출 없이 기존 로컬 임베딩만으로 낸다.

## 설계 결정

- **엣지 kind**: `semantically_related` (신규 EdgeKind 값 — 스키마 컬럼 추가 불요, `kind`는 이미 문자열 컬럼)
- **provenance**: `inferred` (01번 계획의 어휘 재사용)
- **점수 저장 위치**: `edges.metadata` JSON에 `{ similarity: number }` (기존 `metadata` 컬럼 재사용, `src/db/queries.ts:1224` 확인됨 — 신규 컬럼 불요)
- **폭발 방지**: 문서당 top-K(기본 5) + 최소 코사인 유사도 임계값(기본 0.75) 동시 적용. BLADE급(1347 문서) 코퍼스에서 조합 폭발을 막는 핵심 안전장치.
- **대상**: `mdast_vectors`에 이미 임베딩된 문서만(코드 심볼 임베딩은 스코프 밖 — 마크다운 문서 간 유사도만 다룬다. 코드 심볼까지 확장은 후속 과제).

## 단계

**1. 스키마 변경 불요 확인**
- Symbol: `edges` 테이블 정의
- CodeGraph: `codegraph_explore "schema.sql edges table kind metadata"`
- File: `src/db/schema.sql`
- Scope: `CREATE TABLE edges` 블록
- BLK target: [인프라]
- Action: (확인만, 변경 없음)
- Success criterion: `kind`가 CHECK 제약 없는 TEXT 컬럼임을 확인(신규 kind 값 삽입에 스키마 변경 불요)

**2. pairwise KNN 함수 신설**
- Symbol: `buildSemanticEdges(db, opts): Promise<{created: number, skipped: number}>`
- CodeGraph: `codegraph_node loadVecExtension`, `codegraph_node embed` (기존 함수 시그니처 재확인)
- File: 신규 `src/docs/semantic-edges.ts`
- Scope: 신규 파일 전체
- BLK target: [인프라]
- Action: insert
- Success criterion: `mdast_vectors`의 모든 rowid 쌍에 대해 코사인 유사도를 계산하고, top-K + 임계값을 만족하는 쌍만 반환하는 순수 함수가 존재. sqlite-vec의 MATCH 연산(기존 `search.ts`의 KNN 패턴, k를 리터럴로 인라인하는 제약 포함)을 각 문서를 쿼리 벡터 삼아 반복 호출하는 방식으로 구현(N개 문서 × 1회 KNN 쿼리 = O(N) 쿼리, 전체 pairwise O(N²) 스캔보다 sqlite-vec 인덱스를 활용해 저렴).

**3. 엣지 upsert**
- Symbol: `buildSemanticEdges` 내부, `queries.insertEdges` 재사용
- CodeGraph: `codegraph_node insertEdges`
- File: `src/docs/semantic-edges.ts`
- Scope: 신규 함수 내부
- BLK target: [인프라]
- Action: insert
- Success criterion: 반환된 쌍이 `kind='semantically_related', provenance='inferred', metadata={similarity}`로 `insertEdges` 호출됨. 자기참조(같은 문서) 제외, 이미 `doc_link`로 연결된 쌍의 중복 삽입은 허용(별개 kind이므로 상충 없음 — 04번 리포트에서 "이미 명시적으로 링크된 쌍"과 "링크 없는 유사 쌍"을 구분해 표시할 근거가 됨).

**4. 파이프라인 연결 (옵션 게이트)**
- Symbol: `indexAll` 또는 `sync` (CodeGraph 클래스 메서드)
- CodeGraph: `codegraph_node indexAll`, `codegraph_node sync`
- File: `src/index.ts`
- Scope: `indexMarkdown` 호출 직후 지점 (기존 `linkDocEdges` 호출부와 동일한 위치, `src/index.ts:350` 부근)
- BLK target: [인프라]
- Action: insert
- Success criterion: 기존 `resolveDocsEnabled`/`CODEGRAPH_DOCS` 게이팅 패턴을 그대로 따르는 신규 게이트(예: `CODEGRAPH_SEMANTIC_EDGES` 환경변수 또는 프로젝트 플래그)로 감싸져 있어, 미설정 시 완전히 no-op(기존 코드 프로젝트의 그래프가 byte-identical 유지 — `report.py`의 "work-memory lessons omitted when absent" 원칙과 동일 사상).

**5. 증분 갱신**
- Symbol: `buildSemanticEdges`의 재실행 경로
- File: `src/docs/semantic-edges.ts`
- Scope: 기존 SHA1 변경감지(`indexMarkdown`의 `content_hash` 비교)와 연동하는 부분
- BLK target: [인프라]
- Action: insert
- Success criterion: 변경되지 않은 문서 쌍은 재계산 스킵, 삭제된 문서의 `semantically_related` 엣지는 기존 `doc-links-linker.ts`의 고아 정리 패턴과 동일하게 제거됨

**6. 테스트**
- Symbol: 신규 테스트
- File: `__tests__/semantic-edges.test.ts` (신규)
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: 소규모 fixture(3~5개 마크다운, 명백히 유사한 2개 + 무관한 1~2개)로 top-K/임계값 동작 검증. `npm run test` 그린.

**7. 기존 조회 도구 확인**
- Symbol: `codegraph_context`, `codegraph_callers`
- CodeGraph: N/A (스키마 불변이므로 자동 노출 기대)
- File: (변경 없음, 확인만)
- Scope: N/A
- BLK target: [인프라]
- Action: (확인만)
- Success criterion: 신규 kind 엣지가 별도 코드 변경 없이 기존 MCP 도구 응답에 그대로 나타남(신규 kind를 화이트리스트/필터링하는 하드코딩 지점이 있다면 그곳만 추가 수정)

## 검증 (완료 조건)

- BLADE(1347 문서) 규모 테스트 시 LLM API 호출 0회(네트워크 요청 없음, 로컬 임베딩만) 확인
- 생성된 엣지 수가 top-K × 문서 수 이하로 상한 준수
- `/code-review` 0 Critical
