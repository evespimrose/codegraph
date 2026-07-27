/**
 * Provenance aggregation, shared by the MCP layer and the graph report.
 */
import type { Edge, EdgeProvenance } from './types';

/** Every provenance bucket, plus `unknown` for edges from a pre-tagging index. */
export type ProvenanceCounts = Record<EdgeProvenance | 'unknown', number>;

/**
 * Count edges per provenance. Untagged edges land in `unknown`, which is the
 * expected bucket for any index built before provenance stamping.
 */
export function summarizeProvenance(edges: Array<Pick<Edge, 'provenance'>>): ProvenanceCounts {
  const counts: ProvenanceCounts = {
    'tree-sitter': 0,
    scip: 0,
    resolver: 0,
    heuristic: 0,
    unknown: 0,
  };
  for (const edge of edges) {
    counts[edge.provenance ?? 'unknown']++;
  }
  return counts;
}
