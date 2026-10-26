const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { CodeGraph, FileWatcher, LockUnavailableError } = require('../lib');
process.env.CODEGRAPH_DOCS = '0';
process.env.CODEGRAPH_DISABLE_EMBEDDINGS = '1';

test('initial reconciliation retries a failure even without new edits', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-retry-'));
    fs.writeFileSync(path.join(root, 'initial.cs'), 'public class Initial {}');
    let calls = 0;
    const errors = [];
    const watcher = new FileWatcher(root, async () => {
        calls++;
        if (calls === 1) throw new Error('first reconciliation failed');
        if (calls === 2) throw new LockUnavailableError();
        return { filesChanged: 1, durationMs: 1 };
    }, { debounceMs: 100, onSyncError: error => errors.push(error.message) });
    t.after(() => watcher.stop());
    assert.equal(watcher.start(), true);
    await watcher.waitUntilReady();
    await t.waitFor(() => assert.equal(calls, 3), { timeout: 10000 });
    assert.equal(errors.length, 1);
    assert.deepEqual(watcher.getPendingFiles(), []);
});

test('a persistent sync failure stops automatic retries and retries again on the next edit', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-retry-cap-'));
    let calls = 0;
    const decisions = [];
    const watcher = new FileWatcher(root, async () => {
        calls++;
        throw new Error('database is unavailable');
    }, { debounceMs: 50, retryBaseMs: 10, onSyncError: (_, info) => decisions.push(info.willRetry) });
    t.after(() => watcher.stop());
    watcher.start(); await watcher.waitUntilReady();
    await t.waitFor(() => assert.equal(calls, 7), { timeout: 10000 });
    await delay(1000);
    assert.equal(calls, 7);
    assert.deepEqual(decisions, [true, true, true, true, true, true, false]);
    fs.writeFileSync(path.join(root, 'Edited.cs'), 'public class Edited {}');
    await t.waitFor(() => assert.equal(calls, 8), { timeout: 5000 });
    await delay(500);
    assert.equal(calls, 8);
});

test('a path-level watcher error keeps watching without a sync error', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-path-error-'));
    const errors = [];
    const watcher = new FileWatcher(root, async () => ({ filesChanged: 0, durationMs: 0 }), { debounceMs: 50, onSyncError: error => errors.push(error) });
    t.after(() => watcher.stop());
    watcher.start(); await watcher.waitUntilReady();
    for (const code of ['EBUSY', 'EPERM', 'EACCES']) watcher.watcher.emit('error', Object.assign(new Error(`locked file ${code}`), { code }));
    assert.equal(watcher.isActive(), true);
    assert.deepEqual(errors, []);
    watcher.watcher.emit('error', Object.assign(new Error('watch limit reached'), { code: 'ENOSPC' }));
    assert.equal(watcher.isActive(), false);
    assert.equal(errors.length, 1);
});

test('an empty project still reconciles once at startup', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-empty-'));
    let calls = 0;
    const watcher = new FileWatcher(root, async () => { calls++; return { filesChanged: 0, durationMs: 0 }; }, { debounceMs: 100 });
    t.after(() => watcher.stop());
    watcher.start(); await watcher.waitUntilReady();
    await t.waitFor(() => assert.equal(calls, 1), { timeout: 3000 });
    await delay(300); assert.equal(calls, 1);
});

test('an edit during sync stays pending when two events share a millisecond timestamp', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-sequence-'));
    let hold = false;
    let release;
    let calls = 0;
    const watcher = new FileWatcher(root, async () => {
        calls++;
        if (hold) { hold = false; await new Promise(resolve => { release = resolve; }); }
        return { filesChanged: 1, durationMs: 1 };
    }, { debounceMs: 100 });
    t.after(() => { release?.(); watcher.stop(); });
    watcher.start(); await watcher.waitUntilReady();
    await t.waitFor(() => assert.equal(calls, 1), { timeout: 3000 });
    const fixedTime = Date.now();
    t.mock.method(Date, 'now', () => fixedTime);
    hold = true;
    fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat {}');
    await t.waitFor(() => assert.ok(release), { timeout: 3000 });
    await delay(100);
    fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class UpdatedCombat {}');
    await t.waitFor(() => assert.equal(watcher.getPendingFiles()[0]?.indexing, false), { timeout: 3000 });
    release();
    await t.waitFor(() => assert.equal(calls, 3), { timeout: 3000 });
    assert.deepEqual(watcher.getPendingFiles(), []);
});

test('stop rejects readiness waiters and ignores an old in-flight completion after restart', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-life-'));
    let release;
    let calls = 0;
    const successes = [];
    const watcher = new FileWatcher(root, async () => {
        calls++;
        if (calls === 1) await new Promise(resolve => { release = resolve; });
        return { filesChanged: calls, durationMs: 1 };
    }, { debounceMs: 100, onSyncComplete: result => successes.push(result) });
    t.after(() => { release?.(); watcher.stop(); });
    watcher.start();
    const firstReady = watcher.waitUntilReady();
    watcher.stop();
    await assert.rejects(firstReady, /stopped/);
    watcher.start(); await watcher.waitUntilReady();
    await t.waitFor(() => assert.ok(release), { timeout: 3000 });
    watcher.stop(); watcher.start(); await watcher.waitUntilReady();
    fs.writeFileSync(path.join(root, 'later.cs'), 'public class Later {}');
    release();
    await t.waitFor(() => assert.equal(successes.length, 1), { timeout: 5000 });
    assert.equal(successes[0].filesChanged, 2);
    assert.deepEqual(watcher.getPendingFiles(), []);
});

test('watch retains respectGitignore false and publishes ignored-folder changes', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-scope-'));
    fs.mkdirSync(path.join(root, 'ignored'));
    fs.writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
    fs.writeFileSync(path.join(root, 'ignored', 'Combat.cs'), 'public class Combat { public int Health() { return 1; } }');
    const graph = await CodeGraph.init(root, { index: false });
    t.after(() => graph.close());
    await graph.indexAll({ respectGitignore: false });
    const found = name => graph.getDb().prepare('SELECT name FROM nodes WHERE name = ?').get(name);
    assert.ok(found('Health'));
    const done = [];
    graph.watch({ respectGitignore: false, debounceMs: 100, onSyncComplete: result => done.push(result) });
    await graph.waitUntilWatcherReady();
    await t.waitFor(() => assert.ok(done.length), { timeout: 10000 });
    assert.ok(found('Health'));
    fs.writeFileSync(path.join(root, 'ignored', 'Combat.cs'), 'public class Combat { public int Shield() { return 2; } }');
    await t.waitFor(() => assert.ok(found('Shield')), { timeout: 10000 });
    assert.equal(found('Health'), undefined);
    await t.waitFor(() => assert.equal(graph.isIndexing(), false), { timeout: 10000 });
});

test('changing ignore rules restarts scope and discovers previously excluded sources', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-rules-'));
    fs.mkdirSync(path.join(root, 'ignored'));
    fs.writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
    fs.writeFileSync(path.join(root, 'base.ts'), 'export function base() {}');
    fs.writeFileSync(path.join(root, 'ignored', 'hidden.ts'), 'export function hidden() {}');
    const graph = await CodeGraph.init(root, { index: true });
    t.after(() => graph.close());
    const done = [];
    graph.watch({ debounceMs: 100, onSyncComplete: result => done.push(result) });
    await graph.waitUntilWatcherReady();
    await t.waitFor(() => assert.ok(done.length), { timeout: 10000 });
    fs.writeFileSync(path.join(root, '.gitignore'), '\n');
    await t.waitFor(() => assert.ok(graph.getDb().prepare('SELECT name FROM nodes WHERE name = ?').get('hidden')), { timeout: 10000 });
    await t.waitFor(() => assert.equal(graph.isIndexing(), false), { timeout: 10000 });
});
