# PLAN: 하이브리드 검색·엣지 영속화 + `.codegraphignore` 합집합/토글

**Branch:** Obsidian-Graph-Vector-DB
**Date:** 2026-06-15
**Status:** PLAN
**기준 문서:** `docs/try/try_001.md`(로드맵) + `docs/try/try_002.md`(제안 A)
**통합 보고서(Q1·Q2 검증 + 본 플랜 원본):** `docs/try/try_001_002_verification_and_riper_plan.md`
**승격:** 위 통합 보고서의 「RIPER 플랜」 섹션(§ line 98–246)을 EXECUTE 진입용 정식 아티팩트로 승격.

[MODE: PLAN] · 코드 미수정(명세만).

---

## 선행 검증 요약 (적대적, 실증 완료)

- **Q1**: 커밋 `d989071`("비 ASCII 커버")은 git `core.quotePath` 인코딩 수정(인덱싱/스캐너 계층)일 뿐 **FTS 무관**. try_001 §1.2-C의 "FTS5 unicode61 토크나이저" 귀인은 **오진**(in-memory FTS5 실증: `맥락 오염`→`"맥락"* OR "오염"*`→`["맥락_오염_방지"]` 매칭, unicode61이 `_`를 separator로 정상 토큰화). `[]`의 진짜 원인은 **노드 부재(인덱싱 누락)**. 문서 스캐너는 별도 커밋 `18dc323`(`-z` NUL-delimited + `core.quotepath=false`, `scan-files.ts:31`)에서 수정. → **ASCII 슬러그 마이그레이션은 다른 작업이며 불필요(폐기)**. 단 두 수정 모두 0.9.8 **미릴리스**(글로벌 0.9.8.1엔 포함).
- **Q2**: RX_1 실측(`codegraph_status` + node:sqlite: files 54 / nodes 1396 / edges 2680 / concept 20 / docs 83; `nodes`·`nodes_fts` 코드 렉시컬 평면 **그리고** `mdast_metadata`(83)·`mdast_vectors`(vec0) 문서 시멘틱 평면이 한 DB 공존) → To-Be `query` 시멘틱 폴백은 **thin + docsEnabled 게이트로 BLADE/RX_1 동시 사용 가능**. 단서: (a) 현 `query`는 렉시컬 전용(미구현 제안=Step 7), (b) 콜드스타트(MiniLM 로드 ~수초)는 thin-한정 게이트로 격리 필수, (c) docs off 프로젝트는 폴백 no-op → 순수 렉시컬 graceful degrade.

## 요구 1 확정 설계

- **제안 A 채용**: `.codegraphignore` = 기존 `.gitignore`에 얹는 **가산(추가 제외) 레이어**.
- **동일 로직**: `.gitignore`와 `.codegraphignore`는 **같은 gitignore 문법 + 같은 로더(`tryAdd`)**로 처리.
- **합집합 제외**: 두 파일을 동일 `ignore` 매처에 합류 → **둘 중 하나라도 매치하면 제외**(union). (last-match-wins로 내장기본·gitignore를 negation override 가능하나, git 빠른 경로의 re-include 한계 §1.3-C는 유지 — 가산/subtract 의미가 본체.)
- **gitignore 토글**: `respectGitignore` 옵션(+ CLI `--no-gitignore`)으로 루트 `.gitignore` 병합만 끌 수 있게. 끄면 내장기본 + `.codegraphignore`만 적용.
- **편입 위치**: try_001 **Phase 0**. (Q1 결론 반영: Phase 0의 "ASCII 슬러그 마이그레이션"은 폐기; "엣지 영속화"는 `678b0f1`로 이미 구현됨 → Phase 0은 *이 신규 ignore 작업* 중심 + 기존 수정 검증.)

## Scope Lock (전 스텝 공통 좌표 — codegraph 실측)

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

## Phase 0 — 인프라: `.codegraphignore` 합집합 + gitignore 토글 (요구 1) + 기존 수정 검증

### Step 1 — `buildDefaultIgnore` 확장: `.codegraphignore` 합집합 로드 + `respectGitignore` 토글
- **Symbol**: `buildDefaultIgnore`
- **CodeGraph**: `codegraph_node buildDefaultIgnore` → `src/extraction/index.ts:198-207`
- **File**: `D:\Fork\codegraph\src\extraction\index.ts`
- **Scope**: Lines 198-207 (참조 184-189)
- **BLK target**: [인프라 - 파일 스캐너]
- **Action**: replace (시그니처 + 본문)
- **내용**: `buildDefaultIgnore(rootDir, opts?: { respectGitignore?: boolean }): Ignore`.
  ① `DEFAULT_IGNORE_PATTERNS` 항상 add. ② `opts?.respectGitignore !== false`일 때만 루트 `.gitignore` add. ③ 루트 `.codegraphignore`를 **항상 마지막** add(동일 매처 = 제외 합집합). 두 파일은 공용 `tryAdd(ig, path)` 헬퍼로 동일 로직(존재 시 utf-8 읽어 add, 실패 무소음).
- **Success criterion**: `.codegraphignore`의 `*.gen.cs`가 인덱싱에서 제외; `respectGitignore:false`면 루트 `.gitignore` 무시(내장기본+codegraphignore만).

### Step 2 — `respectGitignore`를 3 소비처에 전파
- **Symbol**: `getGitVisibleFiles` / `scanDirectoryWalk` / `FileWatcher`
- **CodeGraph**: callers of `buildDefaultIgnore` → `:296`, `:529`, `src/sync/watcher.ts:173`
- **File**: `src\extraction\index.ts`, `src\sync\watcher.ts`
- **Scope**: 3 call-site + `scanDirectory`/`scanDirectoryAsync` 옵션 관통
- **BLK target**: [인프라 - 파일 스캐너]
- **Action**: replace (옵션 인자 통과; 기본값 true=하위호환)
- **내용**: chokepoint 1곳(Step 1) 덕에 옵션만 흘려보내면 git·워크·watcher 3경로 자동 일관(try_002 §1.3-B).
- **Success criterion**: 옵션 미지정 시 기존과 byte-동일; `respectGitignore:false` 지정 시 3경로 동일하게 .gitignore 미적용.

### Step 3 — 문서 스캐너에도 동일 합집합 적용
- **Symbol**: `listMarkdownFiles`
- **CodeGraph**: `codegraph_node listMarkdownFiles` → `src/docs/scan-files.ts`
- **File**: `src\docs\scan-files.ts`
- **Scope**: `git ls-files` 결과(:31~) 이후 필터에 공용 ignore 로더 적용
- **BLK target**: [인프라 - 문서 스캐너]
- **Action**: replace
- **내용**: extraction에서 `.codegraphignore` 로더를 export → scan-files가 import(방향 안전, try_002 §4). docs 인덱싱도 동일 제외 합집합. (사용자 §6-5 미결 = "docs 적용"으로 확정.)
- **Success criterion**: `.codegraphignore`에 `manage/secret.md` 추가 시 docs 인덱스(`mdast_metadata`)에서도 제외.

### Step 4 — CLI `--no-gitignore` 플래그 + `codegraph init` 스캐폴드
- **Symbol**: `query`/`index`/`sync` 커맨드, `init`
- **CodeGraph**: `src/bin/codegraph.ts` command 등록부, `src/directory.ts:83-105`
- **File**: `src\bin\codegraph.ts`, `src\directory.ts`
- **Scope**: index/sync action에 `--no-gitignore` 파싱 → `respectGitignore:false` 전달; init이 주석 `.codegraphignore` 생성
- **BLK target**: [인프라 - CLI]
- **Action**: insert
- **내용**: `--no-gitignore` → `respectGitignore:false`. `init`이 `.codegraph/.gitignore` 자동생성 패턴을 재사용해 주석 달린 `.codegraphignore` 스캐폴드 생성.
- **Success criterion**: `codegraph index --no-gitignore`가 루트 .gitignore 무시; `codegraph init`이 `.codegraphignore` 생성.

### Step 5 — 테스트 + CHANGELOG
- **File**: `__tests__/extraction.test.ts`, `__tests__/security.test.ts`, `CHANGELOG.md`
- **BLK target**: [테스트/문서]
- **Action**: append/insert
- **내용**: `.codegraphignore` 가산 제외·negation·`respectGitignore:false` 케이스(git 경로/워크 경로/watcher), docs 스캐너 제외 케이스. 우선순위표(내장기본 ↔ .gitignore ↔ .codegraphignore ↔ 중첩) 1개 문서화. `[Unreleased]`에 사용자향 항목.
- **Success criterion**: `npm test` 신규 통과 + 기존 ~13 scanDirectory assertion 회귀 0.

### Step 6 — 기존 비-ASCII·엣지 수정 재검증 (Q1·엣지 결론 반영, 코드 변경 없음)
- **CodeGraph**: `codegraph_status projectPath=BLADE`, node:sqlite 실측
- **File**: (검증 전용) BLADE/RX_1 인덱스
- **BLK target**: [검증]
- **Action**: verify
- **내용**: 글로벌 0.9.8.1로 BLADE 재인덱싱 → 한글 `.md`가 `mdast_metadata`/`nodes`에 진입(d989071+18dc323), `doc_link` 엣지 ≥1(678b0f1, §11.2 통과) 확인. ASCII 슬러그 마이그레이션은 **수행하지 않음(폐기)**.
- **Success criterion**: BLADE 한글 문서 노드 수 > 0, `edges`(doc_link) ≥ 1.

## Phase 1 — query 시멘틱 폴백 (제안 #2, 최고 레버리지)

### Step 7 — `query` action에 thin-fallback → `searchDocs` 병합
- **Symbol**: `query` action / `searchNodes` / `searchDocs` / `resolveDocsEnabled`
- **CodeGraph**: `src/bin/codegraph.ts:910`, `src/index.ts:760`, `src/docs/search.ts:111`
- **File**: `src\bin\codegraph.ts`
- **Scope**: query action(:910~) — 렉시컬 결과 후처리
- **BLK target**: [검색 - query 시멘틱화]
- **Action**: insert
- **내용**: `rawResults.length < THIN_THRESHOLD(예:3) && resolveDocsEnabled(db)`이면 `searchDocs(db, q, {topk:limit})` KNN 병합(렉시컬 우선, 시멘틱 보강 표식). 기존 게이트(`loadVecExtension`+`isEmbedAvailable`) 재사용, 미가용 시 무소음. 콜드스타트는 thin-한정으로 격리.
- **Success criterion**: BLADE/순수MD에서 `query "자연어"`가 비어있지 않게 반환(task1.md 빈쿼리 낭비 해소); RX_1 코드 쿼리는 폴백 미발동(회귀 0).

## Phase 2 — backlinks/docs를 CLI 표면으로 (제안 #1 표면)

### Step 8 — `codegraph backlinks <file>` / `codegraph docs <query>` 서브커맨드
- **Symbol**: `findBacklinks` / `searchDocs`
- **CodeGraph**: `src/docs/search.ts:262 / :111`
- **File**: `src\bin\codegraph.ts`
- **Scope**: 신규 command 2개 등록
- **BLK target**: [CLI - 그래프 표면]
- **Action**: insert
- **내용**: MCP 전용이던 `findBacklinks`/`searchDocs`를 CLI로 노출(스티어링이 아니라 *툴 표면*으로 우선권). 순수-MD 인덱스 감지 시 그래프 전이 결과 선두 노출.
- **Success criterion**: `codegraph backlinks character/인물_강은휘.md`가 백링크 반환; `codegraph docs "<q>"`가 시멘틱 hit 반환.

## Phase 3 — 정책 분기 (concept/doc-graph 게이트)

### Step 9 — BLADE(순수MD auto) vs RX_1(override) 게이트 정합·문서화
- **Symbol**: `isPureMarkdownProject` / `CODEGRAPH_DOC_GRAPH`
- **CodeGraph**: `src/docs/doc-links-linker.ts`, `src/docs/config.ts`
- **File**: (문서) `docs/`, (정합 확인) 해당 게이트
- **Scope**: 기존 하이브리드 게이트(`코드노드==0 && mdast>0` OR override) 정책 명문화
- **BLK target**: [정책]
- **Action**: verify/document
- **내용**: concept/doc-graph는 BLADE에서 auto, RX_1에서 override(기본 off) 유지. 혼합 프로젝트 기본 활성화는 Non-Goal. 단일 진실 우선순위·게이트 표 1개.
- **Success criterion**: 문서에 게이트 매트릭스 존재; RX_1 기본 동작 불변.

## Step 10 — 빌드·회귀·동기화
- **File**: 전체
- **BLK target**: [게이트]
- **Action**: verify
- **내용**: `npm run build` → 전체 `vitest`(회귀 0, 기존 알려진 Windows 실패 제외) → `sync-global-codegraph`(글로벌 bin EEXIST 주의).
- **Success criterion**: 빌드 그린 + 신규 테스트 통과 + 글로벌 해시 일치.

---

## 성공 기준 (전체)
1. `.codegraphignore` 합집합 제외가 git·워크·watcher·docs **4경로 일관**; `respectGitignore`/`--no-gitignore` 토글 동작.
2. `query` 시멘틱 폴백: 순수-MD 빈쿼리 낭비 해소 + RX_1 코드 쿼리 **회귀 0**.
3. 빌드 그린 + vitest 회귀 0.
4. BLADE: 비-ASCII 인덱싱(d989071+18dc323)·`doc_link` 엣지(678b0f1) 동작 실증.

## Non-Goals (스코프 제외)
- **한글→ASCII 슬러그 마이그레이션** — Q1 결론: 인-툴 수정으로 **불필요(폐기)**. (외부가 *릴리스 0.9.8*을 쓰면 두 수정이 미릴리스라 임시로만 유효.)
- **git 빠른 경로 포기한 re-include**(try_002 Phase 3, §1.3-C 고위험) — 수요 확인 전 보류.
- **tree-sitter markdown 전환** — regex 마감 확정([[try-treesitter-markdown-vs-regex]]).
- **혼합 프로젝트 doc-graph 기본 활성화** — override 유지.
- **CLI 콜드스타트 상시 임베딩** — thin-한정 폴백으로만.

## 미결 (사용자/구현 결정)
- THIN_THRESHOLD 값(기본 3 제안) · 시멘틱 결과 병합 랭킹 표식.
- `.codegraphignore` 위치(루트 공유 권장) · 우선순위 규칙 최종 확정(try_002 §6-2,3).
- 릴리스 시점(0.9.9?)에 비-ASCII 두 수정 포함 — 외부 사용자 한글 누락 해소.
