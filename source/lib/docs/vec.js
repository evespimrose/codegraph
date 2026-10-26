"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadVecExtension = loadVecExtension;
exports.isVecAvailable = isVecAvailable;
exports.floatBlob = floatBlob;
// Per-connection memo so repeated indexer/search calls don't re-load the
// extension on the same db (idempotent, but re-loading is wasted work).
const loaded = new WeakSet();
/**
 * Load sqlite-vec into `db`. Idempotent per connection. Returns false (never
 * throws) when sqlite-vec or the adapter's loadExtension is unavailable.
 */
function loadVecExtension(db) {
    if (loaded.has(db))
        return true;
    if (typeof db.loadExtension !== 'function')
        return false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteVec = require('sqlite-vec');
        db.loadExtension(sqliteVec.getLoadablePath());
        loaded.add(db);
        return true;
    }
    catch {
        return false;
    }
}
/** Whether sqlite-vec can be resolved at all (module + native binary). */
function isVecAvailable() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteVec = require('sqlite-vec');
        return typeof sqliteVec.getLoadablePath === 'function';
    }
    catch {
        return false;
    }
}
/**
 * Float32 vector → BLOB Buffer for vec0 binding. vec0 stores raw little-endian
 * float32; node:sqlite binds a Buffer as a BLOB unchanged.
 */
function floatBlob(vec) {
    const f32 = vec instanceof Float32Array ? vec : Float32Array.from(vec);
    return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}
//# sourceMappingURL=vec.js.map