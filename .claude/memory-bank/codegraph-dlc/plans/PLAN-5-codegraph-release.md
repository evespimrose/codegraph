# PLAN-5 — Codegraph npm 릴리즈 + Claude/Codex 마켓플레이스 실행 (R1 병합·범프 포함)
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선. 각 스텝 Scope 범위만 Read(offset+limit). -->
발부: 2026-07-07 (Fable 5, PLAN-1~4 REVIEW R1·R4 후속) · 실행 세션: **codegraph 로컬 개발 레포 단독 세션**
실행 모델: Haiku 4.5 · EXECUTOR CONTRACT: [PLAN-0-INDEX.md](PLAN-0-INDEX.md) 준수 (스텝 밖·타 레포 접근 금지, 승인게이트, 검증 의무, STOP 조건)
점화 시 사용자 첨부: PLAN-2 실행 보고 요지 + REVIEW의 R1 단락(버전-바이너리 정합성 붕괴 증거 체인).
경로 규약: `<repo>/` = codegraph 레포 루트.

## 절대 경계 (이 레포 하우스룰 — 위반 = 즉시 STOP)

- **`npm publish` / `git push` / `git tag` 직접 실행 금지.** 릴리즈는 GitHub Actions "Release" 워크플로로만 — 수동 publish는 non-bundled 루트 패키지를 쏴서 Node<22.5 사용자를 깨뜨림. 실행자는 파일 작성·로컬 커밋·검증까지, **공유 상태 변경(푸시·트리거)은 전부 사용자 핸드오프**.
- CHANGELOG는 `[Unreleased]`에만 기입, `[X.Y.Z]` 블록 사전 생성 금지(prepare-release.mjs가 승격).
- 버전 범프는 사용자 결재 스텝에서만(이 플랜은 사용자가 릴리즈를 명시 발주했으므로 결재 후 package.json 1파일 수정 허용 — 워크플로가 lock 동기화).
- 검증은 **버전 문자열 신뢰 금지, 기능 프로브 우선** (R1 교훈).

## 배경 (첨부 보고 기반 — 재조사 금지)

- PLAN-2 산출(stale 배너·launch log·설치기 절대경로·retire 정책·**md 삭제 조정**)은 `codegraph-dlc` 브랜치에 존재. main 포함 여부 미확정.
- R1 확정: 전역/데몬에 "수정 미포함인데 버전은 높은(0.9.8.3)" 바이너리가 재등장한 이력 → 병합+범프로 "버전 ≥ 신버전 = 수정 포함"을 성립시켜야 함.
- 마켓플레이스 설계 정본: `<repo>/docs/design/marketplace-distribution.md` (PLAN-2 Step 8 산출) — **본 플랜의 패키징 세부는 이 문서가 SSOT**. 플랜과 충돌 시 설계 문서 우선, 단 충돌 사실은 보고에 기재.
- npm 패키지명 `@evespimrose/codegraph`. 릴리즈 워크플로: 버전 범프 → Actions Release 트리거 → prepare-release·번들·GitHub Release·npm thin-installer 발행(NPM_TOKEN 필요).

## Steps (10)

### Step 0 선행 자가검증 (기능 프로브 — 버전 문자열 판단 금지)
- **BLK target**: [인프라]
- **Action**: 기록: (a) `git branch --show-current`·`git status --porcelain`(더러우면 STOP), (b) `git branch --merged main | grep codegraph-dlc`로 병합 여부, (c) `git log --oneline -5 main`·`-5 codegraph-dlc`, (d) `npm view @evespimrose/codegraph version`(공개 최신), (e) 현재 package.json version, (f) **기능 프로브**: main HEAD에 md 삭제 조정 코드 존재 확인 — `codegraph_search "removed"` 또는 src/docs/indexer.ts의 삭제 조정 블록 grep(단일 파일).
- **Success criterion**: 6항 기록. main에 이미 병합돼 있으면 Step 1을 "확인만"으로 축소.

### Step 1 [승인게이트] codegraph-dlc → main 로컬 병합 (R1 해소 1/2)
- **File**: git 병합 (소스 파일 직접 편집 없음 — 충돌 시 STOP·사용자 에스컬레이션)
- **BLK target**: [인프라]
- **Action**: `git checkout main && git merge --no-ff codegraph-dlc` (로컬만). 충돌 0 전제 — 충돌 발생 시 즉시 STOP(해소 판단은 사용자). 병합 후 격리 스위트 재실행: cross-project-staleness·installer-targets·mcp-daemon·watcher + `tsc --noEmit`.
- **Success criterion**: 병합 커밋 존재 + 격리 스위트 전부 pass(PLAN-2 보고 수치와 동일 수준) + Step 0-(f) 프로브가 main에서 성립.

### Step 2 [사용자결재] 버전 범프 (R1 해소 2/2)
- **File**: `<repo>/package.json`
- **Scope**: `"version"` 1행
- **BLK target**: [인프라]
- **Action**: 사용자에게 버전 결재 요청 — 권고 **0.9.9.0**(기능성 변경 포함: stale 배너·launch log·설치기 절대경로·retire; 최소선 0.9.8.4 — 공개 0.9.8.3 초과 필수). 결재값으로 package.json만 수정(lock은 워크플로가 동기), 로컬 커밋.
- **Success criterion**: package.json version > `npm view` 공개 버전, 커밋 존재.

### Step 3 CHANGELOG [Unreleased] 최종 점검
- **File**: `<repo>/CHANGELOG.md`
- **Scope**: `## [Unreleased]` 섹션만
- **BLK target**: [인프라]
- **Action**: PLAN-2 기입 6항 존재 확인 + Step 4에서 플러그인 배포가 이번 릴리즈에 포함되면 사용자향 1항 추가(내부 경로·심볼 금지). 버전 블록 미생성 유지.
- **Success criterion**: [Unreleased]에 릴리즈 대상 전 항목 존재, `## [X.Y.Z]` 신규 블록 0.

### Step 4 [승인게이트] Claude Code 플러그인 패키징 구현
- **File**: `<repo>/docs/design/marketplace-distribution.md`(정본 — 먼저 Read) 기반, [NEW-BLK] `.claude-plugin/plugin.json`(+ 설계 문서가 지정하는 마켓플레이스 매니페스트·MCP 서버 정의 파일)
- **BLK target**: [NEW-BLK]
- **Action**: 설계 문서의 구조대로 플러그인 매니페스트 작성 — MCP 서버 동봉(`.mcp.json` 수동 배선·PATH 의존 해소가 목적). MCP command 해석 방식(번들 바이너리 vs npx)은 설계 문서 규정을 따르고, 문서가 미규정이면 STOP 후 사용자 결재. **훅/커맨드 스키마: 단일 command 문자열, `args` 배열 금지 함정 재확인**(플러그인 mcpServers 스키마는 args 허용 — 혼동 금지, 스키마별 규격 준수).
- **Success criterion**: 매니페스트 JSON 유효(파서 검증) + 설계 문서의 필수 요소 체크리스트 전항 충족.

### Step 5 플러그인 로컬 검증
- **BLK target**: [인프라]
- **Action**: `claude plugin --help`로 로컬 검증 커맨드 존재 확인 → 있으면 `claude plugin validate` 실행. 없으면 수동 검증: 매니페스트 스키마 대조 + 로컬 마켓플레이스 add/install 테스트 절차를 사용자 체크리스트로 문서화(실행자가 인터랙티브 `/plugin` 불가한 항목은 핸드오프).
- **Success criterion**: validate pass 또는 수동 체크리스트 완비(보고 첨부).

### Step 6 [사용자결재·핸드오프] 푸시 + Release 워크플로 트리거
- **BLK target**: [인프라]
- **Action**: 사용자에게 정확한 커맨드 순서 핸드오프: (1) `git push origin main`(병합+범프+플러그인 커밋), (2) GitHub Actions → Release → Run workflow (on main), (3) NPM_TOKEN 시크릿 존재 사전 확인 안내. 실행자는 대기 — 사용자가 "트리거 완료" 응답 후 Step 7 진행. 응답 전 진행 금지.
- **Success criterion**: 핸드오프 메시지에 3항 + 예상 산출(GitHub Release·npm 신버전) 명시.

### Step 7 릴리즈 결과 검증 (읽기 전용)
- **BLK target**: [인프라]
- **Action**: (a) `npm view @evespimrose/codegraph version` = Step 2 결재 버전, (b) `gh release view v<버전>`(또는 `gh release list | head -3`)으로 GitHub Release 존재·노트가 CHANGELOG 승격분과 일치, (c) 레포 main에 prepare-release 자동 커밋(CHANGELOG 승격·lock 동기) 반영 확인(`git pull` 후 log). 실패 시 1회 재확인(전파 지연 5분 대기 허용) 후 STOP.
- **Success criterion**: 3항 전부 일치.

### Step 8 전역 재동기 + 기능 프로브 (R1 종결 검증)
- **BLK target**: [인프라]
- **Action**: (a) `npm install -g @evespimrose/codegraph@<신버전>` — 이번엔 로컬 pack이 아닌 **공개 npm 기준**으로 전역 통일. (b) **기능 프로브 3종**: 임시 docs-on 프로젝트에서 md 생성→검색 hit / 삭제→sync→검색 miss(삭제 조정 동작 = R1·R2 연동 실증) / `.codegraph/mcp-launch.log` 1행 생성. (c) 기존 데몬에 retire 승계 로그 확인(daemon.log — 구데몬 잔존 시).
- **Success criterion**: 프로브 3종 전부 pass. **삭제 프로브 pass 시 보고에 "R2 재조사 전제 충족·로드맵 §8.3 승격 가능" 신호 기재.**

### Step 9 [사용자결재·핸드오프] 마켓플레이스 공개 + Codex 대응
- **BLK target**: [인프라]
- **Action**: (a) 플러그인/마켓플레이스 레포 푸시는 사용자 핸드오프 → 공개 후 사용자가 임의 프로젝트에서 `/plugin marketplace add` + `/plugin install codegraph` 1회 테스트하는 체크리스트 제공(성공 기준: `.mcp.json` 없이 codegraph_* 툴 로드). (b) Codex marketplace 대응은 설계 문서의 해당 절차를 핸드오프 항목으로 정리(실행 가능분만 이 세션에서 준비). 
- **Success criterion**: 핸드오프 체크리스트 2건(Claude/Codex) 보고 포함.

### Step 10 검증 총괄 & 보고
- **Action**: `<repo>/docs/output/YYYY-MM-DD-plan5-execution.md` 적재(SCHEMA 8필드 준수 — 이 레포에 conveyor 배포됨). 말미 점화 요지: 신버전·전역 통일 상태·삭제 프로브 결과(R2/§8.3 신호)·마켓플레이스 공개 상태 ≤5줄.
- **Success criterion**: 보고 파일 존재 + Stop 훅 compress 정상 통과. 출력: "PLAN-5 완료" 1줄.
