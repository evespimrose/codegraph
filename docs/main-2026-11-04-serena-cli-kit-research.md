# 조사: serena-cli 와 Serena MCP 의존성 해제

> 작성일: 2026-11-04
> 앞선 타당성 분석: `docs/Try_ZgCodegraphSerenaPipeline.md` (zg·codegraph·serena 전처리 파이프라인 전체)
> 이 문서는 그 분석 뒤 PLAN 단계에서 새로 확인한 사실만 적는다.

## 1. 사용자 요구

- Serena 를 Claude Code MCP 등록 없이 로컬 CLI 로 쓴다. 이유: MCP 연결 때 도구 설명을 매번 내려받는 토큰 비용.
- 도구 스키마는 온디맨드로 읽는다. 처음에는 한 줄 목록만, 필요할 때 한 도구의 상세 스키마를, 읽은 스키마는 캐시한다.
- 입력은 codegraph CLI 처럼 플래그로 받는다. 출력은 기본 텍스트, `-j` 로 JSON-RPC 형식.
- 구현 위치는 KIT 와 이 레포. Claude 와 Codex 의 MCP 등록을 모두 해제한다.

## 2. Serena 설치 구조 (KIT 소유)

| 항목 | 사실 | 근거 |
|---|---|---|
| 번들 위치 | `D:/Fork/KIT/tools/serena` (사용자 안내, 2026-11-04) | `tools/serena/README.md` |
| 판 | Serena `1.7.1.dev0`, 상류 커밋 `f1d78a88`, C# 프로젝트 탐색 오버레이 포함. MIT | `tools/serena/manifest.json` |
| 설치 위치 | `~/.local/share/team-tech-support-harness/serena/<wheel8>-<constraints8>/` (지금 `50a237dc-cfbdfbd1`). 판마다 불변 폴더 | `tools/serena/install.ps1:158`, `:185-187` |
| 런타임 파일 | `start-client.ps1`, `shared_client.py`, `shared_runtime.py`, `shared_server.py` 를 설치 때마다 릴리스 폴더로 복사 | `install.ps1:224-234` |
| MCP 등록 | `-Agent claude` 는 `~/.claude.json` 의 `mcpServers.serena`, `-Agent codex` 는 `~/.codex/config.toml` 의 `[mcp_servers."serena"]` 를 씀 | `install.ps1:31-96`, `:116-154`, `:235-241` |
| 등록 호출자 | `D:/Fork/KIT/install.ps1:559` 가 `-Agent 'claude'`, `install-codex.ps1:769` 가 `-Agent 'codex'` 로 부름. KIT 를 다시 설치할 때마다 등록이 되살아남 | 두 파일 |
| 이 PC 상태 | `~/.claude.json` 에 KIT 등록 있음. `~/.codex/config.toml` 에는 serena 블록 없음 | 직접 확인 |
| 팀 배포 | `distribution.team.json` 이 `tools/serena/*` 를 통째로 내보냄. 새 파일도 자동 포함 | `distribution.team.json:81` |

## 3. 공유 데몬과 MCP 비용 실측

KIT 공유 데몬은 프로젝트·컨텍스트·인자 조합마다 Serena MCP 서버를 streamable-http 로 띄운다. 127.0.0.1 임의 포트, Bearer 토큰, 유휴 1800초 종료다(`shared_server.py`, `shared_runtime.py`).

별도 프로세스에서 `shared_runtime.connect()` 로 붙어 측정했다(스크래치 스크립트, 이 레포 루트에서 실행).

| 측정 | 값 |
|---|---|
| 데몬 연결(콜드) | 6.07초 |
| initialize + tools/list | 0.07초 |
| `get_symbols_overview` 호출(웜) | 0.13초 |
| 도구 수 / tools/list JSON 크기 | 21개 / 26,210자 |
| `initial_instructions` 결과 크기 | 8,879자 |
| 서버 instructions | 130자 |
| `readOnlyHint` | 21개 모두 있음. 읽기 전용 10개, 편집 11개 |

읽기 전용 10개: `find_declaration`, `find_implementations`, `find_referencing_symbols`, `find_symbol`, `get_diagnostics_for_file`, `get_symbols_overview`, `initial_instructions`, `list_memories`, `onboarding`, `read_memory`.

## 4. 시제품 CLI 검증 (스크래치, 저장소 변경 없음)

| 확인 | 결과 |
|---|---|
| `serena-cli tools` | 10줄, 946자. 첫 호출 762ms, 캐시 호출 492ms |
| `serena-cli schema find_symbol` | 4,321자 (밑줄 별칭을 뺀 뒤) |
| `serena-cli find_symbol check_codegraph_recent --relative-path .claude/hooks/codegraph-gate.sh` | 524ms, `relative_path`·`body_location` 포함 JSON |
| `-j` | `{"jsonrpc":"2.0","id":...,"result":{"status":"ok","tool":...,"data":...}}` 한 줄 |
| 편집 도구·모르는 도구·필수 인자 누락 | 종료 코드 1 |
| 단위 테스트 15개 | `python3 -m pytest` 통과 (0.58초) |

Serena 의 `body_location` 줄 번호는 0 기준이다. `check_codegraph_recent` 는 파일 65행에서 시작하는데 Serena 는 `start_line: 64` 를 준다.

## 5. 상류 Serena

- v1.7.1 과 v2.1.0(2026-10-19) 모두 도구를 직접 부르는 CLI 명령이 없다. `serena tools` 는 `list`, `description` 뿐이다.
- `start-project-server` 는 MCP 없는 HTTP 경로지만 읽기 전용이고, v2 부터 `auth_secret` 인증을 요구한다. 사용자 결정으로 이번에는 쓰지 않는다.
- v2.0.0 부터 Serena 본체가 GPL-3.0-or-later 다. 이번 계획은 Serena 소스를 고치지 않고 HTTP 로만 부른다.

## 6. 테스트 기준선 (변경 전)

| 테스트 | 결과 |
|---|---|
| `test/Serena-Installer.Tests.ps1` (Windows PowerShell 5.1) | 9/9 통과 |
| 같은 테스트 (pwsh 7.6.9) | 8/9. "registers Claude ..." 가 `System.Web` 로딩 실패 |
| `test/Install-Claude.Tests.ps1` | 16/16 (두 엔진) |
| `test/Export-Dist.Tests.ps1` | 4/4 |
| `test/test_serena_shared.py` (system python3) | 9 실패, 7 통과. "Serena startup exited 1". 이번 변경과 무관한 기존 상태 |
| 이 레포 `codegraph-gate-matrix.sh` / `outcome-matrix.sh` / `sonar-guard-matrix.sh` | 15/0, 21/0, 28/0 |

- Pester 는 두 엔진 모두 3.4.0 이다.
- `pwsh -Command "Invoke-Pester ... -EnableExit"` 는 실패가 있어도 종료 코드 0 을 돌려줬다. 수락 기준은 `-PassThru` 의 `TotalCount`·`FailedCount` 로 판정한다.
- `pack.py` 는 수락 명령을 `bash -c` 로 저장소 루트에서 돌리고, 제한 시간은 300초(`PACK_CMD_TIMEOUT`)다.

## 7. 이 레포 훅 사실

- `tool-history-recorder.sh` 는 Bash 의 `codegraph <sub>` 만 `codegraph_<sub>` 로 번역한다(`:32-70`).
- 좌표 원장은 codegraph 탐색 호출에서만 쓴다(`:97-124`). Bash 응답 dict 를 통째로 `json.dumps` 하므로 stdout 안 JSON 의 따옴표가 이스케이프되어 `"filePath": "..."` 정규식이 맞지 않는다. 접두어(`Assets`, `docs`, `manage`, `tools`, `.claude`) 정규식만 경로를 건진다.
- `codegraph-gate.sh` 의 `LOCATING_TOOLS` 는 codegraph 서브커맨드만 통행증으로 본다(`:56`).
- `outcome.py` 는 `codegraph_` 접두만 결과 건수로 판정한다(`:130-133`).
- `CORE_RULES` RULE-1 은 `session-start.sh:29`, `post-compact.sh:29` 에 같은 문장이 있다.
- 이 레포에서 `mcp__serena__` 를 참조하는 파일은 없다.

## 8. KIT 안내문 중 Serena MCP 를 전제한 곳

| 파일 | 위치 |
|---|---|
| `settings.template.json` | `:62-70` `mcp__serena__*` 허용 9개 |
| `test/Install-Claude.Tests.ps1` | `:97` 위 허용을 검사 |
| `hooks/codegraph-session.ps1` | `:46`, `:177` 세션 안내 |
| `hooks/codegraph-session.sh` | `:52`, `:136` 세션 안내 |
| `rules/RULES.md` | `:302-308` MCP 사용, 탐색 규율, `initial_instructions` SSOT, 의미 라우팅 |
| `codex/AGENTS.md` | `:22` |
| `distribution/team/AGENTS.md` | `:19` |
| `references/HARD_RULES_DETAILS.md` | `:244-248` |

`hooks/codegraph-guard.*`, `references/PRINCIPLES.md`, `rules/RULES.md:391` 은 "Serena" 를 일반 명칭으로만 써서 이번 범위에 넣지 않는다.

## 9. 범위 밖으로 기록만 하는 것

- zvec-grep 포크: `D:/Fork/zvec-grep` (origin `evespimrose/zvec-grep`, `4eaaeb8` 2026-11-03). zg 단계는 별도 작업이다.
- `test_serena_shared.py` 의 기존 실패 9건.
- PowerShell 도구로 부른 `serena-cli`·`codegraph` 는 기록기가 번역하지 않는다(지금도 Bash 만 번역).
