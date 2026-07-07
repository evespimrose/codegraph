/**
 * Hybrid docs search (src/docs/search.ts).
 *
 * - findGoverningDocs + the searchDocs gating paths are pure metadata and run
 *   unconditionally (this is the no-op / relevance-gate proof).
 * - The full searchDocs KNN path needs sqlite-vec; it's gated on that and uses a
 *   MOCKED embedder so it never downloads the MiniLM model in CI.
 */
import { vi } from 'vitest';
// Hoisted: replace the optional embedder with a deterministic 384-dim stub so
// the search path runs without @xenova/transformers or a model download.
vi.mock('../src/docs/embed', () => ({
  embed: async () => { const v = new Float32Array(384); v[0] = 1; return v; },
  isEmbedAvailable: async () => true,
  embedBatch: async () => [],
  getEmbedder: async () => null,
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../src/db';
import type { SqliteDatabase } from '../src/db/sqlite-adapter';
import { searchDocs, findGoverningDocs } from '../src/docs/search';
import { setDocsEnabled } from '../src/docs/config';
import { loadVecExtension, isVecAvailable, floatBlob } from '../src/docs/vec';
import { ensureVectorTable } from '../src/docs/indexer';

const ENV = 'CODEGRAPH_DOCS';

let dir: string;
let conn: DatabaseConnection;
let db: SqliteDatabase;
let savedEnv: string | undefined;

beforeEach(() => {
  // The env override wins in resolveDocsEnabled — clear it so each test controls
  // the feature purely via the persisted project flag (setDocsEnabled).
  savedEnv = process.env[ENV];
  delete process.env[ENV];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-docs-search-'));
  conn = DatabaseConnection.initialize(path.join(dir, 't.db'));
  db = conn.getDb();
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  try { conn.close(); } catch { /* ignore */ }
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
});

function insertDoc(file: string, codeRefs: string[]): void {
  db.prepare(
    `INSERT INTO mdast_metadata (file_path, blk_tags, code_refs, content_summary, content_hash, last_updated)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(file, null, JSON.stringify(codeRefs), 'summary prose', 'hash', '');
}

describe('findGoverningDocs (relevance gate, no optional deps)', () => {
  it('returns docs whose code_refs govern a queried file', () => {
    insertDoc('docs/foo.md', ['src/foo.ts']);
    setDocsEnabled(db, true);
    const docs = findGoverningDocs(db, ['src/foo.ts']);
    expect(docs.length).toBe(1);
    expect(docs[0]!.file).toBe('docs/foo.md');
    expect(docs[0]!.codeRefs).toContain('src/foo.ts');
  });

  it('returns [] when no doc governs the queried file', () => {
    insertDoc('docs/foo.md', ['src/foo.ts']);
    setDocsEnabled(db, true);
    expect(findGoverningDocs(db, ['src/unrelated.ts'])).toEqual([]);
  });

  it('returns [] when the docs feature is disabled (silent gate)', () => {
    insertDoc('docs/foo.md', ['src/foo.ts']);
    setDocsEnabled(db, false);
    expect(findGoverningDocs(db, ['src/foo.ts'])).toEqual([]);
  });
});

describe('searchDocs gating', () => {
  it('returns enabled:false with no hits when the feature is off', async () => {
    const res = await searchDocs(db, 'anything');
    expect(res.enabled).toBe(false);
    expect(res.hits).toEqual([]);
  });
});

describe.skipIf(!isVecAvailable())('searchDocs end-to-end (vec0 + mocked embed)', () => {
  it('ranks the nearest doc and resolves its governed code symbols', async () => {
    loadVecExtension(db);
    ensureVectorTable(db);

    insertDoc('docs/foo.md', ['src/foo.ts']);
    const row = db.prepare('SELECT id FROM mdast_metadata WHERE file_path = ?').get('docs/foo.md') as { id: number };
    const v = new Float32Array(384); v[0] = 1; // matches the mocked query vector
    db.prepare('INSERT INTO mdast_vectors(rowid, embedding) VALUES (?, ?)').run(BigInt(row.id), floatBlob(v));

    db.prepare(
      `INSERT INTO nodes (id, kind, name, qualified_name, file_path, language,
        start_line, end_line, start_column, end_column, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('n1', 'function', 'fooFn', 'fooFn', 'src/foo.ts', 'typescript', 10, 20, 0, 0, 0);

    setDocsEnabled(db, true);

    const res = await searchDocs(db, 'foo');
    expect(res.enabled).toBe(true);
    expect(res.available).toBe(true);
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0]!.file).toBe('docs/foo.md');
    expect(res.hits[0]!.codeRefs).toContain('src/foo.ts');
    expect(res.hits[0]!.symbols.some((s) => s.symbol === 'fooFn')).toBe(true);
  });
});
