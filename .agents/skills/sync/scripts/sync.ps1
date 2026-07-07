<#
  sync.ps1 — install this repo's workflow scaffolding into target project roots.

  Modes (-Mode):
    mixed (default) : copy files missing in the target; for files that DIFFER,
                      back up the target copy under <target>\.sync-backup\<stamp>\
                      then overwrite. Identical files are skipped.
                      -DryRun reports the differing files WITHOUT writing anything.
    force           : overwrite every manifest file in every target. Overwritten
                      files are auto-backed-up first (unless -NoBackup). No prompts.
    soft            : copy only files MISSING in the target; never overwrite.

  Data files (relative to the skill dir, override with -ListFile / -ManifestFile):
    projects\list.txt : absolute target project-root paths (one per line, # = comment)
    manifest.txt      : source-relative paths to sync (dirs recursive, # = comment)

  Generated into each target root: .mcp.json (codegraph MCP), merge-preserving any
  sibling MCP servers already present. Subject to the same mode rules.

  Output ends with a machine-readable block between ===SUMMARY-JSON=== markers.
#>
[CmdletBinding()]
param(
  [ValidateSet('force','soft','mixed')] [string]$Mode = 'mixed',
  [string]$Source,
  [string]$ListFile,
  [string]$ManifestFile,
  [string[]]$Targets,
  [switch]$DryRun,
  [switch]$NoBackup
)
$ErrorActionPreference = 'Stop'

$SkillDir = Split-Path -Parent $PSScriptRoot
if(-not $Source){ $Source = (Resolve-Path (Join-Path $SkillDir '..\..\..')).Path }
$Source = $Source.TrimEnd('\','/')
if(-not $ListFile){ $ListFile = Join-Path $SkillDir 'projects\list.txt' }
if(-not $ManifestFile){ $ManifestFile = Join-Path $SkillDir 'manifest.txt' }

function Read-Lines($path){
  if(-not (Test-Path -LiteralPath $path)){ return @() }
  Get-Content -LiteralPath $path | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith('#') }
}
function Ensure-Dir($file){
  $dir = Split-Path -Parent $file
  if($dir -and -not (Test-Path -LiteralPath $dir)){ New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}
function Write-Text($file, $text){
  Ensure-Dir $file
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $text, $enc)
}
function Copy-One($srcFull, $dest){
  Ensure-Dir $dest
  Copy-Item -LiteralPath $srcFull -Destination $dest -Force
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
function Backup-File($targetRoot, $rel){
  $src = Join-Path $targetRoot $rel
  if(-not (Test-Path -LiteralPath $src)){ return }
  $dest = Join-Path $targetRoot (Join-Path ".sync-backup\$stamp" $rel)
  Ensure-Dir $dest
  Copy-Item -LiteralPath $src -Destination $dest -Force
}

# --- codegraph .mcp.json, merge-preserving sibling servers ---
function Build-DesiredMcp($targetRoot){
  $f = Join-Path $targetRoot '.mcp.json'
  $servers = [ordered]@{}
  if(Test-Path -LiteralPath $f){
    try {
      $obj = (Get-Content -LiteralPath $f -Raw) | ConvertFrom-Json
      if($obj -and $obj.mcpServers){
        foreach($p in $obj.mcpServers.PSObject.Properties){ $servers[$p.Name] = $p.Value }
      }
    } catch { }
  }
  $servers['codegraph'] = [ordered]@{ type='stdio'; command='codegraph'; args=@('serve','--mcp') }
  return ([ordered]@{ mcpServers = $servers } | ConvertTo-Json -Depth 8)
}

# Parse manifest. A leading '!' marks a FORCE-ONLY path: synced (overwritten) only in
# -Mode force; skipped entirely in mixed/soft so each target's own runtime state
# (RIPER .riper-state, branch memories, MEMORY.md) is left untouched by routine syncs.
$items = New-Object System.Collections.Generic.List[object]
foreach($m in (Read-Lines $ManifestFile)){
  if($m.StartsWith('!')){ $items.Add([pscustomobject]@{ Path=$m.Substring(1).Trim(); ForceOnly=$true }) }
  else { $items.Add([pscustomobject]@{ Path=$m; ForceOnly=$false }) }
}
if($Targets){ $targetRoots = @($Targets) } else { $targetRoots = @(Read-Lines $ListFile) }

# Build generic file ops from the manifest (.mcp.json handled separately via merge)
$ops = New-Object System.Collections.Generic.List[object]
foreach($it in $items){
  $full = Join-Path $Source $it.Path
  if(-not (Test-Path -LiteralPath $full)){
    # Force-only entries are protective markers; absence in source is expected, not a warning.
    if(-not $it.ForceOnly){ Write-Warning "manifest item missing in source: $($it.Path)" }
    continue
  }
  $gi = Get-Item -LiteralPath $full
  if($gi.PSIsContainer){
    Get-ChildItem -LiteralPath $full -Recurse -File -Force | ForEach-Object {
      $rel = $_.FullName.Substring($Source.Length).TrimStart('\','/')
      $ops.Add([pscustomobject]@{ Rel=$rel; SourceFull=$_.FullName; ForceOnly=$it.ForceOnly })
    }
  } else {
    $rel = $gi.FullName.Substring($Source.Length).TrimStart('\','/')
    $ops.Add([pscustomobject]@{ Rel=$rel; SourceFull=$gi.FullName; ForceOnly=$it.ForceOnly })
  }
}

if($targetRoots.Count -eq 0){
  Write-Output "No targets in $ListFile — add absolute project-root paths (one per line). Nothing to do."
}

$report = New-Object System.Collections.Generic.List[object]
foreach($t in $targetRoots){
  $t = $t.TrimEnd('\','/')
  $r = @{
    Target=$t; Mode=$Mode; DryRun=[bool]$DryRun
    Added=0; Overwritten=0; SkippedExisting=0; SkippedIdentical=0; SkippedProtected=0
    Conflicts=@(); BackupDir=$null; Error=$null
  }
  if(-not (Test-Path -LiteralPath $t)){ $r.Error='TARGET_NOT_FOUND'; $report.Add([pscustomobject]$r); continue }
  if((Resolve-Path -LiteralPath $t).Path -ieq $Source){ $r.Error='TARGET_EQUALS_SOURCE_SKIPPED'; $report.Add([pscustomobject]$r); continue }
  $conflicts = New-Object System.Collections.Generic.List[string]

  foreach($op in $ops){
    # FORCE-ONLY paths (memory-bank, MEMORY.md, ...): only sync under -Mode force, so
    # mixed/soft never clobber the target's own RIPER state and memories.
    if($op.ForceOnly -and $Mode -ne 'force'){ $r.SkippedProtected++; continue }
    $tgtFile = Join-Path $t $op.Rel
    $exists = Test-Path -LiteralPath $tgtFile
    if($Mode -eq 'soft'){
      if($exists){ $r.SkippedExisting++ }
      else { if(-not $DryRun){ Copy-One $op.SourceFull $tgtFile }; $r.Added++ }
    }
    elseif($Mode -eq 'force'){
      if($exists){ if(-not $DryRun -and -not $NoBackup){ Backup-File $t $op.Rel }; $r.Overwritten++ }
      else { $r.Added++ }
      if(-not $DryRun){ Copy-One $op.SourceFull $tgtFile }
    }
    else { # mixed
      if(-not $exists){ if(-not $DryRun){ Copy-One $op.SourceFull $tgtFile }; $r.Added++ }
      else {
        $differ = (Get-FileHash -LiteralPath $op.SourceFull).Hash -ne (Get-FileHash -LiteralPath $tgtFile).Hash
        if($differ){
          $conflicts.Add($op.Rel)
          if(-not $DryRun){ Backup-File $t $op.Rel; Copy-One $op.SourceFull $tgtFile }
          $r.Overwritten++
        } else { $r.SkippedIdentical++ }
      }
    }
  }

  # .mcp.json (merge-preserving)
  $mcpFile = Join-Path $t '.mcp.json'
  $mcpExists = Test-Path -LiteralPath $mcpFile
  $desiredMcp = Build-DesiredMcp $t
  if($Mode -eq 'soft'){
    if($mcpExists){ $r.SkippedExisting++ } else { if(-not $DryRun){ Write-Text $mcpFile $desiredMcp }; $r.Added++ }
  }
  elseif($Mode -eq 'force'){
    if($mcpExists){ if(-not $DryRun -and -not $NoBackup){ Backup-File $t '.mcp.json' }; $r.Overwritten++ } else { $r.Added++ }
    if(-not $DryRun){ Write-Text $mcpFile $desiredMcp }
  }
  else { # mixed
    if(-not $mcpExists){ if(-not $DryRun){ Write-Text $mcpFile $desiredMcp }; $r.Added++ }
    else {
      $cur = ((Get-Content -LiteralPath $mcpFile -Raw) -replace "`r`n","`n").TrimEnd()
      $want = ($desiredMcp -replace "`r`n","`n").TrimEnd()
      if($cur -ne $want){
        $conflicts.Add('.mcp.json')
        if(-not $DryRun){ Backup-File $t '.mcp.json'; Write-Text $mcpFile $desiredMcp }
        $r.Overwritten++
      } else { $r.SkippedIdentical++ }
    }
  }

  $r.Conflicts = $conflicts.ToArray()
  if(($Mode -ne 'soft') -and (-not $DryRun) -and ($r.Overwritten -gt 0) -and (-not ($Mode -eq 'force' -and $NoBackup))){
    $r.BackupDir = Join-Path $t ".sync-backup\$stamp"
  }
  $report.Add([pscustomobject]$r)
}

# --- human-readable ---
Write-Output ""
Write-Output "Source : $Source"
$md = $Mode; if($DryRun){ $md = "$Mode (dry-run)" }
Write-Output "Mode   : $md"
Write-Output "Targets: $($targetRoots.Count)"
foreach($r in $report){
  Write-Output ("-"*60)
  Write-Output "Target: $($r.Target)"
  if($r.Error){ Write-Output "  ! $($r.Error)"; continue }
  Write-Output "  added=$($r.Added)  overwritten=$($r.Overwritten)  skipped-existing=$($r.SkippedExisting)  skipped-identical=$($r.SkippedIdentical)  skipped-protected=$($r.SkippedProtected)"
  if($r.Conflicts.Count -gt 0){
    Write-Output "  conflicts ($($r.Conflicts.Count)) — would back up + overwrite:"
    $r.Conflicts | ForEach-Object { Write-Output "    ~ $_" }
  }
  if($r.BackupDir){ Write-Output "  backup: $($r.BackupDir)" }
}

# --- machine-readable ---
Write-Output ""
Write-Output "===SUMMARY-JSON==="
try {
  $summary = [pscustomobject]@{ source=$Source; mode=$Mode; dryRun=[bool]$DryRun; targets=$report.ToArray() }
  Write-Output ($summary | ConvertTo-Json -Depth 7)
} catch {
  Write-Output "{}"
}
Write-Output "===END-SUMMARY-JSON==="
