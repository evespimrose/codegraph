# 발상: serena-cli 설계 결정

> 작성일: 2026-11-04
> 조사: `main-2026-11-04-serena-cli-kit-research.md`

## 1. 온디맨드 스키마 3단 구조

| 단계 | 내용 | 비용 |
|---|---|---|
| 0 상시 | 규칙·세션 안내에 "serena-cli tools / schema <tool>" 한 줄 | 문장 하나 |
| 1 목록 | `serena-cli tools`: 읽기 전용 도구 이름과 한 줄 요약 | 946자 (실측) |
| 2 상세 | `serena-cli schema <tool>`: 한 도구의 플래그와 설명. `-j` 는 JSON Schema | 도구 하나에 수천 자 (find_symbol 4,321자) |
| 캐시 | `tools/list` 결과를 릴리스·컨텍스트별 파일로 저장. 없을 때만 데몬에 물음 | 캐시 적중 시 데몬 호출 없음 |

지금 MCP 는 연결 때 21개 도구 이름과 서버 지침을 싣고, 스키마를 불러오면 26,210자, 지침서(`initial_instructions`)를 읽으면 8,879자를 더 쓴다.

## 2. 고려한 안과 결정

| 주제 | 안 | 결정 | 근거 |
|---|---|---|---|
| 구현 위치 | KIT + 이 레포 / 이 레포만 | KIT + 이 레포 | 사용자 결정. KIT 설치기가 등록을 매번 되살리므로 KIT 를 고쳐야 유지됨 |
| 등록 해제 범위 | Claude 만 / Claude 와 Codex | Claude 와 Codex | 사용자 결정 |
| 해제 대상 | serena 키 전부 / KIT 가 만든 항목만 | KIT 가 만든 항목만 | 인자에 `shared_client.py` 또는 `start-client.ps1` 이 있는 항목. 사용자가 직접 등록한 serena 는 둠 |
| 전송 | 상류 project server / KIT 공유 데몬 | KIT 공유 데몬 재사용 | 사용자 결정. 기동 잠금, 인증, 유휴 종료가 이미 있음 |
| 입력 | MCP JSON 인자 / codegraph 식 플래그 | 플래그. 필수는 위치 인자, 선택은 `--kebab-case` | 사용자 결정. 스키마에서 파서를 만들어 하드코딩하지 않음 |
| 출력 | 텍스트 / JSON-RPC | 기본 텍스트, `-j` 는 JSON-RPC 2.0 한 줄 | 사용자 결정. `result.status`·`result.data`, 실패는 `error` 와 `error.data.status` |
| 편집 도구 | 노출 / 비노출 | 비노출 (`readOnlyHint` 참인 도구만) | 편집을 Bash 로 하면 Write/Edit 훅과 RULE-4 승인을 우회함 |
| 줄 번호 | 1 기준으로 바꿈 / Serena 그대로 | 그대로(0 기준) + 안내 | 입력 인자와 출력의 기준을 같게 유지 |
| 셸 shim | `.cmd` 만 / `.cmd` + sh | 둘 다 `~/.local/bin` | KIT codegraph shim 과 같은 방식. Git Bash 는 `.cmd` 를 이름만으로 못 부름 |

## 3. 플랜 나누기

RULE-7 은 플랜당 10단계까지다. 그래서 파일 집합이 겹치지 않게 세 플랜으로 나눈다.

| 플랜 | 저장소 | 내용 | 선후 |
|---|---|---|---|
| `main-2026-11-04-serena-cli-kit` | KIT | CLI, CLI 테스트, 설치기, 설치기 테스트, 배포 테스트, README | 먼저 |
| `main-2026-11-04-serena-cli-guidance` | KIT | 권한 템플릿, 세션 훅 안내, RULES, AGENTS, 참고 문서 | KIT 런타임과 같이 배포 |
| `main-2026-11-04-serena-cli-hooks` | 이 레포 | 기록기, Read 게이트, outcome, 매트릭스, RULE-1, CORE_RULES | 병행 가능 |

세 플랜의 파일은 겹치지 않는다. 실제 CLI 호출이 필요한 수락 기준(A4 이후)은 KIT 배포(사람 단계 H1) 뒤에 돈다.

`rules/RULES.md` 는 `~/.claude/rules` 정션이라 고치는 순간 모든 세션에 반영된다. 그래서 안내문 플랜은 런타임 플랜을 배포할 때 같이 반영한다.

## 사용자 결정

- 2026-11-04 "플랜시작, serena mcp와의 의존성 해제까지 진행. 왜냐하면 : 커넥터 연결 시의 tool 설명 내려받는게 너무 토큰 부담이 큼."
- 2026-11-04 구현 위치: "KIT + 이 레포 (권장)".
- 2026-11-04 Codex 등록: "Claude 와 Codex 모두".
- 2026-11-04 CLI 경로: "KIT 공유 데몬 재사용하되 mcp 프로토콜은 -j(json-rpc형식의 출력 사용) 플래그를 이용해서 선택적으로 온오프 가능하도록. 입력은 codegraph-cli처럼 입력에서의 mcp양식 제약 해소하고 싶음"
- 2026-11-04 "나는 tool schema를 온디맨드로 읽을수 있도록 해서 매번 내는 콜드스타트 세금을 절약하고 싶은거야." 2단계 선택(목록, 상세), 스키마 캐시, 출력 구조 표준화(status, data, error) 요청.
- 2026-11-04 Serena 설치 위치 안내: `D:/Fork/KIT/tools/serena`. zg 포크 위치 안내: `D:\Fork\zvec-grep` (이번 범위 밖).
