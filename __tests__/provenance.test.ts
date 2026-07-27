import { describe, it, expect } from 'vitest';
import { summarizeProvenance } from '../src/provenance';
import type { Edge } from '../src/types';

describe('summarizeProvenance', () => {
  it('counts each bucket and routes untagged edges to unknown', () => {
    const edges: Array<Pick<Edge, 'provenance'>> = [
      { provenance: 'tree-sitter' },
      { provenance: 'tree-sitter' },
      { provenance: 'resolver' },
      { provenance: 'heuristic' },
      { provenance: 'scip' },
      {},
      { provenance: undefined },
    ];

    expect(summarizeProvenance(edges)).toEqual({
      'tree-sitter': 2,
      scip: 1,
      resolver: 1,
      heuristic: 1,
      unknown: 2,
    });
  });

  it('returns an all-zero shape for an empty edge list', () => {
    expect(summarizeProvenance([])).toEqual({
      'tree-sitter': 0,
      scip: 0,
      resolver: 0,
      heuristic: 0,
      unknown: 0,
    });
  });
});
