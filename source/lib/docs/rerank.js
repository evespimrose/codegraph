"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReranker = startReranker;
exports.rerankHits = rerankHits;
exports.cascadeOrder = cascadeOrder;
const path = require("path");
const model_assets_1 = require("./model-assets");
// fuseHits 의 순위 상수와 같은 값. 리랭커 순위와 결합 순위를 같은 방식으로 섞기 위함
const RANK_CONSTANT = 61;
// 결합 순위의 비중. 측정에서 0.5가 1.0보다 좋았음
const LEXICAL_WEIGHT = 0.5;
const SHORT_TOKENS = 256;
const LONG_TOKENS = 512;
// 길이가 비슷한 입력끼리 묶어야 패딩이 줄어듦
const BATCH_SIZE = 4;
const LONG_TOP = 3;
const DEFAULT_THREADS = 8;
let loading = null;
/** 리랭커를 한 프로세스에서 한 번만 띄움. 실패해도 거절하지 않고 오류를 값으로 돌려줌 */
function startReranker() {
    if (!loading) {
        loading = loadScorer().then((scorer) => ({ scorer }), (error) => ({ error }));
    }
    return loading;
}
async function loadScorer() {
    const status = (0, model_assets_1.inspectRerankAssets)();
    if (!status.valid)
        throw new Error(status.issues.join('; '));
    const transformers = await Promise.resolve().then(() => require('@huggingface/transformers'));
    // 절대 경로를 모델 이름으로 넘기면 임베딩 모델의 env.localModelPath 설정과 섞이지 않음
    const modelPath = path.join(status.modelRoot, ...status.modelId.split('/'));
    const threads = positiveInt(process.env.CODEGRAPH_RERANK_THREADS) ?? DEFAULT_THREADS;
    const tokenizer = await transformers.AutoTokenizer.from_pretrained(modelPath);
    const model = await transformers.AutoModelForSequenceClassification.from_pretrained(modelPath, {
        dtype: 'q8',
        session_options: { intraOpNumThreads: threads },
    });
    return {
        modelId: status.modelId,
        score: async (query, texts, maxLength) => {
            const encoded = tokenizer(new Array(texts.length).fill(query), {
                text_pair: texts,
                padding: true,
                truncation: true,
                max_length: maxLength,
            });
            const { logits } = await model(encoded);
            return Array.from(logits.data);
        },
    };
}
/**
 * 후보를 다시 줄 세움. 결합 순위(입력 순서)에서 시작함.
 *
 * 1. 짧은 입력으로 전체를 점수 매기고, 리랭커 순위와 결합 순위를 섞음.
 * 2. 섞은 순위의 상위 몇 개만 긴 입력으로 다시 점수 매겨 그 안에서 줄 세움.
 */
async function cascadeOrder(query, texts, score) {
    const scores = await scoreByLength(query, texts, SHORT_TOKENS, score);
    const rank = ranksOf(scores);
    const blended = texts.map((_, index) => 1 / (RANK_CONSTANT + rank[index]) + LEXICAL_WEIGHT / (RANK_CONSTANT + index));
    const order = texts.map((_, index) => index).sort((left, right) => blended[right] - blended[left]);
    const head = order.slice(0, LONG_TOP);
    if (head.length > 1) {
        const longScores = await score(query, head.map((index) => texts[index]), LONG_TOKENS);
        head.forEach((index, position) => { scores[index] = longScores[position]; });
        head.sort((left, right) => scores[right] - scores[left]);
    }
    return { order: [...head, ...order.slice(LONG_TOP)], scores };
}
async function scoreByLength(query, texts, maxLength, score) {
    const byLength = texts.map((text, index) => ({ index, length: text.length })).sort((left, right) => left.length - right.length);
    const scores = new Array(texts.length);
    for (let start = 0; start < byLength.length; start += BATCH_SIZE) {
        const batch = byLength.slice(start, start + BATCH_SIZE);
        const values = await score(query, batch.map((item) => texts[item.index]), maxLength);
        batch.forEach((item, position) => { scores[item.index] = values[position]; });
    }
    return scores;
}
function ranksOf(values) {
    const rank = new Array(values.length);
    values.map((value, index) => ({ value, index }))
        .sort((left, right) => right.value - left.value)
        .forEach((item, position) => { rank[item.index] = position; });
    return rank;
}
/**
 * 결합 검색 후보를 리랭커로 다시 줄 세우고 상위 topk 를 돌려줌.
 * 리랭커를 쓸 수 없으면 결합 순서를 그대로 쓰고 경고를 남김.
 */
async function rerankHits(db, query, hits, topk, reranking) {
    const loaded = await reranking;
    const warnings = [];
    const summary = { enabled: false, depth: hits.length, model: null, ms: 0 };
    if (loaded.error || hits.length < 2) {
        if (loaded.error)
            warnings.push(`Reranker unavailable; keeping the combined order: ${messageOf(loaded.error)}`);
        return { hits: hits.slice(0, topk), warnings, summary };
    }
    const started = performance.now();
    let outcome;
    try {
        const texts = documentTexts(db, hits.map((hit) => hit.file));
        outcome = await cascadeOrder(query, hits.map((hit) => texts.get(hit.file) ?? ''), loaded.scorer.score);
    }
    catch (error) {
        warnings.push(`Reranking failed; keeping the combined order: ${messageOf(error)}`);
        return { hits: hits.slice(0, topk), warnings, summary };
    }
    summary.enabled = true;
    summary.model = loaded.scorer.modelId;
    summary.ms = Math.round(performance.now() - started);
    const reranked = outcome.order.slice(0, topk).map((index) => ({
        ...hits[index],
        rerankScore: round4(outcome.scores[index]),
    }));
    return { hits: reranked, warnings, summary };
}
// 색인 텍스트는 제목, 본문 앞부분(요약), 섹션 순이라 요약을 한 번만 빼고 제목을 앞에 붙임
function documentTexts(db, files) {
    const texts = new Map();
    if (files.length === 0)
        return texts;
    const placeholders = files.map(() => '?').join(',');
    const rows = db.prepare(`
    SELECT m.file_path, m.title, m.content_summary, f.structure
    FROM mdast_metadata m JOIN document_fts f ON f.rowid = m.id
    WHERE m.file_path IN (${placeholders})
  `).all(...files);
    for (const row of rows) {
        let body = row.structure ?? '';
        const summary = row.content_summary ?? '';
        if (summary && body.includes(summary))
            body = body.replace(summary, '');
        texts.set(row.file_path, `${row.title ?? ''}\n${body}`.trim());
    }
    return texts;
}
function positiveInt(value) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function round4(value) {
    return Math.round(value * 1e4) / 1e4;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=rerank.js.map
