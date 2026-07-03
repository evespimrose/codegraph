# PLAN-2 — Codegraph: 인덱스 신선도·MCP 로드 실패 근본 수정·배포
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선. 각 스텝 Scope 범위만 Read(offset+limit). -->
실행 세션: **codegraph 로컬 개발 레포 단독 세션** (v0.9.8.3 본선 · rrdd 사본에서 실행 금지)
실행 모델: Haiku 4.5 · EXECUTOR CONTRACT: [PLAN-0-INDEX.md](PLAN-0-INDEX.md) 준수
cxt 항목: 5(와쳐 실동작 — 검증 완료분의 잔여 구멍) + 6(MCP 로드 실패 근본 원인·배포)
경로 규약: `<repo>/` = codegraph 레포 루트. 라인 넘버는 2026-07-02 실측 기준 — 심볼·grep 앵커 우선.
주의: 이 레포 CLAUDE.md 하우스룰 준수 — CHANGELOG는 [Unreleased]에만, npm publish/git push/tag 직접 실행 금지. retrieval 성능 무회귀 원칙(탐색 예산·trace 충분성) 준수.

## 배경 (2026-07-02 rrdd 실측 — 재조사 금지)

- **와쳐 md 감지: docs-on 프로젝트에서 생성·수정 정상 실측. 삭제는 결함 확정** — 프로브 md rm 후 디스크 부재 상태에서 데몬 idle 재기동·catch-up 2회를 거쳐도 인덱스에 문서 잔존. 라이브 watcher 경로·catch-up 경로 양쪽 다 md 삭제 조정(reconciliation) 부재 → stale 문서 누적(검색 오염). 남은 구멍은 이것 포함 3개.
- **구멍 A — 크로스 프로젝트 stale**: `projectPath`로 타 프로젝트 질의 시 대상 DB를 in-process로 열 뿐 catchUpSync·watcher 미기동. 실측: WIKI DB mtime 07-01에서 당일 질의 후에도 불변, WIKI `docs/Roadmap/Workflow_End_To_End_LoadMap.md`(06-11 생성)가 검색 불가. 서브프로젝트 인덱스는 "그 프로젝트에서 세션을 열 때만" 신선.
- **구멍 B — MCP 로드 간헐 실패**: `.mcp.json`이 bare `codegraph` 커맨드 → npm 전역 shim의 PATH 의존. GUI 런처/환경별 PATH 부재 시 스폰 자체가 실패(간헐성의 전형). 최신 local-handshake 구조(`runLocalHandshakeProxy`가 initialize/tools-list 즉답)라 등록 타임아웃 실패는 거의 봉합 → 잔존 실패는 스폰 실패로 수렴. 관측성 부재가 근본 문제. 부수: 데몬 버전 스큐(0.9.8.2/0.9.8.3 혼재 이력), daemon.log EPIPE 소음.

## Steps (10)

### Step 1 크로스 프로젝트 stale 재현 테스트
- **Symbol**: ToolHandler 비-기본 프로젝트 open 경로 (착수 시 `codegraph_search "ToolHandler"` 좌표 확정)
- **File**: [NEW-BLK] `<repo>/__tests__/cross-project-staleness.test.ts`
- **BLK target**: [NEW-BLK]
- **Action**: insert — temp 프로젝트 2개 생성, B를 projectPath로 여는 동안 B의 md/소스 변경 → 질의 결과 미반영임을 고정하는 테스트(현행 동작 명세화).
- **Success criterion**: `npx vitest run __tests__/cross-project-staleness.test.ts` pass.

### Step 2 [승인게이트] stale 감지 배너 + 옵트인 catch-up
- **Symbol**: `MCPEngine.catchUpSync` (src/mcp/engine.ts:241) · ToolHandler cross-project open
- **File**: `<repo>/src/mcp/tools.ts`, `<repo>/src/mcp/engine.ts`
- **Scope**: cross-project open 함수 ±40줄 (codegraph_search로 확정)
- **BLK target**: [인프라]
- **Action**: insert — 비-기본 프로젝트 open 시 DB mtime vs 파일시스템 최근 변경 경량 비교 → stale이면 응답 말미 1행 배너("index may be stale — run `codegraph sync` in <path>"). env `CODEGRAPH_CROSS_PROJECT_SYNC=1`이면 open 시 catchUpSync 수행(기본 off — 비용 통제). 기존 `mcp-staleness-banner.test.ts` 패턴 재사용.
- **Success criterion**: Step 1 테스트를 배너 검증으로 갱신 후 pass + `npm test` 무회귀.

### Step 3 [승인게이트] MCP 스폰 관측성 (launch log)
- **Symbol**: `main` (src/bin/codegraph.ts:113) serve --mcp 진입부
- **File**: `<repo>/src/bin/codegraph.ts`
- **Scope**: serve 서브커맨드 핸들러 ±30줄
- **BLK target**: [인프라]
- **Action**: insert — 기동 시 `.codegraph/mcp-launch.log`에 1행 append(ts·버전·mode(direct/proxy/daemon)·argv0·실패 시 사유). "가끔 실패"를 다음 발생 시 즉시 원인 특정 가능하게.
- **Success criterion**: `node dist/bin/codegraph.js serve --mcp` 기동 → 로그 1행 생성, 테스트 무회귀.

### Step 4 [승인게이트] 설치기 스폰 하드닝
- **Symbol**: claude 타깃 설치기 (src/installer/targets/claude.ts)
- **File**: `<repo>/src/installer/targets/claude.ts`
- **Scope**: MCP 서버 JSON 작성부 (codegraph_search로 확정)
- **BLK target**: [인프라]
- **Action**: replace — `.mcp.json`에 bare `codegraph` 대신 절대 경로 해석 옵션: 설치 시점 `process.execPath`(node 절대경로) + 전역 `dist/bin/codegraph.js` 절대경로 기록(`--install-abs-path` 플래그 or 기본). Cursor `--path` 주입 quirk 보존. `installer-targets.test.ts`에 계약 테스트 추가(멱등성·uninstall 역행 포함).
- **Success criterion**: `npx vitest run __tests__/installer-targets.test.ts` 전체 pass.

### Step 5 [승인게이트] 데몬 버전 스큐 정책 + EPIPE 가드
- **Symbol**: `connectWithHello` (src/mcp/proxy.ts:110) · `Daemon.handleConnection` (src/mcp/daemon.ts:206)
- **File**: `<repo>/src/mcp/proxy.ts`, `<repo>/src/mcp/daemon.ts`
- **Scope**: proxy.ts [110-136], daemon.ts [206-230]
- **BLK target**: [인프라]
- **Action**: insert — version-mismatch 감지 시(신 클라이언트 vs 구 데몬) in-process 폴백 유지 + 구 데몬에 graceful shutdown 요청 1회 발신(다음 세션부터 신버전 승계). EPIPE는 dead-socket write guard(try/catch + 세션 drop)로 로그 소음 제거.
- **Success criterion**: `mcp-daemon.test.ts` 무회귀 + 신규 스큐 시나리오 테스트 pass.

### Step 6 [승인게이트] md 삭제 미반영 결함 수정 + 와쳐 3종 회귀 테스트
- **Symbol**: `indexMarkdown` (src/docs/indexer.ts) · `CodeGraph.sync` 종결부 (src/index.ts) · `MCPEngine.catchUpSync` — 착수 시 codegraph_search로 좌표 확정
- **File**: `<repo>/src/docs/indexer.ts`, `<repo>/src/index.ts`, `<repo>/__tests__/watcher.test.ts`
- **Scope**: sync 종결부의 md 인덱싱 블록 ±40줄 + indexer의 문서 upsert 경로
- **BLK target**: [인프라]
- **Action**: (a) **수정**: md 인덱싱 경로에 삭제 조정 추가 — DB의 md doc 목록 vs `listMarkdownFiles` 디스크 대조로 고아 문서(및 그 concept/링크 파생 노드) 제거. 라이브 sync·catch-up 양 경로 모두 커버. content_hash 증분 원칙 유지(무변경 파일 재임베딩 금지). (b) **테스트**: docs-on에서 md 생성/수정/**삭제** → 인덱스 반영 3종 + docs-off에서 md 이벤트 무시 고정. 2026-07-02 실측 결함(삭제 잔존)을 재현→수정 확인하는 케이스 필수.
- **Success criterion**: 삭제 테스트가 수정 전 fail·수정 후 pass + `npx vitest run __tests__/watcher.test.ts` 전체 pass + 노드 수 폭증 없음(before/after count).

### Step 7 CHANGELOG 기입
- **File**: `<repo>/CHANGELOG.md`
- **Scope**: `## [Unreleased]` 섹션만
- **BLK target**: [인프라]
- **Action**: append — Step 2~6을 사용자향 문구로(내부 경로·심볼명 금지, New Features/Fixes 그룹).
- **Success criterion**: [Unreleased] 아래 신규 항목 존재, 버전 블록 사전 생성 없음.

### Step 8 [사용자결재] npm 정식 배포 + 마켓플레이스 패키징 설계
- **File**: [NEW-BLK] `<repo>/docs/design/marketplace-distribution.md`
- **BLK target**: [NEW-BLK]
- **Action**: (a) npm `@evespimrose/codegraph` 릴리즈는 GitHub Actions Release 워크플로로만 — Haiku는 절차 문서화·핸드오프만(버전 범프·트리거는 사용자). (b) Claude Code plugin marketplace 패키징 설계 문서: plugin.json에 MCP 서버 동봉 → `.mcp.json` 수동 배선·PATH 의존 해소(구멍 B의 구조적 종결), Codex marketplace 대응 포함. 설치 UX: `/plugin install` 1회.
- **Success criterion**: 설계 문서 존재 + 릴리즈 핸드오프 절차가 execution 보고에 명시.

### Step 9 [사용자결재] 전역 반영·데몬 승계 검증
- **Action**: `/sync-global-codegraph` 실행(npm pack + install -g, 해시 검증) → **이 레포에서** 데몬 재기동 후 daemon.log로 신버전 승계 확인(Step 5 정책 실증). 타 레포 데몬 검증은 다음 세션들(각 프로젝트 세션 첫 질의 시)에 자연 위임 — 타 레포 접근 금지.
- **BLK target**: [인프라]
- **Success criterion**: `codegraph --version` 신버전 + 이 레포 daemon.log에 스큐 승계 로그.

### Step 10 검증 총괄 & 보고
- **Action**: `npm test` 전체 → `<repo>/docs/output/YYYY-MM-DD-plan2-execution.md` 적재. 말미에 **PLAN-3 점화용 요지**(전역 버전, stale 배너 유무, `CODEGRAPH_CROSS_PROJECT_SYNC` 사용법, 절대경로 설치 플래그) ≤5줄.
- **Success criterion**: 전체 테스트 pass + 보고 파일 존재. 출력: "PLAN-2 완료" 1줄.
