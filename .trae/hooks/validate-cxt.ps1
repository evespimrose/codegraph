
# validate-cxt.ps1 — Validate BLK tag in cxt file (PowerShell / Windows)
# Usage: & .trae\hooks\validate-cxt.ps1 "docs\contextmd\cxt130.md"
# Exit code: 0 = OK, 1 = Error
param(
  [Parameter(Mandatory=$true)]
  [string]$FilePath
)

if (-not (Test-Path $FilePath)) {
  Write-Error "ERROR: File not found: $FilePath"
  exit 1
}

$lines = Get-Content $FilePath
$line2 = if ($lines.Count -ge 2) { $lines[1] } else { "" }

if ($line2 -match '<!--\s*BLK:.*-->') {
  $blkMatch = [regex]::Match($line2, 'BLK-\d+\w*')
  $blk = if ($blkMatch.Success) { $blkMatch.Value } else { "" }

  Write-Host "OK: BLK tag found → $line2" -ForegroundColor Green

  # Skip dictionary check for infrastructure tags
  if ($blk -eq "") {
    Write-Host "INFO: Infrastructure work — dictionary § 1 check skipped" -ForegroundColor Cyan
    exit 0
  }

  # Check if BLK exists in dictionary § 1
  $dictPath = "manage\dictionary.md"
  if (Test-Path $dictPath) {
    $found = Select-String -Path $dictPath -Pattern ([regex]::Escape($blk))
    $count = if ($found) { @($found).Count } else { 0 }
    if ($count -gt 0) {
      Write-Host "OK: $blk exists in dictionary ($count lines)" -ForegroundColor Green
    } else {
      Write-Warning "WARN: $blk not found in dictionary → manage\dictionary.md § 1 needs update"
    }
  } else {
    Write-Warning "WARN: manage\dictionary.md not found — dictionary check skipped"
  }
  exit 0
} else {
  Write-Host "ERROR: Missing BLK tag on line 2" -ForegroundColor Red
  Write-Host "  Current line 2: $line2"
  Write-Host "  Required format: <!-- BLK: BLK-XXX -->"
  Write-Host "  Action: Re-run context-sharer with BLK tag included"
  exit 1
}
