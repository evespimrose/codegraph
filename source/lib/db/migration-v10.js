"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySemanticEdgeMigration = applySemanticEdgeMigration;
const provenance_1 = require("../provenance");
function applySemanticEdgeMigration(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_edge_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      corpus_fingerprint TEXT NOT NULL,
      model_id TEXT NOT NULL,
      config_fingerprint TEXT NOT NULL,
      edge_count INTEGER NOT NULL CHECK (edge_count >= 0),
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
    if (!hasColumn(db, 'edges', 'provenance'))
        return;
    const legacy = db.prepare('SELECT COUNT(*) AS count FROM edges WHERE provenance IS NULL')
        .get();
    if (Number(legacy.count) === 0)
        return;
    db.prepare(`
    INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(provenance_1.PROVENANCE_REBUILD_META_KEY, provenance_1.PROVENANCE_REBUILD_REASON, Date.now());
}
function hasColumn(db, table, column) {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table);
    if (!exists)
        return false;
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some((candidate) => candidate.name === column);
}
//# sourceMappingURL=migration-v10.js.map