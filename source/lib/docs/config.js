"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOC_GRAPH_ENV_VAR = exports.EMBED_DIM = exports.DOCS_META_KEY = exports.DOCS_ENV_VAR = void 0;
exports.docsEnvOverride = docsEnvOverride;
exports.docGraphEnvOverride = docGraphEnvOverride;
exports.setDocsEnabled = setDocsEnabled;
exports.docsEnabledFromDb = docsEnabledFromDb;
exports.resolveDocsEnabled = resolveDocsEnabled;
/** Env var that force-enables / force-disables the docs feature. */
exports.DOCS_ENV_VAR = 'CODEGRAPH_DOCS';
/** project_metadata key under which the persisted opt-in flag lives. */
exports.DOCS_META_KEY = 'docs_enabled';
/** Embedding dimensionality (multilingual-e5-small). Shared by embed/db/search. */
exports.EMBED_DIM = 384;
function parseBool(v) {
    if (v == null)
        return undefined;
    const s = String(v).trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'on')
        return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'off')
        return false;
    return undefined;
}
/** The CODEGRAPH_DOCS env override, or undefined when unset/unrecognized. */
function docsEnvOverride() {
    return parseBool(process.env[exports.DOCS_ENV_VAR]);
}
/**
 * Env var that force-enables / force-disables doc-graph promotion (doc/doc_link
 * nodes & edges). Independent of CODEGRAPH_DOCS: docs must be on for promotion
 * to run, but this gates whether `doc_links` get promoted into the graph.
 * Unset → auto-detect (pure-Markdown project). 1 → force on; 0 → force off.
 */
exports.DOC_GRAPH_ENV_VAR = 'CODEGRAPH_DOC_GRAPH';
/** The CODEGRAPH_DOC_GRAPH env override, or undefined when unset/unrecognized. */
function docGraphEnvOverride() {
    return parseBool(process.env[exports.DOC_GRAPH_ENV_VAR]);
}
/** Persist the docs-enabled flag in project_metadata (idempotent upsert). */
function setDocsEnabled(db, enabled) {
    db.prepare(`INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(exports.DOCS_META_KEY, enabled ? '1' : '0', Date.now());
}
/** Read the persisted docs-enabled flag from project_metadata (false if absent). */
function docsEnabledFromDb(db) {
    try {
        const row = db
            .prepare('SELECT value FROM project_metadata WHERE key = ?')
            .get(exports.DOCS_META_KEY);
        return parseBool(row?.value) ?? false;
    }
    catch {
        // project_metadata may not exist on a pre-v2 DB — treat as disabled.
        return false;
    }
}
/**
 * Resolve whether the docs feature is enabled for this run. The env var wins
 * (so `--with-docs` / CI can force it); otherwise the persisted project flag;
 * otherwise off. Pass the db to honor the persisted flag; omit it to consult
 * only the env override.
 */
function resolveDocsEnabled(db) {
    const env = docsEnvOverride();
    if (env !== undefined)
        return env;
    if (db)
        return docsEnabledFromDb(db);
    return false;
}
//# sourceMappingURL=config.js.map