"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyUniversalIndexMigration = applyUniversalIndexMigration;
function applyUniversalIndexMigration(db) {
    db.exec(`
    ALTER TABLE nodes ADD COLUMN domain_kind TEXT;
    ALTER TABLE nodes ADD COLUMN metadata_json TEXT;
    CREATE INDEX IF NOT EXISTS idx_nodes_domain_kind ON nodes(domain_kind);

    CREATE TABLE IF NOT EXISTS file_inventory (
      path TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      size INTEGER NOT NULL,
      modified_at INTEGER NOT NULL,
      content_hash TEXT,
      language TEXT,
      mime_type TEXT,
      adapter_id TEXT,
      adapter_version TEXT,
      diagnostic TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_file_inventory_status ON file_inventory(status);
    CREATE INDEX IF NOT EXISTS idx_file_inventory_adapter ON file_inventory(adapter_id);

    ALTER TABLE mdast_metadata ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown';
    ALTER TABLE mdast_metadata ADD COLUMN title TEXT;
    ALTER TABLE mdast_metadata ADD COLUMN structure_json TEXT;
    ALTER TABLE mdast_metadata ADD COLUMN embedding_model TEXT;
    ALTER TABLE mdast_metadata ADD COLUMN file_size INTEGER;
    ALTER TABLE mdast_metadata ADD COLUMN modified_at INTEGER;
  `);
}
//# sourceMappingURL=migration-v9.js.map