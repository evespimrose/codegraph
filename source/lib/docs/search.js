"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGoverningDocs = exports.findBacklinks = void 0;
exports.searchDocs = searchDocs;
const config_1 = require("./config");
const embed_1 = require("./embed");
const links_util_1 = require("./links-util");
const lexical_search_1 = require("./lexical-search");
const rerank_1 = require("./rerank");
const vec_1 = require("./vec");
const search_tuning_1 = require("../search-tuning");
var document_relations_1 = require("./document-relations");
Object.defineProperty(exports, "findBacklinks", { enumerable: true, get: function () { return document_relations_1.findBacklinks; } });
Object.defineProperty(exports, "findGoverningDocs", { enumerable: true, get: function () { return document_relations_1.findGoverningDocs; } });
const SUMMARY_CAP = 200;
const DEFAULT_TOPK = 8;
const DEFAULT_CODE_LIMIT = 8;
const DEFAULT_RERANK_DEPTH = 10;
const MAX_TOPK = 50;
// 모델 이름별 문서 수 조회 결과. 같은 연결의 일괄 질의에서 매번 세지 않도록 연결 단위로 보관함
const staleModelCache = new WeakMap();
async function searchDocs(db, query, opts = {}) {
    const result = {
        schemaVersion: 1,
        enabled: false,
        available: false,
        hits: [],
        warnings: [],
        semanticState: 'disabled',
    };
    if (!(0, config_1.resolveDocsEnabled)(db))
        return result;
    result.enabled = true;
    result.semanticState = 'unavailable';
    const normalizedQuery = (query ?? '').trim();
    if (!normalizedQuery)
        return result;
    const topk = clampInt(opts.topk ?? DEFAULT_TOPK, 1, MAX_TOPK);
    const codeLimit = clampInt(opts.codeLimit ?? DEFAULT_CODE_LIMIT, 0, 100);
    const rerank = opts.rerank === true;
    // 리랭커는 결합 순위의 상위 후보만 다시 줄 세우므로, 후보는 출력 수보다 많이 뽑음
    const tuning = (0, search_tuning_1.loadSearchTuning)();
    // 마크다운 우선은 넓게 뽑은 후보를 형식으로 다시 줄 세우므로 깊이가 출력 수보다 커야 함
    const candidateDepth = tuning.docsMarkdownFirst ? Math.max(topk, clampInt(tuning.docsMarkdownDepth, 1, MAX_TOPK)) : topk;
    const depth = rerank ? Math.max(candidateDepth, clampInt(opts.rerankDepth ?? DEFAULT_RERANK_DEPTH, 1, MAX_TOPK)) : candidateDepth;
    // 모델 로딩은 질의 임베딩과 검색이 도는 동안 함께 시작함
    const reranking = rerank ? (0, rerank_1.startReranker)() : null;
    await searchCandidates(db, normalizedQuery, result, { depth, codeLimit, lexicalWeight: lexicalWeightFor(normalizedQuery, tuning) });
    if (tuning.docsMarkdownFirst)
        result.hits = markdownFirst(result.hits);
    if (reranking) {
        const reranked = await (0, rerank_1.rerankHits)(db, normalizedQuery, result.hits, topk, reranking);
        result.hits = reranked.hits;
        result.rerank = reranked.summary;
        result.warnings.push(...reranked.warnings);
    }
    else {
        result.hits = result.hits.slice(0, topk);
    }
    result.warnings = [...new Set(result.warnings)];
    return result;
}
async function searchCandidates(db, normalizedQuery, result, { depth, codeLimit, lexicalWeight }) {
    // 모델 로딩이 어휘 검색과 겹치도록 벡터 검색을 쓸 수 있으면 먼저 시작함
    if ((0, vec_1.loadVecExtension)(db) && (await (0, embed_1.isEmbedAvailable)()) && staleEmbeddingModels(db).length === 0 && tableExists(db, 'mdast_vectors'))
        (0, embed_1.warmEmbedder)();
    const lexical = (0, lexical_search_1.searchDocsLexical)(db, normalizedQuery, depth, codeLimit);
    result.warnings.push(...lexical.warnings);
    if (!(0, vec_1.loadVecExtension)(db)) {
        result.hits = lexical.hits;
        result.warnings.push('sqlite-vec unavailable; lexical document search remains active.');
        return result;
    }
    if (!(await (0, embed_1.isEmbedAvailable)())) {
        result.hits = lexical.hits;
        result.warnings.push('Document embeddings unavailable; lexical document search remains active.');
        return result;
    }
    // 다른 모델로 만든 벡터와 지금 질의 벡터는 비교할 수 없음. 어휘 검색만 남기고 경고함
    const staleModels = staleEmbeddingModels(db);
    if (staleModels.length > 0) {
        result.hits = lexical.hits;
        result.semanticState = 'stale';
        result.warnings.push(`Document vectors were built with ${staleModels.join(', ')}; run codegraph sync to rebuild them.`);
        return result;
    }
    result.available = true;
    result.semanticState = 'ready';
    if (!tableExists(db, 'mdast_vectors')) {
        result.hits = lexical.hits;
        return result;
    }
    let queryVector;
    try {
        queryVector = await (0, embed_1.embed)(embed_1.EMBED_QUERY_PREFIX + normalizedQuery);
    }
    catch (error) {
        return semanticFailure(result, lexical.hits, `Embedding failed: ${messageOf(error)}`);
    }
    let nearest;
    try {
        nearest = db.prepare(`
      SELECT rowid, distance FROM mdast_vectors
      WHERE embedding MATCH ? AND k = ${depth} ORDER BY distance
    `).all((0, vec_1.floatBlob)(queryVector));
    }
    catch (error) {
        return semanticFailure(result, lexical.hits, `Vector query failed: ${messageOf(error)}`);
    }
    if (nearest.length === 0) {
        result.hits = lexical.hits;
        return result;
    }
    const ids = nearest.map((row) => Number(row.rowid));
    const distanceById = new Map(nearest.map((row) => [Number(row.rowid), Number(row.distance)]));
    let metadataRows;
    try {
        metadataRows = db.prepare(`
      SELECT id, file_path, blk_tags, code_refs, content_summary, format, title
      FROM mdast_metadata WHERE id IN (${ids.map(() => '?').join(',')})
    `).all(...ids);
    }
    catch (error) {
        return semanticFailure(result, lexical.hits, `Vector metadata lookup failed: ${messageOf(error)}`);
    }
    metadataRows.sort((left, right) => ((distanceById.get(left.id) ?? Infinity) - (distanceById.get(right.id) ?? Infinity)));
    const refsByDocument = new Map();
    const allReferences = new Set();
    for (const row of metadataRows) {
        const references = (0, links_util_1.parseRefs)(row.code_refs);
        refsByDocument.set(row.id, references);
        for (const reference of references)
            allReferences.add(reference);
    }
    const resolved = (0, lexical_search_1.resolveCodeSymbols)(db, [...allReferences]);
    result.warnings.push(...resolved.warnings);
    const vectorHits = metadataRows.map((row) => {
        const codeRefs = refsByDocument.get(row.id) ?? [];
        const symbols = [];
        for (const file of codeRefs) {
            symbols.push(...(resolved.byFile.get(file) ?? []));
            if (symbols.length >= codeLimit)
                break;
        }
        return {
            file: row.file_path,
            blk: row.blk_tags,
            summary: truncate(row.content_summary ?? '', SUMMARY_CAP),
            distance: round4(distanceById.get(row.id) ?? 0),
            codeRefs,
            symbols: symbols.slice(0, codeLimit),
            format: row.format ?? 'markdown',
            title: row.title,
            retrieval: ['vector'],
        };
    });
    result.hits = (0, lexical_search_1.fuseHits)(vectorHits, lexical.hits, depth, lexicalWeight);
    return result;
}
function staleEmbeddingModels(db) {
    const cached = staleModelCache.get(db);
    if (cached)
        return cached;
    let models;
    try {
        models = db.prepare(`
      SELECT DISTINCT embedding_model FROM mdast_metadata
      WHERE embedding_model IS NOT NULL AND embedding_model != ?
      ORDER BY embedding_model
    `).all(embed_1.EMBED_MODEL_ID).map((row) => String(row.embedding_model));
    }
    catch {
        models = [];
    }
    staleModelCache.set(db, models);
    return models;
}
function lexicalWeightFor(query, tuning) {
    // 라틴 식별자가 없는 질의는 조사 때문에 어휘 일치가 약해 비중을 따로 둠
    return /[A-Za-z][A-Za-z0-9_]{2,}/.test(query) ? tuning.docsLexicalWeight : tuning.docsLexicalWeightHangul;
}
function markdownFirst(hits) {
    const isMarkdown = (hit) => (hit.format ?? 'markdown') === 'markdown';
    return [...hits.filter(isMarkdown), ...hits.filter((hit) => !isMarkdown(hit))];
}
function semanticFailure(result, lexicalHits, warning) {
    result.available = false;
    result.semanticState = 'unavailable';
    result.hits = lexicalHits;
    result.warnings.push(warning);
    return result;
}
function tableExists(db, name) {
    try {
        return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE name = ? LIMIT 1').get(name));
    }
    catch {
        return false;
    }
}
function clampInt(value, minimum, maximum) {
    const normalized = Math.floor(Number.isFinite(value) ? value : minimum);
    return Math.max(minimum, Math.min(maximum, normalized));
}
function truncate(value, cap) {
    return value.length > cap ? `${value.slice(0, cap).trimEnd()}…` : value;
}
function round4(value) {
    return Math.round(value * 1e4) / 1e4;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=search.js.map
