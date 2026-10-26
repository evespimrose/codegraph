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

function project(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-cli-한글 '));
    context.after(async () => {
        await require('../lib/watch/manager').stopWatcher(root);
        fs.rmSync(root, { recursive: true, force: true });
    });
    fs.writeFileSync(path.join(root, 'Flow.cs'), 'public static class Target { public static void Alpha() {} public static void Beta() {} } public class Entry { public void Run() { Target.Alpha(); } }');
    const result = cli('init', root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return root;
}

test('C# exact traversal is fresh after edits and removed calls disappear', context => {
    const root = project(context);
    fs.writeFileSync(path.join(root, 'Flow.cs'), 'public static class Target { public static void Alpha() {} public static void Beta() {} } public class Entry { public void Run() { Target.Beta(); } }');
    const result = cli('callers', 'Beta', '-p', root, '--json');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).callers[0].name, 'Run');
    assert.equal(JSON.parse(cli('callers', 'Alpha', '-p', root, '--json').stdout).callers.length, 0);
    assert.equal(JSON.parse(cli('callees', 'Entry::Run', '-p', root, '--json').stdout).callees[0].name, 'Beta');
});

test('qualified lookup does not combine different classes sharing a method name', context => {
    const root = project(context);
    fs.writeFileSync(path.join(root, 'Other.cs'), 'public class Other { public void Run() { Target.Alpha(); } }');
    const result = cli('callees', 'Other::Run', '-p', root, '--json');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).callees.map(node => node.name), ['Alpha']);
});

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

test('empty traversal and files results are valid JSON', context => {
    const root = project(context);
    for (const command of ['callers', 'callees', 'impact']) {
        const result = cli(command, 'NoSuchSymbolQAZZZ123', '-p', root, '--json');
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(JSON.parse(result.stdout).found, false);
    }
    assert.deepEqual(JSON.parse(cli('files', '-p', root, '--pattern', 'absent.zzz', '--json').stdout), []);
});

test('query and files discover added C# and remove deleted C# without manual sync', context => {
    const root = project(context);
    const added = path.join(root, 'Added.cs');
    fs.writeFileSync(added, 'public class AddedAfterIndex {}');
    const result = cli('query', 'AddedAfterIndex', '-p', root, '--json');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).results[0].node.name, 'AddedAfterIndex');
    fs.unlinkSync(added);
    assert.deepEqual(JSON.parse(cli('files', '-p', root, '--pattern', 'Added.cs', '--json').stdout), []);
});

test('context accepts the JSON alias and retains declared budget', context => {
    const root = project(context);
    const result = cli('context', 'Target Alpha Run', '-p', root, '--json', '--budget', '700');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.tokenBudget, 700);
    assert.ok(body.estimatedTokens <= 700);
});

test('missing-project JSON errors are machine readable across read commands', context => {
    const root = project(context);
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    for (const args of [['query', 'Target', '-p'], ['docs', 'guide', '-p'], ['context', 'Target', '-p'], ['doctor']]) {
        const result = cli(...args, empty, '--json');
        assert.equal(result.status, 1);
        assert.equal(typeof JSON.parse(result.stdout).error, 'string', result.stdout);
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
    assert.equal(JSON.parse(query.stdout).results[0].node.name, 'IntentionallyIncluded');
    assert.equal((await manager.watcherStatus(root)).pid, status.pid);
    await manager.stopWatcher(root);
});

test('an initial C# parsing failure still starts watching and recovers after a valid save', { timeout: 30000 }, async context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-cli-recovery-'));
    const manager = require('../lib/watch/manager');
    context.after(async () => {
        await manager.stopWatcher(root);
        fs.rmSync(root, { recursive: true, force: true });
    });
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
    context.after(async () => {
        await manager.stopWatcher(root);
        fs.rmSync(root, { recursive: true, force: true });
    });
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
