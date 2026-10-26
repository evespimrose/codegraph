const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CodeGraph } = require('../lib');
const { MAX_SOURCE_FILE_SIZE } = require('../lib/extraction/limits');

function fixture(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-resolution-'));
    const previous = [process.env.CODEGRAPH_DOCS, process.env.CODEGRAPH_DISABLE_EMBEDDINGS];
    process.env.CODEGRAPH_DOCS = '0';
    process.env.CODEGRAPH_DISABLE_EMBEDDINGS = '1';
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        graph.close();
        for (const [i, key] of ['CODEGRAPH_DOCS', 'CODEGRAPH_DISABLE_EMBEDDINGS'].entries()) {
            if (previous[i] === undefined) delete process.env[key];
            else process.env[key] = previous[i];
        }
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { graph, root, write: (name, content) => fs.writeFileSync(path.join(root, name), content) };
}

test('source size cap is inclusive and inventory ignores oversized files without stale symbols', async context => {
    const { graph, write } = fixture(context);
    const exact = 'public class Exact {}' + ' '.repeat(MAX_SOURCE_FILE_SIZE - 21);
    assert.equal(Buffer.byteLength(exact), MAX_SOURCE_FILE_SIZE);
    write('Exact.cs', exact);
    write('Over.xml', '<root/>' + ' '.repeat(MAX_SOURCE_FILE_SIZE));
    const full = await graph.indexAll({ respectGitignore: false });
    assert.equal(full.success, true, JSON.stringify(full.errors));
    assert.ok(graph.getNodesInFile('Exact.cs').some(n => n.name === 'Exact'));
    assert.equal(graph.getDb().prepare("SELECT status FROM file_inventory WHERE path = 'Over.xml'").get().status, 'ignored');
    write('Exact.cs', exact + ' ');
    const grown = await graph.sync({ respectGitignore: false });
    assert.equal(grown.status, 'current', JSON.stringify(grown));
    assert.deepEqual(graph.getNodesInFile('Exact.cs'), []);
    const ignored = graph.getDb().prepare("SELECT status, diagnostic FROM file_inventory WHERE path = 'Exact.cs'").get();
    assert.equal(ignored.status, 'ignored');
    assert.match(ignored.diagnostic, /1048577 > 1048576/);
    const repeated = await graph.sync({ respectGitignore: false });
    assert.equal(repeated.status, 'current');
    assert.equal(repeated.filesAdded + repeated.filesModified + repeated.filesRemoved, 0);
    write('Exact.cs', 'public class Restored {}');
    assert.equal((await graph.sync({ respectGitignore: false })).status, 'current');
    assert.ok(graph.getNodesInFile('Exact.cs').some(n => n.name === 'Restored'));
});

function calls(graph, target) {
    return graph.getDb().prepare("SELECT s.name AS caller, t.name AS callee FROM edges e JOIN nodes s ON s.id=e.source JOIN nodes t ON t.id=e.target WHERE e.kind='calls' AND t.name=?").all(target);
}

test('unchanged callers follow a late target, target body edit, deletion and restoration', async context => {
    const { graph, root, write } = fixture(context);
    write('Caller.cs', 'public class Caller { public void Run() { Target.Fire(); } }');
    await graph.indexAll({ respectGitignore: false });
    assert.deepEqual(calls(graph, 'Fire'), []);
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1, 'late addition resolves an unchanged caller');
    write('Target.cs', 'public class Target { public static void Fire() { int count = 1; } }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1, 'body edit preserves incoming call');
    write('Target.cs', 'public class Target { public static void Burst() {} }');
    await graph.sync({ respectGitignore: false });
    assert.deepEqual(calls(graph, 'Fire'), [], 'target-only rename removes stale calls');
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1, 'restored method repairs unchanged caller');
    fs.unlinkSync(path.join(root, 'Target.cs'));
    await graph.sync({ respectGitignore: false });
    assert.deepEqual(calls(graph, 'Fire'), []);
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1, 'restoring target repairs unchanged caller');
});

test('target-only changes do not resolve unrelated retained references', async context => {
    const { graph, write } = fixture(context);
    write('Unrelated.cs', `public class Unrelated { public void Work() { ${Array.from({ length: 1200 }, (_, i) => `Unknown${i}();`).join('\n')} } }`);
    write('Caller.cs', 'public class Caller { public void Run() { Target.Fire(); } }');
    await graph.indexAll({ respectGitignore: false });
    assert.ok(graph.queries.getUnresolvedReferencesCount() >= 1200);
    const observed = [];
    const resolveAll = graph.resolver.resolveAll.bind(graph.resolver);
    graph.resolver.resolveAll = (refs, progress) => { observed.push(...refs); return resolveAll(refs, progress); };
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1);
    assert.ok(observed.length < 10, `expected a bounded target update, saw ${observed.length}`);
    assert.equal(observed.some(ref => ref.referenceName.startsWith('Unknown')), false);
    observed.length = 0;
    write('Target.cs', 'public class Target { public static void Fire() { int count = 42; } }');
    await graph.sync({ respectGitignore: false });
    assert.equal(calls(graph, 'Fire').length, 1);
    assert.ok(observed.length < 10);
    assert.equal(observed.some(ref => ref.referenceName.startsWith('Unknown')), false);
    observed.length = 0;
    await graph.sync({ respectGitignore: false });
    assert.equal(observed.length, 0);
    context.diagnostic('1,200 unrelated unresolved calls: zero attempted during target add, body edit, or unchanged sync');
});

test('batched resolution retains misses and visits every repeated call location exactly once', async context => {
    const { graph, write } = fixture(context);
    write('Caller.cs', 'public class Caller { public void Run() {\n Missing();\n Missing();\n Target.Fire();\n Target.Fire();\n Target.Fire();\n } }');
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.orchestrator.indexAll(undefined, undefined, false, { respectGitignore: false });
    graph.resolver.initialize();
    const count = graph.queries.getUnresolvedReferencesCount();
    const seen = [];
    const original = graph.resolver.resolveOne.bind(graph.resolver);
    graph.resolver.resolveOne = ref => { seen.push(ref); return original(ref); };
    const result = await graph.resolver.resolveAndPersistBatched(undefined, 2);
    assert.equal(result.stats.total, count);
    assert.equal(seen.length, count);
    assert.equal(new Set(seen.map(ref => JSON.stringify([ref.fromNodeId, ref.referenceName, ref.referenceKind, ref.line, ref.column]))).size, count);
    assert.equal(calls(graph, 'Fire').length, 3);
    assert.equal(graph.queries.getUnresolvedByName('Missing').length, 2);
});

function simulateLegacyReferenceStorage(graph) {
    const db = graph.getDb();
    db.prepare("DELETE FROM project_metadata WHERE key = 'source-reference-intent-v1'").run();
    db.prepare('DELETE FROM unresolved_refs').run();
    for (const edge of db.prepare('SELECT id, metadata FROM edges WHERE metadata IS NOT NULL').all()) {
        const metadata = JSON.parse(edge.metadata);
        delete metadata.sourceReference;
        db.prepare('UPDATE edges SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), edge.id);
    }
}

test('legacy reference recovery runs once without replacing graph nodes or resolving unrelated references', async context => {
    const { graph, write } = fixture(context);
    write('Caller.cs', 'public class Caller { public void Run() { Target.Fire(); Late.Arrive(); } }');
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.indexAll();
    simulateLegacyReferenceStorage(graph);
    const before = graph.getDb().prepare('SELECT id, updated_at FROM nodes ORDER BY id').all();
    const edgesBefore = graph.getDb().prepare('SELECT id, source, target FROM edges ORDER BY id').all();
    const phases = [];
    const sync = await graph.sync({ onProgress: event => phases.push(event.phase) });
    assert.equal(sync.status, 'current');
    assert.ok(phases.includes('references-recovery'));
    assert.equal(phases.includes('resolving'), false);
    assert.deepEqual(graph.getDb().prepare('SELECT id, updated_at FROM nodes ORDER BY id').all(), before);
    assert.deepEqual(graph.getDb().prepare('SELECT id, source, target FROM edges ORDER BY id').all(), edgesBefore);
    assert.ok(graph.queries.getUnresolvedByName('Late.Arrive').length > 0);
    phases.length = 0;
    await graph.sync({ onProgress: event => phases.push(event.phase) });
    assert.equal(phases.includes('references-recovery'), false);
    write('Late.cs', 'public class Late { public static void Arrive() {} }');
    await graph.sync();
    assert.equal(calls(graph, 'Arrive').length, 1);
    write('Target.cs', 'public class Target { public static void Fire() { int x = 10; } }');
    await graph.sync();
    assert.equal(calls(graph, 'Fire').length, 1);
});

test('failed legacy reference recovery keeps existing graph and retries without publishing a revision', async context => {
    const { graph, write } = fixture(context);
    write('Caller.cs', 'public class Caller { public void Run() { Target.Fire(); } }');
    write('Target.cs', 'public class Target { public static void Fire() {} }');
    await graph.indexAll();
    simulateLegacyReferenceStorage(graph);
    const before = graph.queries.getNodeAndEdgeCount();
    const extractor = require('../lib/extraction/tree-sitter');
    const original = extractor.extractFromSource;
    extractor.extractFromSource = () => { throw new Error('Injected recovery failure'); };
    try { await assert.rejects(graph.sync(), /Injected recovery failure/); }
    finally { extractor.extractFromSource = original; }
    assert.deepEqual(graph.queries.getNodeAndEdgeCount(), before);
    assert.equal(calls(graph, 'Fire').length, 1);
    assert.equal(Boolean(graph.getDb().prepare("SELECT value FROM project_metadata WHERE key='source-reference-intent-v1'").get()), false);
    assert.equal((await graph.sync()).status, 'current');
});
