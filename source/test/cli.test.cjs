const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const entry = path.resolve(__dirname, '../lib/bin/codegraph.js');
process.env.CODEGRAPH_WATCH_REGISTRY = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-cli-registry-'));

function cli(...parameters) {
    const result = spawnSync(process.execPath, ['--liftoff-only', entry, ...parameters], {
        encoding: 'utf8', timeout: 30000, windowsHide: true,
        env: { ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' },
    });
    assert.equal(result.error, undefined, result.error?.message);
    return result;
}

// stopWatcher 는 IPC 가 닫히면 돌아옴. 워커 프로세스가 끝나기 전에는 Windows 가 프로젝트 폴더 삭제를 거부함
async function removeProject(root) {
    const { pid } = await require('../lib/watch/manager').stopWatcher(root);
    const { livePid } = require('../lib/watch/protocol');
    const deadline = Date.now() + 20000;
    while (pid && livePid(pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    fs.rmSync(root, { recursive: true, force: true });
}

function project(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-cli-한글 '));
    context.after(() => removeProject(root));
    fs.writeFileSync(path.join(root, 'Flow.cs'), 'public static class Target { public static void Alpha() {} public static void Beta() {} } public class Entry { public void Run() { Target.Alpha(); } }');
    const result = cli('init', root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return root;
}

test('explicit nonexistent or uninitialized child paths cannot borrow parent indexes', context => {
    const root = project(context);
    const child = path.join(root, 'child');
    fs.mkdirSync(child);
    for (const target of [path.join(root, 'absent'), child]) {
        const result = cli('status', target, '--json');
        assert.equal(result.status, 1, result.stdout + result.stderr);
        const body = JSON.parse(result.stdout);
        assert.ok(body.error || body.initialized === false);
        assert.notEqual(body.projectPath, root);
    }
});

test('CLI automatically starts one persistent watcher and queries retain its ignore setting', { timeout: 30000 }, async context => {
    const root = project(context);
    const manager = require('../lib/watch/manager');
    fs.writeFileSync(path.join(root, '.gitignore'), 'Ignored.cs\n');
    fs.writeFileSync(path.join(root, 'Ignored.cs'), 'public class IntentionallyIncluded {}');
    const result = spawnSync(process.execPath, ['--liftoff-only', entry, 'index', root, '--no-gitignore', '--quiet'], {
        encoding: 'utf8', timeout: 20000, windowsHide: true,
        env: { ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    await context.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 15000 });
    const status = await manager.watcherStatus(root);
    assert.equal(status.configuration.respectGitignore, false);
    const query = cli('query', 'IntentionallyIncluded', '-p', root, '--json');
    assert.equal(query.status, 0, query.stdout + query.stderr);
    assert.equal(JSON.parse(query.stdout).results[0].results[0].node.name, 'IntentionallyIncluded');
    assert.equal((await manager.watcherStatus(root)).pid, status.pid);
    await manager.stopWatcher(root);
});

test('an initial C# parsing failure still starts watching and recovers after a valid save', { timeout: 30000 }, async context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-cli-recovery-'));
    const manager = require('../lib/watch/manager');
    context.after(() => removeProject(root));
    fs.writeFileSync(path.join(root, 'Repair.cs'), 'public class NeedsRepair { public void Run(');
    const result = spawnSync(process.execPath, ['--liftoff-only', entry, 'init', root], {
        encoding: 'utf8', timeout: 20000, windowsHide: true,
        env: { ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /Repair\.cs/);
    assert.match(fs.readFileSync(path.join(root, '.codegraph/errors.log'), 'utf8'), /Repair\.cs/);
    assert.equal((await manager.watcherStatus(root)).active, true);
    fs.writeFileSync(path.join(root, 'Repair.cs'), 'public class RepairedAutomatically { public void Run() {} }');
    await context.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 15000 });
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(root, '.codegraph/codegraph.db'), { readOnly: true });
    try { assert.ok(db.prepare('SELECT name FROM nodes WHERE name = ?').get('RepairedAutomatically')); }
    finally { db.close(); }
});

for (const command of ['sync', 'index', 'init']) {
    for (const active of [true, false]) {
        test(`plain ${command} retains included C#/PTN with an ${active ? 'active' : 'inactive'} watcher`, { timeout: 30000 }, async context => {
            const root = project(context);
            const manager = require('../lib/watch/manager');
            const invoke = (...parameters) => spawnSync(process.execPath, ['--liftoff-only', entry, ...parameters], {
                encoding: 'utf8', timeout: 20000, windowsHide: true,
                env: { ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_WATCH_REGISTRY: path.join(root, '.codegraph/qa-watchers') },
            });
            fs.writeFileSync(path.join(root, '.gitignore'), 'Ignored.cs\nIgnored.ptn\n');
            fs.writeFileSync(path.join(root, 'Ignored.cs'), 'public class RetainedIgnoredClass {}');
            fs.writeFileSync(path.join(root, 'Ignored.ptn'), 'component RetainedIgnoredComponent { int Value; }');
            const included = invoke('index', root, '--no-gitignore', '--quiet');
            assert.equal(included.status, 0, included.stdout + included.stderr);
            await context.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 15000 });
            if (!active) await manager.stopWatcher(root);
            const args = command === 'init' ? [command, root] : [command, root, '--quiet'];
            const result = active ? invoke(...args) : cli(...args);
            assert.equal(result.status, 0, result.stdout + result.stderr);
            const status = await manager.watcherStatus(root);
            assert.equal(status.configuration.respectGitignore, false);
            assert.equal(status.active, active);
            if (active) await context.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 15000 });
            const { DatabaseSync } = require('node:sqlite');
            const db = new DatabaseSync(path.join(root, '.codegraph/codegraph.db'), { readOnly: true });
            try {
                assert.ok(db.prepare('SELECT name FROM nodes WHERE name = ?').get('RetainedIgnoredClass'));
                assert.ok(db.prepare('SELECT name FROM nodes WHERE name = ?').get('RetainedIgnoredComponent'));
            } finally { db.close(); }
            if (!active) {
                const restarted = invoke(...args);
                assert.equal(restarted.status, 0, restarted.stdout + restarted.stderr);
                assert.equal((await manager.watcherStatus(root)).configuration.respectGitignore, false);
                assert.equal((await manager.watcherStatus(root)).active, true);
            }
        });
    }
}

test('new projects respect gitignore and explicit lifecycle options replace the saved scope', { timeout: 45000 }, async context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-cli-ignore-default-'));
    const manager = require('../lib/watch/manager');
    context.after(() => removeProject(root));
    const invoke = (...parameters) => spawnSync(process.execPath, ['--liftoff-only', entry, ...parameters], {
        encoding: 'utf8', timeout: 20000, windowsHide: true,
        env: { ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_WATCH_REGISTRY: path.join(root, '.codegraph/qa-watchers') },
    });
    fs.writeFileSync(path.join(root, '.gitignore'), 'Ignored.cs\nIgnored.ptn\n');
    fs.writeFileSync(path.join(root, 'Visible.cs'), 'public class VisibleClass {}');
    fs.writeFileSync(path.join(root, 'Ignored.cs'), 'public class ExplicitlyIncludedClass {}');
    fs.writeFileSync(path.join(root, 'Ignored.ptn'), 'component ExplicitlyIncludedComponent { int Value; }');
    const initial = invoke('init', root);
    assert.equal(initial.status, 0, initial.stdout + initial.stderr);
    const { DatabaseSync } = require('node:sqlite');
    const check = async respectGitignore => {
        await context.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 15000 });
        assert.equal((await manager.watcherStatus(root)).configuration.respectGitignore, respectGitignore);
        const db = new DatabaseSync(path.join(root, '.codegraph/codegraph.db'), { readOnly: true });
        try {
            for (const name of ['ExplicitlyIncludedClass', 'ExplicitlyIncludedComponent']) {
                assert.equal(Boolean(db.prepare('SELECT name FROM nodes WHERE name = ?').get(name)), !respectGitignore);
            }
        } finally { db.close(); }
    };
    await check(true);
    for (const [command, flag, respectGitignore] of [
        ['index', '--no-gitignore', false],
        ['sync', '--gitignore', true],
        ['sync', '--no-gitignore', false],
        ['index', '--gitignore', true],
    ]) {
        const result = invoke(command, root, flag, '--quiet');
        assert.equal(result.status, 0, result.stdout + result.stderr);
        await check(respectGitignore);
    }
});
