---
name: sync
description: Use when the user invokes /sync or asks to install/propagate THIS repo's workflow scaffolding into OTHER project roots — the .claude / .codex / .trae / .agents / .cursor dirs, CLAUDE.md / AGENTS.md / SKILL.md, hooks·skills·commands·rules, settings.json (plugin enablement), universal feedback memory, plus a generated codegraph .mcp.json. Reads target absolute paths from projects/list.txt and the sync manifest, then installs with one of three conflict modes — --mixed (diff → back up → overwrite, DEFAULT), --soft (skip existing), --force (overwrite all). Korean triggers — "워크플로우 동기화", "워크플로우 설치", "다른 프로젝트에 배포", "sync 워크플로우", "스킬·훅 배포", "/sync".
---

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (Cave-Man Output Arm · 전 스킬 공통)

- **메인 컨텍스트 타이핑 금지** — 과정 narration·중간 요약·"이제 ~하겠습니다" 출력 안 함
- **도구 사용 허용** — codegraph→(보완)Read/Edit 등으로 메인이 직접 작업 (hook 통제下)
- **서브에이전트 디스패치 금지** — Agent/Task 호출 안 함 (콜드스타트 토큰세금 ~100배). 예외: 초대형 규모·병렬 독립 작업을 **사용자가 발의**한 경우만
- **완료 보고만 허용** — 끝에 `XX 완료` 1~2단어 간단 보고만 타이핑
- **Auto-Clarity 예외** — 보안·비가역·모호 다단계·반복질문·하드블로커 → 정상 출력 (correctness > brevity)

정책: [[main-context-zero-delegation]] · `/output-arm` · CLAUDE.md RULE-9
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
- **제외(이 repo 고유 런타임 상태 — 절대 안 보냄)**: `.claude/state`, `.claude/memory-bank`, `settings.local.json`, `memory/MEMORY.md`+프로젝트 메모리, `.codegraph`·`node_modules`·`dist`·`src`·`docs` 등
- **생성**: 각 타깃 루트에 `.mcp.json` (codegraph MCP, `@evespimrose/codegraph` 전역 설치 기준). 기존 `.mcp.json`이 있으면 **다른 서버는 보존하고 codegraph만 병합**한다.

## 플래그 (3 모드)

| 플래그 | 동작 | 백업 |
|---|---|---|
| `--mixed` *(기본)* | 없는 파일은 복사, **다른 파일은 백업 후 덮어쓰기**, 동일 파일은 건너뜀 | 다른 파일만 |
| `--soft` | **이미 있는 파일은 건너뜀**, 없는 파일만 복사 | 불필요(덮어쓰기 없음) |
| `--force` | 모든 대상 파일 **덮어쓰기** (프롬프트 없음) | 덮어쓴 파일 자동 백업 (`-NoBackup`로 생략) |

백업 위치: `<타깃>\.sync-backup\<YYYYMMDD-HHmmss>\<원래경로>` (복구 가능). 타깃은 `.sync-backup/`를 gitignore 권장.

## 실행 워크플로 (메인 직접 — 서브에이전트 금지)

작업은 번들 스크립트 [`scripts/sync.ps1`](scripts/sync.ps1)가 수행하고, 메인 에이전트가 오케스트레이션한다.

### --mixed (기본): dry-run → 충돌 제시 → 승인+백업 → 적용
1. **차이 파악(쓰기 없음)**:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/sync/scripts/sync.ps1 -Mode mixed -DryRun
   ```
2. 출력 `===SUMMARY-JSON===` 블록의 `conflicts`(타깃별 달라지는 파일)를 사용자에게 **그대로 제시**하고, 하드 백업 후 덮어쓸지 **승인 요청**한다. 충돌 0이면 바로 4로.
3. **승인 시 적용** (충돌 파일 백업 → 덮어쓰기, 없는 파일 복사):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/sync/scripts/sync.ps1 -Mode mixed
   ```
4. `added / overwritten / skipped / backup` 요약을 1~2줄로 보고.

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
- 타깃의 `memory/MEMORY.md` 인덱스는 건드리지 않는다. 동기화된 feedback 파일 포인터가 필요하면 사용자 확인 후 한 줄 추가.

## 검증 (이 스킬 수정 시)
- frontmatter 유효 + `<!-- CAVE-MAN-OUTPUT-ARM -->` 마커 존재
- `sync.ps1 -DryRun`이 쓰기 없이 충돌만 보고하는지 확인
