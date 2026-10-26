const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { CodeGraph } = require('../lib');
const manager = require('../lib/watch/manager');
const protocol = require('../lib/watch/protocol');
process.env.CODEGRAPH_DOCS = '0';
process.env.CODEGRAPH_DISABLE_EMBEDDINGS = '1';
process.env.CODEGRAPH_WATCH_REGISTRY = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-registry-'));

test('detached watcher survives initiating process exit and tracks CSharp/PTN without queries', { timeout: 90000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-detached-'));
    fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Health() { return 1; } }');
    const initial = await CodeGraph.init(root, { index: true }); initial.close();
    t.after(async () => { await manager.stopWatcher(root); });
    const entry = require.resolve('../lib/watch/manager');
    const launch = spawnSync(process.execPath, ['--liftoff-only', '-e', 'require(process.argv[1]).ensureWatcher(process.argv[2],{debounceMs:150}).then(x=>console.log(JSON.stringify(x)))', entry, root], { encoding: 'utf8', timeout: 10000, windowsHide: true, env: process.env });
    assert.equal(launch.status, 0, launch.stderr);
    const started = JSON.parse(launch.stdout.trim()); assert.equal(started.active, true);
    assert.equal(protocol.livePid(started.pid), true);
    await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 20000 });
    const reader = CodeGraph.openSync(root);
    t.after(() => reader.close());
    const found = name => reader.getDb().prepare('SELECT name FROM nodes WHERE name = ?').get(name);
    await t.test('CSharp save replaces symbol', async t => {
        fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Shield() { return 2; } }');
        await t.waitFor(() => assert.ok(found('Shield')), { timeout: 15000 }); assert.equal(found('Health'), undefined);
    });
    await t.test('PTN add and atomic save publish component names', async t => {
        fs.writeFileSync(path.join(root, 'Combat.ptn'), 'component WatchHealth { int Value; }');
        await t.waitFor(() => assert.ok(found('WatchHealth')), { timeout: 15000 });
        fs.writeFileSync(path.join(root, 'Combat.ptn.tmp'), 'component WatchShield { int Value; }');
        fs.renameSync(path.join(root, 'Combat.ptn.tmp'), path.join(root, 'Combat.ptn'));
        await t.waitFor(() => assert.ok(found('WatchShield')), { timeout: 15000 }); assert.equal(found('WatchHealth'), undefined);
    });
    await t.test('rapid saves retain the final content', async t => {
        for (let version = 0; version < 10; version++) { fs.writeFileSync(path.join(root, 'Combat.cs'), `public class Combat { public int Version${version}() { return ${version}; } }`); await delay(20); }
        await t.waitFor(() => assert.ok(found('Version9')), { timeout: 15000 }); assert.equal(found('Version0'), undefined);
    });
    await t.test('rename and deletion remove old PTN symbols', async t => {
        fs.renameSync(path.join(root, 'Combat.ptn'), path.join(root, 'Renamed.ptn'));
        await t.waitFor(() => assert.ok(reader.getDb().prepare('SELECT path FROM files WHERE path = ?').get('Renamed.ptn')), { timeout: 15000 });
        assert.equal(reader.getDb().prepare('SELECT path FROM files WHERE path = ?').get('Combat.ptn'), undefined);
        fs.unlinkSync(path.join(root, 'Renamed.ptn'));
        await t.waitFor(() => assert.equal(found('WatchShield'), undefined), { timeout: 15000 });
    });
    await t.test('concurrent starts select one authenticated process', async () => {
        const results = await Promise.all(Array.from({ length: 6 }, () => manager.ensureWatcher(root)));
        assert.deepEqual(new Set(results.map(result => result.pid)), new Set([started.pid]));
        const listed = await manager.listWatchers(); assert.ok(listed.some(result => result.projectPath === fs.realpathSync.native(root)));
    });
    await t.test('external package junction tracks CSharp and PTN edits at their target', async t => {
        const external = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-package-'));
        fs.mkdirSync(path.join(root, 'Packages'));
        fs.symlinkSync(external, path.join(root, 'Packages', 'watch-package'), process.platform === 'win32' ? 'junction' : 'dir');
        fs.writeFileSync(path.join(external, 'External.cs'), 'public class External { public int Original() { return 1; } }');
        fs.writeFileSync(path.join(external, 'External.ptn'), 'component ExternalOriginal { int Value; }');
        await t.waitFor(() => assert.ok(found('ExternalOriginal') && found('Original')), { timeout: 15000 });
        fs.writeFileSync(path.join(external, 'External.cs'), 'public class External { public int Updated() { return 2; } }');
        fs.writeFileSync(path.join(external, 'External.ptn'), 'component ExternalUpdated { int Value; }');
        await t.waitFor(() => assert.ok(found('ExternalUpdated') && found('Updated')), { timeout: 15000 });
        assert.equal(found('ExternalOriginal'), undefined); assert.equal(found('Original'), undefined);
    });
    await t.test('stop leaves edits stale and restart reconciles them', async t => {
        const stopped = await manager.stopWatcher(root); assert.equal(stopped.phase, 'stopped');
        fs.writeFileSync(path.join(root, 'Offline.cs'), 'public class Offline {}'); await delay(700);
        assert.equal(found('Offline'), undefined);
        const restarted = await manager.ensureWatcher(root); assert.equal(restarted.active, true); assert.notEqual(restarted.pid, started.pid);
        await t.waitFor(() => assert.ok(found('Offline')), { timeout: 15000 });
    });
});

test('stale PID state cannot signal or replace an unrelated live process', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-stale-'));
    const graph = await CodeGraph.init(root); graph.close();
    const location = protocol.locations(root);
    protocol.writeJson(location.state, { pid: process.pid, token: 'stale', heartbeatAt: 0, phase: 'watching' });
    const stopped = await manager.stopWatcher(root); assert.equal(stopped.phase, 'stopped');
    assert.equal(protocol.livePid(process.pid), true);
    const started = await manager.ensureWatcher(root); t.after(async () => { await manager.stopWatcher(root); });
    assert.equal(started.active, true); assert.notEqual(started.pid, process.pid);
});

test('simultaneous cold starts and a directory alias converge on one worker', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-cold-'));
    const graph = await CodeGraph.init(root); graph.close();
    t.after(async () => { await manager.stopWatcher(root); });
    const alias = root + '-alias';
    fs.symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const starts = await Promise.all(Array.from({ length: 6 }, (_, index) => manager.ensureWatcher(index % 2 ? root : alias, { timeoutMs: 10000 })));
    assert.ok(starts.every(status => status.active));
    assert.equal(new Set(starts.map(status => status.pid)).size, 1);
    assert.equal(new Set(starts.map(status => status.projectId)).size, 1);
});

test('explicit watch configuration changes restart and survive ordinary ensure calls', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-config-'));
    const graph = await CodeGraph.init(root); graph.close();
    t.after(async () => { await manager.stopWatcher(root); });
    const first = await manager.ensureWatcher(root);
    const second = await manager.ensureWatcher(root, { respectGitignore: false, debounceMs: 250 });
    assert.notEqual(first.pid, second.pid);
    assert.equal(second.configuration.respectGitignore, false);
    const third = await manager.ensureWatcher(root);
    assert.equal(third.pid, second.pid);
    assert.equal(third.configuration.respectGitignore, false);
    await manager.stopWatcher(root);
    assert.equal((await manager.watcherStatus(root)).configuration.respectGitignore, false);
});

test('document edits publish directly and status shows pending files before sync', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-docs-'));
    const { setDocsEnabled } = require('../lib/docs/config');
    const graph = await CodeGraph.init(root);
    setDocsEnabled(graph.getDb(), true);
    delete process.env.CODEGRAPH_DOCS;
    t.after(async () => { await manager.stopWatcher(root); graph.close(); process.env.CODEGRAPH_DOCS = '0'; });
    await manager.ensureWatcher(root, { debounceMs: 500 });
    await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).ready, true), { timeout: 10000 });
    fs.writeFileSync(path.join(root, 'guide.md'), '# Watch guide\n\nRealtime documentation.');
    await t.waitFor(async () => assert.ok((await manager.watcherStatus(root)).pendingFiles.some(file => file.path === 'guide.md')), { timeout: 3000 });
    await t.waitFor(() => assert.ok(graph.getDb().prepare('SELECT file_path FROM mdast_metadata WHERE file_path = ?').get('guide.md')), { timeout: 10000 });
    fs.unlinkSync(path.join(root, 'guide.md'));
    await t.waitFor(() => assert.equal(graph.getDb().prepare('SELECT file_path FROM mdast_metadata WHERE file_path = ?').get('guide.md'), undefined), { timeout: 10000 });
});

test('runtime mismatch authenticates and replaces the previous worker', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-upgrade-'));
    fs.writeFileSync(path.join(root, 'base.cs'), 'public class Base {}');
    const graph = await CodeGraph.init(root, { index: true }); graph.close();
    const worker = require.resolve('../lib/watch/worker');
    const previous = spawn(process.execPath, ['--liftoff-only', worker, root, Buffer.from(JSON.stringify({ runtimeId: 'previous-runtime' })).toString('base64url')], { windowsHide: true, stdio: 'ignore', env: process.env });
    t.after(async () => { await manager.stopWatcher(root); });
    await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).active, true), { timeout: 10000 });
    const upgraded = await manager.ensureWatcher(root, { timeoutMs: 10000 });
    assert.equal(upgraded.active, true); assert.notEqual(upgraded.pid, previous.pid); assert.equal(upgraded.runtimeId, protocol.runtimeId());
});

test('independent CLI processes contend on the native startup lock', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-processes-'));
    const graph = await CodeGraph.init(root); graph.close();
    t.after(async () => { await manager.stopWatcher(root); });
    const entry = require.resolve('../lib/watch/manager');
    const results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
        const client = spawn(process.execPath, ['--liftoff-only', '-e', 'require(process.argv[1]).ensureWatcher(process.argv[2],{timeoutMs:10000}).then(x=>console.log(JSON.stringify(x)))', entry, root], { windowsHide: true, env: process.env });
        let output = ''; let errors = '';
        client.stdout.on('data', chunk => { output += chunk; });
        client.stderr.on('data', chunk => { errors += chunk; });
        client.on('error', reject);
        client.on('exit', code => { if (code !== 0) reject(new Error(errors)); else { try { resolve(JSON.parse(output)); } catch (error) { reject(error); } } });
    })));
    assert.ok(results.every(status => status.active));
    assert.equal(new Set(results.map(status => status.pid)).size, 1);
});

test('a crashed owned worker releases its native lease and can restart', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-crash-'));
    const graph = await CodeGraph.init(root); graph.close();
    const previous = spawn(process.execPath, ['--liftoff-only', require.resolve('../lib/watch/worker'), root], { windowsHide: true, stdio: 'ignore', env: process.env });
    t.after(async () => { await manager.stopWatcher(root); });
    await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).pid, previous.pid), { timeout: 10000 });
    const exited = once(previous, 'exit');
    previous.kill('SIGKILL');
    await exited;
    const recovered = await manager.ensureWatcher(root);
    assert.equal(recovered.active, true); assert.notEqual(recovered.pid, previous.pid);
});

test('a worker that cannot open its index stops after bounded start attempts', { timeout: 60000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-broken-'));
    fs.mkdirSync(path.join(root, '.codegraph'));
    fs.writeFileSync(path.join(root, '.codegraph', 'codegraph.db'), 'not a sqlite database');
    t.after(async () => { await manager.stopWatcher(root); });
    const started = await manager.ensureWatcher(root);
    assert.equal(started.active, true);
    await t.waitFor(() => assert.equal(protocol.livePid(started.pid), false), { timeout: 45000, interval: 500 });
    assert.match(fs.readFileSync(protocol.locations(root).log, 'utf8'), /failed starts/);
});

test('a live worker that answers too slowly is reported busy instead of replaced', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-busy-'));
    const graph = await CodeGraph.init(root); graph.close();
    const location = protocol.locations(root);
    const sockets = new Set();
    const silent = net.createServer(socket => { sockets.add(socket); });
    await new Promise(resolve => silent.listen(location.endpoint, resolve));
    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => silent.close(resolve));
    });
    protocol.writeJson(location.state, { pid: process.pid, token: 'busy', heartbeatAt: 0, phase: 'reconciling' });
    const started = Date.now();
    const result = await manager.ensureWatcher(root);
    assert.equal(result.busy, true);
    assert.equal(result.pid, process.pid);
    assert.ok(Date.now() - started < 3000, `ensureWatcher took ${Date.now() - started} ms`);
});

test('listing watchers removes registry records of deleted projects', async () => {
    const missing = path.join(os.tmpdir(), 'cg-watch-deleted-project-never-created');
    const record = path.join(protocol.registryDirectory(), 'a'.repeat(32) + '.json');
    protocol.writeJson(record, { projectPath: missing, projectId: 'a'.repeat(32), runtimeId: 'any' });
    await manager.listWatchers();
    assert.equal(fs.existsSync(record), false);
});

test('a reader holding the state file cannot stop the worker heartbeat', { timeout: 30000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-contention-'));
    const graph = await CodeGraph.init(root); graph.close();
    t.after(async () => { await manager.stopWatcher(root); });
    const started = await manager.ensureWatcher(root);
    assert.equal(started.active, true);
    const location = protocol.locations(root);
    const reader = fs.openSync(location.state, 'r');
    try { await delay(2500); }
    finally { fs.closeSync(reader); }
    await delay(1500);
    const status = await manager.watcherStatus(root);
    assert.equal(status.active, true, JSON.stringify(status));
    assert.equal(status.pid, started.pid);
});

test('a worker exits after the idle limit and status requests postpone it', { timeout: 40000 }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-idle-'));
    const graph = await CodeGraph.init(root); graph.close();
    const previous = process.env.CODEGRAPH_WATCH_IDLE_MS;
    process.env.CODEGRAPH_WATCH_IDLE_MS = '3000';
    t.after(async () => {
        if (previous === undefined) delete process.env.CODEGRAPH_WATCH_IDLE_MS;
        else process.env.CODEGRAPH_WATCH_IDLE_MS = previous;
        await manager.stopWatcher(root);
    });
    const started = await manager.ensureWatcher(root);
    assert.equal(started.active, true);
    for (let index = 0; index < 5; index++) {
        await delay(1000);
        assert.equal((await manager.watcherStatus(root)).pid, started.pid);
    }
    await t.waitFor(() => assert.equal(protocol.livePid(started.pid), false), { timeout: 15000, interval: 250 });
    assert.match(fs.readFileSync(protocol.locations(root).log, 'utf8'), /without CLI requests/);
});
