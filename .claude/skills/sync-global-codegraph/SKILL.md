---
name: sync-global-codegraph
description: >
  Use when the user wants to update/sync the globally-installed `codegraph` command with THIS
  project's current source — e.g. "전역 codegraph 최신화", "글로벌 codegraph 동기화",
  "전역에 반영", "sync global codegraph", or invokes /sync-global-codegraph. Rebuilds the project
  and reinstalls it globally as a REAL copy (npm pack + npm install -g), then verifies global == project
  by file hash. On success it also prepends a build patch-note section to
  docs/fetch-notes/codegraph-build-notes.md (newest on top). Use this instead of `npm link` —
  cross-volume junctions are unstable on this machine.
  Trigger on: "전역 codegraph 최신화/동기화", "global codegraph 갱신", "sync-global-codegraph".
---

# sync-global-codegraph

이 프로젝트를 재빌드해 **전역 `codegraph` 명령**을 프로젝트 루트의 최신 빌드로 교체한다.
`npm link`(junction)이 이 머신에서 불안정하므로 **`npm pack` + `npm install -g`(실제 복사)** 방식을 쓴다.

## 실행 프로토콜

```
1. 스크립트 1줄 실행 (이 스킬의 scripts/sync-global.ps1, 절대경로)
2. exit 0(동기화 성공) 시에만 → 이번 빌드 변경점을
   docs/fetch-notes/codegraph-build-notes.md 최상단에 prepend (아래 §빌드 패치노트)
3. 메인 컨텍스트 출력 0 — 대화창엔 "동기화 완료"만 (아래 §출력 규칙)
4. 그 외 소스 코드 구현/수정 없음 — 스크립트 실행·패치노트 기록만
```

### 실행 (한 줄)

PowerShell 도구로 이 스킬 디렉터리의 스크립트를 **절대경로**로 호출한다. 경로는 하드코딩하지 말고
런타임에 주어지는 이 스킬의 *Base directory* + `\scripts\sync-global.ps1`을 쓴다(레포 이동에도 안전):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Unity\codegraph\.claude\skills\sync-global-codegraph\scripts\sync-global.ps1"
```

### 스크립트가 하는 일 (sync-global.ps1)

1. `git rev-parse --show-toplevel`로 repo 루트 확정 → `npm run build` *(실패 시 전역 미변경, exit 1)*
2. 실행 중 codegraph MCP 프로세스 정지 — **어느 패키지든**(전역 충돌 패키지 포함) *(전역 폴더 잠금/EPERM 방지)*
3. `codegraph` bin 소유자 점검: 다른 패키지(예: 업스트림 @colbymchenry)가 소유하면 `--force` 예약 + 깨진 이전 설치(dist 없는 반쪽) 정리
4. `npm pack` → tarball
5. `npm install -g <tarball>` *(필요 시 `--force`로 bin 재지정 — junction 없음)* → tarball 삭제
6. 검증: `dist/bin/codegraph.js`·`dist/index.js`·`dist/db/schema.sql` 해시가 전역과 일치하는지 + **전역 `codegraph --version`이 프로젝트 `package.json` 버전과 일치하는지** (현재 0.9.8.n을 자동 타깃 — 버전업 시 그 버전으로 따라감; 불일치 시 exit 2)

### 결과 해석 (종료코드)

| 출력 | 코드 | 의미 |
|------|------|------|
| `OK  global codegraph = <ver> (matches project root)` | 0 | 동기화 성공 |
| `BUILD FAILED - global UNCHANGED` | 1 | 소스 컴파일 실패 → 전역 그대로. 빌드 에러부터 수정 |
| `MISMATCH  global not fully updated` | 2 | install 미반영 또는 **버전 불일치**(foreign bin 소유자/잠금) → 에이전트 종료 후 재실행 |

## 출력 규칙 (메인 컨텍스트 0)

이 스킬의 산출은 `docs/fetch-notes/codegraph-build-notes.md` **단 하나**에만 기록한다. verify 해시표·버전·종료코드·진행 로그를 대화창에 풀어쓰지 않는다(토큰 절약이 목적 — `/try`와 동일 원칙).

- **성공(exit 0):** 패치노트 prepend 후 대화창엔 **`동기화 완료`** 한 줄만 출력. 그 외 일절 금지(해시표·요약·파일 경로 나열 금지).
- **실패(exit 1/2):** 침묵하면 깨진 전역이 가려지므로 예외 — **한 줄**로만 사유 보고. 예: `동기화 실패 (exit 1: BUILD FAILED) — 빌드 에러 수정 후 재실행`. 로그·해시 덤프 금지.
- 패치노트 본문(섹션 형식·검증 내용)은 **파일에만**. 대화창에 미러링하지 않는다.

## 빌드 패치노트 작성 (exit 0 시 필수)

동기화가 성공(exit 0)하면 **반드시** 이번 빌드의 변경점을 통합 패치노트에 남긴다. 빌드 실패(exit 1/2)면 작성하지 않는다.

- **파일**: `docs/fetch-notes/codegraph-build-notes.md` (없으면 헤더와 `<!-- NEWEST-ON-TOP ... -->` 마커를 갖춰 새로 생성).
- **위치**: `<!-- NEWEST-ON-TOP ... -->` 마커 **바로 아래에 새 섹션을 prepend** — 최신 빌드가 항상 맨 위, 과거 섹션은 그대로 아래로 누적(기존 항목 수정·삭제 금지).
- **한 섹션 = 한 빌드**. 형식:
  - 헤더: `## [YYYY-MM-DD] v<package.json 버전> — <한 줄 요약>`
  - `**Sync:**` global==project 버전 + 해시 일치 + 빌드 그린(verify 출력에서).
  - `**Source:**` `<브랜치> @ <git short SHA>` (+ 미커밋 시 `(+ working tree)`).
  - `### New Features` — 사용자향 변경(입력 명령/플래그·기능 위주, 내부 경로/심볼 최소화).
  - `### Internal / Docs` — 구조 변경·신규 문서.
  - `### 검증` — 신규/회귀 테스트 결과·e2e, 상세 리포트 경로 링크.
- **변경점 출처**: 이번 세션의 `git diff`/작업 내용 + 스크립트 verify 출력. **직전 섹션과 중복 금지** — 이번 빌드에서 새로 바뀐 것만.
- 변경점이 사실상 없으면(재빌드만) 한 줄짜리 "rebuild only, no functional change" 섹션으로 간단히 남긴다.

## 주의

- **복사 설치**라서 프로젝트를 수정할 때마다 이 스킬을 다시 실행해야 전역에 반영된다.
- **버전 자동 추종**: 타깃 버전을 하드코딩하지 않고 프로젝트 `package.json`의 현재 버전(0.9.8.n)을 따른다. `npm pack`이 그 버전으로 tarball을 만들고, verify 단계가 전역 `codegraph --version` == `package.json` 버전을 단언한다(불일치 시 exit 2). 버전업되면 다음 실행이 자동으로 새 버전을 타깃한다.
- 끝의 `Exit code 255`나 stderr 경고는 npm deprecation 경고를 PowerShell이 NativeCommandError로 감싸는 quirk일 뿐 **실패가 아니다** — 판단은 항상 **verify 해시·버전**으로 한다.
- 다른 머신/CI에는 적용 안 됨(이 PC의 전역 npm 한정).
- **Cross-scope bin 충돌**: 전역 `codegraph` bin을 다른 스코프 패키지가 소유하면(이 머신은 한때 업스트림 `@colbymchenry/codegraph` 소유) 평범한 `npm install -g`가 `EEXIST … \npm\codegraph`로 실패한다. 스크립트가 셔임 소유자를 보고 `--force`로 재지정한다. 충돌 패키지를 **완전히** 없애려면 수동 `npm uninstall -g @colbymchenry/codegraph`. 이력은 메모리 `global-codegraph-bin-conflict` 참조.
