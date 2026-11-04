const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

process.env.CODEGRAPH_NO_WATCH = '1';
const { nameTokens } = require('../lib/search/name-tokens');
const { fuseHits } = require('../lib/docs/lexical-search');
const { applyNameTokensMigration } = require('../lib/db/migration-v12');
const { loadSearchTuning, resetSearchTuning } = require('../lib/search-tuning');
const { CodeGraph } = require('../lib/index');
const { searchDocs } = require('../lib/docs/search');

function tempGraph(context, prefix, files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    for (const [name, text] of Object.entries(files))
        fs.writeFileSync(path.join(root, name), text);
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        try { graph.close(); } catch { /* 이미 닫힘 */ }
        fs.rmSync(root, { recursive: true, force: true });
    });
    return graph;
}

function withEnv(context, values) {
    for (const [key, value] of Object.entries(values))
        process.env[key] = value;
    resetSearchTuning();
    context.after(() => {
        for (const key of Object.keys(values))
            delete process.env[key];
        resetSearchTuning();
    });
}

test('identifiers split into lowercase words', () => {
    assert.equal(nameTokens('DamageHitJob'), 'damage hit job');
    assert.equal(nameTokens('HTTPServer2'), 'http server 2');
    assert.equal(nameTokens('sign_in_user'), 'sign in user');
    assert.equal(nameTokens('Memory'), null);
});

test('lexical weight scales the lexical side of the fusion', () => {
    const hit = (file) => ({ file, retrieval: [] });
    const vectorHits = [hit('v.md'), hit('both.md')];
    const lexicalHits = [hit('l.md'), hit('both.md')];
    assert.deepEqual(fuseHits(vectorHits, lexicalHits, 3).map((h) => h.file), ['both.md', 'l.md', 'v.md']);
    assert.deepEqual(fuseHits(vectorHits, lexicalHits, 3, 0.5).map((h) => h.file), ['both.md', 'v.md', 'l.md']);
});

test('environment overrides the tuning file', (context) => {
    withEnv(context, { CODEGRAPH_DOCS_FTS_WEIGHTS: '1,4,2,1', CODEGRAPH_DOCS_MARKDOWN_FIRST: '1', CODEGRAPH_NAME_TOKENS_WEIGHT: '5' });
    const tuning = loadSearchTuning();
    assert.deepEqual(tuning.docsFtsWeights, [1, 4, 2, 1]);
    assert.equal(tuning.docsMarkdownFirst, true);
    assert.equal(tuning.nameTokensWeight, 5);
});

test('migration v12 adds word tokens to an existing node index', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, qualified_name TEXT, docstring TEXT, signature TEXT);
      CREATE VIRTUAL TABLE nodes_fts USING fts5(id, name, qualified_name, docstring, signature, content='nodes', content_rowid='rowid');
      CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature)
        VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
      END;
      INSERT INTO nodes (id, name, qualified_name) VALUES ('n1', 'DamageHitJob', 'DamageHitJob');
    `);
    applyNameTokensMigration(db);
    const before = db.prepare(`SELECT id FROM nodes_fts WHERE nodes_fts MATCH '"hit"*'`).all();
    assert.deepEqual(before.map((row) => row.id), ['n1']);
    db.exec(`INSERT INTO nodes (id, name, qualified_name, name_tokens) VALUES ('n2', 'FollowOwnerSystem', 'FollowOwnerSystem', 'follow owner system')`);
    const after = db.prepare(`SELECT id FROM nodes_fts WHERE nodes_fts MATCH '"owner"*'`).all();
    assert.deepEqual(after.map((row) => row.id), ['n2']);
    db.close();
});

test('symbol search finds a name by inner words', async (context) => {
    withEnv(context, { CODEGRAPH_NAME_TOKENS_WEIGHT: '10' });
    const graph = tempGraph(context, 'codegraph-tokens-', {
        'Hit.cs': 'public class DamageHitJob { public void Run() {} }\n',
    });
    assert.equal((await graph.indexAll()).success, true);
    const names = graph.searchNodes('hit job', { limit: 5 }).map((result) => result.node.name);
    assert.ok(names.includes('DamageHitJob'));
});

test('markdown-first puts markdown hits ahead of other formats', async (context) => {
    withEnv(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_DOCS_MARKDOWN_FIRST: '1' });
    const graph = tempGraph(context, 'codegraph-mdfirst-', {
        'notes.txt': 'inventory grid layout inventory grid layout inventory grid layout\n',
        'grid.md': '# Grid\n\ninventory layout\n',
    });
    await graph.indexAll();
    const result = await searchDocs(graph.getDb(), 'inventory grid layout', { topk: 2 });
    assert.equal(result.hits[0].file, 'grid.md');
});
