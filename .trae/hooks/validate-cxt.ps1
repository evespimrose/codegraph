# validate-cxt.ps1 — Validate BLK tag in cxt file (PowerShell / Windows)
# Usage: & .trae\hooks\validate-cxt.ps1 "docs\contextmd\cxt130.md"
# Exit code: 0 = OK, 1 = Error
# Fast mode: 1턴 안에 BLK 태그만 검증 후 완료 (dictionary check 스킵 — Sonar Protocol 준수, No Recursion)

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

# BLK tag format: <!-- BLK: BLK-XXX --> or <!-- BLK: 인프라 -->
if ($line2 -match '<!--\s*BLK:.*-->') {
  $blkMatch = [regex]::Match($line2, 'BLK-\d+\w*')
  $blk = if ($blkMatch.Success) { $blkMatch.Value } else { "" }

  Write-Host "OK: BLK tag found → $line2" -ForegroundColor Green

  # Fast mode: Return immediately (no dictionary check)
  # Infrastructure tags (<!-- BLK: 인프라 -->) skip numeric BLK check
  exit 0
} else {
  Write-Host "ERROR: Missing BLK tag on line 2" -ForegroundColor Red
  Write-Host "  Current line 2: $line2"
  Write-Host "  Required format: <!-- BLK: BLK-XXX --> or <!-- BLK: 인프라 -->"
  Write-Host "  Action: Re-run context-sharer with BLK tag included"
  exit 1
}
