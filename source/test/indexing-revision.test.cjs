const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const { SOURCE_PARSER_REVISION, SOURCE_PARSER_REVISION_META_KEY, getProvenanceRebuildReason } = require('../lib/provenance');

function fixture(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-revision-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    const previous = process.env.CODEGRAPH_DOCS;
    process.env.CODEGRAPH_DOCS = '0';
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        graph.close();
        if (previous === undefined) delete process.env.CODEGRAPH_DOCS;
        else process.env.CODEGRAPH_DOCS = previous;
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { root, graph, db: graph.getDb() };
}

test('a parser revision mismatch rebuilds unchanged source once and restores PTN symbols', async context => {
    const { root, graph, db } = fixture(context);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner {}\n');
    fs.writeFileSync(path.join(root, 'Spawn.ptn'), 'component SpawnTrigger {}\n');
    assert.equal((await graph.indexAll()).success, true);
    assert.equal(getProvenanceRebuildReason(db), null);
    db.prepare("UPDATE nodes SET name = 'StaleRunner' WHERE name = 'Runner'").run();
    graph.queries.deleteFile('Spawn.ptn');
    db.prepare('UPDATE project_metadata SET value = ? WHERE key = ?').run('older-parser', SOURCE_PARSER_REVISION_META_KEY);
    const indexAll = graph.orchestrator.indexAll.bind(graph.orchestrator);
    const monitored = context.mock.method(graph.orchestrator, 'indexAll', (...args) => indexAll(...args));
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'Runner'), true);
    assert.equal(graph.getNodesInFile('Spawn.ptn').some(node => node.name === 'SpawnTrigger'), true);
    assert.equal(db.prepare('SELECT value FROM project_metadata WHERE key = ?').get(SOURCE_PARSER_REVISION_META_KEY).value, SOURCE_PARSER_REVISION);
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(monitored.mock.callCount(), 1);
});

test('a parser revision rebuild with malformed source clears the requirement once and keeps the diagnostic', async context => {
    const { root, graph, db } = fixture(context);
    const file = path.join(root, 'Runner.cs');
    fs.writeFileSync(file, 'public class Runner {}\n');
    await graph.indexAll();
    db.prepare('DELETE FROM project_metadata WHERE key = ?').run(SOURCE_PARSER_REVISION_META_KEY);
    fs.writeFileSync(file, 'public class Runner { void Broken(\n');
    const indexAll = graph.orchestrator.indexAll.bind(graph.orchestrator);
    const monitored = context.mock.method(graph.orchestrator, 'indexAll', (...args) => indexAll(...args));
    const rebuilt = await graph.sync();
    assert.equal(rebuilt.status, 'current', JSON.stringify(rebuilt));
    assert.equal(getProvenanceRebuildReason(db), null);
    assert.ok(rebuilt.warnings.some(warning => warning.includes('C# syntax tree contains errors')));
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(monitored.mock.callCount(), 1);
    fs.writeFileSync(file, 'public class Runner { void Repaired() {} }\n');
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'Repaired'), true);
});

test('a required rebuild reports blocked while another process holds the index lock', async context => {
    const { root, graph, db } = fixture(context);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner {}\n');
    await graph.indexAll();
    db.prepare('DELETE FROM project_metadata WHERE key = ?').run(SOURCE_PARSER_REVISION_META_KEY);
    const { FileLock } = require('../lib/utils');
    const lock = new FileLock(path.join(root, '.codegraph', 'codegraph.lock'));
    lock.acquire();
    try {
        assert.equal((await graph.sync()).status, 'blocked');
        assert.equal(getProvenanceRebuildReason(db), SOURCE_PARSER_REVISION);
    }
    finally {
        lock.release();
    }
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(getProvenanceRebuildReason(db), null);
});

test('reported full and incremental durations include document finalization time', async context => {
    const { root, graph } = fixture(context);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner {}\n');
    const documents = require('../lib/docs/indexer');
    const indexMarkdown = documents.indexMarkdown;
    context.mock.method(documents, 'indexMarkdown', async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return indexMarkdown(...args);
    });
    for (const operation of [() => graph.indexAll(), () => graph.sync()]) {
        const started = Date.now();
        const result = await operation();
        assert.ok(result.durationMs >= Date.now() - started - 20, JSON.stringify(result));
    }
});
