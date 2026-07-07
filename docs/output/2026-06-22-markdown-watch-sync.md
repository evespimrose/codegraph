# Markdown Watch/Sync 자동 인덱싱 연결 — EXECUTE 결과
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선 (context→search→node). 소스 위치는 아래 마크다운 링크로 추적 -->

> 출처 cxt: [docs/contextmd/cxt1.md](../contextmd/cxt1.md) · 플랜: [codegraph-dlc-2026-06-22-markdown-watch-sync.md](../../.claude/memory-bank/codegraph-dlc/plans/codegraph-dlc-2026-06-22-markdown-watch-sync.md)
> RIPER: RESEARCH(codegraph)→PLAN(승인)→EXECUTE. 규모=중형 → 검증 inline 수행(서브에이전트 디스패치 금지 조건 준수).

## 변경 요약 (broken link 2곳 연결)

| Layer | 파일·심볼 | 내용 |
|---|---|---|
| 신규 | [`isMarkdownFile`](../../src/docs/scan-files.ts) (scan-files.ts) | `MD_EXT` 재사용한 export 함수 — md 판정 단일 진실원천. watcher/`listMarkdownFiles` 일관성 보장 |
| A | [WatchOptions.docsEnabled](../../src/sync/watcher.ts) + 게이트 [watcher.ts:~228](../../src/sync/watcher.ts) | `const markdownFile = this.docsEnabled && isMarkdownFile(normalized); if (!isSourceFile && !markdownFile) return;` — **docs-ON일 때만** `.md` 통과. docs-OFF는 byte-무회귀 |
| A | [`CodeGraph.watch`](../../src/index.ts) (index.ts) | `resolveDocsEnabled(this.db.getDb())` 1회 해석 → `{ ...options, docsEnabled }` 주입 |
| B | [`CodeGraph.sync`](../../src/index.ts) 종료부 | best-effort `indexMarkdown` 호출(내부 `resolveDocsEnabled` 게이트=OFF면 no-op) + `docs.indexed>0`일 때만 `linkGovernsEdges`+`linkDocEdges` 재연결. `SyncResult` 타입 무변경 |
| 테스트 | [watcher.test.ts](../../__tests__/watcher.test.ts) | `markdown gating` describe 3종: docs-ON `.md`→sync 호출 / docs-OFF→미호출 / `isMarkdownFile` 진리표 |
| 문서 | [CHANGELOG.md](../../CHANGELOG.md) `[Unreleased]`→Fixes | 사용자향 1줄 |

## 검증 (Layer C)

- **빌드**: `npm run build` (tsc + copy-assets) ✅ — 타입 에러 0.
- **watcher 스위트**: `vitest run __tests__/watcher.test.ts` → **20/20 통과** (신규 3종 포함). 기존 `src/readme.md` 폐기 회귀 테스트 그대로 green.
- **Layer B 표면**: sync·governs-linking·doc-links-linking·docs-search·docs-tool-gating 통과. docs-db 2건 실패는 **사전 존재**(schema version 8 vs 테스트 하드코딩 5).
- **전체 스위트 회귀 증명**: 전체 14 fail / 1048 pass. 실패 14건 전부 내 변경과 무관한 서브시스템 —
  - 스키마 버전 상수: docs-db, foundation, pr19
  - MCP 서버 라이프사이클(Windows EPERM/race, CLAUDE.md 기지의 사전 실패): mcp-initialize, mcp-roots, mcp-daemon
  - 언어 resolution: frameworks-integration(JVM), resolution(C/C++)
  - **clean tree(stash) 대조**: 동일 파일 집합이 실패하며, clean 두 번 사이에서도 13↔14로 변동(daemon race·foundation flaky) → 내 변경과 무관 확정. watcher·markdown·scan-files·sync-docs-hook 관련 실패 0.

## 한계·후속 (non-goal로 명시)

- `SyncResult.docs` 미추가: 순수 `.md` 편집 시 watcher가 보고하는 `filesChanged`가 `.md`를 세지 않음(cosmetic, 정확성 무관).
- docs opt-in은 `watch()` 시점 1회 고정 — watch 가동 후 docs 활성화 시 re-watch 필요(`respectGitignore`와 동일).
- **라이브 MCP 반영**: 전역 설치 codegraph는 `/sync-global-codegraph`로 재동기화해야 본 변경이 실 서버에 적용됨(EXECUTE 범위 외).
