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
/**
 * Load sqlite-vec into `db`. Idempotent per connection. Returns false (never
 * throws) when sqlite-vec or the adapter's loadExtension is unavailable.
 */
export declare function loadVecExtension(db: SqliteDatabase): boolean;
/** Whether sqlite-vec can be resolved at all (module + native binary). */
export declare function isVecAvailable(): boolean;
/**
 * Float32 vector → BLOB Buffer for vec0 binding. vec0 stores raw little-endian
 * float32; node:sqlite binds a Buffer as a BLOB unchanged.
 */
export declare function floatBlob(vec: Float32Array | number[]): Buffer;
//# sourceMappingURL=vec.d.ts.map