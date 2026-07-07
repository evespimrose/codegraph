---
name: sync-global-codegraph
description: >
  Use when the user wants to update/sync the globally-installed `codegraph` command with THIS
  project's source (npm pack + install -g, verify by hash) — "전역 codegraph 최신화",
  "글로벌 codegraph 동기화", "전역에 반영", "/sync-global-codegraph".
  Do NOT use to deploy workflow scaffolding to other projects (use /sync), or on other machines/CI — this PC's global npm only.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# sync-global-codegraph

이 프로젝트를 재빌드해 **전역 `codegraph` 명령**을 프로젝트 루트의 최신 빌드로 교체한다.
`npm link`(junction)이 이 머신에서 불안정하므로 **`npm pack` + `npm install -g`(실제 복사)** 방식을 쓴다.

## 실행 프로토콜

```
1. 스크립트 1줄 실행 (이 스킬의 scripts/sync-global.ps1, 절대경로)
2. 출력의 verify 해시표·버전·종료코드로 결과 보고
3. 코드 구현·다른 파일 수정 없음 — 스크립트 실행과 보고만
```

### 실행 (한 줄)

PowerShell 도구로 이 스킬 디렉터리의 스크립트를 절대경로로 호출한다:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Fork\codegraph\.claude\skills\sync-global-codegraph\scripts\sync-global.ps1"
```

### 스크립트가 하는 일 (sync-global.ps1)

1. `git rev-parse --show-toplevel`로 repo 루트 확정 → `npm run build` *(실패 시 전역 미변경, exit 1)*
2. 실행 중 codegraph MCP 프로세스 정지 — **어느 패키지든**(전역 충돌 패키지 포함) *(전역 폴더 잠금/EPERM 방지)*
3. `codegraph` bin 소유자 점검: 다른 패키지(예: 업스트림 @colbymchenry)가 소유하면 `--force` 예약 + 깨진 이전 설치(dist 없는 반쪽) 정리
4. `npm pack` → tarball
5. `npm install -g <tarball>` *(필요 시 `--force`로 bin 재지정 — junction 없음)* → tarball 삭제
6. 검증: `dist/bin/codegraph.js`·`dist/index.js`·`dist/db/schema.sql` 해시가 전역과 일치하는지 + `codegraph --version`

### 결과 해석 (종료코드)

| 출력 | 코드 | 의미 |
|------|------|------|
| `OK  global codegraph = <ver> (matches project root)` | 0 | 동기화 성공 |
| `BUILD FAILED - global UNCHANGED` | 1 | 소스 컴파일 실패 → 전역 그대로. 빌드 에러부터 수정 |
| `MISMATCH  global not fully updated` | 2 | install 미반영(foreign bin 소유자/잠금) → 에이전트 종료 후 재실행 |

## 주의

- **복사 설치**라서 프로젝트를 수정할 때마다 이 스킬을 다시 실행해야 전역에 반영된다.
- 끝의 `Exit code 255`나 stderr 경고는 npm deprecation 경고를 PowerShell이 NativeCommandError로 감싸는 quirk일 뿐 **실패가 아니다** — 판단은 항상 **verify 해시·버전**으로 한다.
- 다른 머신/CI에는 적용 안 됨(이 PC의 전역 npm 한정).
- **Cross-scope bin 충돌**: 전역 `codegraph` bin을 다른 스코프 패키지가 소유하면(이 머신은 한때 업스트림 `@colbymchenry/codegraph` 소유) 평범한 `npm install -g`가 `EEXIST … \npm\codegraph`로 실패한다. 스크립트가 셔임 소유자를 보고 `--force`로 재지정한다. 충돌 패키지를 **완전히** 없애려면 수동 `npm uninstall -g @colbymchenry/codegraph`. 이력은 메모리 `global-codegraph-bin-conflict` 참조.

## 사용하지 말아야 할 때 (Negative Constraints)

- 워크플로 스캐폴딩을 *다른 프로젝트*에 배포 — `/sync`.
- codegraph *소스* 수정 자체 — 본 스킬은 빌드+전역 재설치만.
- 다른 머신·CI — 이 PC의 전역 npm 한정.
