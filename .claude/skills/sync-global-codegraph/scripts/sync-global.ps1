# sync-global.ps1
# 전역 PATH의 `codegraph` 명령이 이 레포의 dist\bin\codegraph.js를 시스템 node로
# 직접 실행하도록 launcher(.cmd)를 심는다. npm 전역 bin을 건드리지 않으므로 다른
# 스코프 패키지와의 소유권 충돌이 구조적으로 없고, 이후엔 npm run build만 다시
# 실행해도 전역 명령에 즉시 반영된다(이 스크립트 재실행은 최초 1회면 충분).
# 종료코드: 0=동기화 성공, 1=빌드 실패(전역 미변경), 2=검증 실패(PATH 미반영 등)

$repo = (git rev-parse --show-toplevel 2>$null)
if (-not $repo) { $repo = (Get-Location).Path }
Set-Location $repo

$launcherDir  = Join-Path $env:LOCALAPPDATA 'codegraph-dev\bin'
$launcherPath = Join-Path $launcherDir 'codegraph.cmd'
$distEntry    = Join-Path $repo 'dist\bin\codegraph.js'

Write-Host "[1/5] build  ($repo)" -ForegroundColor Cyan
$o = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
  $o | Select-Object -Last 6
  Write-Host "BUILD FAILED - global UNCHANGED" -ForegroundColor Red
  exit 1
}

Write-Host "[2/5] stop running codegraph processes (any package - avoid file lock)" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='node.exe'" 2>$null |
  Where-Object {
    ($_.CommandLine -match 'codegraph') -and
    ($_.CommandLine -match 'serve\s+--mcp' -or
     $_.CommandLine -match 'codegraph[\\/]dist[\\/]bin[\\/]codegraph\.js' -or
     $_.CommandLine -like '*\.codegraph\bundles*' -or
     $_.CommandLine -like '*codegraph-dev\bin*')
  } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  killed PID $($_.ProcessId)" } catch {} }
Start-Sleep -Milliseconds 900

Write-Host "[3/5] retire npm-global codegraph (avoid PATH shadowing)" -ForegroundColor Cyan
# 직접 launcher로 전환하므로 npm 전역 bin 자체를 비운다 - 스코프 충돌(EEXIST)이 재발할 지점이 없어짐
foreach ($p in @('@evespimrose/codegraph', '@colbymchenry/codegraph')) {
  npm uninstall -g $p --no-audit --no-fund 2>$null | Out-Null
}

Write-Host "[4/5] write launcher -> $distEntry" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null
# --liftoff-only: tree-sitter wasm 대형 문법이 turboshaft로 올라가며 나는 Zone OOM 회피(issue #293/#298).
# CLI 자체 재실행도 이 플래그를 커버하지만 여기서 직접 넘겨 이중 스폰을 피함.
$launcherContent = '@node --liftoff-only "' + $distEntry + '" %*'
Set-Content -Path $launcherPath -Value $launcherContent -Encoding ascii

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
if (($userPath -split ';') -notcontains $launcherDir) {
  [Environment]::SetEnvironmentVariable('Path', ("$launcherDir;$userPath").TrimEnd(';'), 'User')
  Write-Host "  added $launcherDir to user PATH (새 터미널부터 반영)" -ForegroundColor Yellow
}

Write-Host "[5/5] verify" -ForegroundColor Cyan
$verOut = (& $launcherPath --version 2>$null | Select-Object -First 1)
$pkgVer = (node -p "require('./package.json').version")
if ($verOut -eq $pkgVer) {
  Write-Host "OK  global codegraph = $verOut  (direct launcher -> $repo)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "MISMATCH  launcher='$verOut' expected='$pkgVer'" -ForegroundColor Red
  exit 2
}
