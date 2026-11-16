const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph, FileWatcher } = require('../lib');
const scanFiles = require('../lib/docs/scan-files');
const manager = require('../lib/watch/manager');
const protocol = require('../lib/watch/protocol');
const { createStateWriter } = require('../lib/watch/worker');

function environment(context, values) {
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    context.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

function temporaryRoot(context, prefix) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}

test('watcher passes pending paths after the first full reconcile and goes full for a large batch', async t => {
    const root = temporaryRoot(t, 'cg-watch-paths-');
    const calls = [];
    let hold = false;
    let release;
    const watcher = new FileWatcher(root, async paths => {
        calls.push(paths);
        if (hold) { hold = false; await new Promise(resolve => { release = resolve; }); }
        return { filesChanged: 0, durationMs: 0, full: !paths };
    }, { debounceMs: 100 });
    t.after(() => { release?.(); watcher.stop(); });
    assert.equal(watcher.start(), true);
    await watcher.waitUntilReady();
    await t.waitFor(() => assert.equal(calls.length, 1), { timeout: 5000 });
    assert.equal(calls[0], undefined);
    fs.writeFileSync(path.join(root, 'Edit.cs'), 'public class Edit {}');
    await t.waitFor(() => assert.equal(calls.length, 2), { timeout: 5000 });
    assert.deepEqual(calls[1], ['Edit.cs']);
    // 맞추는 동안 201개가 쌓이면 다음 맞추기는 경로 없이 전체 sync 로 함
    hold = true;
    fs.writeFileSync(path.join(root, 'Hold.cs'), 'public class Hold {}');
    await t.waitFor(() => assert.ok(release), { timeout: 5000 });
    for (let index = 0; index <= 200; index++) fs.writeFileSync(path.join(root, `Bulk${index}.cs`), `public class Bulk${index} {}`);
    // Windows 는 같은 폴더에 파일이 늘 때 이미 맞춘 Edit.cs 의 change 를 다시 보낼 수 있어 개수 대신 포함 여부를 봄
    await t.waitFor(() => {
        const pending = new Set(watcher.getPendingFiles().map(file => file.path));
        assert.ok(pending.has('Hold.cs'));
        for (let index = 0; index <= 200; index++) assert.ok(pending.has(`Bulk${index}.cs`));
    }, { timeout: 10000 });
    release();
    await t.waitFor(() => assert.deepEqual(watcher.getPendingFiles(), []), { timeout: 10000 });
    assert.deepEqual(calls[2], ['Hold.cs']);
    assert.equal(calls[3], undefined);
});

test('flushNow reconciles pending edits at once instead of waiting for the debounce', async t => {
    const root = temporaryRoot(t, 'cg-watch-flush-now-');
    const calls = [];
    const watcher = new FileWatcher(root, async paths => { calls.push(paths); return { filesChanged: 0, durationMs: 0 }; }, { debounceMs: 60000 });
    t.after(() => watcher.stop());
    assert.equal(watcher.start(), true);
    await watcher.waitUntilReady();
    await watcher.flushNow();
    assert.deepEqual(calls, [undefined]);
    fs.writeFileSync(path.join(root, 'Late.cs'), 'public class Late {}');
    await t.waitFor(() => assert.equal(watcher.getPendingFiles().length, 1), { timeout: 5000 });
    await watcher.flushNow();
    assert.deepEqual(calls, [undefined, ['Late.cs']]);
    assert.deepEqual(watcher.getPendingFiles(), []);
    await watcher.flushNow();
    assert.equal(calls.length, 2);
});

test('sync with known paths reconciles only those files without listing the tree', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-targeted-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    fs.writeFileSync(path.join(root, 'Alpha.cs'), 'public class Alpha { void First() {} }\n');
    fs.writeFileSync(path.join(root, 'Beta.cs'), 'public class Beta { void Keep() {} }\n');
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nfirst\n');
    fs.writeFileSync(path.join(root, 'Other.md'), '# Other\n');
    const graph = CodeGraph.initSync(root);
    // after 훅은 등록 순서대로 돌아서 DB 를 닫은 뒤 폴더를 지우도록 한 훅에 넣음
    context.after(() => {
        graph.close();
        fs.rmSync(root, { recursive: true, force: true });
    });
    const db = graph.getDb();
    assert.equal((await graph.indexAll()).success, true);
    fs.writeFileSync(path.join(root, 'Alpha.cs'), 'public class Alpha { void First() {} void Second() {} }\n');
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nsecond revision\n');
    const listing = context.mock.method(scanFiles, 'listVisibleFiles', () => { throw new Error('targeted sync must not list the tree'); });
    const targeted = await graph.sync({ paths: ['Alpha.cs', 'Notes.md'] });
    assert.equal(targeted.status, 'current', JSON.stringify(targeted));
    assert.equal(targeted.scope, 'paths');
    assert.equal(targeted.filesChecked, 1);
    assert.equal(targeted.filesModified, 1);
    assert.deepEqual(targeted.docPaths, ['Notes.md']);
    assert.ok(graph.getNodesInFile('Alpha.cs').some(node => node.name === 'Second'));
    assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path = 'Other.md'").get().c, 1);
    assert.ok(db.prepare("SELECT path FROM file_inventory WHERE path = 'Beta.cs'").get());
    fs.rmSync(path.join(root, 'Beta.cs'));
    const removed = await graph.sync({ paths: ['Beta.cs'] });
    assert.equal(removed.scope, 'paths');
    assert.equal(removed.filesRemoved, 1);
    assert.equal(graph.getNodesInFile('Beta.cs').length, 0);
    assert.equal(db.prepare("SELECT path FROM file_inventory WHERE path = 'Beta.cs'").get(), undefined);
    assert.ok(db.prepare("SELECT path FROM file_inventory WHERE path = 'Other.md'").get());
    assert.equal(listing.mock.callCount(), 0);
    listing.mock.restore();
    // 새 경로나 무시 규칙 파일이 섞이면 전체 sync 로 감
    fs.writeFileSync(path.join(root, 'Gamma.cs'), 'public class Gamma {}\n');
    const added = await graph.sync({ paths: ['Gamma.cs'] });
    assert.equal(added.scope, 'full');
    assert.ok(graph.getNodesInFile('Gamma.cs').some(node => node.name === 'Gamma'));
    assert.equal((await graph.sync({ paths: ['.gitignore'] })).scope, 'full');
    assert.equal((await graph.sync()).scope, 'full');
});

test('watcher state is written only when it changes or the refresh interval passes', () => {
    let now = 1000;
    let fail = false;
    const writes = [];
    const write = createStateWriter(state => {
        if (fail) throw new Error('EPERM');
        writes.push(state.phase);
    }, 5000, () => now);
    assert.equal(write({ phase: 'watching', heartbeatAt: 1 }), true);
    now += 1000;
    assert.equal(write({ phase: 'watching', heartbeatAt: 2 }), false);
    assert.equal(write({ phase: 'reconciling', heartbeatAt: 3 }), true);
    now += 5000;
    assert.equal(write({ phase: 'reconciling', heartbeatAt: 4 }), true);
    fail = true;
    assert.throws(() => write({ phase: 'stopped', heartbeatAt: 5 }), /EPERM/);
    fail = false;
    assert.equal(write({ phase: 'stopped', heartbeatAt: 6 }), true);
    assert.deepEqual(writes, ['watching', 'reconciling', 'reconciling', 'stopped']);
});

test('a flush request makes the watcher publish a pending edit through a targeted sync', { timeout: 90000 }, async t => {
    environment(t, {
        CODEGRAPH_NO_WATCH: undefined,
        CODEGRAPH_DOCS: '0',
        CODEGRAPH_DISABLE_EMBEDDINGS: '1',
        CODEGRAPH_WATCH_REGISTRY: temporaryRoot(t, 'cg-watch-registry-'),
    });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-flush-'));
    fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Health() { return 1; } }');
    const initial = await CodeGraph.init(root, { index: true });
    initial.close();
    let reader = null;
    let workerPid = null;
    t.after(async () => {
        reader?.close();
        await manager.stopWatcher(root);
        // 파이프가 닫힌 뒤에도 감시 프로세스가 잠깐 파일을 쥐고 있어 끝날 때까지 기다림
        const deadline = Date.now() + 15000;
        while (workerPid && protocol.livePid(workerPid) && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(root, { recursive: true, force: true });
    });
    const started = await manager.ensureWatcher(root, { debounceMs: 60000 });
    workerPid = started.pid;
    assert.equal(started.active, true);
    await t.waitFor(async () => assert.equal((await manager.flushWatcher(root)).ready, true), { timeout: 30000 });
    fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Shield() { return 2; } }');
    await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).pendingFiles.length, 1), { timeout: 15000 });
    const flushed = await manager.flushWatcher(root);
    assert.equal(flushed.ready, true, JSON.stringify(flushed));
    assert.deepEqual(flushed.pendingFiles, []);
    assert.equal(flushed.lastSync.full, false);
    reader = CodeGraph.openSync(root);
    assert.ok(reader.getDb().prepare('SELECT name FROM nodes WHERE name = ?').get('Shield'));
});
