/**
 * Hybrid Markdown search — the read-path for the docs vector store.
 *
 * Two public entry points, both operating on the SAME codegraph.db (no ATTACH;
 * merged topology):
 *
 *   - searchDocs()        — semantic search. Embeds the query, runs a vec0 KNN
 *                           over mdast_vectors, joins back to mdast_metadata,
 *                           and resolves each doc's frontmatter `code_refs` to
 *                           concrete code symbols in `nodes`. Returns a COMPACT
 *                           payload (summary ≤ SUMMARY_CAP + symbol pointers) so
 *                           it can be inlined into MCP output cheaply.
 *
 *   - findGoverningDocs() — pure metadata lookup (no embeddings, no sqlite-vec):
 *                           given code file paths, return the docs whose
 *                           `code_refs` govern them. This is the relevance GATE
 *                           used by node/impact augmentation — it must work even
 *                           when sqlite-vec / transformers are absent, and must
 *                           return [] (silent) rather than throw on any
 *                           pre-docs / disabled / empty state.
 *
 * Fully gated and best-effort: when the docs feature is off, or the optional
 * deps are unavailable, or nothing has been indexed yet, both functions degrade
 * to an empty result with zero effect on the code graph. Reconstructs the
 * `search.mjs` read-path that codegraph-mdast referenced.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';
import { resolveDocsEnabled } from './config';
import { loadVecExtension, floatBlob } from './vec';
import { embed, isEmbedAvailable } from './embed';

/** Compact summary cap for inlined payloads (chars). */
const SUMMARY_CAP = 200;
/** Default number of nearest docs to return. */
const DEFAULT_TOPK = 8;
/** Default cap on resolved code symbols per doc hit. */
const DEFAULT_CODE_LIMIT = 8;
/** Hard ceiling on topk (also bounds the inlined vec0 `k` literal). */
const MAX_TOPK = 50;

/**
 * Node kinds worth surfacing as a doc's "related symbols". Deliberately
 * excludes noise (variable/field/parameter/import/export/property/constant/
 * enum_member) so the pointer list stays high-signal.
 */
const SYMBOL_KINDS = [
  'class', 'struct', 'interface', 'trait', 'protocol',
  'function', 'method', 'enum', 'type_alias', 'namespace',
  'module', 'component', 'route',
];

/** A code symbol resolved from a governing doc's `code_refs`. */
export interface DocCodeSymbol {
  symbol: string;
  kind: string;
  file: string;
  line: number;
  signature: string | null;
}

/** One ranked doc with its compact summary + resolved code pointers. */
export interface DocHit {
  /** Markdown file path (project-relative, forward slashes). */
  file: string;
  /** BLK tag from line 2, or null. */
  blk: string | null;
  /** Compact prose summary (≤ SUMMARY_CAP chars). */
  summary: string;
  /** vec0 distance (smaller = nearer). */
  distance: number;
  /** Raw governed code files from frontmatter `code_refs`. */
  codeRefs: string[];
  /** Code symbols resolved from `codeRefs` via `nodes` (capped). */
  symbols: DocCodeSymbol[];
}

export interface SearchDocsResult {
  /** docs feature opted in? */
  enabled: boolean;
  /** sqlite-vec + transformers both usable? */
  available: boolean;
  hits: DocHit[];
  warnings: string[];
}

export interface GoverningDoc {
  file: string;
  blk: string | null;
  summary: string;
  codeRefs: string[];
}

export interface DocLinksResult {
  file: string;
  forwardLinks: string[];
  backLinks: string[];
}

export interface SearchDocsOptions {
  topk?: number;
  codeLimit?: number;
}

/**
 * Semantic search over indexed Markdown. Returns ranked docs with compact
 * summaries and the code symbols their `code_refs` govern. Never throws for
 * expected-missing-capability reasons — returns `enabled`/`available` flags and
 * any warnings, with an empty `hits` array, instead.
 */
export async function searchDocs(
  db: SqliteDatabase,
  query: string,
  opts: SearchDocsOptions = {}
): Promise<SearchDocsResult> {
  const result: SearchDocsResult = {
    enabled: false, available: false, hits: [], warnings: [],
  };

  // Gate 1 — opt-in (env CODEGRAPH_DOCS or persisted project flag).
  if (!resolveDocsEnabled(db)) return result;
  result.enabled = true;

  const q = (query ?? '').trim();
  if (!q) return result; // nothing to embed

  // Gate 2 — sqlite-vec extension (graceful: warn rather than throw).
  if (!loadVecExtension(db)) {
    result.warnings.push('sqlite-vec unavailable — Markdown vector search skipped.');
    return result;
  }
  // Gate 3 — embeddings dependency.
  if (!(await isEmbedAvailable())) {
    result.warnings.push('@xenova/transformers not installed — run "npm i @xenova/transformers" to enable doc search.');
    return result;
  }
  result.available = true;

  // No docs indexed yet → empty (do NOT create the table on the read path).
  if (!tableExists(db, 'mdast_vectors')) return result;

  let qvec: Float32Array;
  try {
    qvec = await embed(q);
  } catch (e) {
    result.warnings.push(`embedding failed: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }

  const topk = clampInt(opts.topk ?? DEFAULT_TOPK, 1, MAX_TOPK);
  const codeLimit = clampInt(opts.codeLimit ?? DEFAULT_CODE_LIMIT, 0, 100);

  // KNN. `k` is inlined as a validated integer literal: node:sqlite binds JS
  // numbers as REAL, which the vec0 `k =` constraint rejects, so a bound param
  // is unsafe here. Only the query vector (a BLOB) is bound.
  let knn: Array<{ rowid: number | bigint; distance: number }>;
  try {
    knn = db
      .prepare(`SELECT rowid, distance FROM mdast_vectors WHERE embedding MATCH ? AND k = ${topk} ORDER BY distance`)
      .all(floatBlob(qvec)) as Array<{ rowid: number | bigint; distance: number }>;
  } catch (e) {
    result.warnings.push(`vector query failed: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }
  if (knn.length === 0) return result;

  const idOrder = knn.map((r) => Number(r.rowid));
  const distById = new Map<number, number>();
  for (const r of knn) distById.set(Number(r.rowid), Number(r.distance));

  // Doc metadata for the matched rowids (rowid === mdast_metadata.id).
  const metaPh = idOrder.map(() => '?').join(',');
  const metaRows = db
    .prepare(
      `SELECT id, file_path, blk_tags, code_refs, content_summary
       FROM mdast_metadata WHERE id IN (${metaPh})`
    )
    .all(...idOrder) as Array<MetaRow>;
  // Re-impose KNN (distance) order; the IN() query returns rows unordered.
  metaRows.sort((a, b) => (distById.get(a.id) ?? Infinity) - (distById.get(b.id) ?? Infinity));

  // Collect every governed code file across all hits → resolve symbols once.
  const refsByDoc = new Map<number, string[]>();
  const allRefs = new Set<string>();
  for (const m of metaRows) {
    const refs = parseRefs(m.code_refs);
    refsByDoc.set(m.id, refs);
    for (const f of refs) allRefs.add(f);
  }
  const symbolsByFile = resolveSymbols(db, [...allRefs]);

  for (const m of metaRows) {
    const refs = refsByDoc.get(m.id) ?? [];
    const symbols: DocCodeSymbol[] = [];
    for (const f of refs) {
      const fileSyms = symbolsByFile.get(f);
      if (fileSyms) symbols.push(...fileSyms);
      if (symbols.length >= codeLimit) break;
    }
    result.hits.push({
      file: m.file_path,
      blk: m.blk_tags ?? null,
      summary: truncate(m.content_summary ?? '', SUMMARY_CAP),
      distance: round4(distById.get(m.id) ?? 0),
      codeRefs: refs,
      symbols: symbols.slice(0, codeLimit),
    });
  }

  return result;
}

/**
 * Relevance gate: docs whose `code_refs` govern any of `filePaths`. Pure
 * metadata — needs neither sqlite-vec nor transformers — and swallows every
 * error (pre-v5 DB, disabled feature, empty input) into a `[]` so callers can
 * use it as a silent "is there a governing doc?" check.
 */
export function findGoverningDocs(db: SqliteDatabase, filePaths: string[]): GoverningDoc[] {
  if (!resolveDocsEnabled(db)) return [];
  if (!filePaths || filePaths.length === 0) return [];
  const targets = filePaths.map(normPath).filter(Boolean);
  if (targets.length === 0) return [];

  try {
    const rows = db
      .prepare(
        `SELECT file_path, blk_tags, code_refs, content_summary
         FROM mdast_metadata WHERE code_refs IS NOT NULL`
      )
      .all() as Array<MetaRow>;

    const out: GoverningDoc[] = [];
    for (const r of rows) {
      const refs = parseRefs(r.code_refs);
      if (refs.length === 0) continue;
      const governs = refs.some((ref) => targets.some((t) => pathMatches(ref, t)));
      if (governs) {
        out.push({
          file: r.file_path,
          blk: r.blk_tags ?? null,
          summary: truncate(r.content_summary ?? '', SUMMARY_CAP),
          codeRefs: refs,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Finds both forward links (documents the target references) and backlinks
 * (documents that reference the target) for a given Markdown file.
 * Requires the docs feature to be enabled and the file to be indexed.
 */
export function findBacklinks(db: SqliteDatabase, filePath: string, maxDepth: number = 1): DocLinksResult | null {
  if (!resolveDocsEnabled(db)) return null;
  const target = normPath(filePath);
  if (!target) return null;

  try {
    // 1. Get forward links (what target references)
    const forwardRow = db
      .prepare('SELECT doc_links FROM mdast_metadata WHERE file_path = ?')
      .get(target) as { doc_links: string | null } | undefined;
    
    if (!forwardRow) return null; // Document not found in DB

    const forwardLinks = parseRefs(forwardRow.doc_links);

    // 2. Get backlinks (who references target) recursively using CTE
    const sql = `
      WITH RECURSIVE chain(file_path, depth) AS (
        SELECT file_path, 1 FROM mdast_metadata
        WHERE doc_links LIKE ?
        UNION
        SELECT m.file_path, c.depth + 1
        FROM mdast_metadata m
        JOIN chain c ON m.doc_links LIKE '%"' || c.file_path || '"%'
        WHERE c.depth < ?
      )
      SELECT DISTINCT file_path FROM chain;
    `;
    
    const backRows = db
      .prepare(sql)
      .all('%"' + target + '"%', maxDepth) as Array<{ file_path: string }>;
    
    const backLinks = backRows.map(row => row.file_path);

    return {
      file: target,
      forwardLinks,
      backLinks
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

interface MetaRow {
  id: number;
  file_path: string;
  blk_tags: string | null;
  code_refs: string | null;
  doc_links: string | null;
  content_summary: string | null;
}

/** Resolve governed code files → high-signal symbols grouped by file. */
function resolveSymbols(db: SqliteDatabase, files: string[]): Map<string, DocCodeSymbol[]> {
  const byFile = new Map<string, DocCodeSymbol[]>();
  if (files.length === 0) return byFile;

  const filePh = files.map(() => '?').join(',');
  const kindPh = SYMBOL_KINDS.map(() => '?').join(',');
  let rows: Array<{
    name: string; kind: string; file_path: string; start_line: number; signature: string | null;
  }>;
  try {
    rows = db
      .prepare(
        `SELECT name, kind, file_path, start_line, signature
         FROM nodes
         WHERE file_path IN (${filePh}) AND kind IN (${kindPh})
         ORDER BY file_path, start_line`
      )
      .all(...files, ...SYMBOL_KINDS) as typeof rows;
  } catch {
    return byFile; // nodes table shape changed / query failed — no symbols
  }

  for (const n of rows) {
    const arr = byFile.get(n.file_path) ?? [];
    arr.push({
      symbol: n.name,
      kind: n.kind,
      file: n.file_path,
      line: Number(n.start_line),
      signature: n.signature ?? null,
    });
    byFile.set(n.file_path, arr);
  }
  return byFile;
}

/** Does a table/virtual-table/view named `name` exist? (sqlite_master is plain.) */
function tableExists(db: SqliteDatabase, name: string): boolean {
  try {
    const row = db.prepare('SELECT 1 AS x FROM sqlite_master WHERE name = ? LIMIT 1').get(name);
    return !!row;
  } catch {
    return false;
  }
}

/** Parse a `code_refs` JSON column into a string[] (defensive). */
function parseRefs(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Normalize a path for comparison: backslashes → '/', drop leading './'. */
function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

/** Path equality with segment-boundary suffix tolerance (rel vs absolute). */
function pathMatches(a: string, b: string): boolean {
  const x = normPath(a);
  const y = normPath(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.endsWith('/' + y) || y.endsWith('/' + x);
}

function truncate(s: string, cap: number): string {
  return s.length > cap ? s.slice(0, cap).trimEnd() + '…' : s;
}

function clampInt(n: number, lo: number, hi: number): number {
  const v = Math.floor(Number.isFinite(n) ? n : lo);
  return Math.max(lo, Math.min(hi, v));
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
