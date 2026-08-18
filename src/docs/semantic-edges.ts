/**
 * semantic-edges — post-indexMarkdown pass that turns the doc embeddings
 * already sitting in `mdast_vectors` into first-class `semantically_related`
 * doc↔doc edges, so `codegraph_callers`/`callees`/`impact` surface docs that
 * cover the same ground without anyone having linked them by hand.
 *
 * No embedding and no model load happen here: the vectors indexMarkdown wrote
 * are read back out of vec0 and fed straight to its own KNN, so this pass
 * touches neither `@xenova/transformers` nor the network. Which pairs survive
 * is semantic-pairs.ts; this file is the database half.
 *
 * Gated so existing graphs stay byte-identical:
 *   1. CODEGRAPH_SEMANTIC_EDGES (or the persisted flag) must be on — off by default.
 *   2. docs must be on, else nothing was embedded.
 *   3. doc-graph promotion must be on, else the `doc` nodes these edges connect
 *      do not exist (linkDocEdges creates them).
 *
 * Best-effort: any DB/shape error degrades to {0,0} with no side effect.
 *
 * A pair is undirected but stored once, low rowid → high. callers and callees
 * between them cover both ends; getImpactRadius walks incoming edges only, so
 * there the relation is visible from the higher end alone.
 */
import { createHash } from 'crypto';
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { QueryBuilder } from '../db/queries';
import type { Edge } from '../types';
import {
  resolveDocsEnabled,
  resolveSemanticEdgesEnabled,
  getProjectMeta,
  setProjectMeta,
  SEMANTIC_EDGES_META_KEY,
} from './config';
import { loadVecExtension } from './vec';
import { docId, shouldPromoteDocGraph } from './doc-links-linker';
import {
  cosineFromL2,
  selectPairs,
  DEFAULT_TOP_K,
  DEFAULT_MIN_SIMILARITY,
  type SemanticNeighbor,
  type SemanticPair,
} from './semantic-pairs';

const MAX_TOP_K = 50;

/** Decimals kept in `metadata.similarity`, enough to rank but not to churn. */
const SIMILARITY_SCALE = 10_000;

/** project_metadata key holding the corpus+params digest of the last build. */
const DIGEST_META_KEY = 'semantic_edges_fingerprint';

const EDGE_KIND = 'semantically_related';

export interface SemanticEdgeOptions {
  topK?: number;
  minSimilarity?: number;
}

export interface SemanticEdgeResult {
  /** `semantically_related` edges written. */
  created: number;
  /** KNN candidates rejected by the threshold, the top-K cut, or as a duplicate pair. */
  skipped: number;
}

const ZERO: SemanticEdgeResult = { created: 0, skipped: 0 };

interface DocRow {
  id: number;
  file_path: string;
}

function clampInt(value: number, low: number, high: number): number {
  const rounded = Math.trunc(Number(value));
  if (!Number.isFinite(rounded)) return low;
  return rounded < low ? low : rounded > high ? high : rounded;
}

/** Bind-ready copy of a BLOB column, whichever typed array the driver returned. */
function toBuffer(blob: Uint8Array): Buffer {
  return Buffer.isBuffer(blob) ? blob : Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
}

/**
 * Digest of every doc's content hash plus the tuning parameters. Any add,
 * delete, edit, or parameter change moves it, and nothing else does. Null when
 * the corpus cannot be read, which just costs an unnecessary rebuild.
 */
function corpusDigest(db: SqliteDatabase, topK: number, minSimilarity: number): string | null {
  try {
    const rows = db
      .prepare('SELECT id, content_hash FROM mdast_metadata ORDER BY id')
      .all() as Array<{ id: number; content_hash: string | null }>;
    const hash = createHash('sha1').update(`k=${topK};min=${minSimilarity};`);
    for (const row of rows) hash.update(`${row.id}:${row.content_hash ?? ''};`);
    return hash.digest('hex');
  } catch {
    return null;
  }
}

function countEdges(db: SqliteDatabase): number {
  try {
    const row = db
      .prepare('SELECT COUNT(*) AS total FROM edges WHERE kind = ?')
      .get(EDGE_KIND) as { total: number };
    return Number(row.total);
  } catch {
    return 0; // edges table unreadable — treat as nothing built
  }
}

/**
 * Each document's nearest neighbours, by handing its own stored vector back to
 * vec0 as the query. Null when the KNN shape is not what we expect, which the
 * caller turns into a no-op rather than a partial edge set.
 */
function knnSearch(db: SqliteDatabase, docs: DocRow[], topK: number): SemanticNeighbor[] | null {
  const vectorQuery = db.prepare('SELECT embedding FROM mdast_vectors WHERE rowid = ?');
  // `k` is inlined as a validated integer literal: node:sqlite binds JS numbers
  // as REAL, which the vec0 `k =` constraint rejects. Only the query vector (a
  // BLOB) is bound. topK + 1 leaves room for the doc's own zero-distance hit.
  const knnQuery = db.prepare(
    `SELECT rowid, distance FROM mdast_vectors WHERE embedding MATCH ? AND k = ${topK + 1} ORDER BY distance`
  );

  const neighbors: SemanticNeighbor[] = [];
  try {
    for (const doc of docs) {
      const stored = vectorQuery.get(BigInt(doc.id)) as { embedding?: Uint8Array } | undefined;
      if (!stored?.embedding) continue; // metadata row with no vector yet
      const hits = knnQuery.all(toBuffer(stored.embedding)) as Array<{
        rowid: number | bigint;
        distance: number;
      }>;
      for (const hit of hits) {
        neighbors.push({
          from: doc.id,
          to: Number(hit.rowid),
          similarity: cosineFromL2(Number(hit.distance)),
        });
      }
    }
  } catch {
    return null;
  }
  return neighbors;
}

function toEdges(pairs: SemanticPair[], pathById: Map<number, string>): Edge[] {
  const edges: Edge[] = [];
  for (const pair of pairs) {
    const from = pathById.get(pair.a);
    const to = pathById.get(pair.b);
    if (!from || !to) continue;
    edges.push({
      source: docId(from),
      target: docId(to),
      kind: EDGE_KIND,
      provenance: 'heuristic',
      metadata: {
        similarity: Math.round(pair.similarity * SIMILARITY_SCALE) / SIMILARITY_SCALE,
        synthesizedBy: 'semantic-edges',
        registeredAt: 'src/index.ts:buildSemanticEdges',
      },
    });
  }
  return edges;
}

/**
 * Rebuild the `semantically_related` edge set from `mdast_vectors`.
 * Called by CodeGraph.indexAll/sync right after linkDocEdges.
 *
 * The rebuild is always whole-corpus. Top-K neighbourhoods are not separable
 * per pair — one document's new embedding can enter or leave the top-K of
 * arbitrarily many others — so a partial update would leave a quietly stale
 * graph. Cost is contained by the digest check instead, which skips the pass
 * entirely while the corpus and parameters are untouched.
 */
export function buildSemanticEdges(
  db: SqliteDatabase,
  queries: QueryBuilder,
  opts: SemanticEdgeOptions = {}
): SemanticEdgeResult {
  if (!resolveSemanticEdgesEnabled(db)) return ZERO;
  if (!resolveDocsEnabled(db)) return ZERO;
  if (!shouldPromoteDocGraph(db)) return ZERO;
  if (!loadVecExtension(db)) return ZERO;

  const topK = clampInt(opts.topK ?? DEFAULT_TOP_K, 1, MAX_TOP_K);
  const minSimilarity = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  let docs: DocRow[];
  try {
    docs = db.prepare('SELECT id, file_path FROM mdast_metadata ORDER BY id').all() as DocRow[];
  } catch {
    return ZERO; // mdast_metadata missing (docs forced on but never indexed)
  }
  if (docs.length < 2) return ZERO;

  // Skipping needs BOTH an unchanged corpus and edges still on disk. linkDocEdges
  // runs first and re-inserts every `doc` node, which cascade-deletes each one's
  // edges — including the ones built here on the previous pass. Trusting the
  // digest alone would leave them deleted until the next doc edit.
  const digest = corpusDigest(db, topK, minSimilarity);
  if (digest && digest === getProjectMeta(db, DIGEST_META_KEY) && countEdges(db) > 0) {
    return ZERO;
  }

  const neighbors = knnSearch(db, docs, topK);
  if (!neighbors) return ZERO;

  const { pairs, skipped } = selectPairs(neighbors, { topK, minSimilarity });
  const edges = toEdges(pairs, new Map(docs.map((doc) => [doc.id, doc.file_path])));

  // `edges` has no unique constraint, so INSERT OR IGNORE would stack duplicates
  // on re-run. Clearing this kind first is what makes the pass idempotent, and
  // it keeps that guarantee independent of whether linkDocEdges ran before us.
  try {
    db.prepare('DELETE FROM edges WHERE kind = ?').run(EDGE_KIND);
    queries.insertEdges(edges);
  } catch {
    return ZERO; // write failed — leave the previous state alone
  }

  // Endpoints missing a `doc` node are dropped by insertEdges, so count rows.
  const created = countEdges(db);
  try {
    if (digest) setProjectMeta(db, DIGEST_META_KEY, digest);
    setProjectMeta(db, SEMANTIC_EDGES_META_KEY, '1');
  } catch {
    /* metadata is an optimization: without it the next run just rebuilds */
  }

  return { created, skipped };
}
