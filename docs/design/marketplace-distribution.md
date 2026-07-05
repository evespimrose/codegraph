# Marketplace Distribution — plugin packaging & npm release handoff

<!-- BLK: 인프라 -->
> PLAN-2 Step 8 산출물 (2026-07-04). 배경: `.mcp.json` 수동 배선의 bare `codegraph`
> 커맨드는 npm 전역 shim의 PATH 가용성에 의존한다 — GUI 런처 환경에서 PATH가 비어
> 있으면 스폰 자체가 실패한다(구멍 B). Step 4의 절대경로 설치가 증상을 줄이지만,
> **플러그인 마켓플레이스 동봉이 구조적 종결**이다: 클라이언트가 서버 바이너리
> 위치를 스스로 알고 스폰하므로 PATH·수동 배선이 개입할 틈이 없다.

## 1. npm 정식 릴리즈 — 절차 핸드오프 (실행은 사용자)

`@evespimrose/codegraph` 릴리즈는 **GitHub Actions "Release" 워크플로로만** 수행한다
(`.github/workflows/release.yml`). 수동 `npm publish`는 루트 패키지(비번들)를 올려
Node < 22.5 사용자를 깨뜨리므로 금지 (CLAUDE.md Releases 절).

핸드오프 체크리스트 (버전 범프·트리거는 사용자 몫):

1. `CHANGELOG.md`의 `## [Unreleased]`에 이번 릴리즈 내용이 쌓여 있는지 확인
   (PLAN-2 Step 7이 기입 완료 — 버전 블록은 **만들지 않는다**; prepare-release가 승격).
2. `package.json`의 `version`을 목표 버전으로 범프 (GitHub 웹 UI 단일 파일 편집로
   충분 — 워크플로의 lock-sync 스텝이 package-lock을 맞춰준다).
3. GitHub → Actions → **Release** → Run workflow (on `main`).
4. 워크플로가: lock 동기화 → `[Unreleased]` 승격 커밋 → 플랫폼 번들 빌드 →
   GitHub Release 생성 → npm shim + per-platform 패키지 publish (`NPM_TOKEN` 필요).

## 2. Claude Code plugin marketplace 패키징 설계

### 2.1 목표 UX

```
/plugin install codegraph
```
1회로 끝. `.mcp.json` 수동 편집·PATH 의존·설치기 실행 전부 불요.

### 2.2 패키지 구조 (제안)

```
codegraph-plugin/
  .claude-plugin/
    plugin.json          # 매니페스트 — mcpServers 동봉 선언
  bin/                   # 플랫폼별 self-contained 번들 (기존 release 아티팩트 재사용)
    codegraph-<os>-<arch>/...
  scripts/
    resolve-bin.js       # os/arch 감지 → 번들 내 절대경로 반환
```

`plugin.json` 핵심 (마켓플레이스 스키마 확정 시 필드명 조정):

```jsonc
{
  "name": "codegraph",
  "version": "<X.Y.Z>",            // npm 버전과 lockstep
  "mcpServers": {
    "codegraph": {
      "command": "${pluginRoot}/bin/current/node",   // 동봉 런타임 — PATH 무관
      "args": ["${pluginRoot}/bin/current/lib/dist/bin/codegraph.js", "serve", "--mcp"]
    }
  }
}
```

- `${pluginRoot}` 치환은 호스트가 제공 (미지원 시 postinstall 스크립트가 절대경로를
  기록하는 Step 4 `resolveServeCommand`와 동일한 패턴으로 폴백).
- 번들은 기존 `scripts/build-bundle.sh` 아티팩트를 그대로 재사용 — 새 빌드 체계 없음.
- 용량: 마켓플레이스가 대용량 동봉을 거부하면 **thin 매니페스트 + 첫 기동 시
  GitHub Releases에서 번들 다운로드**(기존 `CODEGRAPH_DOWNLOAD_BASE` 폴백 재사용).

### 2.3 Codex marketplace 대응

Codex는 `config.toml`의 `[mcp_servers.codegraph]`를 읽는다. 마켓플레이스 등장 시
동일 원칙 적용: 매니페스트가 동봉 런타임 절대경로를 선언, TOML 수동 배선 제거.
현행 설치기(`targets/codex.ts`)는 그대로 유지 — 플러그인은 **추가 채널**이지
대체가 아니다 (수동 설치 사용자 무영향).

### 2.4 신선도·버전 스큐와의 결합

- 플러그인 업데이트 = 바이너리 교체 → 구 데몬이 남는 시나리오는 Step 5의
  skew-succession(`codegraph/retire`)이 처리: 새 클라이언트가 구 데몬에 graceful
  shutdown을 요청하고 해당 세션은 in-process로 서빙.
- 스폰 실패 관측은 Step 3의 `.codegraph/mcp-launch.log`가 플러그인 채널에서도 동일
  작동 (기동 진입점이 같은 bin이므로).

### 2.5 미결 (마켓플레이스 스키마 확정 대기)

| # | 항목 | 결정자 |
|---|---|---|
| 1 | plugin.json의 MCP 서버 선언 필드 정식 스키마 | Anthropic 문서 확정 후 |
| 2 | 동봉 vs thin+다운로드 (마켓플레이스 용량 정책) | 사용자 |
| 3 | 플러그인 버전 ↔ npm 버전 lockstep 자동화 (release workflow 스텝 추가) | 사용자 |
