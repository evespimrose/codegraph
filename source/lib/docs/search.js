"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGoverningDocs = exports.findBacklinks = void 0;
exports.searchDocs = searchDocs;
const config_1 = require("./config");
const embed_1 = require("./embed");
const links_util_1 = require("./links-util");
const lexical_search_1 = require("./lexical-search");
const vec_1 = require("./vec");
var document_relations_1 = require("./document-relations");
Object.defineProperty(exports, "findBacklinks", { enumerable: true, get: function () { return document_relations_1.findBacklinks; } });
Object.defineProperty(exports, "findGoverningDocs", { enumerable: true, get: function () { return document_relations_1.findGoverningDocs; } });
const SUMMARY_CAP = 200;
const DEFAULT_TOPK = 8;
const DEFAULT_CODE_LIMIT = 8;
const MAX_TOPK = 50;
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
    const lexical = (0, lexical_search_1.searchDocsLexical)(db, normalizedQuery, topk, codeLimit);
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
      WHERE embedding MATCH ? AND k = ${topk} ORDER BY distance
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
    result.hits = (0, lexical_search_1.fuseHits)(vectorHits, lexical.hits, topk);
    result.warnings = [...new Set(result.warnings)];
    return result;
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