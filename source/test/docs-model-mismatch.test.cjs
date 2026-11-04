const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const { searchDocs } = require('../lib/docs/search');

// 색인은 벡터 없이 하고, 문서 행에 다른 모델 이름을 적어 옛 벡터가 남은 상황을 만듦
test('vectors from another embedding model are skipped with a warning and lexical hits remain', async context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-stale-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    fs.writeFileSync(path.join(root, 'guide.md'), '# 운기 설명\n\n운기조식은 호흡을 가라앉히는 수련임.\n');
    const env = { CODEGRAPH_DOCS: process.env.CODEGRAPH_DOCS, CODEGRAPH_DISABLE_EMBEDDINGS: process.env.CODEGRAPH_DISABLE_EMBEDDINGS };
    process.env.CODEGRAPH_DOCS = '1';
    process.env.CODEGRAPH_DISABLE_EMBEDDINGS = '1';
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        graph.close();
        for (const [key, value] of Object.entries(env)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        fs.rmSync(root, { recursive: true, force: true });
    });
    assert.equal((await graph.indexAll()).success, true);
    graph.getDb().prepare('UPDATE mdast_metadata SET embedding_model = ?').run('other/old-model');
    delete process.env.CODEGRAPH_DISABLE_EMBEDDINGS;

    const result = await searchDocs(graph.getDb(), '운기조식');

    assert.equal(result.semanticState, 'stale');
    assert.equal(result.available, false);
    assert.ok(result.hits.length > 0, JSON.stringify(result));
    for (const hit of result.hits) assert.deepEqual(hit.retrieval, ['lexical']);
    assert.ok(result.warnings.some(warning => warning.includes('other/old-model') && warning.includes('codegraph sync')), JSON.stringify(result.warnings));
});
