---
name: sync
description: Use when the user invokes /sync or asks to install/propagate THIS repo's workflow scaffolding into OTHER project roots. Korean triggers — "워크플로우 동기화", "워크플로우 설치", "다른 프로젝트에 배포", "스킬·훅 배포", "/sync". Do NOT use to update global codegraph (use /sync-global-codegraph) or for single-file copy — multi-project scaffolding deployment only.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Sync — 워크플로우 스캐폴딩 배포기

이 repo(워크플로우 **원본**)의 재사용 가능한 워크플로우 스캐폴딩을 `projects/list.txt`에 적힌 **다른 프로젝트 루트들**에 설치한다. 타깃의 파일을 덮어쓰는 **비가역·외부영향** 동작이므로 기본 모드는 안전한 `--mixed`(차이 파악 → 하드 백업 → 덮어쓰기)다.

## 입력 — 데이터 파일 2개 (편집 후 실행)

| 파일 | 역할 |
|---|---|
| [`projects/list.txt`](projects/list.txt) | 타깃 프로젝트 루트 **절대경로** 목록 (한 줄 1개, `#`=주석). 빈 목록이면 안전 no-op. |
| [`manifest.txt`](manifest.txt) | 무엇이 "워크플로우"인지 — 원본 루트 기준 **상대경로**. 디렉토리는 재귀 복사. |

## 동기화 대상

- **포함(스캐폴딩)**: `.claude/{skills,commands,hooks,rules,agents,settings.json}` · `.codex` · `.trae` · `.agents` · `.cursor` · `CLAUDE.md` · `AGENTS.md` · `SKILL.md`
- **포함(범용 feedback)**: `memory/feedback_korean_communication.md` (사용자 전역 선호 — 모든 프로젝트 적용)
- **force-only(타깃 런타임 상태 — mixed/soft는 건너뜀, `--force`로만 덮어씀)**: `.claude/memory-bank`(`.riper-state`+브랜치 메모리) · `memory/MEMORY.md`. 평소 동기화는 타깃의 RIPER 상태·메모리를 **보존**하고, `--force`만 백업 후 덮어쓴다(타깃 하드 리셋용). `manifest.txt`에서 `!` 접두로 표기.
- **제외(이 repo 고유 런타임 상태 — 절대 안 보냄)**: `.claude/state`, `settings.local.json`, 프로젝트별 메모리, `.codegraph`·`node_modules`·`dist`·`src`·`docs` 등
- **생성**: 각 타깃 루트에 `.mcp.json` (codegraph MCP, `@evespimrose/codegraph` 전역 설치 기준). 기존 `.mcp.json`이 있으면 **다른 서버는 보존하고 codegraph만 병합**한다.

## 플래그 (3 모드)

| 플래그 | 동작 | 백업 |
|---|---|---|
| `--mixed` *(기본)* | 없는 파일은 복사, **다른 파일은 백업 후 덮어쓰기**, 동일 파일은 건너뜀 | 다른 파일만 |
| `--soft` | **이미 있는 파일은 건너뜀**, 없는 파일만 복사 | 불필요(덮어쓰기 없음) |
| `--force` | 모든 대상 파일 **덮어쓰기** (프롬프트 없음) | 덮어쓴 파일 자동 백업 (`-NoBackup`로 생략) |

백업 위치: `<타깃>\.sync-backup\<YYYYMMDD-HHmmss>\<원래경로>` (복구 가능). 타깃은 `.sync-backup/`를 gitignore 권장.

**force-only 경로** (`manifest.txt`의 `!` 접두 — `.claude/memory-bank`·`memory/MEMORY.md`): mixed/soft는 `skipped-protected`로 **건너뛰어 타깃 상태를 보존**하고, `--force`만 백업 후 덮어쓴다. ⚠️ `--force`는 이 repo의 `.riper-state`·플랜·세션 메모리를 타깃에 밀어넣으므로(타깃 RIPER 상태 덮어씀) 의도적 하드 리셋일 때만 사용.

## 실행 워크플로 (메인 직접 — 서브에이전트 금지)

작업은 번들 스크립트 [`scripts/sync.ps1`](scripts/sync.ps1)가 수행하고, 메인 에이전트가 오케스트레이션한다.

### --mixed (기본): dry-run → 충돌 제시 → 승인+백업 → 적용
1. **차이 파악(쓰기 없음)**:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/sync/scripts/sync.ps1 -Mode mixed -DryRun
   ```
2. dry-run stdout의 `conflicts` 목록(타깃별 `~ 경로` 행 — **dry-run에서만 나열됨**)을 사용자에게 **그대로 제시**하고, 하드 백업 후 덮어쓸지 **승인 요청**한다. 충돌 0이면 바로 4로. 전체 기계가독 JSON은 stdout이 아니라 `<repo>/.claude/state/sync-last-report.json`에 기록된다(컨텍스트 다이어트 — 필요 시만 열람).
3. **승인 시 적용** (충돌 파일 백업 → 덮어쓰기, 없는 파일 복사):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/sync/scripts/sync.ps1 -Mode mixed
   ```
4. `added / overwritten / skipped / backup` 요약을 1~2줄로 보고. 적용(non-dry-run) 시 stdout은 타깃별 카운트+백업경로만 출력한다(conflicts 재나열 안 함 — dry-run에서 이미 승인됨).

### --soft / --force: 직접 실행
```
... sync.ps1 -Mode soft     # 있는 파일 건너뜀
... sync.ps1 -Mode force    # 전부 덮어쓰기 (자동 백업; 비가역 → 실행 전 한 번 확인)
```
`--force`는 광범위 덮어쓰기이므로 실행 전 사용자에게 한 번 확인한다(Auto-Clarity: 비가역).

### 특정 타깃만
`list.txt` 대신 직접 지정: `... sync.ps1 -Mode mixed -Targets "D:\Fork\RX_1"`

## 주의

- **소스 = 스킬이 있는 repo 루트.** 이 스킬은 자기 자신(`.claude/skills/sync`)도 복사하므로 타깃의 `list.txt`/`manifest.txt`도 동기화 대상이다 — mixed가 백업으로 보호하나, 타깃별 목록을 따로 쓰는 경우 `--soft`를 쓰거나 적용 후 복원할 것.
- `.mcp.json` 병합은 codegraph 키만 갱신/추가하고 형제 서버는 보존한다. 그래도 기존 파일 형식이 다르면 mixed가 충돌로 잡아 백업 후 정규화한다.
- 타깃의 `memory/MEMORY.md`·`.claude/memory-bank`는 **force-only**라 mixed/soft에선 건드리지 않는다(타깃 RIPER 상태·메모리 보존). `--force`만 백업 후 덮어쓴다. 동기화된 feedback 파일 포인터가 필요하면 사용자 확인 후 한 줄 추가.

## 검증 (이 스킬 수정 시)
- frontmatter 유효 + `<!-- CAVE-MAN-OUTPUT-ARM -->` 마커 존재
- `sync.ps1 -DryRun`이 쓰기 없이 충돌만 보고하는지 확인
- `-Mode mixed -DryRun`에서 force-only(`memory-bank`·`MEMORY.md`)가 `skipped-protected`로 잡히고, `-Mode force -DryRun`에선 잡히지 않는지(overwritten/added로 전환) 확인

## 사용하지 말아야 할 때 (Negative Constraints)

- 전역 `codegraph` 명령 갱신 — `/sync-global-codegraph`.
- 단일 파일을 wiki/raw로 이동 — `move-to-raw`.
- 이 repo 내부 작업 — sync는 *타 프로젝트 루트*로의 배포 전용(list.txt 비면 안전 no-op).
