# Try — 입국심사 13원자 codegraph 편입 타당성

> 작성일: 2026-06-16
> 대상 작업: CRG(1·2·3·4) + Headroom(1~7) + Sequential-Thinking(1·4) 원자를 codegraph 추가기능으로 구현할지 / MCP 병립 vs 직접편입 / 개발처(codegraph DLC vs claude-personal-integrated-workflow) 결정
> 분석 모드: codegraph 우선 탐색(Cave-Man) → 5축 비교 → 적대적 검증. **구현 착수 없음.**

---

## 0. 핵심 발견 — 가장 비싼 원자는 이미 구현돼 있다

`Obsidian-Graph-Vector-DB` 브랜치 codegraph 현황(codegraph_context/explore로 확인):

| 입국심사가 "신규/레퍼런스"라 본 것 | codegraph 실제 상태 (이 브랜치) | 근거 |
|---|---|---|
| **Headroom Atom 4** — sqlite-vec 위키 벡터 메모리(384dim) | **이미 구현됨** | `src/docs/embed.ts`(all-MiniLM-L6-v2, 384dim, @xenova/transformers), `config.ts`(EMBED_DIM=384, opt-in `CODEGRAPH_DOCS`), sqlite-vec 로더(`SqliteDatabase.loadExtension`), `findRelevantContext`(하이브리드 시맨틱+심볼) |
| **CRG Atom 6** — Obsidian/위키 export (※범위 외였음) | **이미 구현됨** | `MARKDOWN_NODE_KINDS=['concept','doc']`, `MARKDOWN_EDGE_KINDS=['governs','doc_link']`, `codegraph_backlinks` 도구 |
| **CRG Atom 1** — 엣지 신뢰도 | **부분 구현됨** | 합성 엣지 `provenance:'heuristic'` + `metadata.synthesizedBy`(extracted vs heuristic 이분) |
| **CRG Atom 2** — minimal-context 진입 | **부분 구현됨** | `codegraph_context`("call FIRST"), explore 예산 스케일링(`getExploreBudget`) |

**함의**: 사용자의 가정("모두 채택해 개발")은 사실상 **이미 절반은 끝난 상태에서 출발**한다. Headroom Atom 4는 이 브랜치의 존재 이유 그 자체(branch명 = Obsidian-Graph-Vector-DB, 최근 커밋 "query 시멘틱 폴백/백링크+시멘틱검색")이며, 로드맵 Priority-3 Track B의 **실체**다. 따라서 분석의 무게중심은 "무엇을 새로 짓나"가 아니라 **"무엇이 codegraph의 기능이 *맞고*, 무엇이 워크플로우/위키로 빠져야 하나"**의 분류에 있다.

---

## 1. As-Is — codegraph가 이미 가진 표면

```
src/index.ts            CodeGraph 클래스 (init/index/sync/search/context/findRelevantContext)
src/docs/               embed.ts · indexer.ts · search.ts · config.ts  ← 벡터/시맨틱 레이어 (Headroom A4)
src/db/                 sqlite-adapter(loadExtension=sqlite-vec) · queries · migrations
src/graph/              GraphTraverser(BFS impact radius) · GraphQueryManager  ← CRG A1 BFS
src/resolution/         callback-synthesizer 등 (provenance:'heuristic')      ← CRG A1 신뢰도
src/context/            findRelevantContext(하이브리드 검색, minScore=0.3)
src/mcp/tools.ts        ~11개 MCP 도구 등록 + getExploreBudget               ← CRG A2/A3 표적
types.ts                concept/doc 노드, governs/doc_link 엣지              ← CRG A6(범위 외)
```

핵심 문제(현황): (a) MCP 도구 11개가 **무조건 전부 등록**된다(allowlist 없음 → CRG A3·Seq A4가 지적한 고정 스키마 토큰). (b) 합성 엣지 신뢰도가 2분법(extracted/heuristic)이라 CRG A1의 3단계(EXTRACTED/INFERRED/AMBIGUOUS)보다 거칠다. (c) 새로 붙은 시맨틱 폴백이 "정직한가"(Headroom A7 no-silent-fallback) 미검증.

---

## 2. (Q1) 원자별 codegraph-기능화 분류 + 구현비용 내림차순

먼저 **"이게 codegraph의 기능이 맞는가"** 로 13원자를 3분류한다. codegraph는 *결정론적 AST 검색 인덱스*다 — 에이전트의 컨텍스트 조립/세션/추론 루프는 codegraph의 통제면이 아니다(CLAUDE.md "Adapt the tool to the agent — don't change the agent").

| 분류 | 원자 | 이유 |
|---|---|---|
| **A. codegraph 기능 맞음 (구현 대상)** | CRG1, CRG2, CRG3, HR1, HR2, HR3, HR4(완료), HR7 | 인덱스/검색/출력/결정성 — 정적 답을 더 좋게 |
| **B. codegraph 기능 아님 (워크플로우/하네스)** | HR5(프리픽스 KV캐시), HR6(세션 학습 루프), Seq1(사고 외재화=RIPER) | 에이전트 프롬프트·세션·추론 루프를 건드림 |
| **C. 코드 아님 (위키 노트/방법론)** | CRG4(벤치 정직성), Seq4(스키마 토큰 경고→CRG3로 흡수) | 구현할 "기능"이 없음 |

**구현비용 내림차순 (A분류, 전부 채택 가정 — 비싼 것부터):**

| # | 원자 | 비용 | codegraph 작업 내용 | fit |
|---|---|---|---|---|
| 1 | **HR6** learn 루프 | **HIGH** | 세션 로그 파서 + 실패/성공 상관 + 메모리 파일 안전 자동기입(+검토 게이트) | ★☆☆ (실은 B분류, 강행 시 최고비용) |
| 2 | **HR1** CCR 압축+retrieve | **MED-HIGH** | 모든 도구 출력에 압축 마커 삽입 + 상태저장 캐시(TTL) + `codegraph_retrieve(hash)` 신규 도구 | ★★☆ (retrieve-의존 손실 리스크) |
| 3 | **CRG2** minimal-context+턴예산 | **MED** | context의 ~100토큰 minimal 모드 + 턴 예산 메타데이터 | ★★☆ (예산 *강제*는 에이전트측=저살리언스 벽) |
| 4 | **HR2** SmartCrusher 트리밍 | **MED** | explore 출력 트리밍을 "통계적 이상치/시그니처 보존"으로 | ★☆☆ (코드는 로그형 아님, fit 낮음) |
| 5 | **HR3** 결정성 불변식+parity | **LOW-MED** | codegraph 출력 byte-equal parity 테스트 하네스 | ★★☆ (런타임 기능 아닌 테스트 인프라) |
| 6 | **CRG1** 3단계 엣지 신뢰도 | **LOW** | 기존 `provenance` 2분법 → 3단계 + trace/node 출력 노출 | ★★★ |
| 7 | **HR7** 정직한 시맨틱 폴백 | **LOW** | 기존 minScore=0.3 경로가 저신뢰 날조 안 하도록 하드닝(neutral 반환) | ★★★ (이 브랜치 신규 폴백 직격) |
| 8 | **CRG3** 도구 allowlist | **LOW** | `CODEGRAPH_TOOLS` env로 도구 등록 필터(1곳) | ★★★ |
| 9 | **HR4** sqlite-vec 메모리 | **~0** | **이미 구현됨** — Headroom은 비교 레퍼런스일 뿐 | ★★★ |
| — | CRG4 / HR5 / Seq1 / Seq4 | **N/A** | 코드 아님(C) 또는 codegraph 통제면 밖(B) | — |

---

## 3. (Q2) MCP 병립 시너지/역시너지 + 토큰 증가율

가정: CRG·Headroom·Sequential-Thinking을 **MCP로 codegraph와 동시 상주**시킨다.

| MCP | 시너지 | 역시너지 (치명적인 것 굵게) | 상시 토큰 |
|---|---|---|---|
| **CRG** | 같은 tree-sitter AST·SQLite 철학 | **codegraph와 기능 100% 중복 — 두 개의 AST 코드그래프 인덱스. 에이전트가 어느 도구 부를지 혼란. 중복에 내는 세금.** | ~8k/턴 (allowlist 시 ~1.2~2.4k) |
| **Sequential-Thinking** | 단계적 사고 외재화 | **RIPER가 이미 더 결정론적으로 제공 — 중복. 철학 충돌(훅 강제 vs 위임 종료)** | 스키마 ~600(+3%), 체인 실행 시 +12% |
| **Headroom** | 입력 압축(−40~92%) | LLM↔에이전트 사이 프록시 — codegraph(검색 인덱스)와 레이어가 다름. Rust 빌드+ML 모델+CCR 손실 | CCR 도구 +0.5%/턴 + 추론 레이턴시 |

**토큰 증가율 예측 (직접편입#1 대비):**

- **#1 직접편입 정상상태**: ~**0%/턴** (원자가 기존 도구 출력에 흡수되거나 오프라인·opt-in). CRG3 allowlist는 codegraph 자기 도구 스키마를 **줄이므로 오히려 음(−)**.
- **#2 MCP 병립**: 사용 전에도 **상시 스키마 오버헤드**가 붙는다.
  - allowlist 적용: CRG ~1.5k + SeqThinking ~0.6k ≈ **+2.1k/턴 고정**. 대표 누적 컨텍스트(~10~15k/턴) 기준 **+15~20%/턴**.
  - allowlist 미적용: CRG 풀 8k → **+50~70%/턴**.
  - SeqThinking 체인이 도는 턴엔 추가 **+12%** 스파이크. Headroom 프록시 운용 시 입력은 줄지만 CCR 손실·레이턴시 비용.

> **결론(Q2)**: 토큰만 보면 직접편입이 **압도적으로 우월**(+0% vs +15~70%). MCP 병립 비용의 대부분은 **codegraph와 겹치는 CRG에 내는 중복세**다. MCP를 따로 띄울 유일한 명분은 "codegraph에 흡수 불가능한 기능"(Headroom 프록시 압축, SeqThinking 추론 루프)뿐인데 — **그것들의 올바른 집은 상시 MCP가 아니라 워크플로우 프로젝트**다(§6).

---

## 4. 5축 비교 (try 필수 — 직접편입#1 vs MCP병립#2)

| 축 | #1 직접편입 (codegraph 기능화) | #2 MCP 병립 |
|---|---|---|
| **아키텍처 명확성** | 단일 인덱스·단일 진실원천. 레이어 경계 깨끗(검색=codegraph). | **두 개의 AST 그래프 = 순환적 권위 모호.** 에이전트 도구 선택 혼란 |
| **컴파일·빌드 영향** | codegraph 빌드만(`tsc`+wasm copy). HR4 의존성(@xenova) opt-in. parity 하네스 추가 시만 ↑ | 코드 빌드 0(외부 MCP). 단 Headroom=Rust+ML 런타임 도입 |
| **장기 유지보수** | 한 곳에 모임. sync-global로 전 설치본 자동 수혜. | 3개 MCP 버전·스키마 각각 추적. 업스트림 CRG 변경에 종속 |
| **단기 비용** | A6/HR4 완료 → CRG3·CRG1·HR7만 **저비용 즉시**. HR1/HR6는 큰 작업 | 설치·allowlist 설정·프록시 운용. 토큰 상시 +15~70% |
| **현재 작업 연관성** | **최상** — 이 브랜치가 시맨틱/벡터/백링크를 짓는 중. HR7·CRG1은 그 작업의 마감재 | 낮음 — 병립은 현재 브랜치 작업과 직교, 오히려 산만 |

---

## 5. (Q3) 적대적 검증 · 로드맵 정합성 · 우선도

**적대적 검증 (입국심사 결론 재심):** 세 입국심사 문서는 13원자 대부분을 **"+0% 개념추출(위키 노트)"** 로 판정했다. 사용자의 재프레이밍("codegraph 기능으로 구현")은 그 판정과 충돌한다 — 그리고 **입국심사가 옳다**:
- HR5/HR6/Seq1은 codegraph 통제면 밖(에이전트 프롬프트/세션/추론). codegraph에 넣으면 "도구로 에이전트를 바꾸려는" 안티패턴(검증됨: trace-first 스티어링조차 안 먹혔고 오히려 회귀).
- CRG4/Seq4는 코드가 아니라 교훈. HR2는 코드가 로그형이 아니라 fit 낮음.
- **즉 13원자를 전부 codegraph 기능으로 짓는 것은 과설계.** 진짜 codegraph 기능은 **CRG1·CRG3·HR7(+이미 된 HR4)** 의 좁은 집합뿐이고, 전부 **저비용**이다.

**로드맵 정합성:** 로드맵 §2.2(온디맨드 시맨틱 질의)·Priority-3 Track B(sqlite-vec 위키 벡터DB)는 **codegraph `src/docs/`로 이미 실체화 진행 중**. CRG1(신뢰도)·HR7(정직한 폴백)은 §4 "candor/reality check"(인덱스 오염→환각)와 §8.3(무결성 강제 훅)에 직결. CRG3는 §7(초미세토큰)·§1.2 원칙1(토큰 1급자원)에 직결. **고fit 원자들은 로드맵과 정합**하고, 저fit 원자들(HR5/6, Seq1)은 로드맵의 *워크플로우* 영역(§5~7 마스터마인드/에이전트 팀)에 속한다 — codegraph가 아니라.

**우선도 (구현비용 대비 도움):**

| 우선 | 원자 | 근거 |
|---|---|---|
| **P0 (즉시·저비용·고fit)** | CRG3 allowlist · HR7 정직한 폴백 · CRG1 3단계 신뢰도 | 전부 LOW 비용, 이 브랜치 작업의 마감재, 토큰·신뢰 즉효 |
| **P1 (완료/문서화)** | HR4 | 이미 됨 → Headroom 레퍼런스로 검증·기록만 |
| **P2 (조건부)** | CRG2 minimal 모드(강제 제외) · HR3 parity 하네스 | minimal *모드*만 OK, 턴예산 *강제*는 저살리언스라 보류 |
| **P3 (보류)** | HR1 CCR · HR2 SmartCrusher | 큰 작업 + fit/리스크 의문, 가치 입증 후 |
| **제외 (codegraph 아님)** | HR5 · HR6 · Seq1 → 워크플로우 / CRG4 · Seq4 → 위키 노트 | §6 참조 |

---

## 6. (Q4) 개발처 — codegraph DLC vs claude-personal-integrated-workflow

결정 원리(codegraph 자체 하우스룰): **"정적 인덱스가 더 좋은 답을 주는 것"은 codegraph. "에이전트의 컨텍스트 조립·세션·행동을 바꾸는 것"은 워크플로우.** codegraph는 저살리언스 채널로만 에이전트에 영향을 주며 *행동을 강제하지 않는다*. mdast/마크다운 레이어가 이미 codegraph에 실려 전역 배포(sync-global)되는 점이 이 경계를 더 또렷하게 한다.

| → **codegraph DLC** (sync-global 배포 수혜) | → **claude-personal-integrated-workflow** |
|---|---|
| HR4 (완료, 벡터 메모리) | HR5 CacheAligner (시스템 프롬프트 프리픽스 안정화 = 하네스) |
| CRG1 (엣지 신뢰도) | HR6 learn 루프 (세션 로그→메모리 파일 교정 = 워크플로우 메모리 편집) |
| CRG3 (도구 allowlist — codegraph 자기 MCP) | Seq1 사고 외재화 (= RIPER, 이미 존재) |
| HR7 (정직한 시맨틱 폴백) | CRG2 턴예산 *강제* (hook으로만 가능) |
| HR2/HR3 (출력 트리밍·parity — *짓는다면* 여기) | HR1 CCR 프록시 (*짓는다면* LLM 앞단 = 하네스) |
| CRG4/Seq4 → 위키 노트(둘 다 아닌 지식 레이어) | |

**판정(Q4)**: **레이어로 갈라서 둘 다 — 그러나 codegraph에 들어갈 것은 좁다.** codegraph DLC = 인덱스/검색/출력/결정성 원자(CRG1·CRG3·HR4·HR7). 그 외(HR5·HR6·Seq1·CRG2강제·HR1)는 워크플로우 프로젝트. **codegraph에 HR6/HR1/Seq1을 넣는 것은 정합성 위반**(검색 인덱스에 세션 학습·프록시·추론 루프를 얹는 것 = 단일책임 파괴, sync-global 배포본을 무겁게 함).

---

## 7. 종합 판결

1. **사용자 가정("13원자 전부 codegraph로 개발")은 권장하지 않음.** 진짜 codegraph 기능은 **CRG1·CRG3·HR7**(+ 이미 된 HR4)의 좁은 저비용 집합. 나머지는 워크플로우(HR5/6, Seq1, CRG2강제, HR1) 또는 위키 노트(CRG4, Seq4)다.
2. **MCP 병립은 토큰상 열위**(+15~70%/턴 vs 직접편입 +0%), 비용 대부분이 **CRG 중복세**. 상시 병립 비권장.
3. **즉시 착수 후보(P0, 전부 LOW)**: CRG3 allowlist → HR7 정직한 폴백 → CRG1 3단계 신뢰도. 셋 다 이 브랜치 작업의 자연스러운 마감재이고 로드맵 §4·§7·§8과 정합.
4. **개발처**: 인덱스성(CRG1/3/HR4/7) = codegraph DLC, 하네스성(HR5/6/Seq1/HR1/CRG2강제) = claude-personal-integrated-workflow.

## 8. 미결 사항 연계
- HR4가 "완료"인 범위 확정 필요: 시맨틱 폴백/백링크가 CLI·MCP 표면에 어디까지 노출됐는지(최근 커밋 기준) → HR7 착수 전 현 폴백 동작 1회 관찰 권장.
- P0 착수는 별도 결재 후 producer 경유. 본 문서는 분석만.
