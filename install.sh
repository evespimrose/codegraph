#!/usr/bin/env bash
set -euo pipefail

bundle_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install_root=''
bin_root=''
agent='none'
dry_run=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --bundle-root) bundle_root=$2; shift 2 ;;
        --install-root) install_root=$2; shift 2 ;;
        --bin-root) bin_root=$2; shift 2 ;;
        --agent) agent=$2; shift 2 ;;
        --dry-run) dry_run=1; shift ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
done

case "$agent" in none|claude|codex) ;; *) echo "Unsupported agent: $agent" >&2; exit 2 ;; esac
python_bin=''
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)' >/dev/null 2>&1; then
        python_bin=$candidate
        break
    fi
done
[ -n "$python_bin" ] || { echo 'Python 3 is required to read the CodeGraph bundle manifest.' >&2; exit 1; }
case "$(uname -s):$(uname -m)" in
    Darwin:x86_64) platform=darwin-x64 ;;
    Darwin:arm64) platform=darwin-arm64 ;;
    Linux:x86_64) platform=linux-x64 ;;
    Linux:aarch64|Linux:arm64) platform=linux-arm64 ;;
    *) echo "Unsupported CodeGraph platform: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

install_root=${install_root:-"$HOME/.local/share/team-tech-support-harness/codegraph"}
bin_root=${bin_root:-"$HOME/.local/bin"}
manifest="$bundle_root/manifest.json"
[ -f "$manifest" ] || { echo "CodeGraph bundle manifest is missing: $manifest" >&2; exit 1; }

metadata=$("$python_bin" - "$manifest" "$platform" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as stream:
    manifest = json.load(stream)
artifact = manifest.get('artifacts', {}).get(sys.argv[2])
if artifact is None:
    raise SystemExit(f'No bundled CodeGraph artifact is available for {sys.argv[2]}.')
print(manifest['codegraphVersion'])
print(artifact['archive'])
print(artifact['size'])
print(artifact['sha256'])
print(artifact.get('integrityManifest', ''))
print(artifact.get('integritySha256', ''))
PY
)
version=$(printf '%s\n' "$metadata" | sed -n '1p')
archive_rel=$(printf '%s\n' "$metadata" | sed -n '2p')
archive_size=$(printf '%s\n' "$metadata" | sed -n '3p')
expected_hash=$(printf '%s\n' "$metadata" | sed -n '4p')
integrity_name=$(printf '%s\n' "$metadata" | sed -n '5p')
integrity_hash=$(printf '%s\n' "$metadata" | sed -n '6p')
hash_file() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}

archive="$bundle_root/$archive_rel"
[ -f "$archive" ] || { echo "Bundled CodeGraph archive is missing: $archive" >&2; exit 1; }
[ "$(wc -c <"$archive" | tr -d ' ')" = "$archive_size" ] || { echo "Bundled CodeGraph archive size mismatch: $archive" >&2; exit 1; }
[ "$(hash_file "$archive")" = "$expected_hash" ] || { echo "Bundled CodeGraph archive checksum mismatch: $archive" >&2; exit 1; }

verify_release() {
    "$python_bin" - "$1" "$version" "$integrity_name" "$integrity_hash" <<'PY'
import hashlib, json, pathlib, sys
try:
    root = pathlib.Path(sys.argv[1]).resolve()
    if sys.argv[3] != 'release-integrity.json' or len(sys.argv[4]) != 64:
        raise ValueError('Missing pinned release integrity manifest')
    manifest_path = root / sys.argv[3]
    content = manifest_path.read_bytes()
    if hashlib.sha256(content).hexdigest() != sys.argv[4]:
        raise ValueError('Release integrity manifest checksum mismatch')
    integrity = json.loads(content)
    if integrity['codegraphVersion'] != sys.argv[2] or not integrity['files']:
        raise ValueError('Release integrity version mismatch')
    for item in integrity['files']:
        file_path = (root / item['path']).resolve()
        file_path.relative_to(root)
        content = file_path.read_bytes()
        if len(content) != item['size'] or hashlib.sha256(content).hexdigest() != item['sha256']:
            raise ValueError(f'Release file checksum mismatch: {item["path"]}')
except Exception:
    raise SystemExit(1)
PY
}

release_id="$version-$(printf '%s' "$expected_hash" | cut -c 1-12)"
target="$install_root/$release_id/$platform"
launcher="$target/bin/codegraph"
needs_install=1
if [ -x "$launcher" ] && verify_release "$target" && [ "$("$launcher" --version 2>/dev/null | tail -n 1)" = "$version" ]; then needs_install=0; fi
stage=''
version_root=''

cleanup_stage() {
    for candidate in "$stage"; do
        [ -n "$candidate" ] || continue
        case "$candidate" in
            "$version_root"/.stage.*) rm -rf -- "$candidate" ;;
            *) echo "Refusing to remove an unexpected CodeGraph staging path: $candidate" >&2 ;;
        esac
    done
}
trap cleanup_stage EXIT

if [ "$needs_install" -eq 1 ]; then
    if [ "$dry_run" -eq 1 ]; then
        echo "would install bundled CodeGraph $version for $platform at $target"
    else
        version_root=$(dirname -- "$target")
        mkdir -p -- "$version_root"
        stage=$(mktemp -d "$version_root/.stage.XXXXXX")
        tar -xzf "$archive" -C "$stage"
        staged="$stage/codegraph-$platform"
        staged_launcher="$staged/bin/codegraph"
        [ -x "$staged_launcher" ] || { echo "Bundled CodeGraph launcher is missing: $staged_launcher" >&2; exit 1; }
        verify_release "$staged" || { echo 'Bundled CodeGraph failed release integrity verification.' >&2; exit 1; }
        [ "$("$staged_launcher" --version 2>/dev/null | tail -n 1)" = "$version" ] || { echo 'Bundled CodeGraph failed its version smoke test.' >&2; exit 1; }
        backup=''
        if [ -e "$target" ] || [ -L "$target" ]; then
            backup="$target.backup-$(date +%Y%m%d-%H%M%S)"
            mv -- "$target" "$backup"
        fi
        if ! mv -- "$staged" "$target"; then
            if [ -n "$backup" ] && [ ! -e "$target" ] && [ -e "$backup" ]; then mv -- "$backup" "$target"; fi
            exit 1
        fi
        rmdir -- "$stage"
        stage=''
    fi
fi

shim="$bin_root/codegraph"
shim_text=$(printf '#!/bin/sh\nexport TEAM_HARNESS_CODEGRAPH=1\nexec "%s" "$@"\n' "$launcher")
existing=''
[ -f "$shim" ] && existing=$(cat -- "$shim")
if [ "$existing" != "$shim_text" ]; then
    if [ "$dry_run" -eq 1 ]; then
        echo "would write the stable CodeGraph CLI shim at $shim"
    else
        mkdir -p -- "$bin_root"
        shim_backup=''
        if [ -e "$shim" ] || [ -L "$shim" ]; then
            if ! grep -qxE '(export )?TEAM_HARNESS_CODEGRAPH=1' "$shim" 2>/dev/null; then
                shim_backup="$shim.backup-$(date +%Y%m%d-%H%M%S)"
                mv -- "$shim" "$shim_backup"
            fi
        fi
        shim_stage="$shim.stage.$$"
        printf '%s' "$shim_text" >"$shim_stage"
        chmod +x "$shim_stage"
        if ! mv -f -- "$shim_stage" "$shim"; then
            if [ -n "$shim_backup" ] && [ ! -e "$shim" ] && [ -e "$shim_backup" ]; then mv -- "$shim_backup" "$shim"; fi
            exit 1
        fi
    fi
fi

if [ "$dry_run" -eq 0 ] && [ "${CODEGRAPH_NO_WATCH:-}" != 1 ] && [ -f "$target/lib/dist/watch/manager.js" ]; then
    "$target/node" - "$target/lib/dist/watch/manager.js" <<'JS'
const manager = require(process.argv[2]);
(async () => {
    for (const watcher of await manager.listWatchers()) {
        const running = await manager.ensureWatcher(watcher.projectPath, { timeoutMs: 30000 });
        if (!running.active || running.restartPending) throw new Error(`Watcher migration is incomplete for ${watcher.projectPath}: ${running.phase || 'inactive'}`);
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
JS
fi

if [ "$agent" != none ]; then
    if [ "$dry_run" -eq 1 ]; then
        echo "would remove the legacy CodeGraph MCP registration for $agent"
    else
        "$python_bin" - "$HOME" "$agent" <<'PY'
import json, os, pathlib, re, sys, uuid

home = pathlib.Path(sys.argv[1])
agent = sys.argv[2]

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = path.stat().st_mode & 0o777 if path.exists() else None
    stage = path.with_name(f'{path.name}.stage-{uuid.uuid4().hex}')
    try:
        stage.write_text(content, encoding='utf-8')
        if mode is not None:
            stage.chmod(mode)
        os.replace(stage, path)
    finally:
        if stage.exists():
            stage.unlink()

def read_json(path):
    if not path.is_file():
        return None
    with path.open(encoding='utf-8-sig') as stream:
        return json.load(stream)

if agent == 'claude':
    config_path = home / '.claude.json'
    config = read_json(config_path)
    servers = config.get('mcpServers') if isinstance(config, dict) else None
    if isinstance(servers, dict) and 'codegraph' in servers:
        del servers['codegraph']
        if not servers:
            del config['mcpServers']
        write(config_path, json.dumps(config, ensure_ascii=False, indent=2) + '\n')

    set_path = home / '.claude' / 'settings.json'
    settings = read_json(set_path)
    permissions = settings.get('permissions') if isinstance(settings, dict) else None
    allow = permissions.get('allow') if isinstance(permissions, dict) else None
    if isinstance(allow, list):
        filtered = [value for value in allow if not str(value).startswith('mcp__codegraph__')]
        if len(filtered) != len(allow):
            if filtered:
                permissions['allow'] = filtered
            else:
                del permissions['allow']
            if not permissions:
                del settings['permissions']
            write(set_path, json.dumps(settings, ensure_ascii=False, indent=2) + '\n')
elif agent == 'codex':
    config_path = home / '.codex' / 'config.toml'
    if config_path.is_file():
        content = config_path.read_text(encoding='utf-8')
        header = re.compile(r'^\s*\[\s*mcp_servers\s*\.\s*(?:"codegraph"|\'codegraph\'|codegraph)\s*\]\s*(?:#.*)?(?:\r?\n)?$')
        nested = re.compile(r'^\s*\[\[?\s*mcp_servers\s*\.\s*(?:"codegraph"|\'codegraph\'|codegraph)(?:\s*\.|\s*\])')
        kept = []
        dropping = False
        for line in content.splitlines(keepends=True):
            if header.match(line):
                dropping = True
                continue
            is_table = re.match(r'^\s*\[', line)
            is_nested = nested.match(line)
            if dropping and is_nested:
                continue
            if dropping and is_table:
                dropping = False
            if not dropping:
                kept.append(line)
        updated = ''.join(kept)
        if updated != content:
            write(config_path, updated)
PY
    fi
fi

if [ "$dry_run" -eq 0 ]; then
    PATH=$("$python_bin" - "$bin_root" "$PATH" <<'PY'
import os, sys
preferred = os.path.abspath(sys.argv[1])
remaining = [entry for entry in sys.argv[2].split(os.pathsep) if entry and os.path.abspath(os.path.expanduser(entry)) != preferred]
print(os.pathsep.join([preferred, *remaining]))
PY
)
    export PATH
    "$python_bin" - "$HOME" "${SHELL:-}" "$bin_root" <<'PY'
import pathlib, shlex, sys
profile = pathlib.Path(sys.argv[1]) / ('.zprofile' if pathlib.Path(sys.argv[2]).name == 'zsh' else '.profile')
existing = profile.read_text(encoding='utf-8') if profile.exists() else ''
prefix = 'export TEAM_HARNESS_CODEGRAPH_BIN='
kept = [line for line in existing.splitlines() if not line.startswith(prefix) and line != 'export PATH="$TEAM_HARNESS_CODEGRAPH_BIN:$PATH"']
updated = '\n'.join(kept).rstrip() + '\n' + prefix + shlex.quote(sys.argv[3]) + '\nexport PATH="$TEAM_HARNESS_CODEGRAPH_BIN:$PATH"\n'
if updated != existing:
    profile.write_text(updated, encoding='utf-8')
PY
fi
printf '%s\n' "$shim"
