"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_THRESHOLD_META_KEY = exports.SEMANTIC_TOP_K_META_KEY = exports.SEMANTIC_EDGES_META_KEY = exports.SEMANTIC_EDGES_ENV_VAR = void 0;
exports.resolveSemanticEdgesEnabled = resolveSemanticEdgesEnabled;
exports.setSemanticEdgesEnabled = setSemanticEdgesEnabled;
exports.setSemanticEdgeConfig = setSemanticEdgeConfig;
exports.buildSemanticEdges = buildSemanticEdges;
const embed_1 = require("./embed");
const semantic_edge_model_1 = require("./semantic-edge-model");
const semantic_edge_incremental_1 = require("./semantic-edge-incremental");
const semantic_edge_cache_1 = require("./semantic-edge-cache");
const semantic_edge_store_1 = require("./semantic-edge-store");
exports.SEMANTIC_EDGES_ENV_VAR = 'CODEGRAPH_SEMANTIC_EDGES';
exports.SEMANTIC_EDGES_META_KEY = 'semantic_edges_enabled';
exports.SEMANTIC_TOP_K_META_KEY = 'semantic_edges_top_k';
exports.SEMANTIC_THRESHOLD_META_KEY = 'semantic_edges_min_similarity';
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 50;
const DEFAULT_MIN_SIMILARITY = 0.75;
function resolveSemanticEdgesEnabled(db) {
    const env = parseBoolean(process.env[exports.SEMANTIC_EDGES_ENV_VAR]);
    if (env !== undefined)
        return env;
    if (!db)
        return false;
    if (!(0, semantic_edge_store_1.tableExists)(db, 'project_metadata'))
        return false;
    const row = db.prepare('SELECT value FROM project_metadata WHERE key = ?')
        .get(exports.SEMANTIC_EDGES_META_KEY);
    return parseBoolean(row?.value) ?? false;
}
function setSemanticEdgesEnabled(db, enabled) {
    db.prepare(`
    INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(exports.SEMANTIC_EDGES_META_KEY, enabled ? '1' : '0', Date.now());
}
function setSemanticEdgeConfig(db, options) {
    const topK = clampInteger(options.topK, 1, MAX_TOP_K);
    const minSimilarity = clampSimilarity(options.minSimilarity);
    const write = db.prepare(`
    INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
    db.transaction(() => {
        const now = Date.now();
        write.run(exports.SEMANTIC_EDGES_META_KEY, options.enabled ? '1' : '0', now);
        write.run(exports.SEMANTIC_TOP_K_META_KEY, String(topK), now);
        write.run(exports.SEMANTIC_THRESHOLD_META_KEY, String(minSimilarity), now);
    })();
}
function buildSemanticEdges(db, options = {}) {
    const enabled = options.enabled ?? resolveSemanticEdgesEnabled(db);
    if (!enabled) {
        return { enabled: false, available: false, created: 0, edgeCount: 0, skipped: 0, rebuilt: false, unchanged: false, reusedDocuments: 0, knnQueries: 0, similarityComparisons: 0, reason: 'disabled' };
    }
    if (!(0, semantic_edge_store_1.tableExists)(db, 'mdast_vectors')) {
        (0, semantic_edge_store_1.invalidateSemanticEdges)(db);
        return { enabled: true, available: false, created: 0, edgeCount: 0, skipped: 0, rebuilt: false, unchanged: false, reusedDocuments: 0, knnQueries: 0, similarityComparisons: 0, reason: 'vector-table-missing' };
    }
    return db.transaction(() => buildEnabled(db, options))();
}
function buildEnabled(db, options) {
    const topK = clampInteger(options.topK ?? readNumber(db, exports.SEMANTIC_TOP_K_META_KEY) ?? DEFAULT_TOP_K, 1, MAX_TOP_K);
    const minSimilarity = clampSimilarity(options.minSimilarity ?? readNumber(db, exports.SEMANTIC_THRESHOLD_META_KEY) ?? DEFAULT_MIN_SIMILARITY);
    const modelId = options.modelId?.trim() || embed_1.EMBED_MODEL_ID;
    const documents = (0, semantic_edge_store_1.readAlignedDocuments)(db, modelId);
    const corpusFingerprint = (0, semantic_edge_model_1.fingerprintCorpus)(documents);
    const configFingerprint = (0, semantic_edge_model_1.hashValue)(JSON.stringify({ algorithm: semantic_edge_model_1.SEMANTIC_EDGE_ALGORITHM, topK, minSimilarity }));
    const state = (0, semantic_edge_store_1.readState)(db);
    const neighborCache = (0, semantic_edge_cache_1.readNeighborCache)(db, topK);
    if (state && neighborCache && (0, semantic_edge_cache_1.cacheMatchesDocuments)(neighborCache, documents)
        && (0, semantic_edge_store_1.stateMatches)(db, state, corpusFingerprint, modelId, configFingerprint)) {
        return {
            enabled: true,
            available: true,
            created: 0,
            edgeCount: state.edge_count,
            skipped: documents.length,
            rebuilt: false,
            unchanged: true,
            reusedDocuments: documents.length,
            knnQueries: 0,
            similarityComparisons: 0,
            corpusFingerprint,
        };
    }
    const compatibleCache = state?.model_id === modelId && state.config_fingerprint === configFingerprint
        ? neighborCache
        : undefined;
    const computation = (0, semantic_edge_incremental_1.computeSemanticEdges)(db, documents, topK, minSimilarity, compatibleCache);
    (0, semantic_edge_store_1.publishSemanticEdges)(db, documents, computation.neighbors, computation.pairs, corpusFingerprint, modelId, configFingerprint);
    return {
        enabled: true,
        available: true,
        created: computation.pairs.length,
        edgeCount: computation.pairs.length,
        skipped: computation.skipped,
        rebuilt: true,
        unchanged: false,
        reusedDocuments: computation.reusedDocuments,
        knnQueries: computation.knnQueries,
        similarityComparisons: computation.similarityComparisons,
        corpusFingerprint,
    };
}
function clampInteger(value, minimum, maximum) {
    const integer = Math.floor(Number.isFinite(value) ? value : minimum);
    return Math.max(minimum, Math.min(maximum, integer));
}
function clampSimilarity(value) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_MIN_SIMILARITY;
}
function parseBoolean(value) {
    if (value == null)
        return undefined;
    if (/^(1|true|yes|on)$/i.test(value.trim()))
        return true;
    if (/^(0|false|no|off)$/i.test(value.trim()))
        return false;
    return undefined;
}
function readNumber(db, key) {
    const row = db.prepare('SELECT value FROM project_metadata WHERE key = ?')
        .get(key);
    if (row?.value === undefined)
        return undefined;
    const value = Number(row.value);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid numeric project metadata for ${key}: ${row.value}`);
    }
    return value;
}
//# sourceMappingURL=semantic-edges.js.map