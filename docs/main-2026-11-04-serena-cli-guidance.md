# 플랜: serena-cli KIT 안내문 (규칙, 세션 훅, AGENTS, 참고 문서, 권한 템플릿)

## 목표
KIT 의 규칙·세션 안내·에이전트 지침·권한 템플릿이 Serena MCP 도구 대신 `serena-cli` 와 온디맨드 스키마(`tools`, `schema <tool>`)를 가리키게 한다.

## 결정
- 이 플랜은 `main-2026-11-04-serena-cli-kit`(KIT 런타임)와 함께 배포한다. `rules/RULES.md` 는 `~/.claude/rules` 정션이라 고치는 즉시 모든 세션에 반영되므로, 런타임 플랜의 EXECUTE 가 끝난 뒤에 실행한다.
- 상시 안내에는 한 줄만 둔다: 목록은 `serena-cli tools`, 상세는 필요한 도구 하나만 `serena-cli schema <tool>`.
- 권한 템플릿은 `mcp__serena__*` 9개를 `Bash(serena-cli:*)`, `PowerShell(serena-cli:*)` 로 바꾼다. CLI 는 읽기 전용 도구만 연다.
- "Serena" 를 일반 명칭으로만 쓰는 곳(`hooks/codegraph-guard.*`, `references/PRINCIPLES.md`, `rules/RULES.md:391`)은 고치지 않는다.
- 코드·문구 블록은 0열에서 시작한다. 블록 안 텍스트를 그대로 쓴다. 바꿀 부분이 한 줄의 일부이면 "변경 전" 은 그 줄 안에서 유일한 부분 문자열이다.

## 바뀔 파일
| 파일 | 변경 |
|---|---|
| `D:/Fork/KIT/settings.template.json` | 권한 허용 목록 |
| `D:/Fork/KIT/test/Install-Claude.Tests.ps1` | 권한 검사 |
| `D:/Fork/KIT/hooks/codegraph-session.ps1` | 세션 안내 2곳 |
| `D:/Fork/KIT/hooks/codegraph-session.sh` | 세션 안내 2곳 |
| `D:/Fork/KIT/rules/RULES.md` | 도구 최적화 절 302-308행 |
| `D:/Fork/KIT/codex/AGENTS.md` | 소스 탐색 문단 |
| `D:/Fork/KIT/distribution/team/AGENTS.md` | 소스 탐색 문장 |
| `D:/Fork/KIT/references/HARD_RULES_DETAILS.md` | Serena 절 |

## 단계

### 단계 1: 권한 템플릿
- 파일: `D:\Fork\KIT\settings.template.json`
- 위치: `permissions.allow` 62-70행
- 동작: replace
- 변경 전:
```json
      "mcp__serena__initial_instructions",
      "mcp__serena__get_symbols_overview",
      "mcp__serena__find_symbol",
      "mcp__serena__find_referencing_symbols",
      "mcp__serena__find_implementations",
      "mcp__serena__find_declaration",
      "mcp__serena__get_diagnostics_for_file",
      "mcp__serena__list_memories",
      "mcp__serena__read_memory",
```
- 변경 후:
```json
      "Bash(serena-cli:*)",
      "PowerShell(serena-cli:*)",
```
- 검증: `python3 -c "import json; a=json.load(open('D:/Fork/KIT/settings.template.json', encoding='utf-8'))['permissions']['allow']; print(sum('mcp__serena' in x for x in a), 'Bash(serena-cli:*)' in a, 'PowerShell(serena-cli:*)' in a)"`
- 기대 출력: `0 True True`

### 단계 2: 설치 테스트의 권한 검사
- 파일: `D:\Fork\KIT\test\Install-Claude.Tests.ps1`
- 위치: 97행
- 동작: replace
- 변경 전:
```powershell
        ($allowed -contains 'mcp__serena__find_symbol') | Should Be $true
```
- 변경 후:
```powershell
        ($allowed -contains 'Bash(serena-cli:*)') | Should Be $true
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/test/Install-Claude.Tests.ps1', encoding='utf-8').read(); print(t.count('mcp__serena'), t.count('Bash(serena-cli:*)'))"`
- 기대 출력: `0 1`

### 단계 3: PowerShell 세션 안내 (색인 완료)
- 파일: `D:\Fork\KIT\hooks\codegraph-session.ps1`
- 위치: 46행 `$msg` 문자열 안
- 동작: replace
- 변경 전:
```text
start with Serena (symbol lookup, references, symbol edits) and the codegraph CLI
```
- 변경 후:
```text
start with serena-cli for symbols and references (run serena-cli tools for the tool list and serena-cli schema <tool> for the arguments of one tool) and the codegraph CLI
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/hooks/codegraph-session.ps1', encoding='utf-8').read(); print(t.count('start with serena-cli for symbols'), t.count('start with Serena'))"`
- 기대 출력: `1 0`

### 단계 4: PowerShell 세션 안내 (색인 중)
- 파일: `D:\Fork\KIT\hooks\codegraph-session.ps1`
- 위치: 177행 `$msg` 문자열 안
- 동작: replace
- 변경 전:
```text
Use Serena for source symbols and references now
```
- 변경 후:
```text
Use serena-cli for source symbols and references now
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/hooks/codegraph-session.ps1', encoding='utf-8').read(); print(t.count('Use serena-cli for source symbols'), t.count('Use Serena for source symbols'))"`
- 기대 출력: `1 0`

### 단계 5: bash 세션 안내 (색인 완료)
- 파일: `D:\Fork\KIT\hooks\codegraph-session.sh`
- 위치: 52행 `message=` 문자열 안
- 동작: replace
- 변경 전:
```text
start with Serena (symbol lookup, references, symbol edits) and the codegraph CLI
```
- 변경 후:
```text
start with serena-cli for symbols and references (run serena-cli tools for the tool list and serena-cli schema <tool> for the arguments of one tool) and the codegraph CLI
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/hooks/codegraph-session.sh', encoding='utf-8').read(); print(t.count('start with serena-cli for symbols'), t.count('start with Serena'))"`
- 기대 출력: `1 0`

### 단계 6: bash 세션 안내 (색인 중)
- 파일: `D:\Fork\KIT\hooks\codegraph-session.sh`
- 위치: 136행 `emit_context` 문자열 안
- 동작: replace
- 변경 전:
```text
Use Serena for source symbols and references now
```
- 변경 후:
```text
Use serena-cli for source symbols and references now
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/hooks/codegraph-session.sh', encoding='utf-8').read(); print(t.count('Use serena-cli for source symbols'), t.count('Use Serena for source symbols'))"`
- 기대 출력: `1 0`

### 단계 7: RULES.md 도구 최적화 절
- 파일: `D:\Fork\KIT\rules\RULES.md`
- 위치: 302-308행
- 동작: replace
- 변경 전:
```markdown
- **MCP Server Usage**: Use Serena for semantic symbols and reference-aware refactors; use other specialized MCP servers only for their defined strengths
- **Batch Operations**: Use MultiEdit over multiple Edits, batch Read calls, group operations
- **Search Discipline**: Use Serena for references, declarations, implementations, and symbol refactors. Use CodeGraph for call paths, architecture, dependencies, and impact. Use text and file search for non-source content or an explicitly justified fallback.
- **Efficiency First**: Choose speed and power over familiarity - use the fastest method available
- **Tool Specialization**: Match tools to their designed purpose (e.g., playwright for web, context7 for docs)
- **MCP-initialize is SSOT**: Before the first Serena coding operation, load `initial_instructions` and activate the repository. The `recall` skill queries `~/.codex/docs` for prior work and decisions.
- **Semantic routing**: Use Serena for symbol-centric work, CodeGraph for graph analysis, `apply_patch` for small known-location edits, exact-path tools for non-source files, and the shell for builds, tests, and Git. If semantic tools cannot cover source discovery, first state `[CODEGRAPH_FALLBACK: concrete reason]`.
```
- 변경 후:
```markdown
- **MCP Server Usage**: Use specialized MCP servers only for their defined strengths. Serena is not an MCP server in this harness. Call it through `serena-cli`.
- **Batch Operations**: Use MultiEdit over multiple Edits, batch Read calls, group operations
- **Search Discipline**: Use `serena-cli` for references, declarations, and implementations. Use CodeGraph for call paths, architecture, dependencies, and impact. Use text and file search for non-source content or an explicitly justified fallback.
- **Efficiency First**: Choose speed and power over familiarity - use the fastest method available
- **Tool Specialization**: Match tools to their designed purpose (e.g., playwright for web, context7 for docs)
- **serena-cli is on demand**: Do not preload Serena instructions or tool schemas. Run `serena-cli tools` for the one-line tool list and `serena-cli schema <tool>` only for the tool you will call. The `recall` skill queries `~/.codex/docs` for prior work and decisions.
- **Semantic routing**: Use `serena-cli` for symbol-centric reads, CodeGraph for graph analysis, `apply_patch` for small known-location edits, exact-path tools for non-source files, and the shell for builds, tests, and Git. If semantic tools cannot cover source discovery, first state `[CODEGRAPH_FALLBACK: concrete reason]`.
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/rules/RULES.md', encoding='utf-8').read(); print(t.count('serena-cli is on demand'), t.count('MCP-initialize is SSOT'))"`
- 기대 출력: `1 0`

### 단계 8: Codex 지침
- 파일: `D:\Fork\KIT\codex\AGENTS.md`
- 위치: 22행
- 동작: replace
- 변경 전:
```markdown
For source-code exploration or editing, call Serena's `initial_instructions` once per session. Use CodeGraph CLI `context`, `query`, `callers`, `callees`, and `impact` for architecture, call flow, and blast radius; use Serena for live symbols, references, edits, and diagnostics. Use raw Read/Grep/Write equivalents only when neither semantic tool can represent the task.
```
- 변경 후:
```markdown
For source-code exploration, use `serena-cli`. Run `serena-cli tools` for the tool list and `serena-cli schema <tool>` only for the tool you will call. Use CodeGraph CLI `context`, `query`, `callers`, `callees`, and `impact` for architecture, call flow, and blast radius. Use `serena-cli` for live symbols, references, implementations, and diagnostics, and edit files with your own edit tool. Use raw Read/Grep/Write equivalents only when neither semantic tool can represent the task.
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/codex/AGENTS.md', encoding='utf-8').read(); print(t.count('use \`serena-cli\`'), t.count('initial_instructions'))"`
- 기대 출력: `1 0`

### 단계 9: 팀 배포 지침
- 파일: `D:\Fork\KIT\distribution\team\AGENTS.md`
- 위치: 19행 마지막 문장
- 동작: replace
- 변경 전:
```text
Use Serena for live symbol references and edits, and use raw file search
```
- 변경 후:
```text
Use `serena-cli` for live symbol references (`serena-cli tools` lists the tools), edit files with your own edit tool, and use raw file search
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/distribution/team/AGENTS.md', encoding='utf-8').read(); print(t.count('serena-cli tools'), t.count('Use Serena for live symbol references'))"`
- 기대 출력: `1 0`

### 단계 10: 하드 규칙 상세의 Serena 절
- 파일: `D:\Fork\KIT\references\HARD_RULES_DETAILS.md`
- 위치: 244-248행
- 동작: replace
- 변경 전:
```markdown
**Serena**: Use Serena for symbol-centric work when its MCP tools are available and the language backend supports the target source.

- Before the first Serena coding operation in a conversation, call `initial_instructions`, then activate the repository with `activate_project`.
- Use `find_referencing_symbols` for all references, `find_declaration` and `find_implementations` for definition routing, `rename_symbol` for project-wide symbol renames, and `replace_symbol_body` for whole-method or whole-class replacement.
- Retrieve the target symbol body before replacing it. Use Serena's reference-aware refactoring tools instead of manual multi-file text replacement.
```
- 변경 후:
```markdown
**Serena**: Use `serena-cli` for symbol-centric reads when the language backend supports the target source. Serena is not registered as an MCP server.

- Run `serena-cli tools` for the one-line tool list. Run `serena-cli schema <tool>` only for the tool you will call. Do not preload `initial_instructions`.
- Use `find_referencing_symbols` for all references, `find_declaration` and `find_implementations` for definition routing, and `find_symbol` with `--include-body` to read one symbol.
- `serena-cli` exposes read-only tools only. Edit with `apply_patch` or the host edit tool, using the line range that `find_symbol` returns. Result line numbers are 0-based.
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/references/HARD_RULES_DETAILS.md', encoding='utf-8').read(); print(t.count('Serena is not registered as an MCP server'), t.count('activate_project'))"`
- 기대 출력: `1 0`

## 수락 기준
```acceptance
{"id":"A1","kind":"auto","cmd":"powershell.exe -NoProfile -Command '$r = Invoke-Pester -Script D:\\Fork\\KIT\\test\\Install-Claude.Tests.ps1 -PassThru -Quiet; if ($r.TotalCount -eq 0 -or $r.FailedCount -gt 0) { exit 1 }'","expect":"exit0"}
{"id":"A2","kind":"auto","cmd":"python3 -c \"import pathlib,sys; root=pathlib.Path('D:/Fork/KIT'); files=['settings.template.json','test/Install-Claude.Tests.ps1','hooks/codegraph-session.ps1','hooks/codegraph-session.sh','rules/RULES.md','codex/AGENTS.md','distribution/team/AGENTS.md','references/HARD_RULES_DETAILS.md']; texts={f:(root/f).read_text(encoding='utf-8') for f in files}; bad=[f for f,t in texts.items() if 'mcp__serena' in t or 'serena-cli' not in t]; print(bad); sys.exit(1 if bad else 0)\"","expect":"exit0"}
{"id":"A3","kind":"auto","cmd":"bash -n D:/Fork/KIT/hooks/codegraph-session.sh","expect":"exit0"}
{"id":"A4","kind":"auto","cmd":"powershell.exe -NoProfile -Command '$e = $null; [void][Management.Automation.Language.Parser]::ParseFile(\"D:\\Fork\\KIT\\hooks\\codegraph-session.ps1\", [ref]$null, [ref]$e); if ($e.Count) { exit 1 }'","expect":"exit0"}
{"id":"H1","kind":"human","how":"KIT 런타임 플랜과 함께 KIT install.ps1 로 배포한 뒤 새 세션을 연다","expect":"SessionStart 안내에 serena-cli 가 보이고, 기본 권한 모드에서 serena-cli 호출에 권한 확인 창이 뜨지 않음"}
```

## 범위 밖
- `hooks/codegraph-guard.sh`, `hooks/codegraph-guard.ps1` 의 거부 사유 문구("Use Serena for symbol work ...").
- `references/PRINCIPLES.md:8`, `rules/RULES.md:391` 의 일반 명칭 "Serena".
- 이미 설치된 사용자 settings 에 남은 `mcp__serena__*` 허용 항목. 도구가 없어 효과가 없다.

## 미결 질문
- 없음

## 승인 기록
- G1: 2026-11-04 사용자 승인(플랜과 `acceptance` 블록). 실행 카드는 루트 세션이 `main-2026-11-04-serena-cli-kit` EXECUTE 결과를 확인한 뒤 올린다.
