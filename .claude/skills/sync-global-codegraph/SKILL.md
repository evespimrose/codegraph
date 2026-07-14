---
name: sync-global-codegraph
description: >
  Use when the user wants to update/sync the globally-installed `codegraph` command with THIS
  project's source (direct launcher onto PATH, no `npm install -g`) — "전역 codegraph 최신화",
  "글로벌 codegraph 동기화", "전역에 반영", "/sync-global-codegraph".
  Do NOT use to deploy workflow scaffolding to other projects (use /sync), or on other machines/CI — this PC's global npm only.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# sync-global-codegraph

이 프로젝트를 재빌드해 **전역 `codegraph` 명령**이 이 레포의 `dist\bin\codegraph.js`를
시스템 node로 직접 실행하도록 만든다. `npm link`(junction)가 이 머신에서 불안정하고
`npm install -g`는 다른 스코프 패키지와 전역 bin 소유권이 충돌하므로, **npm 전역 설치를
거치지 않는 직접 launcher(.cmd) + PATH 등록** 방식을 쓴다.

## 실행 프로토콜

```
1. 스크립트 1줄 실행 (이 스킬의 scripts/sync-global.ps1, 절대경로)
2. 출력의 verify 버전·종료코드로 결과 보고
3. 코드 구현·다른 파일 수정 없음 — 스크립트 실행과 보고만
```

### 실행 (한 줄)

PowerShell 도구로 이 스킬 디렉터리의 스크립트를 절대경로로 호출한다:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Fork\codegraph\.claude\skills\sync-global-codegraph\scripts\sync-global.ps1"
```

### 스크립트가 하는 일 (sync-global.ps1)

1. `git rev-parse --show-toplevel`로 repo 루트 확정 → `npm run build` *(실패 시 전역 미변경, exit 1)*
2. 실행 중 codegraph MCP 프로세스 정지 — **어느 패키지든**(npm-global·직접 launcher 포함) *(파일 잠금 방지)*
3. `npm uninstall -g`로 `@evespimrose/codegraph`·`@colbymchenry/codegraph` 전역 설치를 정리 *(PATH에서 다른 codegraph가 우리 launcher를 가리는 것 방지)*
4. `%LOCALAPPDATA%\codegraph-dev\bin\codegraph.cmd` launcher 작성(레포의 `dist\bin\codegraph.js`를 직접 가리킴) + 최초 1회 PATH 등록
5. 검증: launcher `--version`이 `package.json`의 버전과 일치하는지

### 결과 해석 (종료코드)

| 출력 | 코드 | 의미 |
|------|------|------|
| `OK  global codegraph = <ver>  (direct launcher -> <repo>)` | 0 | 동기화 성공 |
| `BUILD FAILED - global UNCHANGED` | 1 | 소스 컴파일 실패 → 전역 그대로. 빌드 에러부터 수정 |
| `MISMATCH  launcher='...' expected='...'` | 2 | launcher 버전 불일치(PATH 미반영 등) → 새 터미널에서 재확인 |

## 주의

- **직접 launcher**라서 최초 1회 이 스크립트로 PATH를 등록한 뒤에는, 이후 `npm run build`만 다시 실행해도 전역 `codegraph` 명령에 즉시 반영된다(재실행은 launcher가 깨졌거나 npm-global이 재설치돼 PATH를 가릴 때만 필요).
- launcher는 이 레포의 `dist/`를 시스템 node로 그대로 실행하므로, **npm 전역 설치·npm 전역 bin 소유권과 무관** — `npm install -g` 자체를 쓰지 않아 cross-scope bin 충돌(EEXIST)이 구조적으로 발생하지 않는다. 과거 발생 이력은 메모리 `global-codegraph-bin-conflict` 참조(해당 사안은 이 메커니즘 전환으로 종결).
- 끝의 `Exit code 255`나 stderr 경고는 npm deprecation 경고를 PowerShell이 NativeCommandError로 감싸는 quirk일 뿐 **실패가 아니다** — 판단은 항상 **verify 버전·종료코드**로 한다.
- 다른 머신/CI에는 적용 안 됨(이 PC의 전역 launcher 한정).

## 사용하지 말아야 할 때 (Negative Constraints)

- 워크플로 스캐폴딩을 *다른 프로젝트*에 배포 — `/sync`.
- codegraph *소스* 수정 자체 — 본 스킬은 빌드+전역 launcher 갱신만.
- 다른 머신·CI — 이 PC의 전역 launcher 한정.
