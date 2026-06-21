# sync-global.ps1
# 이 프로젝트를 재빌드 → 전역 `codegraph` 명령을 최신 빌드로 교체(실제 복사).
# `npm link`(junction)이 이 머신에서 불안정하므로 pack + `npm install -g`(복사) 방식 사용.
# 종료코드: 0=동기화 성공, 1=빌드 실패(전역 미변경), 2=install 미반영(verify 불일치)
#
# Cross-scope bin 충돌 처리: 전역 `codegraph` bin을 다른 패키지(예: 업스트림
# @colbymchenry 포크)가 소유하면 npm이 EEXIST로 install을 거부한다. 이때 --force로
# bin을 재지정하고, 실행 중 codegraph MCP 프로세스(어느 패키지든)를 모두 정지해
# 전역 폴더 잠금(EPERM)을 푼다.

$pkg = '@evespimrose/codegraph'
$repo = (git rev-parse --show-toplevel 2>$null)
if (-not $repo) { $repo = (Get-Location).Path }
Set-Location $repo

Write-Host "[1/6] build  ($repo)" -ForegroundColor Cyan
$o = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
  $o | Select-Object -Last 6
  Write-Host "BUILD FAILED - global UNCHANGED" -ForegroundColor Red
  exit 1
}

Write-Host "[2/6] stop running codegraph processes (any package - avoid file lock)" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='node.exe'" 2>$null |
  Where-Object {
    ($_.CommandLine -match 'codegraph') -and
    ($_.CommandLine -match 'serve\s+--mcp' -or
     $_.CommandLine -match 'codegraph[\\/]dist[\\/]bin[\\/]codegraph\.js' -or
     $_.CommandLine -like '*\.codegraph\bundles*')
  } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  killed PID $($_.ProcessId)" } catch {} }
Start-Sleep -Milliseconds 900

Write-Host "[3/6] check `codegraph` bin owner + clean broken prior install" -ForegroundColor Cyan
$forceInstall = $false
$prefix = (npm prefix -g 2>$null)
$cmd = Join-Path $prefix 'codegraph.cmd'
if (Test-Path $cmd) {
  # The bin shim's target reveals which package owns `codegraph`. A foreign
  # owner (e.g. upstream @colbymchenry) makes a plain install EEXIST.
  if ((Get-Content $cmd -Raw) -notmatch [regex]::Escape('@evespimrose\codegraph')) {
    Write-Host "  '$pkg' bin owned by ANOTHER package -> install with --force (repoints bin)" -ForegroundColor Yellow
    $forceInstall = $true
  }
}
$global = Join-Path (npm root -g) ($pkg -replace '/','\')
if ((Test-Path $global) -and -not (Test-Path (Join-Path $global 'dist\bin\codegraph.js'))) {
  Write-Host "  removing broken prior $pkg install (node_modules only, no dist)" -ForegroundColor Yellow
  Remove-Item -Recurse -Force $global -ErrorAction SilentlyContinue
}

Write-Host "[4/6] pack" -ForegroundColor Cyan
$tgz = (npm pack 2>$null | Select-Object -Last 1).ToString().Trim()
$tgzPath = Join-Path $repo $tgz

$flags = if ($forceInstall) { '--force' } else { '' }
Write-Host "[5/6] install -g  $tgz $flags" -ForegroundColor Cyan
if ($forceInstall) {
  npm install -g $tgzPath --force --no-audit --no-fund 2>$null
} else {
  npm install -g $tgzPath --no-audit --no-fund 2>$null
}
Remove-Item $tgzPath -Force -ErrorAction SilentlyContinue

Write-Host "[6/6] verify  global == project" -ForegroundColor Cyan
$global = Join-Path (npm root -g) ($pkg -replace '/','\')
$allMatch = $true
foreach ($f in @('dist\bin\codegraph.js','dist\index.js','dist\db\schema.sql')) {
  $pp = Join-Path $repo $f
  $gp = Join-Path $global $f
  if ((Test-Path $pp) -and (Test-Path $gp)) {
    $m = (Get-FileHash $pp).Hash -eq (Get-FileHash $gp).Hash
    if (-not $m) { $allMatch = $false }
    Write-Host ("  {0,-26} {1}" -f $f, $m)
  } else {
    $allMatch = $false
    Write-Host ("  {0,-26} MISSING (proj={1} global={2})" -f $f, (Test-Path $pp), (Test-Path $gp))
  }
}
$ver = (codegraph --version 2>$null | Select-Object -First 1)
if ($allMatch) {
  Write-Host "OK  global codegraph = $ver  (matches project root)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "MISMATCH  global not fully updated (foreign bin owner? lock? rerun after closing agents)" -ForegroundColor Red
  exit 2
}
