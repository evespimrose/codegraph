const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cascadeOrder, rerankHits } = require('../lib/docs/rerank');
const { inspectRerankAssets } = require('../lib/docs/model-assets');

// 짧은 입력(256)과 긴 입력(512)에서 서로 다른 점수를 주는 가짜 리랭커
function fakeScorer(short, long) {
    return async (query, texts, maxLength) => texts.map(text => (maxLength === 256 ? short[text] : long[text]));
}

test('cascade orders the top three by long-input scores and keeps the rest in blended order', async () => {
    // 짧은 점수 순위 B, D, C, E, A. 결합 순위 A, B, C, D, E 와 섞으면 B, D, C, A, E 가 됨
    const short = { A: 1, B: 5, C: 3, D: 4, E: 2 };
    const long = { A: 0, B: 1, C: 9, D: 2, E: 0 };
    const { order, scores } = await cascadeOrder('질문', ['A', 'B', 'C', 'D', 'E'], fakeScorer(short, long));
    assert.deepEqual(order.map(index => ['A', 'B', 'C', 'D', 'E'][index]), ['C', 'D', 'B', 'A', 'E']);
    assert.equal(scores[2], 9);
    assert.equal(scores[4], 2);
});

function fakeDatabase(files) {
    // 본문을 비우면 색인 텍스트가 제목 하나가 되어 가짜 점수표의 키와 같아짐
    const rows = files.map(file => ({ file_path: file, title: file, content_summary: '', structure: '' }));
    return { prepare: () => ({ all: () => rows }) };
}

const hitsFor = files => files.map(file => ({ file, retrieval: ['lexical'] }));

test('rerankHits returns the reranked top hits with scores', async () => {
    const short = { A: 1, B: 5, C: 3, D: 4, E: 2 };
    const long = { A: 0, B: 1, C: 9, D: 2, E: 0 };
    const reranking = Promise.resolve({ scorer: { modelId: 'fake', score: fakeScorer(short, long) } });
    const result = await rerankHits(fakeDatabase(['A', 'B', 'C', 'D', 'E']), '질문', hitsFor(['A', 'B', 'C', 'D', 'E']), 3, reranking);
    assert.deepEqual(result.hits.map(hit => hit.file), ['C', 'D', 'B']);
    assert.equal(result.hits[0].rerankScore, 9);
    assert.equal(result.summary.enabled, true);
    assert.equal(result.summary.model, 'fake');
    assert.deepEqual(result.warnings, []);
});

test('a missing reranker keeps the combined order and warns', async () => {
    const reranking = Promise.resolve({ error: new Error('rerank model is not configured') });
    const result = await rerankHits(fakeDatabase(['A', 'B', 'C']), '질문', hitsFor(['A', 'B', 'C']), 2, reranking);
    assert.deepEqual(result.hits.map(hit => hit.file), ['A', 'B']);
    assert.equal(result.hits[0].rerankScore, undefined);
    assert.equal(result.summary.enabled, false);
    assert.ok(result.warnings.some(warning => warning.includes('rerank model is not configured')), JSON.stringify(result.warnings));
});

test('a scoring failure keeps the combined order and warns', async () => {
    const failing = async () => { throw new Error('inference failed'); };
    const reranking = Promise.resolve({ scorer: { modelId: 'fake', score: failing } });
    const result = await rerankHits(fakeDatabase(['A', 'B', 'C']), '질문', hitsFor(['A', 'B', 'C']), 3, reranking);
    assert.deepEqual(result.hits.map(hit => hit.file), ['A', 'B', 'C']);
    assert.ok(result.warnings.some(warning => warning.includes('inference failed')));
});

test('asset inspection reports a missing or empty model root as invalid', context => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-rerank-empty-'));
    context.after(() => fs.rmSync(empty, { recursive: true, force: true }));
    const missing = inspectRerankAssets(path.join(empty, 'absent'));
    assert.equal(missing.valid, false);
    assert.ok(missing.issues.length > 0);
    const noManifest = inspectRerankAssets(empty);
    assert.equal(noManifest.valid, false);
    assert.ok(noManifest.issues[0].includes('manifest unavailable'), JSON.stringify(noManifest.issues));
});
