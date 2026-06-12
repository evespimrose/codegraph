/**
 * Markdown docs feature — opt-in configuration.
 *
 * The docs feature (markdown vector indexing + hybrid search) is OFF by
 * default. It requires the optional `@xenova/transformers` dependency for
 * embeddings; when that dep is absent the feature stays silently disabled and
 * the code graph behaves exactly as before.
 *
 * Opt-in resolution order (first match wins):
 *   1. CODEGRAPH_DOCS env var (1/true/yes/on → on, 0/false/no/off → off).
 *   2. persisted project_metadata `docs_enabled` flag (set by `--with-docs`).
 *   3. default: off.
 *
 * The env var lets a single `codegraph index --with-docs` (which sets it for
 * the process) both index docs AND persist the flag, so subsequent MCP-server
 * runs pick it up from project_metadata without re-passing the flag.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';

/** Env var that force-enables / force-disables the docs feature. */
export const DOCS_ENV_VAR = 'CODEGRAPH_DOCS';

/** project_metadata key under which the persisted opt-in flag lives. */
export const DOCS_META_KEY = 'docs_enabled';

/** Embedding dimensionality (all-MiniLM-L6-v2). Shared by embed/db/search. */
export const EMBED_DIM = 384;

function parseBool(v: string | undefined | null): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return undefined;
}

/** The CODEGRAPH_DOCS env override, or undefined when unset/unrecognized. */
export function docsEnvOverride(): boolean | undefined {
  return parseBool(process.env[DOCS_ENV_VAR]);
}

/**
 * Env var that force-enables / force-disables doc-graph promotion (doc/doc_link
 * nodes & edges). Independent of CODEGRAPH_DOCS: docs must be on for promotion
 * to run, but this gates whether `doc_links` get promoted into the graph.
 * Unset → auto-detect (pure-Markdown project). 1 → force on; 0 → force off.
 */
export const DOC_GRAPH_ENV_VAR = 'CODEGRAPH_DOC_GRAPH';

/** The CODEGRAPH_DOC_GRAPH env override, or undefined when unset/unrecognized. */
export function docGraphEnvOverride(): boolean | undefined {
  return parseBool(process.env[DOC_GRAPH_ENV_VAR]);
}

/** Persist the docs-enabled flag in project_metadata (idempotent upsert). */
export function setDocsEnabled(db: SqliteDatabase, enabled: boolean): void {
  db.prepare(
    `INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(DOCS_META_KEY, enabled ? '1' : '0', Date.now());
}

/** Read the persisted docs-enabled flag from project_metadata (false if absent). */
export function docsEnabledFromDb(db: SqliteDatabase): boolean {
  try {
    const row = db
      .prepare('SELECT value FROM project_metadata WHERE key = ?')
      .get(DOCS_META_KEY) as { value?: string } | undefined;
    return parseBool(row?.value) ?? false;
  } catch {
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
export function resolveDocsEnabled(db?: SqliteDatabase): boolean {
  const env = docsEnvOverride();
  if (env !== undefined) return env;
  if (db) return docsEnabledFromDb(db);
  return false;
}
