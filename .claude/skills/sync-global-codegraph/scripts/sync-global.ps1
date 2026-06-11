# sync-global.ps1
# 이 프로젝트를 재빌드 → 전역 `codegraph` 명령을 최신 빌드로 교체(실제 복사).
# `npm link`(junction)이 이 머신에서 불안정하므로 pack + `npm install -g`(복사) 방식 사용.
# 종료코드: 0=동기화 성공, 1=빌드 실패(전역 미변경), 2=install 미반영(verify 불일치)

$pkg = '@evespimrose/codegraph'
$repo = (git rev-parse --show-toplevel 2>$null)
if (-not $repo) { $repo = (Get-Location).Path }
Set-Location $repo

Write-Host "[1/5] build  ($repo)" -ForegroundColor Cyan
$o = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
  $o | Select-Object -Last 6
  Write-Host "BUILD FAILED - global UNCHANGED" -ForegroundColor Red
  exit 1
}

Write-Host "[2/5] stop running codegraph processes (avoid file lock)" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='node.exe'" 2>$null |
  Where-Object { $_.CommandLine -like '*@evespimrose\codegraph*' -or $_.CommandLine -like '*.codegraph\bundles*' } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  killed PID $($_.ProcessId)" } catch {} }
Start-Sleep -Milliseconds 700

Write-Host "[3/5] pack" -ForegroundColor Cyan
$tgz = (npm pack 2>$null | Select-Object -Last 1).ToString().Trim()
$tgzPath = Join-Path $repo $tgz

Write-Host "[4/5] install -g  $tgz" -ForegroundColor Cyan
npm install -g $tgzPath --no-audit --no-fund 2>$null
Remove-Item $tgzPath -Force -ErrorAction SilentlyContinue

Write-Host "[5/5] verify  global == project" -ForegroundColor Cyan
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
  Write-Host "MISMATCH  global not fully updated (lock? rerun after closing agents)" -ForegroundColor Red
  exit 2
}
