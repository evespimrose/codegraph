const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');

const CLI = path.join(__dirname, '..', 'lib', 'bin', 'codegraph.js');
const ENV = { ...process.env, CODEGRAPH_NO_WATCH: '1', CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' };

function fixture(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-batch-'));
    fs.writeFileSync(path.join(root, 'breath.md'), '# 운기조식\n\n운기조식은 호흡을 가라앉히는 수련임.\n');
    fs.writeFileSync(path.join(root, 'sect.md'), '# 문파\n\n문파의 보물은 경매로 넘어감. 운기 수련과는 무관함.\n');
    fs.writeFileSync(path.join(root, 'market.md'), '# 시장\n\n시장에서 약재를 사고파는 상인 이야기임.\n');
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        try { graph.close(); } catch { /* 테스트가 이미 닫음 */ }
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { root, graph };
}

const hitFiles = result => result.hits.map(hit => hit.file);

test('docs-batch returns the same hits as single docs runs and touches nothing in .codegraph', async context => {
    const { root, graph } = fixture(context);
    assert.equal((await graph.indexAll()).success, true);
    graph.close();
    const dataDir = path.join(root, '.codegraph');
    const before = fs.readdirSync(dataDir).sort();

    const queries = ['운기조식 호흡', '문파 보물 경매'];
    const input = `${queries[0]}\n\n{"id":"second","q":"${queries[1]}","limit":2}\n`;
    const stdout = execFileSync(process.execPath, [CLI, 'docs-batch', '-p', root, '--limit', '5'], { input, env: ENV, encoding: 'utf8' });
    const lines = stdout.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line));

    assert.equal(lines.length, 3, stdout);
    assert.equal(lines[0].query, queries[0]);
    assert.equal(lines[0].id, null);
    assert.equal(lines[1].id, 'second');
    assert.equal(lines[1].query, queries[1]);
    assert.ok(lines[1].hits.length <= 2);
    assert.equal(lines[2].summary.queries, 2);

    for (const [index, query] of queries.entries()) {
        const single = JSON.parse(execFileSync(process.execPath, [CLI, 'docs', query, '-p', root, '--json', '--no-sync', '--limit', index === 0 ? '5' : '2'], { env: ENV, encoding: 'utf8' }));
        assert.deepEqual(hitFiles(lines[index]), hitFiles(single), query);
    }

    assert.deepEqual(fs.readdirSync(dataDir).sort(), before);
});

test('docs-batch rejects a JSON line without a query', context => {
    const { root, graph } = fixture(context);
    graph.close();
    let failure = null;
    try {
        execFileSync(process.execPath, [CLI, 'docs-batch', '-p', root], { input: '{"id":"x"}\n', env: ENV, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    }
    catch (error) {
        failure = error;
    }
    assert.ok(failure, 'docs-batch should exit nonzero');
    assert.match(String(failure.stderr), /"q" is required/);
});
