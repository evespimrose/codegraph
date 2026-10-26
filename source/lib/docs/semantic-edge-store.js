"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAlignedDocuments = readAlignedDocuments;
exports.readState = readState;
exports.stateMatches = stateMatches;
exports.publishSemanticEdges = publishSemanticEdges;
exports.invalidateSemanticEdges = invalidateSemanticEdges;
exports.tableExists = tableExists;
const links_util_1 = require("./links-util");
const semantic_edge_model_1 = require("./semantic-edge-model");
const semantic_edge_cache_1 = require("./semantic-edge-cache");
const EDGE_KIND = 'semantically_related';
const PROVENANCE = 'inferred';
function readAlignedDocuments(db, modelId) {
    const rows = db.prepare(`
    SELECT m.id, m.file_path, m.content_hash, v.embedding
    FROM mdast_metadata m JOIN mdast_vectors v ON v.rowid = m.id
    WHERE m.embedding_model = ? ORDER BY m.id
  `).all(modelId);
    return rows.map((row) => {
        const bytes = Uint8Array.from(row.embedding);
        return {
            id: Number(row.id),
            filePath: row.file_path,
            contentHash: row.content_hash ?? '',
            vector: (0, semantic_edge_model_1.decodeVector)(bytes),
            blob: Buffer.from(bytes),
            nodeId: (0, semantic_edge_model_1.documentNodeId)(row.file_path),
        };
    });
}
function readState(db) {
    return db.prepare(`
    SELECT corpus_fingerprint, model_id, config_fingerprint, edge_count
    FROM semantic_edge_state WHERE id = 1
  `).get();
}
function stateMatches(db, state, corpusFingerprint, modelId, configFingerprint) {
    if (state.corpus_fingerprint !== corpusFingerprint
        || state.model_id !== modelId
        || state.config_fingerprint !== configFingerprint)
        return false;
    const row = db.prepare(`
    SELECT COUNT(*) AS count,
      SUM(CASE WHEN provenance = '${PROVENANCE}' THEN 0 ELSE 1 END) AS invalid
    FROM edges WHERE kind = '${EDGE_KIND}'
  `).get();
    return Number(row.count) === state.edge_count && Number(row.invalid ?? 0) === 0;
}
function publishSemanticEdges(db, documents, neighbors, pairs, corpusFingerprint, modelId, configFingerprint) {
    const now = Date.now();
    db.prepare(`DELETE FROM edges WHERE kind = '${EDGE_KIND}'`).run();
    (0, semantic_edge_cache_1.replaceNeighborCache)(db, documents, neighbors, now);
    publishNodes(db, documents, now);
    publishEdges(db, pairs, modelId);
    writeState(db, corpusFingerprint, modelId, configFingerprint, pairs.length, now);
}
function publishNodes(db, documents, updatedAt) {
    const current = new Set(documents.map((document) => document.nodeId));
    const stale = db.prepare("SELECT id FROM nodes WHERE domain_kind = 'document.semantic'")
        .all();
    const remove = db.prepare("DELETE FROM nodes WHERE id = ? AND domain_kind = 'document.semantic'");
    for (const node of stale) {
        if (!current.has(node.id))
            remove.run(node.id);
    }
    const insert = db.prepare(`
    INSERT OR IGNORE INTO nodes
    (id, kind, name, qualified_name, file_path, language, start_line, end_line,
     start_column, end_column, domain_kind, updated_at)
    VALUES (?, 'doc', ?, ?, ?, 'markdown', 1, 1, 0, 0, 'document.semantic', ?)
  `);
    for (const document of documents) {
        insert.run(document.nodeId, (0, links_util_1.baseName)(document.filePath).replace(/\.[^.]+$/, ''), document.filePath, document.filePath, updatedAt);
    }
}
function publishEdges(db, pairs, modelId) {
    const insert = db.prepare(`
    INSERT INTO edges (source, target, kind, metadata, provenance)
    VALUES (?, ?, '${EDGE_KIND}', ?, '${PROVENANCE}')
  `);
    for (const pair of pairs) {
        insert.run(pair.source, pair.target, JSON.stringify({
            similarity: pair.similarity,
            model: modelId,
            algorithm: semantic_edge_model_1.SEMANTIC_EDGE_ALGORITHM,
        }));
    }
}
function writeState(db, corpusFingerprint, modelId, configFingerprint, edgeCount, updatedAt) {
    db.prepare('DELETE FROM semantic_edge_state').run();
    db.prepare(`
    INSERT INTO semantic_edge_state
    (id, corpus_fingerprint, model_id, config_fingerprint, edge_count, updated_at)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run(corpusFingerprint, modelId, configFingerprint, edgeCount, updatedAt);
}
function invalidateSemanticEdges(db) {
    const hasEdges = tableExists(db, 'edges');
    const hasState = tableExists(db, 'semantic_edge_state');
    const hasDocuments = tableExists(db, 'semantic_edge_documents');
    const hasNeighbors = tableExists(db, 'semantic_edge_neighbors');
    if (!hasEdges && !hasState && !hasDocuments && !hasNeighbors)
        return;
    db.transaction(() => {
        if (hasEdges)
            db.prepare(`DELETE FROM edges WHERE kind = '${EDGE_KIND}'`).run();
        if (hasState)
            db.prepare('DELETE FROM semantic_edge_state').run();
        (0, semantic_edge_cache_1.clearNeighborCache)(db);
    })();
}
function tableExists(db, name) {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(name));
}
//# sourceMappingURL=semantic-edge-store.js.map