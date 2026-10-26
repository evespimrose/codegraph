/**
 * Markdown docs feature — opt-in configuration.
 *
 * The docs feature (markdown vector indexing + hybrid search) is OFF by
 * default. It uses the bundled Transformers.js runtime for
 * embeddings; when that dep is absent the feature stays silently disabled and
 * the code graph behaves exactly as before.
 *
 * Opt-in resolution order (first match wins):
 *   1. CODEGRAPH_DOCS env var (1/true/yes/on → on, 0/false/no/off → off).
 *   2. persisted project_metadata `docs_enabled` flag (set by `--with-docs`).
 *   3. default: off.
 *
 * The env var lets a single `codegraph index --with-docs` (which sets it for
 * the process) both index docs AND persist the flag, so subsequent CLI
 * runs pick it up from project_metadata without re-passing the flag.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';
/** Env var that force-enables / force-disables the docs feature. */
export declare const DOCS_ENV_VAR = "CODEGRAPH_DOCS";
/** project_metadata key under which the persisted opt-in flag lives. */
export declare const DOCS_META_KEY = "docs_enabled";
/** Embedding dimensionality (all-MiniLM-L6-v2). Shared by embed/db/search. */
export declare const EMBED_DIM = 384;
/** The CODEGRAPH_DOCS env override, or undefined when unset/unrecognized. */
export declare function docsEnvOverride(): boolean | undefined;
/**
 * Env var that force-enables / force-disables doc-graph promotion (doc/doc_link
 * nodes & edges). Independent of CODEGRAPH_DOCS: docs must be on for promotion
 * to run, but this gates whether `doc_links` get promoted into the graph.
 * Unset → auto-detect (pure-Markdown project). 1 → force on; 0 → force off.
 */
export declare const DOC_GRAPH_ENV_VAR = "CODEGRAPH_DOC_GRAPH";
/** The CODEGRAPH_DOC_GRAPH env override, or undefined when unset/unrecognized. */
export declare function docGraphEnvOverride(): boolean | undefined;
/** Persist the docs-enabled flag in project_metadata (idempotent upsert). */
export declare function setDocsEnabled(db: SqliteDatabase, enabled: boolean): void;
/** Read the persisted docs-enabled flag from project_metadata (false if absent). */
export declare function docsEnabledFromDb(db: SqliteDatabase): boolean;
/**
 * Resolve whether the docs feature is enabled for this run. The env var wins
 * (so `--with-docs` / CI can force it); otherwise the persisted project flag;
 * otherwise off. Pass the db to honor the persisted flag; omit it to consult
 * only the env override.
 */
export declare function resolveDocsEnabled(db?: SqliteDatabase): boolean;
//# sourceMappingURL=config.d.ts.map