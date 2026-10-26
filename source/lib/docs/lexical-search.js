"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchDocsLexical = searchDocsLexical;
exports.fuseHits = fuseHits;
exports.resolveCodeSymbols = resolveCodeSymbols;
const links_util_1 = require("./links-util");
const SUMMARY_CAP = 200;
const SYMBOL_KINDS = [
    'class', 'struct', 'interface', 'trait', 'protocol',
    'function', 'method', 'enum', 'type_alias', 'namespace',
    'module', 'component', 'route',
];
function searchDocsLexical(db, query, limit, codeLimit) {
    if (!tableExists(db, 'document_fts'))
        return { hits: [], warnings: [] };
    const ftsQuery = toFtsQuery(query);
    if (!ftsQuery)
        return { hits: [], warnings: [] };
    let rows;
    try {
        rows = db.prepare(`
      SELECT m.id, m.file_path, m.blk_tags, m.code_refs, m.doc_links,
             m.content_summary, m.format, m.title, bm25(document_fts) AS rank
      FROM document_fts
      JOIN mdast_metadata m ON m.id = document_fts.rowid
      WHERE document_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit);
    }
    catch (error) {
        return { hits: [], warnings: [`Lexical document query failed: ${messageOf(error)}`] };
    }
    const refsByDocument = new Map();
    const allReferences = new Set();
    for (const row of rows) {
        const references = (0, links_util_1.parseRefs)(row.code_refs);
        refsByDocument.set(row.id, references);
        for (const reference of references)
            allReferences.add(reference);
    }
    const resolved = resolveCodeSymbols(db, [...allReferences]);
    const hits = rows.map((row, rankIndex) => {
        const codeRefs = refsByDocument.get(row.id) ?? [];
        return {
            file: row.file_path,
            blk: row.blk_tags,
            summary: truncate(row.content_summary ?? '', SUMMARY_CAP),
            distance: round4(rankIndex / Math.max(1, rows.length)),
            codeRefs,
            symbols: codeRefs.flatMap((file) => resolved.byFile.get(file) ?? []).slice(0, codeLimit),
            format: row.format ?? 'markdown',
            title: row.title,
            retrieval: ['lexical'],
        };
    });
    return { hits, warnings: resolved.warnings };
}
function fuseHits(vectorHits, lexicalHits, limit) {
    const ranked = new Map();
    const add = (hits, source) => {
        hits.forEach((hit, index) => {
            const existing = ranked.get(hit.file);
            if (existing) {
                existing.score += 1 / (61 + index);
                existing.sources.add(source);
            }
            else {
                ranked.set(hit.file, { hit, score: 1 / (61 + index), sources: new Set([source]) });
            }
        });
    };
    add(vectorHits, 'vector');
    add(lexicalHits, 'lexical');
    return [...ranked.values()]
        .sort((left, right) => right.score - left.score || left.hit.file.localeCompare(right.hit.file))
        .slice(0, limit)
        .map(({ hit, sources }) => ({ ...hit, retrieval: [...sources].sort() }));
}
function resolveCodeSymbols(db, files) {
    const byFile = new Map();
    if (files.length === 0)
        return { byFile, warnings: [] };
    const filePlaceholders = files.map(() => '?').join(',');
    const kindPlaceholders = SYMBOL_KINDS.map(() => '?').join(',');
    let rows;
    try {
        rows = db.prepare(`
      SELECT name, kind, file_path, start_line, signature FROM nodes
      WHERE file_path IN (${filePlaceholders}) AND kind IN (${kindPlaceholders})
      ORDER BY file_path, start_line
    `).all(...files, ...SYMBOL_KINDS);
    }
    catch (error) {
        return { byFile, warnings: [`Document symbol resolution failed: ${messageOf(error)}`] };
    }
    for (const row of rows) {
        const symbols = byFile.get(row.file_path) ?? [];
        symbols.push({
            symbol: row.name,
            kind: row.kind,
            file: row.file_path,
            line: Number(row.start_line),
            signature: row.signature ?? null,
        });
        byFile.set(row.file_path, symbols);
    }
    return { byFile, warnings: [] };
}
function toFtsQuery(query) {
    const tokens = query.match(/[\p{L}\p{N}_./-]+/gu) ?? [];
    return [...new Set(tokens.map((token) => token.toLowerCase()))]
        .slice(0, 12)
        .map((token) => `"${token.replace(/"/g, '""')}"*`)
        .join(' OR ');
}
function tableExists(db, name) {
    try {
        return Boolean(db.prepare('SELECT 1 AS x FROM sqlite_master WHERE name = ? LIMIT 1').get(name));
    }
    catch {
        return false;
    }
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
//# sourceMappingURL=lexical-search.js.map