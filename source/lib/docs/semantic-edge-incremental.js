"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSemanticEdges = computeSemanticEdges;
const vec_1 = require("./vec");
const semantic_edge_model_1 = require("./semantic-edge-model");
const KNN_RERANK_FACTOR = 4;
function computeSemanticEdges(db, documents, topK, minSimilarity, previous) {
    const computation = new IncrementalComputation(db, documents, topK, previous);
    const neighbors = computation.run();
    const materialized = materializePairs(documents, neighbors, minSimilarity);
    return {
        neighbors,
        pairs: materialized.pairs,
        skipped: materialized.skipped,
        reusedDocuments: computation.reusedDocuments,
        knnQueries: computation.knnQueries,
        similarityComparisons: computation.similarityComparisons,
    };
}
class IncrementalComputation {
    documents;
    topK;
    previous;
    #byId;
    #changedIds = new Set();
    #similarities = new Map();
    #nearest;
    #queryK;
    reusedDocuments = 0;
    knnQueries = 0;
    similarityComparisons = 0;
    constructor(db, documents, topK, previous) {
        this.documents = documents;
        this.topK = topK;
        this.previous = previous;
        this.#byId = new Map(documents.map((document) => [document.id, document]));
        const countRow = db.prepare('SELECT COUNT(*) AS count FROM mdast_vectors').get();
        const vectorCount = Number(countRow.count);
        const staleCount = Math.max(0, vectorCount - documents.length);
        this.#queryK = Math.min(vectorCount, topK * KNN_RERANK_FACTOR + staleCount + 1);
        this.#nearest = db.prepare(`
      SELECT rowid FROM mdast_vectors
      WHERE embedding MATCH ? AND k = ${this.#queryK}
      ORDER BY distance
    `);
        if (previous) {
            for (const document of documents) {
                const prior = previous.documents.get(document.id);
                if (!prior || prior.fingerprint !== (0, semantic_edge_model_1.fingerprintDocument)(document) || prior.nodeId !== document.nodeId) {
                    this.#changedIds.add(document.id);
                }
            }
        }
    }
    run() {
        if (this.documents.length < 2)
            return [];
        const neighbors = [];
        for (const document of this.documents) {
            const ranked = this.rankDocument(document);
            ranked.forEach((candidate, rank) => {
                neighbors.push({
                    sourceDocumentId: document.id,
                    targetDocumentId: candidate.document.id,
                    similarity: candidate.similarity,
                    rank,
                });
            });
        }
        return neighbors;
    }
    rankDocument(document) {
        if (!this.previous)
            return this.rankNearest(document);
        if (this.#changedIds.has(document.id))
            return this.rankAll(document);
        const prior = this.previous.neighbors.get(document.id) ?? [];
        const invalidated = prior.some((neighbor) => !this.#byId.has(neighbor.targetDocumentId) || this.#changedIds.has(neighbor.targetDocumentId));
        if (invalidated)
            return this.rankNearest(document);
        const candidates = new Map();
        for (const neighbor of prior) {
            const target = this.#byId.get(neighbor.targetDocumentId);
            if (target)
                candidates.set(target.id, { document: target, similarity: neighbor.similarity });
        }
        for (const changedId of this.#changedIds) {
            const target = this.#byId.get(changedId);
            if (target && target.id !== document.id) {
                candidates.set(target.id, { document: target, similarity: this.similarity(document, target) });
            }
        }
        this.reusedDocuments++;
        return rankCandidates(candidates.values(), this.topK);
    }
    rankAll(document) {
        const candidates = [];
        for (const target of this.documents) {
            if (target.id !== document.id) {
                candidates.push({ document: target, similarity: this.similarity(document, target) });
            }
        }
        return rankCandidates(candidates, this.topK);
    }
    rankNearest(document) {
        if (this.#queryK === 0)
            return [];
        this.knnQueries++;
        const candidates = this.#nearest.all((0, vec_1.floatBlob)(document.vector))
            .map((row) => this.#byId.get(Number(row.rowid)))
            .filter((target) => target !== undefined && target.id !== document.id)
            .map((target) => ({ document: target, similarity: this.similarity(document, target) }));
        return rankCandidates(candidates, this.topK);
    }
    similarity(left, right) {
        const key = left.id < right.id ? `${left.id}\0${right.id}` : `${right.id}\0${left.id}`;
        const cached = this.#similarities.get(key);
        if (cached !== undefined)
            return cached;
        const value = (0, semantic_edge_model_1.cosine)(left.vector, right.vector);
        this.#similarities.set(key, value);
        this.similarityComparisons++;
        return value;
    }
}
function rankCandidates(candidates, topK) {
    return [...candidates]
        .sort((left, right) => right.similarity - left.similarity
        || left.document.id - right.document.id)
        .slice(0, topK);
}
function materializePairs(documents, neighbors, minSimilarity) {
    const byId = new Map(documents.map((document) => [document.id, document]));
    const candidates = new Map();
    let skipped = 0;
    for (const neighbor of neighbors) {
        if (neighbor.similarity < minSimilarity) {
            skipped++;
            continue;
        }
        const sourceDocument = byId.get(neighbor.sourceDocumentId);
        const targetDocument = byId.get(neighbor.targetDocumentId);
        if (!sourceDocument || !targetDocument || sourceDocument.id === targetDocument.id) {
            skipped++;
            continue;
        }
        const [source, target] = sourceDocument.nodeId < targetDocument.nodeId
            ? [sourceDocument.nodeId, targetDocument.nodeId]
            : [targetDocument.nodeId, sourceDocument.nodeId];
        const key = `${source}\0${target}`;
        const similarity = Math.round(neighbor.similarity * 1e6) / 1e6;
        if (similarity > (candidates.get(key)?.similarity ?? -1)) {
            candidates.set(key, { source, target, similarity });
        }
        else {
            skipped++;
        }
    }
    const pairs = [...candidates.values()];
    pairs.sort((left, right) => compareCodeUnits(left.source, right.source)
        || compareCodeUnits(left.target, right.target));
    return { pairs, skipped };
}
function compareCodeUnits(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
//# sourceMappingURL=semantic-edge-incremental.js.map