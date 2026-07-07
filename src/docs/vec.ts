/**
 * sqlite-vec loadable-extension loader.
 *
 * Loads the sqlite-vec extension into a connection so the `vec0` virtual table
 * (the Markdown vector store) is available. Returns true on success.
 *
 * Defensive by design: even though sqlite-vec is a regular dependency, a
 * platform without a prebuilt binary (or a `--no-optional` / partial install)
 * must degrade to "no vector search" rather than crash the whole code graph.
 * Every failure path — missing module, missing native binary, an adapter
 * without `loadExtension` — is swallowed and reported as `false`.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';

// Per-connection memo so repeated indexer/search calls don't re-load the
// extension on the same db (idempotent, but re-loading is wasted work).
const loaded = new WeakSet<object>();

/**
 * Load sqlite-vec into `db`. Idempotent per connection. Returns false (never
 * throws) when sqlite-vec or the adapter's loadExtension is unavailable.
 */
export function loadVecExtension(db: SqliteDatabase): boolean {
  if (loaded.has(db as unknown as object)) return true;
  if (typeof db.loadExtension !== 'function') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
    loaded.add(db as unknown as object);
    return true;
  } catch {
    return false;
  }
}

/** Whether sqlite-vec can be resolved at all (module + native binary). */
export function isVecAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec');
    return typeof sqliteVec.getLoadablePath === 'function';
  } catch {
    return false;
  }
}

/**
 * Float32 vector → BLOB Buffer for vec0 binding. vec0 stores raw little-endian
 * float32; node:sqlite binds a Buffer as a BLOB unchanged.
 */
export function floatBlob(vec: Float32Array | number[]): Buffer {
  const f32 = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}
