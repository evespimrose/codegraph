# try_001 / try_002 — 적대적 검증(Q1·Q2) + 통합 RIPER 플랜

> 작성일: 2026-06-15 · 브랜치: `Obsidian-Graph-Vector-DB`
> 입력: `docs/try/try_001.md`, `docs/try/try_002.md`, `D:\Fork\RX_1\.codegraph\codegraph.db`
> 검증 빌드: 글로벌 `codegraph 0.9.8.1` (이 브랜치 tip 동기화본) · 마지막 릴리스 `0.9.8`(2026-06-01, 두 비-ASCII 수정 모두 **미릴리스**)
> 검증 도구: git show/log, codegraph MCP(node/explore/status/search, projectPath=RX_1), node:sqlite 직접 실측(RX_1 db + in-memory FTS5 재현)

이 문서 한 장에 (1) 질문 1·2의 적대적 검증 결과와 (2) 요구 1을 반영한 RIPER 플랜을 모두 담는다.
RIPER 플랜은 동일 내용으로 `.claude/memory-bank/Obsidian-Graph-Vector-DB/plans/Obsidian-Graph-Vector-DB-2026-06-15-hybrid-search-codegraphignore.md` 에도 저장된다(EXECUTE 진입용 정식 아티팩트).

---

## 질문 1 — d989071 "비 ASCII 커버"는 try_001의 "FTS5 토크나이저 한글 처리"를 커버한 것인가? ASCII 슬러그 마이그레이션과 다른 작업인가? (적대적 검증)

### 결론 (3줄)
1. **d989071은 git `core.quotePath` 인코딩 버그(인덱싱/스캐너 계층)만 고쳤다. FTS는 한 줄도 안 건드렸다.**
2. **try_001 §1.2-C의 "FTS5 unicode61 토크나이저의 한글+언더스코어 처리" 귀인은 오진이다 — 실증으로 반증됨.** unicode61은 한글+언더스코어를 정상 토큰화한다. task1.md가 `[]`였던 진짜 이유는 **파일이 인덱싱조차 안 됐기 때문**.
3. **"비 ASCII 커버"(인-툴 수정) ≠ "ASCII 슬러그 마이그레이션"(볼트측 우회). 둘은 다른 작업이고, 인-툴 수정이 끝난 지금 슬러그 마이그레이션은 불필요하다.**

### 근거 A — d989071이 실제로 바꾼 것 (git show 실측)
커밋 `d989071fc7…`("비 ASCII 커버", 2026-06-11)의 diff는 `src/extraction/index.ts` 한 파일, git 호출 3곳에 `-c core.quotePath=false` 추가가 전부:

| 위치 | Before → After |
|---|---|
| `collectGitFiles` tracked `src/extraction/index.ts:230` | `git ls-files -c --recurse-submodules` → `git -c core.quotePath=false ls-files …` |
| `collectGitFiles` untracked `:241` | `git ls-files -o --exclude-standard` → `git -c core.quotePath=false ls-files …` |
| `getGitChangedFiles` `:322` | `git status --porcelain --no-renames` → `git -c core.quotePath=false status …` |

근본 원인: git 기본값 `core.quotePath=true`가 비-ASCII 파일명을 octal escape(`인물_강은휘.md` → `"\354\235\270\353\254\274_…"`)로 출력 → Node가 literal 백슬래시 문자열로 받음 → 실제 파일 경로와 불일치 → **DB에 노드/파일 진입 자체가 실패**. FTS5·토크나이저·schema는 무관.

### 근거 B — "FTS5 토크나이저" 귀인은 실증으로 반증 (적대적 핵심)
- RX_1 db 실측: `nodes_fts` DDL에 `tokenize=` 절이 **없음** → FTS5 **기본 토크나이저 = unicode61**(맞다). 그러나 unicode61이 한글을 못 다룬다는 전제가 틀렸다.
- in-memory FTS5(동일 DDL, 기본 토크나이저)에 `맥락_오염_방지`·`인물_강은휘`·`지명_낙양` 삽입 후, **searchNodesFTS의 실제 쿼리 생성 로직**(`src/db/queries.ts:962-970`)을 그대로 재현한 결과:

| 입력(쿼리) | 빌드된 FTS MATCH | 결과 |
|---|---|---|
| `맥락 오염` (task1.md에서 `[]`였던 그것) | `"맥락"* OR "오염"*` | **`["맥락_오염_방지"]` ✓** |
| `맥락` | `"맥락"*` | `["맥락_오염_방지"]` ✓ |
| `강은휘` | `"강은휘"*` | `["인물_강은휘"]` ✓ |
| `지명 낙양` | `"지명"* OR "낙양"*` | `["지명_낙양"]` ✓ |

→ unicode61은 `_`를 separator로 처리해 `맥락_오염_방지`를 `[맥락,오염,방지]`로 토큰화하고, 한글 토큰을 정확히 매칭한다. **토크나이저는 처음부터 문제가 아니었다.** `[]`의 원인은 노드 부재(인덱싱 누락)였고, 그것은 근거 A로 해소됐다.
- 원전 `docs/codegraph-analysis.md`(try_001이 부록 B로 인용)조차 원인을 **"파일 스캐너의 유니코드 처리 버그(NFC/NFD 또는 glob 필터링)"**로 적었지 FTS라고 한 적 없다(line 114). "FTS5 unicode61 토크나이저" 표현은 try_001이 덧붙인 것이며 사실과 다르다.

### 근거 C — "비 ASCII 커버" ≠ "ASCII 슬러그 마이그레이션"
- d989071 = **인-툴 수정**(codegraph가 git 출력을 올바르게 디코딩) = 분석 doc의 "대안 A(도구 수정)".
- ASCII 슬러그 마이그레이션 = **볼트측 rename 우회**(`인물_강은휘.md`→`char_kang-eunhwi.md`, 한글은 frontmatter `title:`+옵시디언 `aliases:`로 보존) = 분석 doc의 "대안 B".
- 분석 doc 자체가 "A·B 병행 가능 / **추후 codegraph가 유니코드를 지원하면 ASCII 슬러그를 한글로 되돌리면 된다**"(line 318)고 명시 → **A가 완료되면 B는 폐기 가능**.

### 적대적 추가 발견 — 커버리지가 두 커밋으로 쪼개져 있다
- d989071은 **코드 추출 스캐너**(`src/extraction/index.ts`)만 고쳤다. 순수-MD(BLADE)가 실제로 쓰는 **문서 스캐너 `src/docs/scan-files.ts`**(`listMarkdownFiles`→`indexMarkdown`)는 **별도 커밋 `18dc323`("스캔 로직 변경")**에서 `-z`(NUL-delimited, escape 자체가 발생 안 함) + `core.quotepath=false`로 수정됐다(`scan-files.ts:31`).
- 타임라인: `0.9.8` 릴리스(06-01) → `d989071`(코드 스캐너) → `18dc323`(문서 스캐너). **두 수정 모두 0.9.8 릴리스엔 없다(이 브랜치 한정, 글로벌 0.9.8.1엔 포함).** 즉 *릴리스 버전을 쓰는 외부 사용자*에겐 아직 한글 누락이 남아 있다.
- 문서 레이어도 한글 1급 시민화 확인: `src/docs/search.ts:259-260` `findBacklinks`가 `[[인물_강은휘]]` basename 매칭을 명시 처리.

### Q1 최종 판정
- "커버된 거 아니냐?" → **인덱싱 누락(진짜 원인)은 커버됐다**(코드=d989071, 문서=18dc323). **단 "FTS5 토크나이저"라는 프레이밍 자체가 오진**이며 그건 커버할 대상이 아니었다(애초에 정상).
- "ASCII 슬러그 마이그레이션과 다른 작업이냐?" → **그렇다. 명백히 다른 작업이고, 인-툴 수정이 끝나 더는 필요 없다.**
- **플랜 영향**: try_001 Phase 0의 "①한글→ASCII 슬러그 마이그레이션" 항목은 **폐기(Non-Goal)** 처리. 단, 두 수정이 *미릴리스*라는 점만 릴리스 시 주의.

---

## 질문 2 — To-Be의 `query "자연어" → searchNodes(렉시컬)` 구조가 순수-MD(BLADE)와 정상(RX_1)에서 동시 사용 가능한가?

### 결론
**예 — 설계상 프로젝트 유형 무관(조건부 시멘틱 폴백 게이트)이라 동시 사용 가능하다.** 단 세 단서: (a) 현재는 **미구현 제안**(현 `query`는 렉시컬 전용), (b) thin 쿼리 콜드스타트(임베딩 모델 로드 ~수초) 비용은 **RX_1에도 적용**, (c) docs 비활성 프로젝트에선 폴백이 무소음 no-op → 순수 렉시컬로 graceful degrade.

### 근거 — RX_1 db 실측 (정상 프로젝트도 두 평면을 동시 보유)
`codegraph_status`(projectPath=RX_1) + node:sqlite 직접 조회:
- files **54** / nodes **1396**(csharp 1270, js 94, markdown 20, python 12) / edges **2680** / concept **20**(BLK-XXX) / **docs indexed 83**.
- 테이블 실측: `nodes`·`nodes_fts`(코드 렉시컬 평면) **그리고** `mdast_metadata`(83) + `mdast_vectors`(vec0) (문서 시멘틱 평면)이 **한 DB에 공존**. sqlite-vec가 node:sqlite에서 로드됨(83 indexed가 증거).
- 즉 **정상 프로젝트(RX_1)도 코드 FTS + doc 벡터를 동시에 들고 있다.** BLADE는 doc 평면만(nodes=0).

### To-Be 동작과 분기 (try_001 §2.1)
```
query "<자연어>" → searchNodes(렉시컬)
                     │ results.length < THIN_THRESHOLD  &&  resolveDocsEnabled(db)
                     └─fallback→ searchDocs(sqlite-vec KNN)  [+ backlink 1~2홉 부착]
```
| 프로젝트 | 시나리오 | 동작 |
|---|---|---|
| RX_1(정상) | 코드 심볼 쿼리 | searchNodes 풍부 → thin 미발동 → **렉시컬 그대로(회귀 0)** |
| RX_1(정상) | 자연어/노히트 쿼리 | thin + docs on → **시멘틱 폴백 발동** → doc hit |
| BLADE(순수MD) | 무엇이든 | nodes=0 → 항상 thin → **폴백이 주 경로** |
| docs off 프로젝트 | 무엇이든 | 폴백 no-op → **순수 렉시컬 graceful** |

동일 진입점(`query`)이 **게이트(thin + docsEnabled)로 분기**하므로 두 프로젝트 유형에서 동시 사용 가능하다. 게이트는 CLAUDE.md 도그마("에이전트가 이미 부르는 query가 더 많은 일을 하게")에 정합.

### 적대적 단서
- 현 `query`(`src/bin/codegraph.ts:891`, action `:910` = `cg.searchNodes`)는 **렉시컬 전용** — To-Be는 제안일 뿐 미구현(= Phase 1 Step 7).
- **콜드스타트(高)**: CLI 일회성 프로세스는 폴백 발동마다 MiniLM 로드. RX_1의 thin 코드 쿼리(오타·자연어)도 폴백을 건드리면 동일 비용 → **thin-한정 게이트로 격리 필수**.
- **THIN_THRESHOLD 튜닝**: 너무 높으면 정상 코드 쿼리도 폴백 → RX_1 회귀. 낮게(예: `<3`) 설정.

### Q2 최종 판정
동시 사용 **가능**하며, RX_1이 "코드+docs 공존"을 실측으로 증명한다. 구현 시 thin-한정 게이트 + 낮은 임계값으로 RX_1 회귀와 콜드스타트를 차단하면 된다.

---

## RIPER 플랜 — try_001 로드맵 + try_002 제안 A(요구 1) 편입

[MODE: PLAN] · 코드 미수정(명세만).

### 요구 1 해석 (확정 설계)
- **제안 A 채용**: `.codegraphignore`를 기존 `.gitignore`에 얹는 **가산(추가 제외) 레이어**.
- **동일 로직**: `.gitignore`와 `.codegraphignore`는 **같은 gitignore 문법 + 같은 로더(`tryAdd`)**로 처리.
- **합집합 제외**: 두 파일을 동일 `ignore` 매처에 합류 → **둘 중 하나라도 매치하면 제외**(union). (last-match-wins로 내장기본·gitignore를 negation override 가능하나, git 빠른 경로의 re-include 한계 §1.3-C는 유지 — 가산/subtract 의미가 본체.)
- **gitignore 토글**: `respectGitignore` 옵션(+ CLI `--no-gitignore`)으로 루트 `.gitignore` 병합만 끌 수 있게. 끄면 내장기본 + `.codegraphignore`만 적용.
- **편입 위치**: try_001 Phase 0. (Q1 결론 반영: Phase 0의 "ASCII 슬러그 마이그레이션"은 폐기; "엣지 영속화"는 `678b0f1`로 이미 구현됨 → Phase 0은 *이 신규 ignore 작업* 중심 + 기존 수정 검증.)

### Scope Lock (전 스텝 공통 좌표 — codegraph 실측)
| 심볼 | 파일:라인 |
|---|---|
| `buildDefaultIgnore` (chokepoint) | `src/extraction/index.ts:198-207` |
| `DEFAULT_IGNORE_PATTERNS` | `src/extraction/index.ts:184-189` |
| 소비처 ① getGitVisibleFiles | `src/extraction/index.ts:296` |
| 소비처 ② scanDirectoryWalk | `src/extraction/index.ts:529` |
| 소비처 ③ FileWatcher | `src/sync/watcher.ts:173` |
| 문서 스캐너 listMarkdownFiles | `src/docs/scan-files.ts:31` |
| `query` 커맨드 / action | `src/bin/codegraph.ts:891 / :910` |
| `searchNodes` | `src/index.ts:760` |
| `searchDocs` / `findBacklinks` | `src/docs/search.ts:111 / :262` |
| `resolveDocsEnabled` / `isEmbedAvailable` / `loadVecExtension` | `src/docs/config.ts` / `src/docs/embed.ts:59` / `src/docs/vec.ts` |
| init `.codegraph/.gitignore` 스캐폴드 패턴 | `src/directory.ts:83-105` |

---

### Phase 0 — 인프라: `.codegraphignore` 합집합 + gitignore 토글 (요구 1) + 기존 수정 검증

#### Step 1 — `buildDefaultIgnore` 확장: `.codegraphignore` 합집합 로드 + `respectGitignore` 토글
- **Symbol**: `buildDefaultIgnore`
- **CodeGraph**: `codegraph_node buildDefaultIgnore` → `src/extraction/index.ts:198-207`
- **File**: `D:\Fork\codegraph\src\extraction\index.ts`
- **Scope**: Lines 198-207 (참조 184-189)
- **BLK target**: [인프라 - 파일 스캐너]
- **Action**: replace (시그니처 + 본문)
- **내용**: `buildDefaultIgnore(rootDir, opts?: { respectGitignore?: boolean }): Ignore`.
  ① `DEFAULT_IGNORE_PATTERNS` 항상 add. ② `opts?.respectGitignore !== false`일 때만 루트 `.gitignore` add. ③ 루트 `.codegraphignore`를 **항상 마지막** add(동일 매처 = 제외 합집합). 두 파일은 공용 `tryAdd(ig, path)` 헬퍼로 동일 로직(존재 시 utf-8 읽어 add, 실패 무소음).
- **Success criterion**: `.codegraphignore`의 `*.gen.cs`가 인덱싱에서 제외; `respectGitignore:false`면 루트 `.gitignore` 무시(내장기본+codegraphignore만).

#### Step 2 — `respectGitignore`를 3 소비처에 전파
- **Symbol**: `getGitVisibleFiles` / `scanDirectoryWalk` / `FileWatcher`
- **CodeGraph**: grep `buildDefaultIgnore` → `:296`, `:529`, `src/sync/watcher.ts:173`
- **File**: `src\extraction\index.ts`, `src\sync\watcher.ts`
- **Scope**: 3 call-site + `scanDirectory`/`scanDirectoryAsync` 옵션 관통
- **BLK target**: [인프라 - 파일 스캐너]
- **Action**: replace (옵션 인자 통과; 기본값 true=하위호환)
- **내용**: chokepoint 1곳(Step 1) 덕에 옵션만 흘려보내면 git·워크·watcher 3경로 자동 일관(try_002 §1.3-B).
- **Success criterion**: 옵션 미지정 시 기존과 byte-동일; `respectGitignore:false` 지정 시 3경로 동일하게 .gitignore 미적용.

#### Step 3 — 문서 스캐너에도 동일 합집합 적용
- **Symbol**: `listMarkdownFiles`
- **CodeGraph**: `codegraph_node listMarkdownFiles` → `src/docs/scan-files.ts`
- **File**: `src\docs\scan-files.ts`
- **Scope**: `git ls-files` 결과(:31~) 이후 필터에 공용 ignore 로더 적용
- **BLK target**: [인프라 - 문서 스캐너]
- **Action**: replace
- **내용**: extraction에서 `.codegraphignore` 로더를 export → scan-files가 import(방향 안전, try_002 §4). docs 인덱싱도 동일 제외 합집합. (사용자 §6-5 미결 = "docs 적용"으로 확정.)
- **Success criterion**: `.codegraphignore`에 `manage/secret.md` 추가 시 docs 인덱스(`mdast_metadata`)에서도 제외.

#### Step 4 — CLI `--no-gitignore` 플래그 + `codegraph init` 스캐폴드
- **Symbol**: `query`/`index`/`sync` 커맨드, `init`
- **CodeGraph**: `src/bin/codegraph.ts` command 등록부, `src/directory.ts:83-105`
- **File**: `src\bin\codegraph.ts`, `src\directory.ts`
- **Scope**: index/sync action에 `--no-gitignore` 파싱 → `respectGitignore:false` 전달; init이 주석 `.codegraphignore` 생성
- **BLK target**: [인프라 - CLI]
- **Action**: insert
- **내용**: `--no-gitignore` → `respectGitignore:false`. `init`이 `.codegraph/.gitignore` 자동생성 패턴을 재사용해 주석 달린 `.codegraphignore` 스캐폴드 생성.
- **Success criterion**: `codegraph index --no-gitignore`가 루트 .gitignore 무시; `codegraph init`이 `.codegraphignore` 생성.

#### Step 5 — 테스트 + CHANGELOG
- **File**: `__tests__/extraction.test.ts`, `__tests__/security.test.ts`, `CHANGELOG.md`
- **BLK target**: [테스트/문서]
- **Action**: append/insert
- **내용**: `.codegraphignore` 가산 제외·negation·`respectGitignore:false` 케이스(git 경로/워크 경로/watcher), docs 스캐너 제외 케이스. 우선순위표(내장기본 ↔ .gitignore ↔ .codegraphignore ↔ 중첩) 1개 문서화. `[Unreleased]`에 사용자향 항목.
- **Success criterion**: `npm test` 신규 통과 + 기존 ~13 scanDirectory assertion 회귀 0.

#### Step 6 — 기존 비-ASCII·엣지 수정 재검증 (Q1·엣지 결론 반영, 코드 변경 없음)
- **CodeGraph**: `codegraph_status projectPath=BLADE`, node:sqlite 실측
- **File**: (검증 전용) BLADE/RX_1 인덱스
- **BLK target**: [검증]
- **Action**: verify
- **내용**: 글로벌 0.9.8.1로 BLADE 재인덱싱 → 한글 `.md`가 `mdast_metadata`/`nodes`에 진입(d989071+18dc323), `doc_link` 엣지 ≥1(678b0f1, §11.2 통과) 확인. ASCII 슬러그 마이그레이션은 **수행하지 않음(폐기)**.
- **Success criterion**: BLADE 한글 문서 노드 수 > 0, `edges`(doc_link) ≥ 1.

### Phase 1 — query 시멘틱 폴백 (제안 #2, 최고 레버리지)

#### Step 7 — `query` action에 thin-fallback → `searchDocs` 병합
- **Symbol**: `query` action / `searchNodes` / `searchDocs` / `resolveDocsEnabled`
- **CodeGraph**: `src/bin/codegraph.ts:910`, `src/index.ts:760`, `src/docs/search.ts:111`
- **File**: `src\bin\codegraph.ts`
- **Scope**: query action(:910~) — 렉시컬 결과 후처리
- **BLK target**: [검색 - query 시멘틱화]
- **Action**: insert
- **내용**: `rawResults.length < THIN_THRESHOLD(예:3) && resolveDocsEnabled(db)`이면 `searchDocs(db, q, {topk:limit})` KNN 병합(렉시컬 우선, 시멘틱 보강 표식). 기존 게이트(`loadVecExtension`+`isEmbedAvailable`) 재사용, 미가용 시 무소음. 콜드스타트는 thin-한정으로 격리.
- **Success criterion**: BLADE/순수MD에서 `query "자연어"`가 비어있지 않게 반환(task1.md 빈쿼리 낭비 해소); RX_1 코드 쿼리는 폴백 미발동(회귀 0).

### Phase 2 — backlinks/docs를 CLI 표면으로 (제안 #1 표면)

#### Step 8 — `codegraph backlinks <file>` / `codegraph docs <query>` 서브커맨드
- **Symbol**: `findBacklinks` / `searchDocs`
- **CodeGraph**: `src/docs/search.ts:262 / :111`
- **File**: `src\bin\codegraph.ts`
- **Scope**: 신규 command 2개 등록
- **BLK target**: [CLI - 그래프 표면]
- **Action**: insert
- **내용**: MCP 전용이던 `findBacklinks`/`searchDocs`를 CLI로 노출(스티어링이 아니라 *툴 표면*으로 우선권). 순수-MD 인덱스 감지 시 그래프 전이 결과 선두 노출.
- **Success criterion**: `codegraph backlinks character/인물_강은휘.md`가 백링크 반환; `codegraph docs "<q>"`가 시멘틱 hit 반환.

### Phase 3 — 정책 분기 (concept/doc-graph 게이트)

#### Step 9 — BLADE(순수MD auto) vs RX_1(override) 게이트 정합·문서화
- **Symbol**: `isPureMarkdownProject` / `CODEGRAPH_DOC_GRAPH`
- **CodeGraph**: `src/docs/doc-links-linker.ts`, `src/docs/config.ts`
- **File**: (문서) `docs/`, (정합 확인) 해당 게이트
- **Scope**: 기존 하이브리드 게이트(`코드노드==0 && mdast>0` OR override) 정책 명문화
- **BLK target**: [정책]
- **Action**: verify/document
- **내용**: concept/doc-graph는 BLADE에서 auto, RX_1에서 override(기본 off) 유지. 혼합 프로젝트 기본 활성화는 Non-Goal. 단일 진실 우선순위·게이트 표 1개.
- **Success criterion**: 문서에 게이트 매트릭스 존재; RX_1 기본 동작 불변.

### Step 10 — 빌드·회귀·동기화
- **File**: 전체
- **BLK target**: [게이트]
- **Action**: verify
- **내용**: `npm run build` → 전체 `vitest`(회귀 0, 기존 알려진 Windows 실패 제외) → `sync-global-codegraph`(글로벌 bin EEXIST 주의).
- **Success criterion**: 빌드 그린 + 신규 테스트 통과 + 글로벌 해시 일치.

---

### 성공 기준 (전체)
1. `.codegraphignore` 합집합 제외가 git·워크·watcher·docs **4경로 일관**; `respectGitignore`/`--no-gitignore` 토글 동작.
2. `query` 시멘틱 폴백: 순수-MD 빈쿼리 낭비 해소 + RX_1 코드 쿼리 **회귀 0**.
3. 빌드 그린 + vitest 회귀 0.
4. BLADE: 비-ASCII 인덱싱(d989071+18dc323)·`doc_link` 엣지(678b0f1) 동작 실증.

### Non-Goals (스코프 제외)
- **한글→ASCII 슬러그 마이그레이션** — Q1 결론: 인-툴 수정으로 **불필요(폐기)**. (외부가 *릴리스 0.9.8*을 쓰면 두 수정이 미릴리스라 임시로만 유효.)
- **git 빠른 경로 포기한 re-include**(try_002 Phase 3, §1.3-C 고위험) — 수요 확인 전 보류.
- **tree-sitter markdown 전환** — regex 마감 확정([[try-treesitter-markdown-vs-regex]]).
- **혼합 프로젝트 doc-graph 기본 활성화** — override 유지.
- **CLI 콜드스타트 상시 임베딩** — thin-한정 폴백으로만.

### 미결 (사용자/구현 결정)
- THIN_THRESHOLD 값(기본 3 제안) · 시멘틱 결과 병합 랭킹 표식.
- `.codegraphignore` 위치(루트 공유 권장) · 우선순위 규칙 최종 확정(try_002 §6-2,3).
- 릴리스 시점(0.9.9?)에 비-ASCII 두 수정 포함 — 외부 사용자 한글 누락 해소.
