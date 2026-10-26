"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDINGS_DISABLE_ENV = exports.EMBED_PASSAGE_PREFIX = exports.EMBED_QUERY_PREFIX = exports.EMBED_MODEL_ID = void 0;
exports.getEmbedder = getEmbedder;
exports.embed = embed;
exports.embedBatches = embedBatches;
exports.isEmbedAvailable = isEmbedAvailable;
/**
 * Local multilingual E5 embeddings via @huggingface/transformers (Transformers.js).
 *
 * multilingual-e5-small → 384-dim, mean-pooled + L2-normalized. Offline after the
 * first model fetch. The runtime is a required package dependency but loaded
 * lazily, so importing this module does not initialize ONNX. Team bundles
 * include pinned model assets; ordinary npm installs populate the local model
 * cache on first use.
 */
const config_1 = require("./config");
const leading_tokens_1 = require("./leading-tokens");
const model_assets_1 = require("./model-assets");
exports.EMBED_MODEL_ID = 'Xenova/multilingual-e5-small';
// E5 는 이 접두사로 학습됨. 빠지면 질의·문서 벡터가 다른 분포로 떨어져 검색 품질이 무너짐
exports.EMBED_QUERY_PREFIX = 'query: ';
exports.EMBED_PASSAGE_PREFIX = 'passage: ';
exports.EMBEDDINGS_DISABLE_ENV = 'CODEGRAPH_DISABLE_EMBEDDINGS';
// ONNX 기본 스레드 수는 논리 코어 수라 스핀 대기로 CPU 를 다 쓰고, 다른 프로세스와 겹치면 크게 느려짐
const EMBED_INTRA_OP_THREADS = 4;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _extractor = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _runtime = null;
/** Lazy singleton. First call loads the model; subsequent runs are offline. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEmbedder() {
    if (_extractor)
        return _extractor;
    if (embeddingsDisabled())
        throw new Error('Embeddings are disabled by CODEGRAPH_DISABLE_EMBEDDINGS.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod;
    try {
        mod = await Promise.resolve().then(() => __importStar(require('@huggingface/transformers')));
    }
    catch {
        throw new Error('The document embedding feature needs "@huggingface/transformers", which is not installed.');
    }
    const { pipeline, env } = mod;
    (0, model_assets_1.configureModelEnvironment)(env);
    _extractor = await pipeline('feature-extraction', exports.EMBED_MODEL_ID, {
        dtype: 'q8',
        session_options: { intraOpNumThreads: EMBED_INTRA_OP_THREADS },
    });
    _runtime = { Tensor: mod.Tensor, meanPooling: mod.mean_pooling };
    return _extractor;
}
/** Embed a single string → Float32Array(EMBED_DIM). */
async function embed(text) {
    const extractor = await getEmbedder();
    const output = await extractor(text ?? '', { pooling: 'mean', normalize: true });
    const vec = Float32Array.from(output.data);
    if (vec.length !== config_1.EMBED_DIM) {
        throw new Error(`embedding dim ${vec.length} != expected ${config_1.EMBED_DIM}`);
    }
    return vec;
}
/** Embed batches in order, tokenizing batch N+1 while the model runs batch N. */
async function* embedBatches(textBatches) {
    if (textBatches.length === 0)
        return;
    const extractor = await getEmbedder();
    let next = prepareBatch(extractor.tokenizer, textBatches[0]);
    for (let index = 0; index < textBatches.length; index++) {
        const pending = runPrepared(extractor, next);
        // 추론이 실패해도 아래 await 에 닿기 전에 unhandled rejection 이 되지 않게 함
        pending.catch(() => { });
        const following = await prepareNextBatch(extractor.tokenizer, textBatches[index + 1]);
        yield await pending;
        if (following.error)
            throw following.error;
        next = following.prepared;
    }
}
// 추론 호출이 네이티브 스레드에서 시작된 뒤에 동기 토큰화로 이벤트 루프를 막아야 둘이 겹침
async function prepareNextBatch(tokenizer, texts) {
    if (!texts)
        return {};
    await new Promise((resolve) => setImmediate(resolve));
    try {
        return { prepared: prepareBatch(tokenizer, texts) };
    }
    catch (error) {
        return { error };
    }
}
function prepareBatch(tokenizer, texts) {
    if (texts.length === 0)
        return { rows: 0 };
    const tokenize = (slice) => tokenizer(slice, { truncation: false }).input_ids.data;
    const idLists = texts.map((text) => (0, leading_tokens_1.leadingTokenIds)(tokenize, text, tokenizer.model_max_length));
    const width = Math.max(...idLists.map((ids) => ids.length));
    const inputIds = new BigInt64Array(texts.length * width).fill(BigInt(tokenizer.pad_token_id ?? 0));
    const attentionMask = new BigInt64Array(texts.length * width);
    idLists.forEach((ids, row) => {
        inputIds.set(ids, row * width);
        attentionMask.fill(1n, row * width, row * width + ids.length);
    });
    return {
        rows: texts.length,
        inputIds: new _runtime.Tensor('int64', inputIds, [texts.length, width]),
        attentionMask: new _runtime.Tensor('int64', attentionMask, [texts.length, width]),
    };
}
async function runPrepared(extractor, prepared) {
    if (prepared.rows === 0)
        return [];
    const outputs = await extractor.model({ input_ids: prepared.inputIds, attention_mask: prepared.attentionMask });
    const hidden = outputs.last_hidden_state ?? outputs.logits ?? outputs.token_embeddings;
    const pooled = _runtime.meanPooling(hidden, prepared.attentionMask).normalize(2, -1);
    const data = Float32Array.from(pooled.data);
    const expectedLength = prepared.rows * config_1.EMBED_DIM;
    if (data.length !== expectedLength) {
        throw new Error(`embedding batch length ${data.length} != expected ${expectedLength}`);
    }
    return Array.from({ length: prepared.rows }, (_, index) => data.slice(index * config_1.EMBED_DIM, (index + 1) * config_1.EMBED_DIM));
}
/** Whether the Transformers.js runtime and configured model assets are available. */
async function isEmbedAvailable() {
    if (embeddingsDisabled())
        return false;
    const assets = (0, model_assets_1.inspectModelAssets)();
    if (assets.mode === 'bundled' && !assets.valid)
        return false;
    // ONNX 런타임 로딩은 첫 임베딩 때만 함. 로딩 실패는 호출부가 어휘 검색으로 대체함
    try {
        require.resolve('@huggingface/transformers');
        return true;
    }
    catch {
        return false;
    }
}
function embeddingsDisabled() {
    return /^(1|true|yes|on)$/i.test(process.env[exports.EMBEDDINGS_DISABLE_ENV] ?? '');
}
//# sourceMappingURL=embed.js.map