const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const { listTextDocumentFiles, listVisibleFiles } = require('../lib/docs/scan-files');
const { createDocumentClassifier } = require('../lib/inventory/classifier');

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

function fixture(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-sync-speed-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    const resources = [];
    context.after(() => {
        for (const resource of resources) resource.close();
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { root, resources };
}

function relativeTo(root, file) {
    return path.relative(root, path.resolve(String(file))).split(path.sep).join('/');
}

// 루트 아래 파일(.codegraph 제외)을 fs.openSync 로 연 기록
function recordOpens(context, root) {
    const opened = [];
    const openFile = fs.openSync;
    const mock = context.mock.method(fs, 'openSync', (file, ...rest) => {
        const relative = relativeTo(root, file);
        if (relative && !relative.startsWith('..') && relative !== '.codegraph' && !relative.startsWith('.codegraph/'))
            opened.push(relative);
        return openFile(file, ...rest);
    });
    return { opened, restore: () => mock.mock.restore() };
}

function chainClass(name, count) {
    const methods = [];
    for (let index = 0; index < count; index++) {
        const call = index + 1 < count ? `Step${index + 1}();` : '';
        methods.push(`    public void Step${index}() { ${call} }`);
    }
    return `public class ${name}\n{\n${methods.join('\n')}\n}\n`;
}

test('unchanged sync opens no project file and a changed document is sampled once and re-indexed', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { void Run() {} }\n');
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nFirst revision.\n');
    fs.writeFileSync(path.join(root, 'Settings.json'), '{ "speed": 1 }\n');
    fs.writeFileSync(path.join(root, 'Theme.uss'), '.panel { color: red; }\n');
    fs.writeFileSync(path.join(root, 'Blob.bin'), Buffer.from([0, 1, 2, 3, 0, 255]));
    fs.writeFileSync(path.join(root, 'Icon.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]));
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    const db = graph.getDb();
    assert.equal((await graph.indexAll()).success, true);
    const inventory = () => db.prepare('SELECT path, status, size, mime_type, adapter_id FROM file_inventory ORDER BY path').all().map(row => ({ ...row }));
    const indexed = inventory();
    const quiet = recordOpens(context, root);
    const unchanged = await graph.sync();
    quiet.restore();
    assert.equal(unchanged.status, 'current', JSON.stringify(unchanged));
    assert.deepEqual(quiet.opened, []);
    assert.equal(unchanged.docsUpdated, 0);
    assert.deepEqual(inventory(), indexed);
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nSecond revision with more text.\n');
    const changed = recordOpens(context, root);
    const updated = await graph.sync();
    changed.restore();
    assert.equal(updated.status, 'current', JSON.stringify(updated));
    assert.deepEqual(changed.opened, ['Notes.md']);
    assert.deepEqual(updated.docPaths, ['Notes.md']);
    const note = db.prepare("SELECT file_size FROM mdast_metadata WHERE file_path = 'Notes.md'").get();
    assert.equal(note.file_size, fs.statSync(path.join(root, 'Notes.md')).size);
    assert.equal(db.prepare("SELECT size FROM file_inventory WHERE path = 'Notes.md'").get().size, note.file_size);
});

test('a text file with a binary extension is never opened or indexed as a document', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    fs.writeFileSync(path.join(root, 'fake.png'), 'plain text that only looks like a document\n');
    fs.writeFileSync(path.join(root, 'Readme.md'), '# Readme\n');
    const opens = recordOpens(context, root);
    assert.deepEqual(listTextDocumentFiles(root).map(document => path.basename(document.absolutePath)), ['Readme.md']);
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    assert.equal((await graph.indexAll()).success, true);
    assert.equal((await graph.sync()).status, 'current');
    opens.restore();
    assert.equal(opens.opened.includes('fake.png'), false);
    const db = graph.getDb();
    const row = db.prepare("SELECT status, mime_type, adapter_id FROM file_inventory WHERE path = 'fake.png'").get();
    assert.deepEqual({ ...row }, { status: 'metadata-only', mime_type: 'application/octet-stream', adapter_id: null });
    assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path = 'fake.png'").get().c, 0);
});

test('stored verdicts are reused only when size, time and extension still agree', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    fs.writeFileSync(path.join(root, 'Broken.md'), Buffer.from([35, 0, 1, 2]));
    fs.writeFileSync(path.join(root, 'Blob.bin'), Buffer.from([0, 1, 2, 3]));
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n');
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    assert.equal((await graph.indexAll()).success, true);
    const classify = createDocumentClassifier(graph.getDb(), root);
    const opens = recordOpens(context, root);
    const verdicts = Object.fromEntries(['Broken.md', 'Blob.bin', 'Notes.md'].map(name => [name, classify(path.join(root, name), name)]));
    opens.restore();
    // 문서 확장자의 바이너리 판별은 읽기 실패로 생겼을 수 있어 다시 연다. 나머지는 저장된 판별을 쓴다
    assert.deepEqual(opens.opened, ['Broken.md']);
    assert.equal(verdicts['Broken.md'].document, null);
    assert.equal(verdicts['Blob.bin'].document, null);
    assert.equal(verdicts['Notes.md'].document.format, 'markdown');
    assert.equal(verdicts['Notes.md'].document.mimeType, 'text/markdown');
    const again = recordOpens(context, root);
    assert.equal(classify(path.join(root, 'Broken.md'), 'Broken.md'), verdicts['Broken.md']);
    again.restore();
    assert.deepEqual(again.opened, []);
    fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nlonger now\n');
    const fresh = createDocumentClassifier(graph.getDb(), root);
    const changed = recordOpens(context, root);
    assert.equal(fresh(path.join(root, 'Notes.md'), 'Notes.md').document.format, 'markdown');
    changed.restore();
    assert.deepEqual(changed.opened, ['Notes.md']);
});

test('git listing does not stat paths the ignore rules exclude', context => {
    const { root } = fixture(context);
    fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'readme.md'), '# vendored\n');
    fs.writeFileSync(path.join(root, 'Guide.md'), '# Guide\n');
    const statted = [];
    const statFile = fs.statSync;
    const mock = context.mock.method(fs, 'statSync', (file, ...rest) => {
        statted.push(relativeTo(root, file));
        return statFile(file, ...rest);
    });
    const visible = listVisibleFiles(root).map(file => relativeTo(root, file));
    mock.mock.restore();
    assert.deepEqual(visible, ['Guide.md']);
    assert.equal(statted.includes('node_modules/pkg/readme.md'), false);
});

test('dominant file is stored by indexing, read without recomputing, and refreshed only by refreshing syncs', async context => {
    environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    fs.mkdirSync(path.join(root, 'Core'));
    fs.mkdirSync(path.join(root, 'Extra'));
    fs.writeFileSync(path.join(root, 'Core', 'Engine.cs'), chainClass('Engine', 30));
    fs.writeFileSync(path.join(root, 'Extra', 'Helper.cs'), chainClass('Helper', 3));
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    const db = graph.getDb();
    assert.equal((await graph.indexAll()).success, true);
    const stored = () => JSON.parse(db.prepare("SELECT value FROM project_metadata WHERE key = 'dominant_file'").get().value);
    const indexed = stored();
    assert.equal(indexed.dominant.filePath, 'Core/Engine.cs');
    assert.equal(indexed.fingerprint, graph.queries.getEdgeFingerprint());
    const compute = context.mock.method(graph.queries, 'computeDominantFile');
    assert.equal(graph.queries.getDominantFile().filePath, 'Core/Engine.cs');
    assert.equal(compute.mock.callCount(), 0);
    fs.writeFileSync(path.join(root, 'Extra', 'Helper.cs'), chainClass('Helper', 120));
    // query 처럼 refreshDominant 없이 맞추면 저장값은 그대로이고, 읽기는 계산만 하고 쓰지 않는다
    assert.equal((await graph.sync()).status, 'current');
    assert.equal(compute.mock.callCount(), 0);
    assert.equal(graph.queries.getDominantFile().filePath, 'Extra/Helper.cs');
    assert.equal(compute.mock.callCount(), 1);
    assert.deepEqual(stored(), indexed);
    // context 와 감시기처럼 refreshDominant 로 맞추면 다시 계산해 저장하고, 그 뒤 읽기는 계산하지 않는다
    assert.equal((await graph.sync({ refreshDominant: true })).status, 'current');
    assert.equal(compute.mock.callCount(), 2);
    const refreshed = stored();
    assert.equal(refreshed.dominant.filePath, 'Extra/Helper.cs');
    assert.equal(refreshed.fingerprint, graph.queries.getEdgeFingerprint());
    assert.equal(graph.queries.getDominantFile().filePath, 'Extra/Helper.cs');
    assert.equal(compute.mock.callCount(), 2);
});

test('codegraph data files are never listed, inventoried or indexed as documents', async context => {
    environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
    const { root, resources } = fixture(context);
    fs.mkdirSync(path.join(root, '.github'));
    fs.writeFileSync(path.join(root, '.github', 'ci.yml'), 'name: ci\n');
    fs.writeFileSync(path.join(root, '.codegraphignore'), '# extra ignores\n');
    fs.writeFileSync(path.join(root, 'Guide.md'), '# Guide\n');
    const graph = CodeGraph.initSync(root);
    resources.push(graph);
    assert.equal((await graph.indexAll()).success, true);
    assert.equal((await graph.sync()).status, 'current');
    const db = graph.getDb();
    const listed = listVisibleFiles(root).map(file => relativeTo(root, file));
    assert.equal(listed.some(file => file.startsWith('.codegraph/')), false);
    assert.equal(listed.includes('.github/ci.yml'), true);
    assert.equal(listed.includes('.codegraphignore'), true);
    assert.equal(db.prepare("SELECT COUNT(*) AS c FROM file_inventory WHERE path LIKE '.codegraph/%'").get().c, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path LIKE '.codegraph/%'").get().c, 0);
});
