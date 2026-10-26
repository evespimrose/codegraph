const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const manager = require('../lib/watch/manager');
const protocol = require('../lib/watch/protocol');
const { syncForRead } = require('../lib/bin/freshness');

async function indexedProject(context) {
    const previous = process.env.CODEGRAPH_DOCS;
    process.env.CODEGRAPH_DOCS = '0';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-freshness-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner {}\n');
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        graph.close();
        if (previous === undefined) delete process.env.CODEGRAPH_DOCS;
        else process.env.CODEGRAPH_DOCS = previous;
        fs.rmSync(root, { recursive: true, force: true });
    });
    assert.equal((await graph.indexAll()).success, true);
    return { root, graph };
}

test('reads use a ready watcher publication without an inline sync', async context => {
    const { root, graph } = await indexedProject(context);
    const ready = {
        active: true, ready: true, pendingFiles: [], runtimeId: protocol.runtimeId(),
        configuration: { respectGitignore: true }, lastSync: { warnings: ['1 source files have indexing errors.'] },
    };
    context.mock.method(manager, 'watcherStatus', async () => ready);
    const sync = context.mock.method(graph, 'sync');
    const result = await syncForRead(graph, root);
    assert.equal(result.status, 'current');
    assert.deepEqual(result.warnings, ready.lastSync.warnings);
    assert.equal(sync.mock.callCount(), 0);
});

test('reads reconcile inline when the watcher cannot vouch for the current graph', async context => {
    const { root, graph } = await indexedProject(context);
    const ready = { active: true, ready: true, pendingFiles: [], runtimeId: protocol.runtimeId(), configuration: { respectGitignore: true } };
    const watchers = [
        { ...ready, pendingFiles: ['Runner.cs'] },
        { ...ready, ready: false },
        { ...ready, runtimeId: 'previous-runtime' },
        { ...ready, active: false },
    ];
    const status = context.mock.method(manager, 'watcherStatus', async () => watchers.shift() ?? ready);
    const sync = context.mock.method(graph, 'sync');
    for (let index = 0; index < 4; index++) assert.equal((await syncForRead(graph, root)).status, 'current');
    assert.equal(sync.mock.callCount(), 4);
    graph.getDb().prepare("INSERT INTO project_metadata (key, value, updated_at) VALUES ('graph_rebuild_required', 'provenance-v10', 1)").run();
    assert.equal((await syncForRead(graph, root)).status, 'current');
    assert.equal(sync.mock.callCount(), 5);
    assert.equal(status.mock.callCount(), 5);
});
