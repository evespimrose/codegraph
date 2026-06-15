# CodeGraph 빌드 패치노트 (fetch-notes)

> 전역 `codegraph` 동기화(`/sync-global-codegraph`)가 성공할 때마다 그 빌드의 변경점을
> **이 문서 최상단에 새 섹션으로 prepend**한다. 가장 최근 빌드가 맨 위. 과거 항목은 아래로 누적.

<!-- NEWEST-ON-TOP: 새 빌드 노트는 이 줄 바로 아래에 추가 -->

---

## [2026-06-15] v0.9.8.1 — `--no-gitignore` 완전 우회 (`.codegraphignore` 독립 스펙화)

**Sync:** global == project `0.9.8.1` · 해시 일치 · 빌드 그린 (exit 0)
**Source:** `Obsidian-Graph-Vector-DB` @ `272fd46` (+ working tree)

### Fixes / New Features
- `codegraph index --no-gitignore` (및 `sync`)가 이제 **git 빠른경로를 완전히 우회**한다. 이전에는 `git ls-files`가 여전히 `.gitignore`를 적용해, git에서 통째로 제외된 경로(예: ignore된 `docs/`)는 `--no-gitignore`로도 인덱싱되지 않았다(이전 빌드의 §1.3-C 한계). 이제 **코드 스캐너와 마크다운 스캐너 모두** `--no-gitignore` 시 파일시스템 walk로 전환 → `.gitignore`에서 빠졌지만 `.codegraphignore`엔 없는 위치를 코드그래프에 넣을 수 있다. `.codegraphignore`가 가산 레이어가 아니라 **독립 ignore 스펙**(합집합·차집합 자유)으로 동작.
- 마크다운 walk에 ignore-매처 기반 디렉터리 prune 추가 — `--no-gitignore`에서도 Unity `Library/` 같은 대형 트리를 통째로 걷지 않음.

### 검증
- 신규 테스트 4건(git 우회 인덱싱 · `.codegraphignore` 차집합 유지 · 마크다운 git-ignored 노출) 통과, extraction 201 통과(회귀 0).
- 전역 바이너리 e2e: gitignored `generated/`가 기본 인덱스엔 없고 `index -f --no-gitignore`에선 등장.

### Note
- RX_1: `docs/`가 git-ignored이므로 `codegraph index -f --no-gitignore`로 `docs/contextmd`(cxt* 컨텍스트 문서)를 인덱싱. RX_1 `.codegraphignore`에 마크다운 **화이트리스트** 스코프 추가 — 그래프 = `docs/*.md`(직속) + `docs/contextmd/**`만(81 files); 그 외 docs 하위 디렉터리(specs·superpowers 등 포함)·root·manage·memory md는 제외. 실측 검증: 누출 0.

---

## [2026-06-15] v0.9.8.1 — `.codegraphignore` 합집합/토글 · query 시멘틱 폴백 · docs CLI 표면

**Sync:** global == project `0.9.8.1` · `dist/bin/codegraph.js`·`dist/index.js`·`dist/db/schema.sql` 해시 일치 · 빌드 그린 (exit 0)
**Source:** `Obsidian-Graph-Vector-DB` @ `272fd46` (+ working tree)

### New Features
- **`.codegraphignore`** — 프로젝트 루트에 두는 추가 제외 레이어. `.gitignore`와 **동일 문법·동일 로더**로 그 위에 합집합 적용(둘 중 하나라도 매치하면 제외). 코드·Markdown 문서 인덱싱 모두에 적용되고, 선행 `!`로 재포함 가능. git·워크·watcher·docs **4경로 일관**.
- **`codegraph init`** 이 주석형 `.codegraphignore` 스캐폴드를 루트에 자동 생성(기본 전부 주석 → 옵트인 전까지 기존과 동일).
- **`--no-gitignore`** 플래그(`codegraph index` / `codegraph sync`) — 루트 `.gitignore`를 무시(내장 기본값·`.codegraphignore`는 유지).
- **`query` 시멘틱 폴백** — 렉시컬 결과가 빈약할 때(THIN<3) 의미 기반 Markdown 검색으로 보강. 자연어 쿼리·순수 Markdown 프로젝트의 빈 응답 해소. opt-in/sqlite-vec/임베딩 미가용 시 무소음 no-op이라 코드 프로젝트는 무영향(콜드스타트는 thin 경로에만).
- **`codegraph backlinks <file>`** / **`codegraph docs <query>`** — 그동안 MCP 전용이던 문서 백링크·시멘틱 검색을 CLI 표면으로 노출.

### Internal / Docs
- `buildDefaultIgnore(rootDir, {respectGitignore})` chokepoint + `ScanOptions` 신설, 3 스캐너 소비처·orchestrator `indexAll`/`sync`에 옵션 관통.
- doc-graph 게이트 매트릭스 문서화: `docs/design/doc-graph-gating.md` (BLADE auto / RX_1 override).

### 검증
- 신규 테스트 **7건 통과**(extraction 6 + foundation 1), **회귀 0**(stash 베이스라인 대비 실패 수 동일), 빌드 바이너리 e2e(init 스캐폴드 + `*.gen.ts` 제외) 확인.
- 상세: `docs/output/Obsidian-Graph-Vector-DB-2026-06-15-execute-report.md`.
