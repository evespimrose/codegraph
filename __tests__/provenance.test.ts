import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { summarizeProvenance } from '../src/provenance';
import { CodeGraph } from '../src';
import { createResolver } from '../src/resolution';
import type { Edge, EdgeProvenance } from '../src/types';
import type { ResolvedRef } from '../src/resolution/types';
import type { QueryBuilder } from '../src/db/queries';

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

describe('createEdges resolvedBy -> provenance mapping', () => {
  const EXPECTED: Record<ResolvedRef['resolvedBy'], EdgeProvenance> = {
    'exact-match': 'resolver',
    import: 'resolver',
    'qualified-name': 'resolver',
    framework: 'resolver',
    'file-path': 'resolver',
    fuzzy: 'heuristic',
    'instance-method': 'heuristic',
  };

  function makeResolved(resolvedBy: ResolvedRef['resolvedBy']): ResolvedRef {
    return {
      original: {
        fromNodeId: 'from::a',
        referenceName: 'target',
        referenceKind: 'references',
        line: 1,
        column: 1,
        filePath: 'a.ts',
        language: 'typescript',
      },
      targetNodeId: 'to::b',
      confidence: 0.8,
      resolvedBy,
    };
  }

  it('maps every resolvedBy strategy to the provenance the vocabulary table specifies', () => {
    let tmpDir: string | undefined;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-provenance-'));
      const cg = CodeGraph.initSync(tmpDir);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queries = (cg as any).queries as QueryBuilder;
      const resolver = createResolver(tmpDir, queries);

      for (const [resolvedBy, expected] of Object.entries(EXPECTED) as Array<
        [ResolvedRef['resolvedBy'], EdgeProvenance]
      >) {
        const [edge] = resolver.createEdges([makeResolved(resolvedBy)]);
        expect(edge.provenance, `resolvedBy=${resolvedBy}`).toBe(expected);
      }

      cg.close();
    } finally {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
