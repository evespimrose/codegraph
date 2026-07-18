<#
  sync.ps1 — install this repo's workflow scaffolding into target project roots.

  Modes (-Mode):
    mixed (default) : copy files missing in the target; for files that DIFFER,
                      back up the target copy under <target>\.sync-backup\<stamp>\
                      then overwrite (unless -NoBackup). Identical files are skipped.
                      -DryRun reports the differing files WITHOUT writing anything.
    force           : overwrite every manifest file in every target. Overwritten
                      files are auto-backed-up first (unless -NoBackup). No prompts.
    soft            : copy only files MISSING in the target; never overwrite (no backup applies).

  -NoBackup applies uniformly to mixed and force (skips the <target>\.sync-backup\<stamp>\
  copy before every overwrite). Irreversible within this tool once applied — the only way
  back is the target's own external history (git, etc.), so use deliberately.

  Scope:
    -AgentFolders (-a) : sync only the auxiliary agent/tool scaffolding folders
                      (.agents .codex .cursor .trae .zcode) via manifest.agents.txt,
                      and skip .mcp.json generation. Composable with -Mode/-Targets/-DryRun.
                      Typical use: push local tool folders to the user home (global).

  Applied to any RECURSIVE folder copy (so a whole-folder manifest entry such as .agents
  or .zcode never leaks its runtime / machine-local state):
    <dot-folder>/memory-bank/ , <dot-folder>/state/  -> excluded entirely
    settings.json                                    -> excluded (install/project config)
    settings.local.json                              -> synced MINUS the 'permissions' key

  Data files (relative to the skill dir, override with -ListFile / -ManifestFile):
    projects\list.txt : absolute target project-root paths (one per line, # = comment)
    manifest.txt      : source-relative paths to sync (dirs recursive, # = comment)

  Generated into each target root: .mcp.json (codegraph MCP), merge-preserving any
  sibling MCP servers already present. Subject to the same mode rules.

  Output: compact per-target summary on stdout (conflict paths listed only on -DryRun,
  where they are needed for user approval). Full machine-readable JSON is written to
  <source>/.claude/state/sync-last-report.json instead of stdout (context diet).
#>
[CmdletBinding()]
param(
  [ValidateSet('force','soft','mixed')] [string]$Mode = 'mixed',
  [string]$Source,
  [string]$ListFile,
  [string]$ManifestFile,
  [string[]]$Targets,
  [switch]$DryRun,
  [switch]$NoBackup,
  [Alias('a')][switch]$AgentFolders
)
$ErrorActionPreference = 'Stop'

$SkillDir = Split-Path -Parent $PSScriptRoot
if(-not $Source){ $Source = (Resolve-Path (Join-Path $SkillDir '..\..\..')).Path }
$Source = $Source.TrimEnd('\','/')
if(-not $ListFile){ $ListFile = Join-Path $SkillDir 'projects\list.txt' }
if(-not $ManifestFile){
  if($AgentFolders){ $ManifestFile = Join-Path $SkillDir 'manifest.agents.txt' }
  else { $ManifestFile = Join-Path $SkillDir 'manifest.txt' }
}

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
# settings.local.json carries a machine/project-local 'permissions' block (allow rules
# bound to local paths/tools). Sync the file but STRIP that key, keeping portable prefs
# (enabled/disabledMcpjsonServers, ...). Returns transformed JSON text, or $null if the
# file can't be parsed (then it is skipped rather than leaking raw permissions).
function Get-SettingsLocalSansPermissions($srcFull){
  try {
    $obj = (Get-Content -LiteralPath $srcFull -Raw) | ConvertFrom-Json
    if($obj.PSObject.Properties['permissions']){ $obj.PSObject.Properties.Remove('permissions') }
    return ($obj | ConvertTo-Json -Depth 20)
  } catch { return $null }
}
# An op either copies a source file (SourceFull) or writes precomputed Content (a transform).
function Op-Hash($op){
  if($null -ne $op.Content){
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($op.Content)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return (([BitConverter]::ToString($sha.ComputeHash($bytes))) -replace '-','') } finally { $sha.Dispose() }
  }
  return (Get-FileHash -LiteralPath $op.SourceFull).Hash
}
function Op-Write($op, $dest){
  if($null -ne $op.Content){ Write-Text $dest $op.Content } else { Copy-One $op.SourceFull $dest }
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
      # Never propagate a folder's runtime / machine-local state, even when the whole
      # dot-folder is a single manifest entry (e.g. .agents/.zcode full mirrors):
      #   <top .dot-folder>/memory-bank/ , <top .dot-folder>/state/   -> skipped entirely
      #   settings.json                                               -> skipped (install/project config)
      #   settings.local.json                                         -> synced MINUS 'permissions'
      # (Explicit FILE entries like the force-only .riper-state go through the else branch
      #  below, so this recursion filter never touches them.)
      if($rel -match '^\.[^\\/]+[\\/](memory-bank|state)([\\/]|$)'){ return }
      $leaf = Split-Path $rel -Leaf
      if($leaf -ieq 'settings.json'){ return }
      if($leaf -ieq 'settings.local.json'){
        $c = Get-SettingsLocalSansPermissions $_.FullName
        if($null -ne $c){ $ops.Add([pscustomobject]@{ Rel=$rel; SourceFull=$null; Content=$c; ForceOnly=$it.ForceOnly }) }
        return
      }
      $ops.Add([pscustomobject]@{ Rel=$rel; SourceFull=$_.FullName; Content=$null; ForceOnly=$it.ForceOnly })
    }
  } else {
    $rel = $gi.FullName.Substring($Source.Length).TrimStart('\','/')
    $ops.Add([pscustomobject]@{ Rel=$rel; SourceFull=$gi.FullName; Content=$null; ForceOnly=$it.ForceOnly })
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
      else { if(-not $DryRun){ Op-Write $op $tgtFile }; $r.Added++ }
    }
    elseif($Mode -eq 'force'){
      if($exists){ if(-not $DryRun -and -not $NoBackup){ Backup-File $t $op.Rel }; $r.Overwritten++ }
      else { $r.Added++ }
      if(-not $DryRun){ Op-Write $op $tgtFile }
    }
    else { # mixed
      if(-not $exists){ if(-not $DryRun){ Op-Write $op $tgtFile }; $r.Added++ }
      else {
        $differ = (Op-Hash $op) -ne (Get-FileHash -LiteralPath $tgtFile).Hash
        if($differ){
          $conflicts.Add($op.Rel)
          if(-not $DryRun){ if(-not $NoBackup){ Backup-File $t $op.Rel }; Op-Write $op $tgtFile }
          $r.Overwritten++
        } else { $r.SkippedIdentical++ }
      }
    }
  }

  # .mcp.json (merge-preserving) — skipped under -AgentFolders (copying tool scaffolding,
  # not provisioning a project root; avoids writing .mcp.json into e.g. the user home).
  if(-not $AgentFolders){
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
          if(-not $DryRun){ if(-not $NoBackup){ Backup-File $t '.mcp.json' }; Write-Text $mcpFile $desiredMcp }
          $r.Overwritten++
        } else { $r.SkippedIdentical++ }
      }
    }
  }

  $r.Conflicts = $conflicts.ToArray()
  if(($Mode -ne 'soft') -and (-not $DryRun) -and ($r.Overwritten -gt 0) -and (-not $NoBackup)){
    $r.BackupDir = Join-Path $t ".sync-backup\$stamp"
  }
  $report.Add([pscustomobject]$r)
}

# --- machine-readable: 전체 JSON은 파일로만 (stdout 중복 출력 금지 — 컨텍스트 다이어트) ---
$reportPath = Join-Path $Source '.claude/state/sync-last-report.json'
try {
  $summary = [pscustomobject]@{ source=$Source; mode=$Mode; dryRun=[bool]$DryRun; when=$stamp; targets=$report.ToArray() }
  Write-Text $reportPath ($summary | ConvertTo-Json -Depth 7)
} catch { }

# --- human-readable (compact): conflicts 상세는 승인이 필요한 dry-run에서만 나열 ---
Write-Output ""
$md = $Mode; if($DryRun){ $md = "$Mode (dry-run)" }
Write-Output "Source: $Source | Mode: $md | Targets: $($targetRoots.Count)"
foreach($r in $report){
  if($r.Error){ Write-Output "  $($r.Target)  ! $($r.Error)"; continue }
  Write-Output "  $($r.Target)  added=$($r.Added) overwritten=$($r.Overwritten) identical=$($r.SkippedIdentical) protected=$($r.SkippedProtected)$(if($r.BackupDir){ '  backup=' + $r.BackupDir })"
  if($DryRun -and $r.Conflicts.Count -gt 0){
    $r.Conflicts | ForEach-Object { Write-Output "    ~ $_" }
  }
}
Write-Output "detail-json: $reportPath"
