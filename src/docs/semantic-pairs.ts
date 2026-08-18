/**
 * semantic-pairs — the scoring and selection policy behind `semantically_related`
 * edges, with no database in sight.
 *
 * Kept apart from semantic-edges.ts so the decision "which document pairs are
 * close enough to link" can be read, tested, and reused (the docs report reaches
 * for it) without standing up sqlite-vec or an index.
 */

/** Neighbours kept per document before the similarity threshold applies. */
export const DEFAULT_TOP_K = 5;

/** Cosine floor a pair must clear to become an edge. */
export const DEFAULT_MIN_SIMILARITY = 0.75;

/** One KNN hit: `from` ranked `to` among its nearest neighbours. */
export interface SemanticNeighbor {
  from: number;
  to: number;
  similarity: number;
}

/** An undirected pair, `a` < `b` by rowid. */
export interface SemanticPair {
  a: number;
  b: number;
  similarity: number;
}

/**
 * vec0 is created without a distance_metric so its distance is L2, and embed()
 * L2-normalizes every vector — for unit vectors |a-b|² = 2 - 2cos, which
 * inverts exactly. Clamped so a vector that escaped normalization (distance
 * past 2) still lands in range instead of returning a bogus similarity.
 */
export function cosineFromL2(distance: number): number {
  const cosine = 1 - (distance * distance) / 2;
  if (cosine > 1) return 1;
  if (cosine < -1) return -1;
  return cosine;
}

/**
 * Reduce raw KNN hits to the undirected pairs worth storing: self-matches
 * dropped, each document capped at `topK` neighbours, anything under
 * `minSimilarity` cut, and (a,b)/(b,a) collapsed to one entry keeping the
 * higher score. Bounded by topK × document count.
 */
export function selectPairs(
  neighbors: SemanticNeighbor[],
  opts: { topK: number; minSimilarity: number }
): { pairs: SemanticPair[]; skipped: number } {
  const bySource = new Map<number, SemanticNeighbor[]>();
  for (const neighbor of neighbors) {
    if (neighbor.from === neighbor.to) continue; // vec0 ranks the query doc first
    const group = bySource.get(neighbor.from);
    if (group) group.push(neighbor);
    else bySource.set(neighbor.from, [neighbor]);
  }

  const best = new Map<string, SemanticPair>();
  let skipped = 0;
  for (const group of bySource.values()) {
    const ranked = [...group].sort((left, right) => right.similarity - left.similarity);
    let rank = 0;
    for (const neighbor of ranked) {
      const withinTopK = rank < opts.topK;
      rank++;
      if (!withinTopK || neighbor.similarity < opts.minSimilarity) {
        skipped++;
        continue;
      }
      const low = Math.min(neighbor.from, neighbor.to);
      const high = Math.max(neighbor.from, neighbor.to);
      const key = `${low}|${high}`;
      const seen = best.get(key);
      if (!seen) {
        best.set(key, { a: low, b: high, similarity: neighbor.similarity });
        continue;
      }
      skipped++; // the same pair, seen from the other end
      if (neighbor.similarity > seen.similarity) seen.similarity = neighbor.similarity;
    }
  }

  return { pairs: [...best.values()], skipped };
}
