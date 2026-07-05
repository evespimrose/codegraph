# PLAN-2 실행 보고 — Codegraph 인덱스 신선도·MCP 로드 실패 근본 수정·배포
<!-- BLK: 인프라 -->

플랜: [PLAN-2-codegraph.md](../../.claude/memory-bank/codegraph-dlc/plans/PLAN-2-codegraph.md) · 실행일: 2026-07-04 · 브랜치: codegraph-dlc · 승인: Step 2~6 일괄 + Step 9 (사용자, 세션 내)

## Step별 결과

| Step | 상태 | 비고 |
|---|---|---|
| 1. 크로스 프로젝트 stale 재현 테스트 | ✅ | [NEW] `__tests__/cross-project-staleness.test.ts` — 갭 고정(`not.toContain('src/later.ts')`) + Step 2 배너 검증을 한 파일로 통합(플랜 Step 2의 "Step 1 테스트를 배너 검증으로 갱신" 종착점을 직접 작성). 4/4 pass. |
| 2. stale 배너 + 옵트인 catch-up | ✅ | `src/mcp/tools.ts`: `ensureCrossProjectFresh`(dispatch 전) + `withCrossProjectNotice`(응답 말미 1행) + `detectCrossProjectStaleNotice`(DB mtime{.db,-wal,-shm} vs 캡 500엔트리·깊이5 BFS, TTL 30s) + `CODEGRAPH_CROSS_PROJECT_SYNC=1` → 루트당 1회 `cg.sync()`. 기본 프로젝트 경로 비용 0. |
| 3. MCP 스폰 관측성 | ✅ | `src/bin/codegraph.ts` serve 진입부 `launchLog` — `.codegraph/mcp-launch.log`에 `ts \| 버전 \| serve-mcp:start/fail \| node=execPath \| argv \| 사유` 1행 append (best-effort, .codegraph 부재 시 무생성). 실증 로그 하단. |
| 4. 설치기 스폰 하드닝 | ✅ | `src/installer/targets/claude.ts`: [NEW] `resolveServeCommand()` — 실재 디스크 CLI 엔트리(dist/bin/codegraph.js)면 `process.execPath` + 엔트리 절대경로 기록(플래그 없이 기본), `_npx` 캐시·미존재·비인식 엔트리는 bare `codegraph` 폴백. Cursor `--path` quirk 무접촉. 테스트 4종 추가 → installer-targets **141/141** pass. |
| 5. 데몬 버전 스큐 + EPIPE | ✅ | `proxy.ts`: mismatch 시 **신>구일 때만** `codegraph/retire` 알림 1회 발신(+`isNewerVersion` export) 후 기존 in-process 폴백 유지. `daemon.ts`: socket error guard + hello write try/catch + `onRetire → stop('retired…')`. **좌표 확장(필수 수신 채널): `session.ts`에 `codegraph/retire` notification case + `MCPSessionOptions.onRetire` 추가** — 플랜 파일 목록 외 1파일, 최소 диспатch 1 case. 신규 스큐 테스트: 구 데몬(1.2.2)엔 retire 발신 / 신 데몬(9.9.9)엔 미발신 검증 → mcp-daemon 격리 **8/8** pass. |
| 6. md 삭제 미반영 수정 + 3종 테스트 | ✅ | `src/docs/indexer.ts`: 스캔 직후 삭제 조정 — DB `mdast_metadata` vs 디스크 대조로 고아 doc의 metadata·vector·markdown 노드(doc/concept)·edges 제거(단일 트랜잭션, best-effort, `removed` 카운터 신설). sync·catch-up 양 경로가 indexMarkdown 경유라 동시 커버. watcher.test.ts에 e2e 3종(생성/수정/**삭제**, 노드 폭증 없음 단언, vec-gated+embed stub) 추가 → **23/23** pass. |
| 7. CHANGELOG | ✅ | `[Unreleased]` Fixes에 6항(사용자향 문구, 내부 심볼 없음). 버전 블록 미생성. |
| 8. npm 배포 절차 + 마켓플레이스 설계 | ✅ | [NEW] `docs/design/marketplace-distribution.md` — npm 릴리즈 핸드오프 체크리스트(워크플로만, 수동 publish 금지) + plugin.json MCP 동봉 구조 + thin/다운로드 폴백 + Codex 대응 + Step 3·5와의 결합. 릴리즈 실행(버전 범프·트리거)은 사용자 몫으로 명시. |
| 9. 전역 반영·데몬 승계 | ✅ | sync-global-codegraph: 해시 3종 일치, `codegraph --version` = **0.9.8.1**. 데몬: 스크립트가 구 프로세스 3개 정지 후 신 데몬 `Listening … v0.9.8.1` 재기동 확인(daemon.log). 라이브 스큐 승계는 구 데몬이 이미 종료돼 재현 불가 — Step 5 신규 테스트(retire 발신/억제)로 실증 갈음. |
| 10. 검증 총괄 | ✅ | 아래. |

## Step 10 검증 증거

```
격리 스위트 (변경 대상):
  cross-project-staleness  4/4   installer-targets  141/141
  mcp-daemon               8/8   watcher            23/23    tsc --noEmit  clean

풀스위트: 1055 passed / 18 failed / 9 skipped
  실패 18 = 전부 무회귀 판정:
  (a) docs-db·foundation·frameworks-integration 6건 — **변경 stash 베이스라인에서 동일 재현** (사전 존재)
  (b) mcp-daemon 4건 — 격리 8/8 통과, 풀스위트 병렬 소켓/스폰 간섭
  (c) mcp-initialize·mcp-roots 계열 — CLAUDE.md 문서화된 Windows 기지 실패(main 재현군)
  → PLAN-2 변경으로 새로 생긴 실패 0

Step 3 실증 (.codegraph/mcp-launch.log):
  2026-07-03T15:52:20.442Z | v0.9.8.1 | serve-mcp:start | node=C:\Program Files\nodejs\node.exe | argv=serve --mcp
Step 9 실증 (daemon.log):
  [CodeGraph daemon] Listening on \\.\pipe\codegraph-92b30ad289a6e370 (pid 5792, v0.9.8.1)
```

## 전제 불일치·확장 (사용자 인지 필요)

1. **버전**: PLAN-0 전역 사실은 "codegraph 레포 = 0.9.8.3 본선"이나 이 레포 package.json은 **0.9.8.1** — 버전 범프는 하우스룰상 사용자 몫이라 미조치.
2. **session.ts 확장**: Step 5 retire 수신 채널로 플랜 파일 목록 외 1파일 최소 수정(위 표).
3. **테스트 인프라 수정**: vitest ESM에서 `require('../index')` 기반 lazy-load가 원천 불가 → [NEW] `src/cg-ref.ts` 레지스트리(무의존·cycle-free) + index.ts 등록 1행 + tools.ts 폴백. 프로덕션 CJS 경로 무변경.

## PLAN-3 점화용 요지 (≤5줄)

- 전역 codegraph **v0.9.8.1** (해시 검증 완료), 데몬 신버전 재기동 확인.
- 크로스 프로젝트 stale **배너 배포됨** — 응답 말미 "(Note: this cross-project index may be stale …)"; `CODEGRAPH_CROSS_PROJECT_SYNC=1`이면 open 시 자동 catch-up(루트당 1회).
- md **삭제** 반영 결함 수정 배포됨 — sync·catch-up 모두 고아 doc 제거(`removed` 카운터).
- 설치기(claude 타깃)는 이제 절대경로(node execPath + dist/bin/codegraph.js)를 기본 기록 — 플래그 불요, npx/미인식 환경은 bare 폴백.
- MCP 기동 관측: `.codegraph/mcp-launch.log` (start/fail + 사유) — "가끔 안 뜸" 재발 시 이 파일부터.
