[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$BundleRoot,
    [string]$InstallRoot,
    [string]$BinRoot,
    [ValidateSet('none', 'claude', 'codex')]
    [string]$Agent = 'none',
    [switch]$SkipPathUpdate,
    [switch]$SkipLegacyPackageCleanup,
    [ValidateSet('win32-x64', 'win32-arm64')]
    [string]$Platform
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object Text.UTF8Encoding($false)
$cleanupTries = 3
$retryDelayMs = 100

function Get-UserHome {
    foreach ($candidate in @($env:USERPROFILE, $env:HOME)) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) { return [IO.Path]::GetFullPath($candidate) }
    }
    throw 'USERPROFILE or HOME is required to install the bundled CodeGraph CLI.'
}

function Get-Platform {
    if (-not [Environment]::OSVersion.Platform.ToString().StartsWith('Win')) {
        throw 'The PowerShell CodeGraph bundle installer supports Windows only.'
    }
    $architecture = [string][Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITEW6432')
    if ([string]::IsNullOrWhiteSpace($architecture)) {
        $architecture = [string][Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE')
    }
    if ([string]::IsNullOrWhiteSpace($architecture)) {
        throw 'Windows processor architecture could not be detected.'
    }
    switch ($architecture.ToLowerInvariant()) {
        'amd64' { 'win32-x64' }
        'x86_64' { 'win32-x64' }
        'arm64' { 'win32-arm64' }
        default { throw "Unsupported Windows architecture: $architecture" }
    }
}

function Test-Version([string]$Launcher, [string]$Expected) {
    if (-not (Test-Path -LiteralPath $Launcher -PathType Leaf)) { return $false }
    try {
        $output = @(& $Launcher --version 2>$null)
        $succeeded = $?
        $actual = $output | Select-Object -Last 1
        return $succeeded -and [string]$actual -eq $Expected
    } catch {
        return $false
    }
}

function Test-Release([string]$Root, [string]$Expected, [object]$Artifact) {
    $integrityName = [string]$Artifact.integrityManifest
    $expectedIntegrity = [string]$Artifact.integritySha256
    if ($integrityName -cne 'release-integrity.json' -or $expectedIntegrity -cnotmatch '^[0-9a-f]{64}$') { return $false }
    $integrityPath = Join-Path $Root $integrityName
    if (-not (Test-Path -LiteralPath $integrityPath -PathType Leaf)) { return $false }
    try {
        if ((Get-FileHash -LiteralPath $integrityPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedIntegrity) { return $false }
        $integrity = [IO.File]::ReadAllText($integrityPath) | ConvertFrom-Json
        if ([string]$integrity.codegraphVersion -cne $Expected -or @($integrity.files).Count -eq 0) { return $false }
        $nodePath = Join-Path $Root 'node.exe'
        $nodeRecord = @($integrity.files | Where-Object { $_.path -ceq 'node.exe' })
        if ($nodeRecord.Count -ne 1 -or -not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { return $false }
        if ((Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne [string]$nodeRecord[0].sha256) { return $false }
        $script = @'
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
(async () => {
  const root = path.resolve(process.argv[1]);
  const integrity = JSON.parse(fs.readFileSync(path.join(root, 'release-integrity.json'), 'utf8'));
  let cursor = 0, invalid = false;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (!invalid && cursor < integrity.files.length) {
      const file = integrity.files[cursor++];
      try {
        const location = path.resolve(root, file.path);
        if (!location.toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error('Invalid release path');
        const bytes = await fs.promises.readFile(location);
        if (bytes.length !== file.size || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Release checksum mismatch');
      } catch (error) { invalid = true; throw error; }
    }
  }));
})().catch(() => { process.exitCode = 1; });
'@
        & $nodePath -e $script $Root 2>$null
        if (-not $?) { return $false }
        return Test-Version (Join-Path $Root 'bin\codegraph.cmd') $Expected
    } catch {
        return $false
    }
}

function Test-BinPath([string]$Entry, [string]$Expected) {
    if ([string]::IsNullOrWhiteSpace($Entry)) { return $false }
    try {
        $entryPath = [Environment]::ExpandEnvironmentVariables($Entry.Trim().Trim('"'))
        return [IO.Path]::GetFullPath($entryPath).Equals($Expected, [StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

function Get-PrioritizedPath([string]$Existing, [string]$Preferred) {
    $remaining = @($Existing -split ';' | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_) -and -not (Test-BinPath $_ $Preferred)
    })
    return (@($Preferred) + $remaining) -join ';'
}

function Stop-TargetWatchers([string]$StagedRoot, [string]$TargetRoot) {
    if ($env:CODEGRAPH_NO_WATCH -eq '1') { return @() }
    $managerPath = Join-Path $StagedRoot 'lib\dist\watch\manager.js'
    if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) { return @() }
    $script = @'
const path = require('node:path');
const manager = require(process.argv[1]);
const target = path.resolve(process.argv[2]).toLowerCase() + path.sep;
(async () => {
  const projects = [];
  for (const watcher of await manager.listWatchers()) {
    if (![watcher.nodePath, watcher.runtimeEntry].some(value => value && path.resolve(value).toLowerCase().startsWith(target))) continue;
    const stopped = await manager.stopWatcher(watcher.projectPath, { timeoutMs: 30000 });
    if (stopped.active || stopped.phase !== 'stopped' || stopped.stopPending) throw new Error(`Watcher did not stop: ${watcher.projectPath}`);
    projects.push(watcher.projectPath);
  }
  console.log(JSON.stringify(projects));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
'@
    $result = & (Join-Path $StagedRoot 'node.exe') -e $script $managerPath $TargetRoot
    if (-not $?) { throw 'An active CodeGraph watcher could not stop for release repair.' }
    return @(([string]$result | ConvertFrom-Json))
}

function Upgrade-Watchers([string]$Root, [string[]]$RestartProjects = @()) {
    if ($env:CODEGRAPH_NO_WATCH -eq '1') { return }
    $managerPath = Join-Path $Root 'lib\dist\watch\manager.js'
    if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) { return }
    $script = @'
const manager = require(process.argv[1]);
(async () => {
  const projects = new Set([...JSON.parse(process.argv[2]), ...(await manager.listWatchers()).map(watcher => watcher.projectPath)]);
  for (const projectPath of projects) {
    const running = await manager.ensureWatcher(projectPath, { timeoutMs: 30000 });
    if (!running.active || running.restartPending) throw new Error(`Watcher migration is incomplete for ${projectPath}: ${running.phase || 'inactive'}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
'@
    $restartJson = ConvertTo-Json -InputObject @($RestartProjects) -Compress
    & (Join-Path $Root 'node.exe') -e $script $managerPath $restartJson
    if (-not $?) { throw 'CodeGraph was installed, but an active project watcher could not migrate to the installed runtime.' }
}

function Remove-Tree([string]$Path, [string]$Root) {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return }
    $fullPath = [IO.Path]::GetFullPath($Path)
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove a path outside the CodeGraph install root: $fullPath" }
    $item = Get-Item -LiteralPath $fullPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Refusing to recursively remove a CodeGraph reparse point: $fullPath" }
    $extended = if ($fullPath.StartsWith('\\?\')) { $fullPath } else { '\\?\' + $fullPath }
    [IO.Directory]::Delete($extended, $true)
}

function Remove-Stale([string]$Path, [string]$Root) {
    $failure = ''
    for ($attempt = 1; $attempt -le $cleanupTries; $attempt++) {
        try {
            Remove-Tree $Path $Root
            return
        } catch {
            $cause = $_.Exception
            while ($null -ne $cause.InnerException) { $cause = $cause.InnerException }
            $winError = $cause.HResult -band 0xffff
            $locked = $cause -is [UnauthorizedAccessException] -or ($cause -is [IO.IOException] -and $winError -in @(32, 33))
            if (-not $locked) { throw }
            $failure = $_.Exception.Message
            if ($attempt -lt $cleanupTries) { Start-Sleep -Milliseconds $retryDelayMs }
        }
    }
    Write-Warning "Could not remove superseded CodeGraph release because it is in use or access-restricted. The installed CLI is ready and cleanup will be retried later: $Path ($failure)"
}

function Remove-LegacyGlobalNpmPackages {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { return }
    $npmRootOutput = @(& $npm.Source root -g 2>$null)
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Could not inspect the global npm root, so legacy CodeGraph package cleanup was skipped.'
        return
    }
    $npmRootText = [string]@($npmRootOutput | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($npmRootText)) {
        Write-Warning 'Global npm root was blank, so legacy CodeGraph package cleanup was skipped.'
        return
    }
    try { $npmRoot = [IO.Path]::GetFullPath($npmRootText.Trim().Trim('"')) } catch {
        Write-Warning 'Global npm root was invalid, so legacy CodeGraph package cleanup was skipped.'
        return
    }
    $legacyPackages = @('@evespimrose/codegraph', '@colbymchenry/codegraph')
    foreach ($packageName in $legacyPackages) {
        $packageRoot = Join-Path $npmRoot $packageName.Replace('/', '\')
        $packageManifest = Join-Path $packageRoot 'package.json'
        if (-not (Test-Path -LiteralPath $packageManifest -PathType Leaf)) { continue }
        try { $package = [IO.File]::ReadAllText($packageManifest) | ConvertFrom-Json } catch {
            Write-Warning "The $packageName npm package manifest was invalid, so cleanup was skipped."
            continue
        }
        if ([string]$package.name -cne $packageName) { continue }
        if ($PSCmdlet.ShouldProcess($packageName, 'remove the legacy global npm package')) {
            $failure = ''
            for ($attempt = 1; $attempt -le $cleanupTries; $attempt++) {
                & $npm.Source uninstall -g $packageName
                $exitCode = $LASTEXITCODE
                if ($exitCode -eq 0 -and -not (Test-Path -LiteralPath $packageManifest -PathType Leaf)) {
                    $failure = ''
                    break
                }
                $failure = "exit code $exitCode"
                if ($attempt -lt $cleanupTries) { Start-Sleep -Milliseconds $retryDelayMs }
            }
            if ($failure) {
                Write-Warning "Could not remove the legacy global npm package because it may be in use. The bundled CLI is ready and cleanup will be retried later: $packageName ($failure)"
            }
        }
    }
}

function Write-Utf8([string]$Path, [string]$Content) {
    $parent = Split-Path $Path -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
    [IO.File]::WriteAllText($stage, $Content, $utf8NoBom)
    try { Move-Item -LiteralPath $stage -Destination $Path -Force }
    finally { if (Test-Path -LiteralPath $stage -PathType Leaf) { [IO.File]::Delete($stage) } }
}

function Invoke-JsonCleanup([string]$NodePath, [string]$Path, [ValidateSet('claude-config', 'claude-settings')][string]$Kind) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
    $script = @'
const fs = require('fs');
const [source, stage, kind] = process.argv.slice(1);
let document;
try {
  document = JSON.parse(fs.readFileSync(source, 'utf8'));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
let changed = false;
if (kind === 'claude-config') {
  const servers = document && typeof document === 'object' ? document.mcpServers : undefined;
  if (servers && typeof servers === 'object' && !Array.isArray(servers) && Object.hasOwn(servers, 'codegraph')) {
    delete servers.codegraph;
    if (Object.keys(servers).length === 0) delete document.mcpServers;
    changed = true;
  }
} else if (kind === 'claude-settings') {
  const permissions = document && typeof document === 'object' ? document.permissions : undefined;
  if (permissions && typeof permissions === 'object' && Array.isArray(permissions.allow)) {
    const filtered = permissions.allow.filter(value => !String(value).startsWith('mcp__codegraph__'));
    if (filtered.length !== permissions.allow.length) {
      if (filtered.length === 0) delete permissions.allow;
      else permissions.allow = filtered;
      if (Object.keys(permissions).length === 0) delete document.permissions;
      changed = true;
    }
  }
} else {
  console.error(`Unknown cleanup kind: ${kind}`);
  process.exit(3);
}
if (!changed) process.exit(10);
fs.writeFileSync(stage, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
'@
    try {
        & $NodePath -e $script $Path $stage $Kind
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 10) { return }
        if ($exitCode -ne 0) { throw "Legacy CodeGraph MCP cleanup cannot parse or update JSON: $Path" }
        Move-Item -LiteralPath $stage -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $stage -PathType Leaf) { [IO.File]::Delete($stage) }
    }
}

function Clean-Claude([string]$HomePath, [string]$NodePath) {
    $configPath = Join-Path $HomePath '.claude.json'
    Invoke-JsonCleanup $NodePath $configPath 'claude-config'
    $settingsPath = Join-Path $HomePath '.claude\settings.json'
    Invoke-JsonCleanup $NodePath $settingsPath 'claude-settings'
}

function Clean-Codex([string]$HomePath) {
    $configPath = Join-Path $HomePath '.codex\config.toml'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return }
    $existing = [IO.File]::ReadAllText($configPath)
    $newline = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lines = [regex]::Split($existing, '\r\n|\n')
    $kept = New-Object 'Collections.Generic.List[string]'
    $dropping = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*\[\s*mcp_servers\s*\.\s*(?:"codegraph"|''codegraph''|codegraph)\s*\]\s*(?:#.*)?$') {
            $dropping = $true
            continue
        }
        $isTable = $line -match '^\s*\['
        $isNested = $line -match '^\s*\[\[?\s*mcp_servers\s*\.\s*(?:"codegraph"|''codegraph''|codegraph)(?:\s*\.|\s*\])'
        if ($dropping -and $isNested) { continue }
        if ($dropping -and $isTable) { $dropping = $false }
        if (-not $dropping) { $kept.Add($line) }
    }
    $updated = $kept -join $newline
    if ($updated -cne $existing) { Write-Utf8 $configPath $updated }
}

function Clean-Mcp([string]$Target, [string]$HomePath, [string]$NodePath) {
    if ($Target -eq 'claude') { Clean-Claude $HomePath $NodePath }
    elseif ($Target -eq 'codex') { Clean-Codex $HomePath }
}

$userHome = Get-UserHome
if (-not $BundleRoot) { $BundleRoot = $PSScriptRoot }
if (-not $InstallRoot) { $InstallRoot = Join-Path $userHome '.local\share\team-tech-support-harness\codegraph' }
if (-not $BinRoot) { $BinRoot = Join-Path $userHome '.local\bin' }
if (-not $Platform) { $Platform = Get-Platform }
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $tar) { throw 'Windows tar.exe is required to extract the bundled CodeGraph archive.' }
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$BinRoot = [IO.Path]::GetFullPath($BinRoot)
$BundleRoot = [IO.Path]::GetFullPath($BundleRoot)

$manifestPath = Join-Path $BundleRoot 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "CodeGraph bundle manifest is missing: $manifestPath" }
try { $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json }
catch { throw "CodeGraph bundle manifest is invalid JSON: $manifestPath" }
$artifactProperty = $manifest.artifacts.PSObject.Properties[$Platform]
if ($null -eq $artifactProperty) { throw "No bundled CodeGraph artifact is available for $Platform." }
$artifact = $artifactProperty.Value
$archive = Join-Path $BundleRoot ([string]$artifact.archive).Replace('/', [IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw "Bundled CodeGraph archive is missing: $archive" }
$archiveItem = Get-Item -LiteralPath $archive
if ($archiveItem.Length -ne [long]$artifact.size) { throw "Bundled CodeGraph archive size mismatch: $archive" }
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveHash -cne [string]$artifact.sha256) { throw "Bundled CodeGraph archive checksum mismatch: $archive" }

$version = [string]$manifest.codegraphVersion
$artifactHash = [string]$artifact.sha256
if ($artifactHash -cnotmatch '^[0-9a-f]{64}$') { throw 'CodeGraph artifact SHA-256 must contain 64 lowercase hexadecimal characters.' }
$releaseId = "$version-$($artifactHash.Substring(0, 12))"
$target = Join-Path (Join-Path $InstallRoot $releaseId) $Platform
$launcher = Join-Path $target 'bin\codegraph.cmd'
$restartProjects = @()
if (-not (Test-Release $target $version $artifact)) {
    if ($PSCmdlet.ShouldProcess($target, "install bundled CodeGraph $version for $Platform")) {
        $versionRoot = Split-Path $target -Parent
        New-Item -ItemType Directory -Force -Path $versionRoot | Out-Null
        $stage = ''
        try {
            $stage = Join-Path $versionRoot ('.stage-' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $stage | Out-Null
            & $tar.Source -xf $archive -C $stage
            if ($LASTEXITCODE -ne 0) { throw "Bundled CodeGraph archive extraction failed with exit code $LASTEXITCODE." }
            $staged = Join-Path $stage "codegraph-$Platform"
            $stagedLauncher = Join-Path $staged 'bin\codegraph.cmd'
            if (-not (Test-Release $staged $version $artifact)) {
                throw "Bundled CodeGraph failed release integrity or version verification: $stagedLauncher"
            }
            $backup = ''
            if (Test-Path -LiteralPath $target) {
                $restartProjects = @(Stop-TargetWatchers $staged $target)
                $backup = "$target.backup-$(Get-Date -Format 'yyyyMMdd-HHmmssfff')"
                Move-Item -LiteralPath $target -Destination $backup
            }
            try {
                Move-Item -LiteralPath $staged -Destination $target
            } catch {
                if ($backup -and -not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $target }
                throw
            }
            if ($backup) { Remove-Stale $backup $InstallRoot }
            Remove-Tree $stage $InstallRoot
            $stage = ''
        } catch {
            if ($restartProjects.Count -gt 0 -and (Test-Path -LiteralPath $launcher -PathType Leaf)) {
                Upgrade-Watchers $target $restartProjects
            }
            throw
        } finally {
            if ($stage) { Remove-Tree $stage $InstallRoot }
        }
    }
}

if (-not (Test-Version $launcher $version) -and -not $WhatIfPreference) { throw "Bundled CodeGraph is not installed at $launcher" }

function Write-Shim([string]$Path, [string]$Text, [string]$OwnerPattern) {
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path) -ceq $Text) { return }
    if (-not $PSCmdlet.ShouldProcess($Path, 'write the stable CodeGraph CLI shim')) { return }
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $backup = $null
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path) -notmatch $OwnerPattern) {
        $backup = "$Path.backup-$(Get-Date -Format 'yyyyMMdd-HHmmssfff')"
        Move-Item -LiteralPath $Path -Destination $backup
    }
    $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
    [IO.File]::WriteAllText($stage, $Text, $utf8NoBom)
    try { Move-Item -LiteralPath $stage -Destination $Path -Force }
    catch {
        if ($backup -and -not (Test-Path -LiteralPath $Path) -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $Path }
        throw
    }
}

function ConvertTo-ShellLiteral([string]$Value) {
    "'" + $Value.Replace("'", "'\''") + "'"
}

$shim = Join-Path $BinRoot 'codegraph.cmd'
Write-Shim $shim "@set `"TEAM_HARNESS_CODEGRAPH=1`"`r`n@`"$launcher`" %*`r`n" '(?m)^@set "TEAM_HARNESS_CODEGRAPH=1"\r?$'
# Git Bash cannot run codegraph.cmd by its bare name. This shim calls node.exe directly, so cmd.exe never re-parses the arguments.
$posixRelease = $target.Replace('\', '/')
$posixShimText = "#!/bin/sh`nexport TEAM_HARNESS_CODEGRAPH=1`nexport CODEGRAPH_MODEL_ROOT=" + (ConvertTo-ShellLiteral "$posixRelease/lib/models") +
    "`nexec " + (ConvertTo-ShellLiteral "$posixRelease/node.exe") + ' --liftoff-only ' + (ConvertTo-ShellLiteral "$posixRelease/lib/dist/bin/codegraph.js") + " `"`$@`"`n"
Write-Shim (Join-Path $BinRoot 'codegraph') $posixShimText '(?m)^export TEAM_HARNESS_CODEGRAPH=1$'

if (-not $WhatIfPreference) { Upgrade-Watchers $target $restartProjects }

if (-not $SkipLegacyPackageCleanup) { Remove-LegacyGlobalNpmPackages }

if (Test-Path -LiteralPath $InstallRoot -PathType Container) {
    foreach ($oldRelease in @(Get-ChildItem -LiteralPath $InstallRoot -Directory -Force | Where-Object {
        $_.Name -ne $releaseId -and $_.Name -match '^\d+\.\d+\.\d+(?:-r\d+|-[0-9a-f]{12})?$'
    })) {
        if ($PSCmdlet.ShouldProcess($oldRelease.FullName, 'remove the superseded harness-managed CodeGraph release')) {
            Remove-Stale $oldRelease.FullName $InstallRoot
        }
    }
}

if (-not $SkipPathUpdate) {
    $userPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
    $nextPath = Get-PrioritizedPath $userPath $BinRoot
    if ($nextPath -cne $userPath) {
        if ($PSCmdlet.ShouldProcess('User PATH', "prioritize $BinRoot")) {
            [Environment]::SetEnvironmentVariable('Path', $nextPath, 'User')
        }
    }
    if (-not $WhatIfPreference) { $env:Path = Get-PrioritizedPath $env:Path $BinRoot }
}

if ($Agent -ne 'none') {
    if (-not (Test-Version $launcher $version)) {
        if (-not $WhatIfPreference) { throw 'Bundled CodeGraph was not installed, so legacy MCP cleanup cannot run.' }
    } elseif ($PSCmdlet.ShouldProcess($Agent, 'remove the legacy CodeGraph MCP registration')) {
        Clean-Mcp $Agent $userHome (Join-Path $target 'node.exe')
    }
}

$global:LASTEXITCODE = 0
Write-Output $shim
