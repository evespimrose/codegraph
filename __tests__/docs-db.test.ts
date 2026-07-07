/**
 * Docs DB layer — schema migration v5 + the sqlite-vec vector store.
 *
 * Migration v5 (mdast_metadata) runs on plain node:sqlite, so it's tested
 * unconditionally. The vec0 vector table needs the sqlite-vec native extension;
 * those tests skip cleanly when it isn't installed (optional / --no-optional).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDatabase, type SqliteDatabase } from '../src/db/sqlite-adapter';
import { DatabaseConnection } from '../src/db';
import { runMigrations, getCurrentVersion, CURRENT_SCHEMA_VERSION } from '../src/db/migrations';
import { loadVecExtension, isVecAvailable, floatBlob } from '../src/docs/vec';
import { ensureVectorTable } from '../src/docs/indexer';

function tableExists(db: SqliteDatabase, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
  return !!row;
}

describe('schema migration v5 (mdast_metadata)', () => {
  it('a freshly-initialized DB ends at the current schema version with mdast_metadata', () => {
    // Drive the REAL init path (schema + migrations applied consistently), not a
    // hand-rolled exec(schema)+migrate which would re-run migrations over an
    // already-current schema and collide on ALTER ... ADD COLUMN.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-docs-db-'));
    const conn = DatabaseConnection.initialize(path.join(dir, 't.db'));
    try {
      const db = conn.getDb();
      expect(getCurrentVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
      expect(CURRENT_SCHEMA_VERSION).toBe(5);
      expect(tableExists(db, 'mdast_metadata')).toBe(true);
    } finally {
      conn.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('upgrading a pre-v5 DB adds mdast_metadata and bumps the version to 5', () => {
    const { db } = createDatabase(':memory:');
    // Simulate an older DB sitting at v4 with no docs table yet.
    db.exec(
      `CREATE TABLE schema_versions (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL, description TEXT);
       INSERT INTO schema_versions (version, applied_at, description) VALUES (4, 0, 'simulated v4');`
    );
    expect(tableExists(db, 'mdast_metadata')).toBe(false);

    runMigrations(db, 4);

    expect(tableExists(db, 'mdast_metadata')).toBe(true);
    expect(getCurrentVersion(db)).toBe(5);
    db.close();
  });
});

describe.skipIf(!isVecAvailable())('sqlite-vec vector store (vec0)', () => {
  it('loads the extension and answers a KNN query in distance order', () => {
    const { db } = createDatabase(':memory:');
    expect(loadVecExtension(db)).toBe(true);
    ensureVectorTable(db);

    const ins = db.prepare('INSERT INTO mdast_vectors(rowid, embedding) VALUES (?, ?)');
    const v1 = new Float32Array(384); v1[0] = 1; // points along axis 0
    const v2 = new Float32Array(384); v2[1] = 1; // points along axis 1
    // node:sqlite binds JS numbers as REAL, which vec0 rejects for rowid — BigInt.
    ins.run(BigInt(1), floatBlob(v1));
    ins.run(BigInt(2), floatBlob(v2));

    const q = new Float32Array(384); q[0] = 1; // closest to v1
    const rows = db
      .prepare('SELECT rowid, distance FROM mdast_vectors WHERE embedding MATCH ? AND k = 2 ORDER BY distance')
      .all(floatBlob(q)) as Array<{ rowid: number | bigint; distance: number }>;

    expect(rows.length).toBe(2);
    expect(Number(rows[0].rowid)).toBe(1);
    expect(rows[0].distance).toBeLessThan(rows[1].distance);
    db.close();
  });

  it('floatBlob serializes a 384-dim vector as raw little-endian float32', () => {
    const v = new Float32Array(384); v[0] = 1;
    expect(floatBlob(v).length).toBe(384 * 4);
  });
});
