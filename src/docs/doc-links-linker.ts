/**
 * doc-links-linker — post-indexMarkdown pass that promotes the Obsidian/wiki
 * links already stored in `mdast_metadata.doc_links` (JSON) into first-class
 * graph rows: ONE `doc` node per Markdown file + a `doc_link` edge per
 * citing→cited reference. This lets the four core graph queries follow doc
 * links — `codegraph_callers` (= backlinks), `codegraph_callees` (= forward
 * links) and `codegraph_impact` — not just the separate `codegraph_backlinks`.
 *
 * Mirrors governs-linker: a deterministic pass run right after indexMarkdown,
 * sharing its phase-gap rationale (doc_links exist only once indexMarkdown has
 * parsed the files).
 *
 * Gated so code projects stay byte-identical:
 *   1. docs feature must be ON (resolveDocsEnabled) — else nothing was parsed.
 *   2. promotion must be ON — auto for pure-Markdown projects, or forced via
 *      CODEGRAPH_DOC_GRAPH (1/0). A code project with docs on but no override
 *      promotes ZERO rows → its code graph is untouched.
 *
 * Best-effort: any DB/shape error degrades to {0,0,0} with no side effect.
 *
 * Idempotency: `insertNode` is INSERT OR REPLACE; replacing a doc node
 * cascade-deletes its old `doc_link` edges (FK ON DELETE CASCADE, foreign_keys
 * pragma ON), and we rebuild them in the same pass — so a re-index leaves the
 * edge set unchanged.
 */
import { createHash } from 'crypto';
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { QueryBuilder } from '../db/queries';
import type { Edge } from '../types';
import { resolveDocsEnabled, docGraphEnvOverride } from './config';
import { baseName, parseRefs, normPath } from './links-util';

export interface DocLinkResult {
  /** `doc` nodes upserted (≈ one per indexed Markdown file). */
  nodes: number;
  /** `doc_link` edges created (citing → cited). */
  edges: number;
  /** links that resolved to no known doc (skipped, non-fatal). */
  skipped: number;
}

const ZERO: DocLinkResult = { nodes: 0, edges: 0, skipped: 0 };

/** Stable node id for a Markdown file's `doc` node. */
function docId(rel: string): string {
  return createHash('sha1').update(`doc::${normPath(rel)}`).digest('hex');
}

/** Drop a trailing file extension (e.g. "인물_강은휘.md" → "인물_강은휘"). */
function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/**
 * Is this a pure-Markdown project? True when the graph holds NO code nodes
 * (everything is `doc`/`concept`) AND at least one Markdown file is indexed.
 * Evaluated AFTER indexMarkdown so the code-node count is final — avoids the
 * mid-index timing trap where not all code nodes are in yet. (Markdown files
 * are NOT scanned as code, so they never create `file` nodes.)
 */
export function isPureMarkdownProject(db: SqliteDatabase): boolean {
  try {
    const code = db
      .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE kind NOT IN ('doc', 'concept')`)
      .get() as { n: number };
    if (Number(code.n) > 0) return false;
    const docs = db.prepare('SELECT COUNT(*) AS n FROM mdast_metadata').get() as { n: number };
    return Number(docs.n) > 0;
  } catch {
    return false;
  }
}

/** Should doc_links be promoted? Env override wins; else auto-detect pure-MD. */
export function shouldPromoteDocGraph(db: SqliteDatabase): boolean {
  return docGraphEnvOverride() ?? isPureMarkdownProject(db);
}

/**
 * Promote `mdast_metadata.doc_links` into `doc` nodes + `doc_link` edges.
 * Called by CodeGraph.indexAll/sync immediately after indexMarkdown.
 * Returns {0,0,0} when docs are off, promotion is gated off, or nothing indexed.
 */
export function linkDocEdges(db: SqliteDatabase, queries: QueryBuilder): DocLinkResult {
  // Gate 1 — docs feature off → never touch the graph.
  if (!resolveDocsEnabled(db)) return ZERO;
  // Gate 2 — promotion gated off (code project without override).
  if (!shouldPromoteDocGraph(db)) return ZERO;

  let rows: Array<{ file_path: string; doc_links: string | null }>;
  try {
    rows = db
      .prepare('SELECT file_path, doc_links FROM mdast_metadata')
      .all() as Array<{ file_path: string; doc_links: string | null }>;
  } catch {
    return ZERO; // mdast_metadata missing (docs forced on but never indexed)
  }
  if (rows.length === 0) return ZERO;

  // basename → full file_path. doc_links are stored as basenames (e.g.
  // "인물_강은휘.md"), so resolve them against full paths the same way
  // findBacklinks does (exact, then basename fallback).
  const basenameIndex = new Map<string, string>();
  for (const r of rows) basenameIndex.set(baseName(r.file_path), normPath(r.file_path));

  // 1) One `doc` node per Markdown file. Raw INSERT OR REPLACE mirrors how
  //    indexMarkdown creates concept nodes: `language='markdown'` is outside
  //    the code Language union by design, so the markdown layer bypasses the
  //    typed queries.insertNode (same precedent). MUST run before edges —
  //    insertEdges drops any edge whose endpoint node is absent.
  const insNode = db.prepare(`
    INSERT OR REPLACE INTO nodes
    (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
    VALUES (?, 'doc', ?, ?, ?, 'markdown', 1, 1, 0, 0, ?)
  `);
  const now = Date.now();
  let nodes = 0;
  for (const r of rows) {
    const rel = normPath(r.file_path);
    insNode.run(docId(rel), stripExt(baseName(rel)), rel, rel, now);
    nodes++;
  }

  // 2) A `doc_link` edge per resolved citing→cited reference (forward link).
  const edges: Edge[] = [];
  let skipped = 0;
  for (const r of rows) {
    const src = normPath(r.file_path);
    for (const link of parseRefs(r.doc_links)) {
      const resolved = basenameIndex.get(link) ?? basenameIndex.get(baseName(link));
      if (!resolved) {
        skipped++;
        continue;
      }
      if (resolved === src) continue; // self-link — ignore
      edges.push({
        source: docId(src),
        target: docId(resolved),
        kind: 'doc_link',
        provenance: 'heuristic',
        metadata: {
          synthesizedBy: 'doc-links-linker',
          registeredAt: 'src/index.ts:linkDocEdges',
        },
      });
    }
  }

  if (edges.length > 0) queries.insertEdges(edges);

  return { nodes, edges: edges.length, skipped };
}
