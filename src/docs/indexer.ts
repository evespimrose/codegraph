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
  warnings: string[];
}

// Dirs whose docs are expected to carry a line-2 BLK tag; a missing BLK there
// only warns (never aborts). README/CHANGELOG/etc. are fine without one.
const GOVERNED_DIRS = ['cxt/', 'docs/contextmd/'];

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
  opts: { onWarn?: (msg: string) => void } = {}
): Promise<MarkdownIndexResult> {
  const result: MarkdownIndexResult = {
    enabled: false, available: false, scanned: 0, indexed: 0, skipped: 0, warnings: [],
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

  const files = listMarkdownFiles(projectRoot);
  result.scanned = files.length;

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
      
      const now = Date.now();
      for (const t of blkTags) {
        const nodeId = createHash('sha1').update(`${rel}::${t.tag}`).digest('hex');
        insNode.run(nodeId, t.tag, t.tag, rel, t.line, t.line, now);
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
