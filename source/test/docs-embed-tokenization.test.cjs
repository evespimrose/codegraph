const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectModelAssets } = require('../lib/docs/model-assets');
const { leadingTokenIds } = require('../lib/docs/leading-tokens');
const { embedBatches, getEmbedder, EMBED_PASSAGE_PREFIX } = require('../lib/docs/embed');
const { EMBED_DIM } = require('../lib/docs/config');

const MAX = 512;

// 낱말마다 1~3개 토큰이 되는 가짜 토크나이저. 낱말끼리 독립이라 앞부분 접두 성질이 SentencePiece 와 같음
function fakeTokenizer(calls) {
    return (text) => {
        calls?.push(text.length);
        const ids = [0];
        for (const word of text.match(/\S+/g) ?? []) {
            let hash = 7;
            for (const char of word) hash = (hash * 31 + char.codePointAt(0)) % 100003;
            for (let repeat = 0; repeat <= hash % 3; repeat++) ids.push(3 + ((hash + repeat) % 1000));
        }
        ids.push(2);
        return ids;
    };
}

// 낱말 하나가 정확히 토큰 하나인 토크나이저. 길이 경계를 정밀하게 맞추는 용도
function onePerWordTokenizer(text) {
    return [0, ...(text.match(/\S+/g) ?? []).map((word, index) => 3 + ((word.length + index) % 1000)), 2];
}

// 라이브러리의 truncation: true 와 같은 결과. 끝의 </s> 도 버림
const stockIds = (tokenize, text) => tokenize(text).slice(0, MAX);

function wordsText(count) {
    return Array.from({ length: count }, (_, index) => `w${index}`).join(' ');
}

test('leading ids equal the stock truncation for long mixed text and tokenize only a bounded prefix', () => {
    const text = Array.from({ length: 4000 }, (_, index) => `단어${index} word${index}`).join(' ');
    assert.ok(text.length > 40_000);
    const calls = [];
    const tokenize = fakeTokenizer(calls);
    assert.deepEqual(leadingTokenIds(tokenize, text, MAX), stockIds(fakeTokenizer(), text));
    assert.ok(Math.max(...calls) < text.length / 4, `tokenized ${Math.max(...calls)} of ${text.length} chars`);
});

test('leading ids equal the stock truncation around the maximum length', () => {
    for (const natural of [2, 3, 500, 510, 511, 512, 513, 514, 543, 544, 545, 546, 600, 5000]) {
        const text = wordsText(natural - 2);
        assert.equal(onePerWordTokenizer(text).length, natural);
        assert.deepEqual(leadingTokenIds(onePerWordTokenizer, text, MAX), stockIds(onePerWordTokenizer, text), `natural length ${natural}`);
    }
});

test('a leading slice that holds exactly the maximum length is not mistaken for a truncated one', () => {
    const text = wordsText(2000);
    // maxTokens 를 훑으면 첫 조각의 자연 길이와 정확히 같아지는 값이 반드시 하나 나옴
    for (let maxTokens = 100; maxTokens <= 400; maxTokens++) {
        assert.deepEqual(leadingTokenIds(onePerWordTokenizer, text, maxTokens), onePerWordTokenizer(text).slice(0, maxTokens), `maxTokens ${maxTokens}`);
    }
});

test('short and empty text keep every id including the closing token', () => {
    assert.deepEqual(leadingTokenIds(fakeTokenizer(), 'hello world', MAX), fakeTokenizer()('hello world'));
    assert.deepEqual(leadingTokenIds(fakeTokenizer(), '', MAX), [0, 2]);
});

test('text without whitespace falls back to a hard cut and keeps the first ids', () => {
    const text = '漢字'.repeat(15_000);
    const perChar = (value) => [0, ...Array.from(value, (char) => 3 + (char.codePointAt(0) % 1000)), 2];
    assert.deepEqual(leadingTokenIds(perChar, text, MAX), stockIds(perChar, text));
});

test('a hard cut inside an unspaced run cannot disturb the leading ids', () => {
    const text = '漢字'.repeat(15_000);
    // 잘린 글의 끝 낱말은 분할이 달라지는 토크나이저를 흉내냄. 끝에서 2~6번째 토큰이 바뀜
    const unstableTail = (value) => {
        const ids = [0, ...Array.from(value, (char) => 3 + (char.codePointAt(0) % 1000)), 2];
        for (let tail = 2; tail <= 6; tail++) ids[ids.length - tail] = 2000 + tail;
        return ids;
    };
    for (let maxTokens = 1150; maxTokens <= 1210; maxTokens++) {
        assert.deepEqual(leadingTokenIds(unstableTail, text, maxTokens), unstableTail(text).slice(0, maxTokens), `maxTokens ${maxTokens}`);
    }
});

test('a smaller maxTokens limit is honored', () => {
    const text = wordsText(1000);
    assert.deepEqual(leadingTokenIds(onePerWordTokenizer, text, 64), onePerWordTokenizer(text).slice(0, 64));
});

const SEGMENTS = [
    '에이전트가 원본 파일을 읽는 규칙과 서브에이전트 위임 기준을 정리한 문서입니다.',
    'Hybrid search over indexed documents (requires the docs feature) with BM25 and vector fusion.',
    'function leadingTokenIds(tokenize, text, maxTokens = 512) { return ids.slice(0, maxTokens); }',
    'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/onnx/model_quantized.onnx?download=true',
    '| 항목 | 값 | 비고 |\n|---|---|---|\n| 모델 | e5-small | 384차원 |',
    '日本語の文章は空白で区切られないので、一つの長い連続した文字列になります。',
    '中文没有空格分隔的长句子也应该得到相同的前缀词元。',
    '`codegraph docs "<질의>" -p <경로> --no-sync -l 5 -j` 로 호출함. 결과는 JSON 임.',
    'C# 최신 문법과 조건부 컴파일 파싱 오류 해소 (#if UNITY_EDITOR / #endif).',
    '이모지와 기호도 섞임 🙂 → ✔ ‼ — “따옴표” ‘작은따옴표’ …',
    'Section 3.2.1: The quick brown fox jumps over the lazy dog; 0xDEADBEEF != 12345.',
];
const SEPARATORS = [' ', '\n', '\n\n', '\t', '\r\n', '　', ' '];

function buildDocument(seed, targetChars) {
    let state = seed;
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    let text = '';
    while (text.length < targetChars) {
        text += SEGMENTS[Math.floor(next() * SEGMENTS.length)] + SEPARATORS[Math.floor(next() * SEPARATORS.length)];
    }
    return EMBED_PASSAGE_PREFIX + text;
}

// 배치마다 따로 돌려 겹치기 없이 같은 배치 구성의 기준 벡터를 얻음
async function embedSequentially(batches) {
    const results = [];
    for (const batch of batches) {
        for await (const vectors of embedBatches([batch])) results.push(vectors);
    }
    return results;
}

const DOCUMENTS = [150, 900, 1500, 2600, 3500, 6000, 9000, 12_000, 12_000, 12_000].map((chars, index) => buildDocument(101 + index, chars));

function unavailableReason() {
    const assets = inspectModelAssets();
    if (assets.mode !== 'bundled' || !assets.valid) return 'bundled model assets not configured (set CODEGRAPH_MODEL_ROOT)';
    try {
        require.resolve('@huggingface/transformers');
    } catch {
        return '@huggingface/transformers is not installed';
    }
    return false;
}
const skip = unavailableReason();

test('leading ids equal the stock truncation with the real tokenizer', { skip }, async () => {
    const { tokenizer } = await getEmbedder();
    const tokenize = (text) => tokenizer(text, { truncation: false }).input_ids.data;
    for (const [index, document] of DOCUMENTS.entries()) {
        const expected = tokenizer(document, { truncation: true }).input_ids.data;
        assert.deepEqual(leadingTokenIds(tokenize, document, tokenizer.model_max_length), expected, `document ${index} (${document.length} chars)`);
    }
});

test('embedBatches matches the stock pipeline output', { skip }, async () => {
    const extractor = await getEmbedder();
    const output = await extractor(DOCUMENTS, { pooling: 'mean', normalize: true });
    const stock = Float32Array.from(output.data);
    const [vectors] = await embedSequentially([DOCUMENTS]);
    assert.equal(vectors.length, DOCUMENTS.length);
    let maxDiff = 0;
    vectors.forEach((vector, row) => {
        assert.equal(vector.length, EMBED_DIM);
        for (let dim = 0; dim < EMBED_DIM; dim++) maxDiff = Math.max(maxDiff, Math.abs(vector[dim] - stock[row * EMBED_DIM + dim]));
    });
    assert.ok(maxDiff < 1e-5, `max abs diff ${maxDiff}`);
});

test('overlapped batches yield the same vectors as sequential batches in order', { skip }, async () => {
    const batches = [DOCUMENTS.slice(0, 4), DOCUMENTS.slice(4, 7), DOCUMENTS.slice(7)];
    const expected = await embedSequentially(batches);
    const actual = [];
    for await (const vectors of embedBatches(batches)) actual.push(vectors);
    assert.equal(actual.length, batches.length);
    actual.forEach((vectors, batchIndex) => {
        assert.equal(vectors.length, batches[batchIndex].length);
        vectors.forEach((vector, row) => {
            const diff = Math.max(...Array.from(vector, (value, dim) => Math.abs(value - expected[batchIndex][row][dim])));
            assert.ok(diff < 1e-6, `batch ${batchIndex} row ${row} diff ${diff}`);
        });
    });
});

test('embedBatches delivers finished batches before reporting a later batch failure', { skip }, async () => {
    const iterator = embedBatches([DOCUMENTS.slice(0, 2), [null]])[Symbol.asyncIterator]();
    const first = await iterator.next();
    assert.equal(first.done, false);
    assert.equal(first.value.length, 2);
    await assert.rejects(iterator.next(), TypeError);
});

test('an empty batch yields an empty result and does not break the batches around it', { skip }, async () => {
    const results = [];
    for await (const vectors of embedBatches([DOCUMENTS.slice(0, 2), [], DOCUMENTS.slice(2, 3)])) results.push(vectors);
    assert.deepEqual(results.map((vectors) => vectors.length), [2, 0, 1]);
});
