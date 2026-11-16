const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.CODEGRAPH_NO_WATCH = '1';
const { symbolText, fuseNodeResults, syncCodeVectors, searchCodeVectors } = require('../lib/search/code-vectors');
const { resetSearchTuning } = require('../lib/search-tuning');
const { CodeGraph } = require('../lib/index');

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

test('symbol text carries kind, qualified name, path and signature', () => {
    const text = symbolText({ kind: 'method', qualified_name: 'Loadout::Rebuild', file_path: 'a/Loadout.cs', signature: 'void Rebuild()', docstring: '  rebuilds\n slots ' });
    assert.equal(text, 'method Loadout::Rebuild\na/Loadout.cs\nvoid Rebuild()\nrebuilds slots');
});

test('vector neighbours join the lexical ranking', (context) => {
    withEnv(context, { CODEGRAPH_CODE_VECTOR_WEIGHT: '1' });
    const node = (id, kind = 'class') => ({ id, kind, name: id });
    const lexical = [{ node: node('a'), score: 9 }, { node: node('b'), score: 5 }];
    const nodes = { b: node('b'), c: node('c'), d: node('d', 'field') };
    const fused = fuseNodeResults(lexical, ['b', 'c', 'd'], (id) => nodes[id], 3, ['class']);
    assert.deepEqual(fused.map((r) => r.node.id), ['b', 'a', 'c']);
});

test('code vectors stay off unless enabled', async (context) => {
    withEnv(context, { CODEGRAPH_CODE_VECTORS: '0' });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-vectors-'));
    fs.writeFileSync(path.join(root, 'Hit.cs'), 'public class DamageHitJob { public void Run() {} }\n');
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        try { graph.close(); } catch { /* 이미 닫힘 */ }
        fs.rmSync(root, { recursive: true, force: true });
    });
    assert.equal((await graph.indexAll()).success, true);
    assert.equal((await syncCodeVectors(graph.getDb())).enabled, false);
    assert.deepEqual(await searchCodeVectors(graph.getDb(), 'damage', 5), []);
    const hybrid = await graph.searchNodesHybrid('DamageHitJob', { limit: 3 });
    assert.equal(hybrid[0].node.name, 'DamageHitJob');
});
