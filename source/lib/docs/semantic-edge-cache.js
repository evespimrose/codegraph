"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readNeighborCache = readNeighborCache;
exports.cacheMatchesDocuments = cacheMatchesDocuments;
exports.replaceNeighborCache = replaceNeighborCache;
exports.clearNeighborCache = clearNeighborCache;
const semantic_edge_model_1 = require("./semantic-edge-model");
function readNeighborCache(db, topK) {
    if (!hasTable(db, 'semantic_edge_documents') || !hasTable(db, 'semantic_edge_neighbors')) {
        return undefined;
    }
    const documentRows = db.prepare(`
    SELECT document_id, node_id, document_fingerprint FROM semantic_edge_documents
    ORDER BY document_id
  `).all();
    const documents = readDocuments(documentRows);
    if (!documents)
        return undefined;
    const neighborRows = db.prepare(`
    SELECT source_document_id, target_document_id, similarity, rank
    FROM semantic_edge_neighbors ORDER BY source_document_id, rank
  `).all();
    const neighbors = readNeighbors(neighborRows, documents);
    if (!neighbors || !hasExpectedRanks(documents, neighbors, topK))
        return undefined;
    return { documents, neighbors };
}
function cacheMatchesDocuments(cache, documents) {
    if (cache.documents.size !== documents.length)
        return false;
    return documents.every((document) => {
        const cached = cache.documents.get(document.id);
        return cached?.nodeId === document.nodeId
            && cached.fingerprint === (0, semantic_edge_model_1.fingerprintDocument)(document);
    });
}
function replaceNeighborCache(db, documents, neighbors, updatedAt) {
    db.prepare('DELETE FROM semantic_edge_neighbors').run();
    db.prepare('DELETE FROM semantic_edge_documents').run();
    const insertDocument = db.prepare(`
    INSERT INTO semantic_edge_documents
    (document_id, node_id, document_fingerprint, updated_at) VALUES (?, ?, ?, ?)
  `);
    for (const document of documents) {
        insertDocument.run(document.id, document.nodeId, (0, semantic_edge_model_1.fingerprintDocument)(document), updatedAt);
    }
    const insertNeighbor = db.prepare(`
    INSERT INTO semantic_edge_neighbors
    (source_document_id, target_document_id, similarity, rank) VALUES (?, ?, ?, ?)
  `);
    for (const neighbor of neighbors) {
        insertNeighbor.run(neighbor.sourceDocumentId, neighbor.targetDocumentId, neighbor.similarity, neighbor.rank);
    }
}
function clearNeighborCache(db) {
    if (hasTable(db, 'semantic_edge_neighbors')) {
        db.prepare('DELETE FROM semantic_edge_neighbors').run();
    }
    if (hasTable(db, 'semantic_edge_documents')) {
        db.prepare('DELETE FROM semantic_edge_documents').run();
    }
}
function readDocuments(rows) {
    const documents = new Map(rows.map((row) => [Number(row.document_id), {
            documentId: Number(row.document_id),
            nodeId: row.node_id,
            fingerprint: row.document_fingerprint,
        }]));
    return documents.size === rows.length ? documents : undefined;
}
function readNeighbors(rows, documents) {
    const neighbors = new Map();
    for (const row of rows) {
        const neighbor = toNeighbor(row);
        if (!validNeighbor(neighbor, documents))
            return undefined;
        const sourceNeighbors = neighbors.get(neighbor.sourceDocumentId) ?? [];
        if (neighbor.rank !== sourceNeighbors.length)
            return undefined;
        sourceNeighbors.push(neighbor);
        neighbors.set(neighbor.sourceDocumentId, sourceNeighbors);
    }
    return neighbors;
}
function toNeighbor(row) {
    return {
        sourceDocumentId: Number(row.source_document_id),
        targetDocumentId: Number(row.target_document_id),
        similarity: Number(row.similarity),
        rank: Number(row.rank),
    };
}
function validNeighbor(neighbor, documents) {
    return documents.has(neighbor.sourceDocumentId)
        && documents.has(neighbor.targetDocumentId)
        && neighbor.sourceDocumentId !== neighbor.targetDocumentId
        && Number.isFinite(neighbor.similarity)
        && neighbor.similarity >= -1
        && neighbor.similarity <= 1
        && neighbor.rank >= 0;
}
function hasExpectedRanks(documents, neighbors, topK) {
    const expectedCount = Math.min(topK, Math.max(0, documents.size - 1));
    return [...documents.keys()].every((documentId) => (neighbors.get(documentId)?.length ?? 0) === expectedCount);
}
function hasTable(db, name) {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(name));
}
//# sourceMappingURL=semantic-edge-cache.js.map