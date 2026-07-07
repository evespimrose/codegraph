/**
 * Markdown indexer — the write-path for the docs vector store.
 *
 * Scans the project's Markdown files, embeds each into the sqlite-vec `vec0`
 * table, and records metadata (BLK tag, code_refs, summary, content hash) in
 * mdast_metadata — all inside the SAME codegraph.db (no ATTACH; merged
 * topology). Incremental: a doc whose content hash is unchanged is skipped.
 *
 * Fully gated and best-effort: when the docs feature is off, or sqlite-vec /
 * @xenova/transformers are unavailable, it is a no-op that leaves the code
 * graph untouched. This reconstructs the `scan.mjs` write-path that
 * codegraph-mdast referenced but never shipped.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { SqliteDatabase } from '../db/sqlite-adapter';
import { EMBED_DIM, resolveDocsEnabled, setDocsEnabled } from './config';
import { loadVecExtension, floatBlob } from './vec';
import { parseDoc, extractBlkTags } from './parse';
import { embed, isEmbedAvailable } from './embed';
import { listMarkdownFiles } from './scan-files';

export interface MarkdownIndexResult {
  /** docs feature opted in? */
  enabled: boolean;
  /** sqlite-vec + transformers both usable? */
  available: boolean;
  scanned: number;
  indexed: number;
  skipped: number;
  /** Docs deleted from disk whose index entries were reconciled away. */
  removed: number;
  warnings: string[];
}

// Dirs whose docs are expected to carry a line-2 BLK tag; a missing BLK there
// only warns (never aborts). README/CHANGELOG/etc. are fine without one.
// Also used as the canonical-doc set for concept node creation: only docs
// under these prefixes produce concept nodes (and become governs edge targets).
// Projects that don't use BLK tags at all are unaffected — concept creation
// is gated on blkTags being non-empty, so the guard is a no-op for them.
export const GOVERNED_DIRS = ['cxt/', 'docs/contextmd/', 'manage/'];

/** Create the vec0 vector table (idempotent). Requires sqlite-vec loaded. */
export function ensureVectorTable(db: SqliteDatabase): void {
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS mdast_vectors USING vec0(embedding float[${EMBED_DIM}]);`
  );
}

/**
 * Index (or incrementally refresh) the project's Markdown into the vector
 * store. Never throws for expected-missing-capability reasons — returns a
 * result with `enabled`/`available` flags and any warnings instead.
 */
export async function indexMarkdown(
  db: SqliteDatabase,
  projectRoot: string,
  opts: { onWarn?: (msg: string) => void; respectGitignore?: boolean } = {}
): Promise<MarkdownIndexResult> {
  const result: MarkdownIndexResult = {
    enabled: false, available: false, scanned: 0, indexed: 0, skipped: 0, removed: 0, warnings: [],
  };

  // Gate 1 — opt-in (env CODEGRAPH_DOCS or persisted project flag).
  if (!resolveDocsEnabled(db)) return result;
  result.enabled = true;

  // Gate 2 — sqlite-vec extension (graceful: false rather than throw).
  if (!loadVecExtension(db)) {
    pushWarn(result, opts, 'sqlite-vec unavailable — Markdown vector indexing skipped.');
    return result;
  }
  // Gate 3 — embeddings dependency.
  if (!(await isEmbedAvailable())) {
    pushWarn(result, opts, '@xenova/transformers not installed — run "npm i @xenova/transformers" to enable doc embeddings.');
    return result;
  }
  result.available = true;

  // Persist the opt-in so MCP-server runs (which have no env var) still see it.
  try { setDocsEnabled(db, true); } catch { /* non-fatal */ }

  ensureVectorTable(db);

  const selHash = db.prepare('SELECT content_hash FROM mdast_metadata WHERE file_path = ?');
  const upMeta = db.prepare(
    `INSERT INTO mdast_metadata (file_path, blk_tags, code_refs, doc_links, content_summary, content_hash, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(file_path) DO UPDATE SET
       blk_tags=excluded.blk_tags, code_refs=excluded.code_refs,
       doc_links=excluded.doc_links,
       content_summary=excluded.content_summary, content_hash=excluded.content_hash,
       last_updated=excluded.last_updated`
  );
  const getId = db.prepare('SELECT id FROM mdast_metadata WHERE file_path = ?');
  const delVec = db.prepare('DELETE FROM mdast_vectors WHERE rowid = ?');
  const insVec = db.prepare('INSERT INTO mdast_vectors(rowid, embedding) VALUES(?, ?)');
  const insNode = db.prepare(`
    INSERT OR REPLACE INTO nodes 
    (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
    VALUES (?, 'concept', ?, ?, ?, 'markdown', ?, ?, 0, 0, ?)
  `);

  const files = listMarkdownFiles(projectRoot, { respectGitignore: opts.respectGitignore });
  result.scanned = files.length;

  // Deletion reconciliation (2026-07-02 실측 결함): a doc deleted from disk
  // used to survive in the index forever — neither the live watcher sync nor
  // the post-open catch-up removed it, so stale docs polluted search. Both
  // paths funnel through indexMarkdown, so reconciling here covers both:
  // any DB doc absent from the just-scanned disk set loses its metadata row,
  // vector, and that file's markdown-language nodes (doc/concept) + their
  // edges. Content-hash incrementality for surviving docs is untouched.
  try {
    const diskRels = new Set(files.map((abs) => normalizeRel(projectRoot, abs)));
    const dbDocs = db.prepare('SELECT id, file_path FROM mdast_metadata').all() as Array<{
      id: number; file_path: string;
    }>;
    const orphans = dbDocs.filter((d) => !diskRels.has(d.file_path));
    if (orphans.length > 0) {
      const delMeta = db.prepare('DELETE FROM mdast_metadata WHERE id = ?');
      const selNodeIds = db.prepare(`SELECT id FROM nodes WHERE file_path = ? AND language = 'markdown'`);
      const delEdge = db.prepare('DELETE FROM edges WHERE source = ? OR target = ?');
      const delNodes = db.prepare(`DELETE FROM nodes WHERE file_path = ? AND language = 'markdown'`);
      db.transaction(() => {
        for (const o of orphans) {
          delVec.run(BigInt(o.id));
          delMeta.run(o.id);
          const nodeRows = selNodeIds.all(o.file_path) as Array<{ id: string }>;
          for (const n of nodeRows) delEdge.run(n.id, n.id);
          delNodes.run(o.file_path);
        }
      })();
      result.removed = orphans.length;
    }
  } catch (e) {
    // Reconciliation is best-effort — never fail the indexing pass over it.
    pushWarn(result, opts, `doc deletion reconciliation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  for (const abs of files) {
    const rel = normalizeRel(projectRoot, abs);
    let raw: string;
    try {
      raw = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue; // unreadable — skip silently
    }

    const hash = createHash('sha1').update(raw).digest('hex');
    const existing = selHash.get(rel) as { content_hash?: string } | undefined;
    if (existing && existing.content_hash === hash) {
      result.skipped++;
      continue;
    }

    const parsed = parseDoc(raw);
    const blkTags = extractBlkTags(raw);
    if (!parsed.blk && GOVERNED_DIRS.some((d) => rel.startsWith(d))) {
      pushWarn(result, opts, `${rel}: missing line-2 <!-- BLK: BLK-XXX --> tag`);
    }

    let vec: Float32Array;
    try {
      vec = await embed(`${parsed.title ?? ''}\n${parsed.summary}`);
    } catch (e) {
      // First embed failed (e.g. model fetch blocked). Abort the pass — nothing
      // else will embed either — but leave already-indexed docs intact.
      pushWarn(result, opts, `embedding failed: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }

    // Metadata upsert + vector replace, atomically. The metadata row's stable
    // integer id IS the vec0 rowid (node:sqlite binds rowids as BigInt).
    db.transaction(() => {
      upMeta.run(
        rel,
        parsed.blk,
        parsed.codeRefs ? JSON.stringify(parsed.codeRefs) : null,
        parsed.docLinks ? JSON.stringify(parsed.docLinks) : null,
        parsed.summary,
        hash
      );
      const row = getId.get(rel) as { id: number };
      const rowid = BigInt(row.id);
      delVec.run(rowid);             // drop any stale vector for this rowid
      insVec.run(rowid, floatBlob(vec));
      
      // concept nodes are only created for canonical docs (GOVERNED_DIRS).
      // Non-canonical mentions (memory-bank, verification reports, etc.) are
      // deliberately excluded to prevent duplicate / noisy concept nodes.
      // Projects that don't use BLK tags produce empty blkTags → no-op.
      const isCanonicalDoc = GOVERNED_DIRS.some((d) => rel.startsWith(d));
      if (isCanonicalDoc) {
        const now = Date.now();
        for (const t of blkTags) {
          const nodeId = createHash('sha1').update(`${rel}::${t.tag}`).digest('hex');
          insNode.run(nodeId, t.tag, t.tag, rel, t.line, t.line, now);
        }
      }
    })();
    result.indexed++;
  }

  return result;
}

function pushWarn(
  result: MarkdownIndexResult,
  opts: { onWarn?: (msg: string) => void },
  msg: string
): void {
  result.warnings.push(msg);
  opts.onWarn?.(msg);
}

function normalizeRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}
