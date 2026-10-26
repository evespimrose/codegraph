"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySemanticNeighborCacheMigration = applySemanticNeighborCacheMigration;
function applySemanticNeighborCacheMigration(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_edge_documents (
      document_id INTEGER PRIMARY KEY,
      node_id TEXT NOT NULL,
      document_fingerprint TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS semantic_edge_neighbors (
      source_document_id INTEGER NOT NULL,
      target_document_id INTEGER NOT NULL,
      similarity REAL NOT NULL CHECK (similarity >= -1 AND similarity <= 1),
      rank INTEGER NOT NULL CHECK (rank >= 0),
      PRIMARY KEY (source_document_id, target_document_id),
      UNIQUE (source_document_id, rank)
    );

    CREATE INDEX IF NOT EXISTS idx_semantic_neighbors_target
      ON semantic_edge_neighbors(target_document_id);
  `);
}
//# sourceMappingURL=migration-v11.js.map