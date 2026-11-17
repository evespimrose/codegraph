const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');

const entry = path.resolve(__dirname, '../lib/bin/codegraph.js');
const registry = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-query-registry-'));
const ENV = {
    ...process.env, CODEGRAPH_DOCS: '0', CODEGRAPH_NO_WATCH: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1',
    CODEGRAPH_WATCH_REGISTRY: registry, CODEGRAPH_SL_WATCH_REGISTRY: registry,
};

function cli(parameters, options = {}) {
    const result = spawnSync(process.execPath, ['--liftoff-only', entry, ...parameters], {
        encoding: 'utf8', timeout: 30000, windowsHide: true, input: options.input,
        env: { ...ENV, ...options.env },
    });
    assert.equal(result.error, undefined, result.error?.message);
    return result;
}

function json(result) {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
}

function project(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-query-한글 '));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'Flow.cs'), 'public static class Target { public static void Alpha() {} public static void Beta() {} } public class Entry { public void Run() { Target.Alpha(); } }');
    const result = cli(['init', root]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return root;
}

test('one query answers mixed kinds in input order with one freshness check', context => {
    const root = project(context);
    fs.writeFileSync(path.join(root, 'Added.cs'), 'public class AddedAfterIndex { public void Use() { Target.Beta(); } }');
    const body = json(cli(['query', 'AddedAfterIndex', 'callers:Beta', 'callees:Entry::Run', 'impact:Alpha', 'files:Added.cs', '-p', root, '--json']));
    assert.equal(body.schemaVersion, 2);
    assert.equal(body.freshness.state, 'current');
    assert.deepEqual(body.results.map(item => [item.index, item.kind, item.input]), [
        [0, 'search', 'AddedAfterIndex'], [1, 'callers', 'Beta'], [2, 'callees', 'Entry::Run'], [3, 'impact', 'Alpha'], [4, 'files', 'Added.cs'],
    ]);
    assert.ok(body.results.every(item => !('freshness' in item)));
    assert.equal(body.results[0].results[0].node.name, 'AddedAfterIndex');
    assert.deepEqual(body.results[1].callers.map(node => node.name), ['Use']);
    assert.equal(body.results[2].callees[0].name, 'Alpha');
    assert.equal(body.results[3].found, true);
    assert.deepEqual(body.results[4].files.map(file => file.path), ['Added.cs']);
});

test('a failing item does not stop the others and sets the exit code', context => {
    const root = project(context);
    const result = cli(['query', 'callers:', 'Target', '-p', root, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.results[0].error, 'empty query');
    assert.equal(body.results[1].kind, 'search');
    assert.ok(body.results[1].results.length > 0);
});

test('names with :: stay symbol searches and only known kinds become prefixes', context => {
    const root = project(context);
    const body = JSON.parse(cli(['query', 'Entry::Run', 'callers:Target::Alpha', 'unknown:Alpha', '-p', root, '--json']).stdout);
    assert.deepEqual(body.results.map(item => [item.kind, item.input]), [['search', 'Entry::Run'], ['callers', 'Target::Alpha'], ['search', 'unknown:Alpha']]);
    assert.deepEqual(body.results[1].callers.map(node => node.name), ['Run']);
});

test('C# exact traversal is fresh after edits and removed calls disappear', context => {
    const root = project(context);
    fs.writeFileSync(path.join(root, 'Flow.cs'), 'public static class Target { public static void Alpha() {} public static void Beta() {} } public class Entry { public void Run() { Target.Beta(); } }');
    const body = json(cli(['query', 'callers:Beta', 'callers:Alpha', 'callees:Entry::Run', '-p', root, '--json']));
    assert.equal(body.results[0].callers[0].name, 'Run');
    assert.equal(body.results[1].callers.length, 0);
    assert.equal(body.results[2].callees[0].name, 'Beta');
});

test('qualified lookup does not combine different classes sharing a method name', context => {
    const root = project(context);
    fs.writeFileSync(path.join(root, 'Other.cs'), 'public class Other { public void Run() { Target.Alpha(); } }');
    const body = json(cli(['query', 'callees:Other::Run', '-p', root, '--json']));
    assert.deepEqual(body.results[0].callees.map(node => node.name), ['Alpha']);
});

test('empty traversal and files results are valid JSON', context => {
    const root = project(context);
    const body = json(cli(['query', 'callers:NoSuchSymbolQAZZZ123', 'callees:NoSuchSymbolQAZZZ123', 'impact:NoSuchSymbolQAZZZ123', 'files:absent.zzz', '-p', root, '--json']));
    assert.deepEqual(body.results.slice(0, 3).map(item => item.found), [false, false, false]);
    assert.deepEqual(body.results[3].files, []);
});

test('search and files discover added C# and drop deleted C# without manual sync', context => {
    const root = project(context);
    const added = path.join(root, 'Added.cs');
    fs.writeFileSync(added, 'public class AddedAfterIndex {}');
    assert.equal(json(cli(['query', 'AddedAfterIndex', '-p', root, '--json'])).results[0].results[0].node.name, 'AddedAfterIndex');
    fs.unlinkSync(added);
    assert.deepEqual(json(cli(['query', 'files:Added.cs', '-p', root, '--json'])).results[0].files, []);
});

test('context items accept the JSON alias and retain the declared budget', context => {
    const root = project(context);
    const body = json(cli(['query', 'context:Target Alpha Run', '-p', root, '--json', '--budget', '700']));
    assert.equal(body.results[0].context.tokenBudget, 700);
    assert.ok(body.results[0].context.estimatedTokens <= 700);
});

test('missing-project JSON errors are machine readable', context => {
    const root = project(context);
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    for (const args of [['query', 'Target', '-p'], ['query', 'docs:guide', '-p'], ['query', 'context:Target', '-p'], ['doctor']]) {
        const result = cli([...args, empty, '--json']);
        assert.equal(result.status, 1);
        assert.equal(typeof JSON.parse(result.stdout).error, 'string', result.stdout);
    }
});

test('items from -i - follow command line items and JSON lines carry ids and options', context => {
    const root = project(context);
    const input = '{"id":"first","kind":"callers","q":"Alpha","limit":1}\ncallees:Entry::Run\n\n';
    const body = json(cli(['query', 'Target', '-i', '-', '-p', root, '--json'], { input }));
    assert.deepEqual(body.results.map(item => [item.id, item.kind, item.input]), [[null, 'search', 'Target'], ['first', 'callers', 'Alpha'], [null, 'callees', 'Entry::Run']]);
    assert.equal(body.results[1].callers.length, 1);
    assert.equal(body.results[2].callees[0].name, 'Alpha');
});

test('a malformed input line runs no query and exits nonzero', context => {
    const root = project(context);
    const result = cli(['query', '-i', '-', '-p', root], { input: '{"id":"x"}\n' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"q" is required/);
});

test('query without items exits nonzero', context => {
    const root = project(context);
    const result = cli(['query', '-p', root, '--json']);
    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stdout).error, /at least one item/);
});

test('text output gives each item a numbered heading', context => {
    const root = project(context);
    const result = cli(['query', 'Target', 'callers:Alpha', '-p', root]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /\[1\] search: Target/);
    assert.match(result.stdout, /\[2\] callers: Alpha/);
    assert.match(result.stdout, /callers of Alpha: 1/);
});

test('affected and backlinks items answer with their own fields', context => {
    const root = project(context);
    const body = json(cli(['query', 'affected:Flow.cs,Tests/FlowTests.cs', '--test-filter', 'Tests/*', 'affected:Flow.cs', 'backlinks:guide.md', '-p', root, '--json']));
    assert.deepEqual(body.results[0].changedFiles, ['Flow.cs', 'Tests/FlowTests.cs']);
    assert.deepEqual(body.results[0].affectedTests, ['Tests/FlowTests.cs']);
    assert.deepEqual(body.results[1].affectedTests, []);
    assert.equal(body.results[1].totalDependentsTraversed, 0);
    assert.deepEqual([body.results[2].file, body.results[2].backLinks, body.results[2].forwardLinks], ['guide.md', [], []]);
});

test('docs items return the same hits alone and in a batch and touch nothing in the data folder', async context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-query-docs-'));
    fs.writeFileSync(path.join(root, 'breath.md'), '# 운기조식\n\n운기조식은 호흡을 가라앉히는 수련임.\n');
    fs.writeFileSync(path.join(root, 'sect.md'), '# 문파\n\n문파의 보물은 경매로 넘어감. 운기 수련과는 무관함.\n');
    fs.writeFileSync(path.join(root, 'market.md'), '# 시장\n\n시장에서 약재를 사고파는 상인 이야기임.\n');
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        try { graph.close(); } catch { /* 테스트가 이미 닫음 */ }
        fs.rmSync(root, { recursive: true, force: true });
    });
    assert.equal((await graph.indexAll()).success, true);
    graph.close();
    const dataDir = path.join(root, fs.readdirSync(root).find(name => name.startsWith('.codegraph') && fs.statSync(path.join(root, name)).isDirectory()));
    const before = fs.readdirSync(dataDir).sort();
    const docsEnv = { CODEGRAPH_DOCS: '1' };
    const input = 'docs:운기조식 호흡\n{"id":"second","kind":"docs","q":"문파 보물 경매","limit":2}\n';
    const body = json(cli(['query', '-i', '-', '-p', root, '--json', '--no-sync', '--limit', '5'], { env: docsEnv, input }));
    assert.deepEqual(body.results.map(item => [item.id, item.kind, item.input]), [[null, 'docs', '운기조식 호흡'], ['second', 'docs', '문파 보물 경매']]);
    assert.ok(body.results[1].hits.length <= 2);
    const alone = [
        json(cli(['query', 'docs:운기조식 호흡', '-p', root, '--json', '--no-sync', '--limit', '5'], { env: docsEnv })),
        json(cli(['query', 'docs:문파 보물 경매', '-p', root, '--json', '--no-sync', '--limit', '2'], { env: docsEnv })),
    ];
    for (const [index, single] of alone.entries()) {
        assert.deepEqual(body.results[index].hits.map(hit => hit.file), single.results[0].hits.map(hit => hit.file));
    }
    assert.deepEqual(fs.readdirSync(dataDir).sort(), before);
});
