import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodeGraph } from '../src';
import { EMBED_DIM, setDocsEnabled, SEMANTIC_EDGES_ENV_VAR } from '../src/docs/config';
import { ensureVectorTable } from '../src/docs/indexer';
import { linkDocEdges } from '../src/docs/doc-links-linker';
import { isVecAvailable, loadVecExtension, floatBlob } from '../src/docs/vec';
import { buildSemanticEdges } from '../src/docs/semantic-edges';
import {
  cosineFromL2,
  selectPairs,
  DEFAULT_TOP_K,
  type SemanticNeighbor,
} from '../src/docs/semantic-pairs';
import type { QueryBuilder } from '../src/db/queries';
import type { SqliteDatabase } from '../src/db/sqlite-adapter';

// The integration cases seed `mdast_vectors` with hand-built unit vectors, so
// they exercise the real vec0 KNN path without @xenova/transformers — which is
// also the proof that this pass never embeds anything.

const SQRT2 = Math.SQRT2;

describe('cosineFromL2', () => {
  it('inverts the L2 distance between unit vectors', () => {
    expect(cosineFromL2(0)).toBeCloseTo(1, 10);        // identical
    expect(cosineFromL2(SQRT2)).toBeCloseTo(0, 10);    // orthogonal
    expect(cosineFromL2(2)).toBeCloseTo(-1, 10);       // opposite
  });

  it('clamps a non-unit vector back into [-1, 1]', () => {
    expect(cosineFromL2(3)).toBe(-1);
    expect(cosineFromL2(0.0001)).toBeLessThan(1);
  });
});

describe('selectPairs', () => {
  const opts = { topK: 2, minSimilarity: 0.75 };

  it('drops the self-match vec0 always ranks first', () => {
    const { pairs } = selectPairs([{ from: 1, to: 1, similarity: 1 }], opts);
    expect(pairs).toEqual([]);
  });

  it('cuts neighbours below the similarity floor', () => {
    const neighbors: SemanticNeighbor[] = [
      { from: 1, to: 2, similarity: 0.9 },
      { from: 1, to: 3, similarity: 0.5 },
    ];
    const { pairs, skipped } = selectPairs(neighbors, opts);
    expect(pairs).toEqual([{ a: 1, b: 2, similarity: 0.9 }]);
    expect(skipped).toBe(1);
  });

  it('caps each document at topK neighbours, keeping the closest', () => {
    const neighbors: SemanticNeighbor[] = [
      { from: 1, to: 2, similarity: 0.80 },
      { from: 1, to: 3, similarity: 0.95 },
      { from: 1, to: 4, similarity: 0.90 },
    ];
    const { pairs, skipped } = selectPairs(neighbors, opts);
    expect(pairs.map((p) => p.b)).toEqual([3, 4]);
    expect(skipped).toBe(1);
  });

  it('collapses (a,b) and (b,a) into one pair at the higher score', () => {
    const neighbors: SemanticNeighbor[] = [
      { from: 1, to: 2, similarity: 0.90 },
      { from: 2, to: 1, similarity: 0.92 },
    ];
    const { pairs, skipped } = selectPairs(neighbors, opts);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ a: 1, b: 2, similarity: 0.92 });
    expect(skipped).toBe(1);
  });

  it('always normalizes a pair to (lower rowid, higher rowid)', () => {
    const { pairs } = selectPairs([{ from: 9, to: 4, similarity: 0.9 }], opts);
    expect(pairs[0]).toMatchObject({ a: 4, b: 9 });
  });

  it('stays within the topK x document-count bound', () => {
    const neighbors: SemanticNeighbor[] = [];
    for (let from = 1; from <= 6; from++) {
      for (let to = 1; to <= 6; to++) neighbors.push({ from, to, similarity: 0.99 });
    }
    const { pairs } = selectPairs(neighbors, opts);
    expect(pairs.length).toBeLessThanOrEqual(opts.topK * 6);
  });
});

/** Unit vector of EMBED_DIM with the given leading components. */
function unitVec(...head: number[]): Float32Array {
  const v = new Float32Array(EMBED_DIM);
  v.set(head.slice(0, EMBED_DIM));
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

function getDbAndQueries(cg: CodeGraph): { db: SqliteDatabase; queries: QueryBuilder } {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: (cg as any).db.getDb() as SqliteDatabase,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queries: (cg as any).queries as QueryBuilder,
  };
}

/** Seed one doc: an mdast_metadata row plus its vector at the matching rowid. */
function seedDoc(db: SqliteDatabase, filePath: string, vec: Float32Array): number {
  db.prepare(
    `INSERT OR REPLACE INTO mdast_metadata (file_path, content_hash, last_updated)
     VALUES (?, ?, datetime('now'))`
  ).run(filePath, `hash-${filePath}`);
  const { id } = db
    .prepare('SELECT id FROM mdast_metadata WHERE file_path = ?')
    .get(filePath) as { id: number };
  db.prepare('DELETE FROM mdast_vectors WHERE rowid = ?').run(BigInt(id));
  db.prepare('INSERT INTO mdast_vectors(rowid, embedding) VALUES(?, ?)').run(
    BigInt(id),
    floatBlob(vec)
  );
  return id;
}

const countSemanticEdges = (db: SqliteDatabase): number =>
  (
    db
      .prepare("SELECT COUNT(*) AS n FROM edges WHERE kind = 'semantically_related'")
      .get() as { n: number }
  ).n;

function docNodeId(db: SqliteDatabase, rel: string): string | undefined {
  const row = db
    .prepare("SELECT id FROM nodes WHERE kind = 'doc' AND qualified_name = ?")
    .get(rel) as { id?: string } | undefined;
  return row?.id;
}

/**
 * Three docs: `a` and `b` nearly collinear (cos ~0.98), `c` orthogonal to both.
 * Only the a-b pair should clear a 0.75 floor.
 */
function seedCorpus(db: SqliteDatabase): void {
  loadVecExtension(db); // vec0 is per-connection, same as indexMarkdown does
  ensureVectorTable(db);
  seedDoc(db, 'a.md', unitVec(1, 0, 0));
  seedDoc(db, 'b.md', unitVec(0.98, 0.199, 0));
  seedDoc(db, 'c.md', unitVec(0, 0, 1));
}

describe.skipIf(!isVecAvailable())('buildSemanticEdges', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    delete process.env[SEMANTIC_EDGES_ENV_VAR];
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDir = undefined;
  });

  function open(name: string): { cg: CodeGraph; db: SqliteDatabase; queries: QueryBuilder } {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `cg-semedge-${name}-`));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);
    seedCorpus(db);
    linkDocEdges(db, queries); // creates the doc nodes these edges connect
    return { cg, db, queries };
  }

  it('is a no-op when the opt-in gate is unset', () => {
    const { cg, db, queries } = open('off');

    const res = buildSemanticEdges(db, queries);

    expect(res).toEqual({ created: 0, skipped: 0 });
    expect(countSemanticEdges(db)).toBe(0);
    cg.close();
  });

  it('links only the pair above the similarity floor', () => {
    const { cg, db, queries } = open('build');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';

    const res = buildSemanticEdges(db, queries);

    expect(res.created).toBe(1);
    expect(countSemanticEdges(db)).toBe(1);

    const aId = docNodeId(db, 'a.md');
    const bId = docNodeId(db, 'b.md');
    const edge = db
      .prepare("SELECT * FROM edges WHERE kind = 'semantically_related'")
      .get() as { source: string; target: string; provenance?: string; metadata?: string };

    expect([edge.source, edge.target].sort()).toEqual([aId, bId].sort());
    expect(edge.provenance).toBe('heuristic');
    const meta = JSON.parse(edge.metadata ?? '{}');
    expect(meta.synthesizedBy).toBe('semantic-edges');
    expect(meta.similarity).toBeGreaterThan(0.75);
    expect(meta.similarity).toBeLessThanOrEqual(1);

    cg.close();
  });

  it('exposes the pair through callers and callees without tool changes', () => {
    const { cg, db, queries } = open('tools');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';
    buildSemanticEdges(db, queries);

    const aId = docNodeId(db, 'a.md')!;
    const bId = docNodeId(db, 'b.md')!;
    const reachable = [
      ...cg.getCallers(aId).map((r) => r.node.id),
      ...cg.getCallees(aId).map((r) => r.node.id),
    ];

    expect(reachable).toContain(bId);
    cg.close();
  });

  // A pair is stored once, low rowid → high. getImpactRadius only walks incoming
  // edges, so the relation shows up from the higher end and not the lower one.
  it('reaches the pair through impact from the target end', () => {
    const { cg, db, queries } = open('impact');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';
    buildSemanticEdges(db, queries);

    const aId = docNodeId(db, 'a.md')!;
    const bId = docNodeId(db, 'b.md')!;

    expect([...cg.getImpactRadius(bId).nodes.keys()]).toContain(aId);
  });

  it('does not duplicate edges across re-runs', () => {
    const { cg, db, queries } = open('idem');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';

    buildSemanticEdges(db, queries);
    buildSemanticEdges(db, queries);
    buildSemanticEdges(db, queries);

    expect(countSemanticEdges(db)).toBe(1);
    cg.close();
  });

  it('skips recomputation while the corpus is unchanged', () => {
    const { cg, db, queries } = open('fingerprint');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';

    expect(buildSemanticEdges(db, queries).created).toBe(1);
    // Second pass short-circuits on the fingerprint: no work, edges intact.
    expect(buildSemanticEdges(db, queries)).toEqual({ created: 0, skipped: 0 });
    expect(countSemanticEdges(db)).toBe(1);

    cg.close();
  });

  it('rebuilds when a linkDocEdges pass cascade-deleted the edges', () => {
    const { cg, db, queries } = open('cascade');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';
    buildSemanticEdges(db, queries);
    expect(countSemanticEdges(db)).toBe(1);

    // Re-inserting the doc nodes wipes every edge hanging off them.
    linkDocEdges(db, queries);
    expect(countSemanticEdges(db)).toBe(0);

    // The corpus fingerprint still matches, so only the existence check saves us.
    expect(buildSemanticEdges(db, queries).created).toBe(1);
    expect(countSemanticEdges(db)).toBe(1);

    cg.close();
  });

  it('rebuilds after a doc changes', () => {
    const { cg, db, queries } = open('changed');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';
    buildSemanticEdges(db, queries);

    // Pull c.md next to a.md; it now clears the floor against both a and b.
    seedDoc(db, 'c.md', unitVec(0.99, 0.141, 0));
    linkDocEdges(db, queries);

    expect(buildSemanticEdges(db, queries).created).toBe(3);
    cg.close();
  });

  it('respects a caller-supplied topK and floor', () => {
    const { cg, db, queries } = open('opts');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';

    // A floor above every real pair leaves nothing to write.
    expect(buildSemanticEdges(db, queries, { minSimilarity: 0.999 }).created).toBe(0);
    // And a floor of 0 links all three documents to each other.
    expect(buildSemanticEdges(db, queries, { minSimilarity: 0 }).created).toBe(3);

    cg.close();
  });

  it('stays under the topK x document-count bound', () => {
    const { cg, db, queries } = open('bound');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';

    const created = buildSemanticEdges(db, queries, { minSimilarity: 0 }).created;

    expect(created).toBeLessThanOrEqual(DEFAULT_TOP_K * 3);
    cg.close();
  });

  it('is gated off on a code project without a doc-graph override', () => {
    const { cg, db, queries } = open('codeproj');
    process.env[SEMANTIC_EDGES_ENV_VAR] = '1';
    // One code node is enough to fail the pure-Markdown auto-detect.
    db.prepare(
      `INSERT OR REPLACE INTO nodes
       (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
       VALUES ('fn::solve', 'function', 'solve', 'solve', 'solver.ts', 'typescript', 1, 1, 0, 0, ?)`
    ).run(Date.now());

    expect(buildSemanticEdges(db, queries)).toEqual({ created: 0, skipped: 0 });
    cg.close();
  });
});
