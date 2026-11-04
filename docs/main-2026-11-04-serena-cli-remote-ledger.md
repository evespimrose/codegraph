# 세션 원장: serena-cli 리모트 세션 (2026-11-04)

리모트(클라우드) 세션이 한 일을 한곳에 모은 기록이다. 로컬 PC 세션이 이 파일 하나로 이어받도록 `/memory:save` 형식을 따른다.

- **Session**: https://claude.ai/code/session_01DBP46Y5rMnj2dhDe3yFSGN (클라우드 컨테이너, Linux. `D:` 드라이브 없음)
- **Saved**: 2026-11-04 14:08 KST
- **Branch**: `claude/keen-carson-turtwr` (두 저장소 모두 같은 이름)
- **Base**: codegraph `5e290af`(사용자 push), claude-personal-integrated-workflow `11c3ac3`(GitHub main, 2026-06-04)
- **Commits made**: workflow `c7e6b5b`, `8350073` / codegraph: 이 원장을 넣은 커밋
- **Not changed**: KIT(`D:\Fork\KIT`), 로컬 `D:\Fork\claude-personal-integrated-workflow`, 플랜 3개, 상태 파일

## 한 줄 요약

실행 카드는 클라우드에서 돌리지 못했다. 세 플랜이 고치는 파일이 모두 로컬에만 있기 때문이다. 대신 hooks 플랜 10단계 전체와 kit 플랜 1·2단계를 스크래치 사본에서 리허설했고 모두 통과했다. KIT 배포 스크립트는 workflow 브랜치에 올렸다.

## 작업 상태

| 작업 (slug) | 플랜 사본 | 리허설 결과 | 로컬에서 할 일 |
|---|---|---|---|
| `main-2026-11-04-serena-cli-kit` | `docs/main-2026-11-04-serena-cli-kit.md` (9단계) | 1·2단계 통과(시험 15/15). 3~9단계는 KIT 와 PowerShell 이 없어 못 함. 정적 점검 결함 0 | Execute 카드 |
| `main-2026-11-04-serena-cli-hooks` | `docs/main-2026-11-04-serena-cli-hooks.md` (10단계) | 10/10 DONE, A1~A4 통과. A5·H1 은 배포 뒤 | Execute 카드 (kit 와 동시) |
| `main-2026-11-04-serena-cli-guidance` | `docs/main-2026-11-04-serena-cli-guidance.md` (10단계) | 대상이 모두 KIT 파일이라 못 함. 정적 점검 결함 0 | kit 결과 확인 뒤 Execute 카드 |

상태 파일 3개는 push 되지 않아 MODE 를 보지 못했다. 세 플랜의 `## 승인 기록` 에는 G1 승인(2026-11-04)이 적혀 있다.

## 로컬 세션이 할 일

`D:\Fork\claude-personal-integrated-workflow` 루트 세션(Sonnet 5.5)에서 한다.

1. 실행 카드 두 장을 연다. 파일이 겹치지 않아 동시에 돌려도 된다.
   - `/riper:workflow main-2026-11-04-serena-cli-kit`
   - `/riper:workflow main-2026-11-04-serena-cli-hooks`
2. kit 카드 결과를 확인한 뒤 `/riper:workflow main-2026-11-04-serena-cli-guidance` 로 안내문 카드를 연다. `rules/RULES.md` 는 `~/.claude/rules` 정션이라 고치는 즉시 모든 세션에 반영된다(guidance 플랜의 결정).
3. 세 카드가 끝나면(상태 파일 3개가 모두 `MODE=REVIEW`) KIT 를 배포한다(kit 플랜 H1). 아래 "KIT 배포 스크립트" 절을 따른다.
4. 배포 뒤 작업마다 `/riper:workflow <slug>` 로 REVIEW 를 잇는다. kit 의 A4~A6 과 hooks 의 A5 는 배포 뒤에만 통과한다. kit 의 `pack.py build` 는 H1 뒤에 돌린다(kit 플랜 수락 기준).

선택: 카드 전에 아래 "리허설 해시" 로 로컬 파일이 리허설 기준과 같은지 보면, 리허설 결과를 그대로 믿어도 되는지 알 수 있다.

## 이 세션의 사용자 지시

1. 첫 메시지: 플랜 세션의 보고를 붙여 넣고 "실행 카드 두 장 시작". 카드가 끝나면 KIT 배포를 지시하는 스크립트를 남기고, git 설명에 넣어 로컬 머신에 전달.
2. 플랜을 git 으로 올림. codegraph `08a6b23` 에는 sync-speed 문서와 `.serena/` 만 있었고, `5e290af` 에 serena-cli 플랜 3개와 kit 의 research·innovate 문서가 들어옴.
3. "할 수 있는 만큼 ㄱㄱ", 번호는 지정하지 않음. 이 세션의 작업 전부를 원장 하나로 `docs/` 에 두고, 커밋에 넣고, 커밋 설명에서 언급.

## 확인한 사실

- 플랜 대상 경로: kit·guidance 는 `D:/Fork/KIT/...` 이고 KIT 는 GitHub 저장소가 없다(`list_repos` 로 확인). hooks 는 `D:\Fork\claude-personal-integrated-workflow\...` 인데, 이 저장소의 GitHub main 은 2026-06-04 판이라 `.claude/hooks/lib/outcome.py` 와 `.claude/hooks/tests/` 가 없다.
- 이 세션이 쓸 수 있는 Remote Control 폴더가 없다(`list_computer_folders` 빈 목록). 그래서 로컬 파일에 닿을 수 없다.
- 플랜의 검증 명령은 `D:/Fork/...` 절대 경로와 `powershell.exe`·Pester 를 쓴다. 실행 카드는 플랜을 적힌 그대로만 실행하므로, 경로를 바꿔 돌리는 것은 G1 범위 밖이다.
- codegraph 의 `.claude` 하네스 사본에서 hooks 플랜의 '변경 전' 10곳이 각각 정확히 한 번 나온다. hooks 리허설은 이 사본으로 했다.
- codegraph `source/` 의 다이제스트(파일 363개)가 `manifest.json` 의 `sourceTreeSha256`(`122d32cc87b5…`)과 같다. 빌드 sha256 `8e92ff564f22…` 는 sync-speed 조사의 대상 빌드(`1.1.2-8e92ff564f22`)와 같다.

## 리허설: hooks

방법: codegraph `5e290af` 를 스크래치 폴더에 clone 하고 `riper:execute` 규칙대로 적용했다. replace 와 insert-after 는 '변경 전' 이 정확히 한 번 나올 때만 바꿨다. 단계마다 플랜의 검증 명령을 그대로 돌렸다. 저장소 파일은 바꾸지 않았다.

기준선(변경 전): `codegraph-gate-matrix` PASS=15 FAIL=0, `outcome-matrix` PASS=21 FAIL=0, `sonar-guard-matrix` PASS=28 FAIL=0. 모두 exit 0.

| 단계 | 파일 | 동작 | 검증 출력 (= 기대 출력) |
|---|---|---|---|
| 1 | `.claude/hooks/tool-history-recorder.sh` | replace | `0 1` |
| 2 | `.claude/hooks/tool-history-recorder.sh` | replace | `1 1` |
| 3 | `.claude/hooks/codegraph-gate.sh` | replace | `1` |
| 4 | `.claude/hooks/lib/outcome.py` | replace | `1` |
| 5 | `.claude/hooks/lib/outcome.py` | replace | `1` |
| 6 | `.claude/hooks/tests/outcome-matrix.sh` | insert-after | `PASS=27 FAIL=0` |
| 7 | `.claude/hooks/tests/codegraph-gate-matrix.sh` | insert-after | `PASS=19 FAIL=0` |
| 8 | `CLAUDE.md` | replace | `1 1` |
| 9 | `.claude/hooks/session-start.sh` | replace | `1` |
| 10 | `.claude/hooks/post-compact.sh` | replace | `1` |

10단계 모두 DONE. 바뀐 파일은 플랜의 `## 바뀔 파일` 8개와 같다(98줄 추가, 16줄 삭제).

수락 기준:

| id | 결과 |
|---|---|
| A1 `bash .claude/hooks/tests/codegraph-gate-matrix.sh` | exit 0, PASS=19 FAIL=0 |
| A2 `bash .claude/hooks/tests/outcome-matrix.sh` | exit 0, PASS=27 FAIL=0 |
| A3 `bash .claude/hooks/tests/sonar-guard-matrix.sh` | exit 0, PASS=28 FAIL=0 |
| A4 CORE_RULES 의 RULE-1 줄 비교 | exit 0 |
| A5 `serena-cli find_symbol ...` | 안 돌림. `serena-cli` 는 KIT 배포 뒤에 생김 |
| H1 | 사람 확인 (새 세션) |

추가 확인: 바뀐 셸 스크립트 6개 `bash -n` 통과, `outcome.py` `py_compile` 통과, 두 훅의 `CORE_RULES` 블록(9줄)이 바이트까지 같음.

### 리허설 해시

sha256 앞 12자, LF 기준이다. 로컬에서는 줄바꿈을 LF 로 바꿔 계산한다. 아래 명령은 workflow 폴더 루트에서 돌린다.

```bash
python3 -c "import hashlib,sys; [print(hashlib.sha256(open(f,'rb').read().replace(b'\r\n',b'\n')).hexdigest()[:12], f) for f in sys.argv[1:]]" .claude/hooks/tool-history-recorder.sh .claude/hooks/codegraph-gate.sh .claude/hooks/lib/outcome.py .claude/hooks/tests/outcome-matrix.sh .claude/hooks/tests/codegraph-gate-matrix.sh CLAUDE.md .claude/hooks/session-start.sh .claude/hooks/post-compact.sh
```

| 파일 | 카드 전 (codegraph 사본) | 카드 뒤 (리허설) |
|---|---|---|
| `.claude/hooks/tool-history-recorder.sh` | `4ea9ab135b1d` | `e1c334d137ef` |
| `.claude/hooks/codegraph-gate.sh` | `1fefab4b976e` | `f1880cfeed71` |
| `.claude/hooks/lib/outcome.py` | `fd51ef7928bd` | `0ba2f9897ece` |
| `.claude/hooks/tests/outcome-matrix.sh` | `5ad139f9894b` | `30574fbe17ea` |
| `.claude/hooks/tests/codegraph-gate-matrix.sh` | `4ee6cabcc5bd` | `9c2f8a4250de` |
| `CLAUDE.md` | `5fa2a962c124` | `91f4f9bb9f53` |
| `.claude/hooks/session-start.sh` | `003d59e00d38` | `1c07c62f8be6` |
| `.claude/hooks/post-compact.sh` | `d5ab33ff3dff` | `67d0c5c178e4` |

카드 전 값이 같으면 로컬 카드 결과도 "카드 뒤" 값과 같아야 한다. `CLAUDE.md` 는 프로젝트마다 다른 부분이 있어 카드 전 값이 다를 수 있다.

## 리허설: kit 1·2단계

- 1단계(create `tools/serena/serena_cli.py`, 247줄): 검증 `ast.parse` 출력 `ok`. DONE.
- 2단계(create `test/test_serena_cli.py`, 173줄): 이 컨테이너에 pytest 가 없어 플랜의 검증 명령은 exit 1(`No module named pytest`)이었다. 같은 시험을 `python3 -m unittest discover -s test -p test_serena_cli.py` 로 돌려 15개 모두 통과했다(exit 0). 플랜의 기대 "15 passed" 와 개수가 같다.
- KIT 모듈 `shared_client`, `shared_runtime` 은 import 만 되게 가짜 파일을 두었다. 호출을 기록해 보니 `shared_runtime.configuration` 14회뿐이었다. 시험이 `Session` 과 `cache_path` 를 가짜로 바꿔 끼우기 때문이다. 그래서 이 결과는 CLI 로직(인자 처리, `-j` 출력, 종료 코드)의 검증이고, KIT 공유 데몬 연동의 검증은 아니다.
- 만든 파일의 해시(앞 12자): `serena_cli.py` `0ae557071b8f`, `test_serena_cli.py` `a3b7ee0262bd`. 카드가 같은 파일을 만들면 값이 같아야 한다.
- 3~9단계(`install.ps1`, Pester 시험, Export-Dist, README): KIT 파일과 PowerShell 이 없어 못 했다.
- Python 3.13.18 (Linux) 로 돌렸다. 로컬 Python 판과 다를 수 있다.

## 정적 점검: kit 3~9단계, guidance 1~10단계

검증 명령이 실제로 돌릴 Python 소스를 그대로 뽑아서, `t.count('<문자열>')` 의 기대값이 '변경 전'·'변경 후' 블록과 모순되지 않는지 봤다.

- 결함 0. 지워져야 하는 문자열(기대 0)은 모두 '변경 전' 에만 있고 '변경 후' 에는 없다. 새 문자열(기대 1·2)은 '변경 후' 에 기대 개수만큼 있다.
- guidance 1단계: '변경 전' 의 `mcp__serena` 9개가 '변경 후' 에서 빠지고 `Bash(serena-cli:*)`, `PowerShell(serena-cli:*)` 가 들어간다.
- guidance A2 조건: 8개 파일 모두 '변경 후' 블록에 `serena-cli` 가 있고 `mcp__serena` 는 없다.
- 한계: 파일의 다른 곳에 같은 문자열이 남아 있는지는 KIT 파일이 없어 확인하지 못했다. PowerShell 블록은 파싱하지 못했다.

## KIT 배포 스크립트

- 위치: evespimrose/claude-personal-integrated-workflow, 브랜치 `claude/keen-carson-turtwr`, `scripts/serena-cli-kit-deploy.ps1` (`c7e6b5b` 에서 추가, `8350073` 에서 갱신)
- 하는 일: serena-cli 상태 파일 3개가 모두 `MODE=REVIEW` 인지 확인 → `D:\Fork\KIT\install.ps1` 실행 → `-Codex` 를 주면 `install-codex.ps1` 실행 → H1 확인(`%USERPROFILE%\.local\bin` 에 `serena-cli`, `serena-cli.cmd` 가 있는지).
- 종료 코드: 0 완료, 2 카드 미완료(`-Force` 로 건너뜀), 4 shim 없음, 그 밖은 설치 실패.
- 실행: workflow 폴더 루트에서 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serena-cli-kit-deploy.ps1` (Codex 를 쓰면 `-Codex`).
- 브랜치를 바꾸지 않고 파일만 받기(작업 트리에만 쓰고 index 는 그대로):

```bash
git fetch origin claude/keen-carson-turtwr
```

```bash
git restore --source origin/claude/keen-carson-turtwr -- scripts/serena-cli-kit-deploy.ps1
```

- 검증 한계: Windows PowerShell 로 실행하거나 파싱해 보지 못했다(이 컨테이너에 PowerShell 이 없음). ASCII 전용, LF, 괄호와 따옴표 짝만 확인했다.
- `c7e6b5b` 의 커밋 설명 중 "플랜이 GitHub 에 없다" 는 옛 내용이다. `8350073` 의 설명이 대신한다.

<details>
<summary>스크립트 전문 (8350073)</summary>

```powershell
# serena-cli execute cards -> KIT deploy (kit plan H1). Run on the local PC after the cards finish.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serena-cli-kit-deploy.ps1 [-Codex] [-Force]
# Card order (from the plan approval notes): kit + hooks cards, then the guidance card after the kit result, then this script.
# -Codex : also run install-codex.ps1 (only when Codex is used)
# -Force : deploy even if a serena-cli state file is not MODE=REVIEW yet
# Session ledger: evespimrose/codegraph, branch claude/keen-carson-turtwr, docs/main-2026-11-04-serena-cli-remote-ledger.md
param(
    [string]$KitRoot = 'D:\Fork\KIT',
    [string]$WorkflowRoot = 'D:\Fork\claude-personal-integrated-workflow',
    [string]$BinRoot = (Join-Path $env:USERPROFILE '.local\bin'),
    [switch]$Codex,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'

# 1. Cards finished? Each serena-cli state file must read MODE=REVIEW.
$riperDir = Join-Path $WorkflowRoot '.claude\memory-bank\main\riper'
$pending = @()
foreach ($part in @('kit', 'hooks', 'guidance')) {
    $stateFile = Join-Path $riperDir "main-2026-11-04-serena-cli-$part.state"
    $mode = 'MISSING'
    if (Test-Path -LiteralPath $stateFile) {
        $modeLine = Get-Content -LiteralPath $stateFile | Where-Object { $_ -like 'MODE=*' } | Select-Object -First 1
        if ($modeLine) { $mode = $modeLine.Substring(5).Trim() } else { $mode = 'NO-MODE' }
    }
    Write-Host ("serena-cli-{0}: MODE={1}" -f $part, $mode)
    if ($mode -ne 'REVIEW') { $pending += $part }
}
if ($pending.Count -gt 0 -and -not $Force) {
    Write-Host ("Not finished: {0}. Deploy skipped (exit 2). Add -Force to deploy anyway." -f ($pending -join ', '))
    exit 2
}

# 2. KIT deploy, then the Codex installer when -Codex is given.
$installers = @('install.ps1')
if ($Codex) { $installers += 'install-codex.ps1' }
foreach ($name in $installers) {
    $installer = Join-Path $KitRoot $name
    if (-not (Test-Path -LiteralPath $installer)) {
        Write-Host "Not found: $installer"
        exit 1
    }
    Write-Host "> powershell -NoProfile -ExecutionPolicy Bypass -File $installer"
    $ErrorActionPreference = 'Continue'  # installer stderr must not abort this script
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) {
        Write-Host "$name failed (exit $code)"
        exit $code
    }
}

# 3. H1 expects the serena-cli shims in BinRoot after the install.
$missing = @()
foreach ($shim in @('serena-cli', 'serena-cli.cmd')) {
    $shimPath = Join-Path $BinRoot $shim
    if (Test-Path -LiteralPath $shimPath) {
        Write-Host "[H1] ok: $shimPath"
    } else {
        Write-Host "[H1] MISSING: $shimPath"
        $missing += $shimPath
    }
}
if ($missing.Count -gt 0) {
    Write-Host 'KIT installed, but the serena-cli shims are missing (exit 4).'
    exit 4
}
Write-Host 'KIT deploy done. Next: kit A4-A6 and hooks A5, then REVIEW with /riper:workflow <slug>.'
```

</details>

## 커밋, push, 차단 기록 (명령 = 종료 코드)

| 명령 | 결과 |
|---|---|
| workflow `git push -u origin claude/keen-carson-turtwr` (`c7e6b5b`) | 0 |
| 스크래치 clone 에서 `git restore --source origin/claude/keen-carson-turtwr -- scripts/serena-cli-kit-deploy.ps1` | 0 (파일만 생기고 index 는 그대로) |
| codegraph `git merge --ff-only origin/main` 뒤 `git push -u origin claude/keen-carson-turtwr` | 0 (`5e290af`, main 과 같음) |
| workflow `git push origin claude/keen-carson-turtwr` (`8350073`) | 0 |
| hooks 리허설: 단계 검증 10개, A1~A4 | 모두 0 |
| kit 1단계 검증 | 0 |
| kit 2단계 검증 (pytest) | 1 (pytest 없음). unittest 로 다시 돌려 0 |
| PowerShell 7 내려받기 (스크립트 문법 검사용) | 권한 분류기가 막음 (외부 코드 실행) |
| `c7e6b5b` amend 와 force push | 권한 분류기가 막음 (git 파괴 동작). 새 커밋 `8350073` 로 대신함 |

## 남은 것과 한계

- 실행 카드 3장, KIT 배포(H1), REVIEW, G2 는 로컬에서 한다.
- hooks 리허설은 codegraph 의 하네스 사본으로 했다. 로컬 workflow 폴더의 파일이 이 사본과 다르면 결과가 다를 수 있다. 위 해시로 확인한다.
- 리허설에 쓴 스크래치 파일(clone, 가짜 모듈, 점검 스크립트)은 세션이 끝나면 사라진다. 저장소에는 넣지 않았다.
- 다음 작업: codegraph-sync-speed 묶음 1 PLAN. 할 수 있다고 판정했다(위 다이제스트 일치). 결과는 이 원장에 덧붙인다.

## 사람 확인 항목

- 로컬 루트 세션에서 "로컬 세션이 할 일" 1번부터 진행한다.
- `install-codex.ps1` 이 `D:\Fork\KIT` 에 있다고 가정했다. 다르면 스크립트에 `-KitRoot` 를 주거나 직접 실행한다.
- 배포 스크립트는 Windows PowerShell 에서 처음 실행된다. 첫 실행 출력을 확인한다.
