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

/**
 * Env var that enables the `semantically_related` doc↔doc edge pass. Docs must
 * also be on (the pass reads the embeddings indexMarkdown wrote). Unset → off:
 * unlike doc-graph promotion there is no auto-detect, because the pass adds
 * derived edges rather than promoting something the user already authored.
 */
export const SEMANTIC_EDGES_ENV_VAR = 'CODEGRAPH_SEMANTIC_EDGES';

/** project_metadata key under which the persisted semantic-edges flag lives. */
export const SEMANTIC_EDGES_META_KEY = 'semantic_edges_enabled';

/** The CODEGRAPH_SEMANTIC_EDGES env override, or undefined when unset/unrecognized. */
export function semanticEdgesEnvOverride(): boolean | undefined {
  return parseBool(process.env[SEMANTIC_EDGES_ENV_VAR]);
}

/** Read a project_metadata value, or null when absent or the table predates v2. */
export function getProjectMeta(db: SqliteDatabase, key: string): string | null {
  try {
    const row = db
      .prepare('SELECT value FROM project_metadata WHERE key = ?')
      .get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null; // pre-v2 DB has no project_metadata — same as unset
  }
}

/** Write a project_metadata value (idempotent upsert). */
export function setProjectMeta(db: SqliteDatabase, key: string, value: string): void {
  db.prepare(
    `INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, Date.now());
}

/**
 * Resolve whether the semantic-edges pass runs. Same order as
 * {@link resolveDocsEnabled}: env override, then the persisted project flag,
 * then off — so an MCP-server sync (which has no env var) keeps rebuilding the
 * edges a `CODEGRAPH_SEMANTIC_EDGES=1` index turned on.
 */
export function resolveSemanticEdgesEnabled(db?: SqliteDatabase): boolean {
  const env = semanticEdgesEnvOverride();
  if (env !== undefined) return env;
  if (!db) return false;
  return parseBool(getProjectMeta(db, SEMANTIC_EDGES_META_KEY)) ?? false;
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
