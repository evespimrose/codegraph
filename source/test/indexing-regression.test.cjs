const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const { DatabaseConnection } = require('../lib/db');
const { QueryBuilder } = require('../lib/db/queries');
const { GraphTraverser } = require('../lib/graph/traversal');
const { sourceAdapterRegistry, ptnAdapter } = require('../lib/extraction/adapters');
const { isSourceFile, detectLanguage } = require('../lib/extraction/grammars');
const { scanDirectory, scanDirectoryAsync } = require('../lib/extraction');
const { setDocsEnabled } = require('../lib/docs/config');
const { listTextDocumentFiles } = require('../lib/docs/scan-files');
const { refreshFileInventory } = require('../lib/inventory');
const { readIndexHealth, buildDoctorReport } = require('../lib/doctor');
const { FileLock } = require('../lib/utils');

function fixture(context) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-indexing-'));
    const root = path.join(base, 'project');
    fs.mkdirSync(root);
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    const resources = [];
    context.after(() => {
        for (const resource of resources) resource.close();
        assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
        fs.rmSync(base, { recursive: true, force: true });
    });
    return { base, root, resources };
}

function environment(context, values) {
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    context.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

test('registered adapter extensions are accepted without duplicating a built-in map', () => {
    sourceAdapterRegistry.register({
        ...ptnAdapter,
        manifest: { ...ptnAdapter.manifest, id: 'indexing-test', language: 'indexing-test', extensions: ['.indextest'] },
    });
    assert.equal(isSourceFile('Entity.PTN'), true);
    assert.equal(isSourceFile('Entity.indextest'), true);
    assert.equal(detectLanguage('Entity.indextest'), 'indexing-test');
    assert.equal(isSourceFile('Unknown.unhandled'), false);
});

test('full and incremental indexing maintain C# and PTN files and symbols after add change and delete', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    fs.writeFileSync(path.join(root, 'Spawn.ptn'), 'component SpawnTrigger {}\n');
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { public void Run() {} }\n');
    assert.deepEqual(scanDirectory(root).sort(), ['Runner.cs', 'Spawn.ptn']);
    assert.deepEqual((await scanDirectoryAsync(root)).sort(), ['Runner.cs', 'Spawn.ptn']);
    assert.deepEqual(scanDirectory(root, undefined, { respectGitignore: false }).sort(), ['Runner.cs', 'Spawn.ptn']);
    const indexed = await graph.indexAll();
    assert.equal(indexed.success, true, JSON.stringify(indexed.errors));
    assert.equal(graph.getNodesInFile('Spawn.ptn').some(node => node.kind === 'component' && node.name === 'SpawnTrigger'), true);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.kind === 'method' && node.name === 'Run'), true);
    assert.equal(graph.getFile('Spawn.ptn').language, 'ptn');
    fs.writeFileSync(path.join(root, 'Spawn.ptn'), 'component SpawnRequest { Int32 Count; }\n');
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { public void Execute() {} }\n');
    fs.writeFileSync(path.join(root, 'Extra.ptn'), 'component ExtraTrigger {}\n');
    fs.writeFileSync(path.join(root, 'Extra.cs'), 'public class ExtraRunner {}\n');
    await graph.sync();
    assert.equal(graph.getNodesInFile('Spawn.ptn').some(node => node.name === 'SpawnRequest'), true);
    assert.equal(graph.getNodesInFile('Spawn.ptn').some(node => node.name === 'SpawnTrigger'), false);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'Execute'), true);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'Run'), false);
    assert.equal(graph.getNodesInFile('Extra.ptn').some(node => node.name === 'ExtraTrigger'), true);
    assert.equal(graph.getNodesInFile('Extra.cs').some(node => node.name === 'ExtraRunner'), true);
    fs.unlinkSync(path.join(root, 'Spawn.ptn'));
    fs.unlinkSync(path.join(root, 'Runner.cs'));
    await graph.sync();
    assert.deepEqual(graph.getNodesInFile('Spawn.ptn'), []);
    assert.deepEqual(graph.getNodesInFile('Runner.cs'), []);
    assert.equal(Boolean(graph.getFile('Spawn.ptn')), false);
    assert.equal(Boolean(graph.getFile('Runner.cs')), false);
    assert.deepEqual(graph.getDb().prepare("SELECT path FROM file_inventory WHERE path IN ('Spawn.ptn', 'Runner.cs')").all(), []);
});

test('force indexing preserves existing graph while another writer owns the lock', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class OriginalRunner {}\n');
    assert.equal((await graph.indexAll()).success, true);
    const oldNodes = graph.getNodesInFile('Runner.cs');
    const lock = new FileLock(path.join(root, '.codegraph', 'codegraph.lock'));
    lock.acquire();
    try {
        fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class RebuiltRunner {}\n');
        const blocked = await graph.indexAll({ force: true });
        assert.equal(blocked.success, false);
        assert.match(blocked.errors[0].message, /file lock/);
        assert.deepEqual(graph.getNodesInFile('Runner.cs'), oldNodes);
    }
    finally {
        lock.release();
    }
    const rebuilt = await graph.indexAll({ force: true });
    assert.equal(rebuilt.success, true);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'RebuiltRunner'), true);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'OriginalRunner'), false);
});

test('malformed C# keeps sync current while health reports it until repair', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    const file = path.join(root, 'Runner.cs');
    fs.writeFileSync(file, 'public class Runner { public void Run() {} }\n');
    assert.equal((await graph.indexAll()).success, true);
    fs.writeFileSync(file, 'public class Runner { public void Run(\n');
    const broken = await graph.sync();
    assert.equal(broken.status, 'current', JSON.stringify(broken));
    assert.equal(broken.errors.some(error => error.filePath === 'Runner.cs' && error.severity === 'error'), true);
    assert.equal(readIndexHealth(graph.getDb()).healthy, false);
    const repeated = await graph.sync();
    assert.equal(repeated.status, 'current');
    assert.ok(repeated.warnings.some(warning => warning.includes('source files have indexing errors')));
    fs.writeFileSync(file, 'public class Runner { public void Fixed() {} }\n');
    const repaired = await graph.sync();
    assert.equal(repaired.status, 'current');
    assert.equal(readIndexHealth(graph.getDb()).healthy, true);
    assert.equal(graph.getNodesInFile('Runner.cs').some(node => node.name === 'Fixed'), true);
});

test('external package source remains indexed while linked documents are explicit exclusions', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { base, root, resources } = fixture(context);
    const external = path.join(base, 'shared-package');
    const linked = path.join(root, 'Packages', 'shared');
    fs.mkdirSync(external);
    fs.mkdirSync(path.dirname(linked));
    fs.writeFileSync(path.join(external, 'Shared.cs'), 'public class SharedSource {}\n');
    fs.writeFileSync(path.join(external, 'Shared.ptn'), 'component SharedComponent {}\n');
    fs.writeFileSync(path.join(external, 'Notes.md'), '# Linked package document\n');
    fs.symlinkSync(external, linked, process.platform === 'win32' ? 'junction' : 'dir');
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    await graph.indexAll({ respectGitignore: false });
    assert.equal(graph.getNodesInFile('Packages/shared/Shared.cs').some(node => node.name === 'SharedSource'), true);
    assert.equal(graph.getNodesInFile('Packages/shared/Shared.ptn').some(node => node.name === 'SharedComponent'), true);
    const visibleFiles = ['Shared.cs', 'Shared.ptn', 'Notes.md'].map(name => path.join(linked, name));
    const openFile = fs.openSync;
    context.mock.method(fs, 'openSync', (file, ...options) => {
        assert.notEqual(path.basename(String(file)), 'Notes.md', 'Excluded document content must not be sampled');
        return openFile(file, ...options);
    });
    assert.deepEqual(listTextDocumentFiles(root, undefined, visibleFiles), []);
    const db = graph.getDb();
    setDocsEnabled(db, true);
    const summary = refreshFileInventory(db, root, { visibleFiles });
    assert.equal(summary.byStatus.indexed, 2);
    assert.equal(summary.byStatus.ignored, 1);
    assert.equal(summary.byStatus.error, 0);
    const record = db.prepare("SELECT status, diagnostic FROM file_inventory WHERE path = 'Packages/shared/Notes.md'").get();
    assert.equal(record.status, 'ignored');
    assert.match(record.diagnostic, /outside the project root/);
});

test('document failures remain visible while sync stays current and clear after successful retry', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    const db = graph.getDb();
    const note = path.join(root, 'Notes.md');
    fs.writeFileSync(note, '# First revision\n');
    await graph.indexAll();
    const oldHash = db.prepare("SELECT content_hash FROM mdast_metadata WHERE file_path = 'Notes.md'").get().content_hash;
    fs.writeFileSync(note, '# Changed document requiring publication\n');
    const parser = require('../lib/docs/document-parser');
    const parseDocument = parser.parseDocument;
    const injected = context.mock.method(parser, 'parseDocument', (raw, format) => {
        if (raw.includes('Changed document requiring publication')) throw new Error('Injected parser failure');
        return parseDocument(raw, format);
    });
    const updated = await graph.sync();
    injected.mock.restore();
    assert.equal(updated.status, 'current', JSON.stringify(updated));
    assert.equal(updated.errors.some(error => error.filePath === 'Notes.md'), true);
    assert.equal(db.prepare("SELECT content_hash FROM mdast_metadata WHERE file_path = 'Notes.md'").get().content_hash, oldHash);
    refreshFileInventory(db, root);
    const unhealthy = readIndexHealth(db);
    assert.equal(unhealthy.healthy, false);
    assert.equal(unhealthy.documentErrors, 1);
    assert.equal(db.prepare("SELECT status FROM file_inventory WHERE path = 'Notes.md'").get().status, 'error');
    const repaired = await graph.sync();
    assert.equal(repaired.status, 'current');
    assert.equal((repaired.errors ?? []).some(error => error.severity === 'error'), false);
    refreshFileInventory(db, root);
    assert.equal(readIndexHealth(db).healthy, true);
});

test('full rebuild and incremental sync remain current with optional document warnings', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    fs.writeFileSync(path.join(root, 'Notes.md'), '# A valid lexical document\n');
    const indexed = await graph.indexAll();
    assert.equal(indexed.success, true);
    assert.ok(indexed.errors.some(error => error.severity === 'warning'));
    graph.getDb().prepare("INSERT INTO project_metadata (key, value, updated_at) VALUES ('graph_rebuild_required', 'provenance-v10', 1)").run();
    const rebuilt = await graph.sync();
    assert.equal(rebuilt.status, 'current', JSON.stringify(rebuilt));
    assert.equal(graph.getDb().prepare("SELECT value FROM project_metadata WHERE key = 'graph_rebuild_required'").get(), undefined);
    assert.equal((await graph.sync()).status, 'current');
    const parser = require('../lib/docs/document-parser');
    context.mock.method(parser, 'parseDocument', () => { throw new Error('Injected document publication error'); });
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Changed document content with a publication error\n');
    const reported = await graph.indexAll();
    assert.equal(reported.success, true);
    assert.equal(reported.docs.errors.length, 1);
    assert.equal(reported.inventory.byStatus.error, 1);
});

test('embedding batch failure preserves healthy lexical publication', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    const embeddings = require('../lib/docs/embed');
    context.mock.method(embeddings, 'isEmbedAvailable', async () => true);
    context.mock.method(embeddings, 'embedBatches', async function* () { throw new Error('Injected optional embedding failure'); });
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Searchable lexical document\n');
    const result = await graph.sync();
    assert.equal(result.status, 'current', JSON.stringify(result));
    assert.equal(result.warnings.some(warning => warning.includes('Injected optional embedding failure')), true);
    assert.equal(graph.getDb().prepare("SELECT COUNT(*) AS count FROM document_fts WHERE file_path = 'Notes.md'").get().count, 1);
    assert.equal(readIndexHealth(graph.getDb()).healthy, true);
});

test('partial source diagnostics preserve valid call edges and document publication during full indexing', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { public void Run() { Step(); } public void Step() {} }\n');
    fs.writeFileSync(path.join(root, 'Broken.cs'), 'public class Broken { void Execute(\n');
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Valid document beside a partial source file\n');
    const result = await graph.indexAll({ force: true });
    assert.equal(result.success, true);
    assert.equal(result.indexHealth.sourceErrors, 1);
    assert.equal(result.inventory.byStatus.error, 1);
    assert.ok(result.docs.indexed > 0);
    const run = graph.getNodesInFile('Runner.cs').find(node => node.kind === 'method' && node.name === 'Run');
    assert.equal(graph.getCallees(run.id).some(callee => callee.node.name === 'Step'), true);
    assert.equal(graph.getDb().prepare("SELECT COUNT(*) AS count FROM document_fts WHERE file_path = 'Notes.md'").get().count, 1);
});

test('doctor reports source and inventory failures while distinguishing warning-only diagnostics', async context => {
    const { root, resources } = fixture(context);
    const connection = DatabaseConnection.initialize(path.join(root, 'health.db'));
    resources.push(connection);
    const db = connection.getDb();
    context.mock.method(require('../lib/docs/model-assets'), 'inspectModelAssets', () => ({ mode: 'bundled', valid: true, issues: [] }));
    const queries = new QueryBuilder(db);
    const record = { path: 'Broken.cs', language: 'csharp', contentHash: 'hash', size: 1, modifiedAt: 1, indexedAt: 1, nodeCount: 0 };
    queries.upsertFile({ ...record, errors: [{ severity: 'error', message: 'Parser rejected source' }] });
    queries.upsertFile({ ...record, path: 'Warning.cs', errors: [{ severity: 'warning', message: 'Partial extraction' }] });
    let health = readIndexHealth(db);
    assert.equal(health.healthy, false);
    assert.equal(health.sourceErrors, 1);
    const report = await buildDoctorReport(db, root, 'test');
    assert.equal(report.ok, false);
    assert.equal(report.indexHealth.sourceErrors, 1);
    assert.match(report.warnings.join('\n'), /source files have indexing errors/);
    queries.deleteFile('Broken.cs');
    assert.equal(readIndexHealth(db).healthy, true);
    assert.equal((await buildDoctorReport(db, root, 'test')).ok, true);
    setDocsEnabled(db, true);
    db.prepare("INSERT INTO project_metadata (key, value, updated_at) VALUES ('document_index_errors', 'invalid', 1)").run();
    health = readIndexHealth(db);
    assert.equal(health.healthy, false);
    assert.equal(health.queryErrors, 1);
});

test('call traversal excludes type references imports and document links', context => {
    const { root, resources } = fixture(context);
    const connection = DatabaseConnection.initialize(path.join(root, 'traversal.db'));
    resources.push(connection);
    const queries = new QueryBuilder(connection.getDb());
    const common = { filePath: 'Runner.cs', language: 'csharp', startLine: 1, endLine: 1, startColumn: 0, endColumn: 1, updatedAt: 1 };
    for (const [id, kind] of [['Run', 'method'], ['Step', 'method'], ['Payload', 'class'], ['Library', 'file'], ['Notes', 'doc']]) {
        queries.insertNode({ ...common, id, kind, name: id, qualifiedName: id });
    }
    queries.insertEdges([
        { source: 'Run', target: 'Step', kind: 'calls', provenance: 'resolver' },
        { source: 'Run', target: 'Payload', kind: 'references', provenance: 'resolver' },
        { source: 'Run', target: 'Library', kind: 'imports', provenance: 'resolver' },
        { source: 'Run', target: 'Notes', kind: 'doc_link', provenance: 'resolver' },
    ]);
    const traversal = new GraphTraverser(queries);
    assert.deepEqual(traversal.getCallees('Run').map(result => result.node.id), ['Step']);
    assert.deepEqual(traversal.getCallers('Step').map(result => result.node.id), ['Run']);
    assert.deepEqual(traversal.getCallers('Payload'), []);
    assert.equal(queries.getOutgoingEdges('Run', ['references']).length, 1);
});

test('C# call traversal returns the invoked method without parameter type references', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Payload {} public class Runner { public void Run(Payload value) { Step(); } public void Step() {} }\n');
    await graph.indexAll();
    const run = graph.getNodesInFile('Runner.cs').find(node => node.kind === 'method' && node.name === 'Run');
    assert.ok(run);
    const callees = graph.getCallees(run.id);
    assert.equal(callees.some(result => result.node.kind === 'method' && result.node.name === 'Step'), true);
    assert.equal(callees.some(result => result.node.name === 'Payload'), false);
    assert.equal(callees.every(result => result.edge.kind === 'calls'), true);
});
