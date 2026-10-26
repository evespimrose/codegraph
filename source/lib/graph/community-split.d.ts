import type { CommunityGraph } from './community-graph';
export declare function partitionGraph(graph: CommunityGraph, seed: number | string, resolution: number): string[][];
export declare function splitOversizedCommunities(graph: CommunityGraph, initial: string[][], totalNodes: number, maxFraction: number, minSplitSize: number, seed: number | string, resolution: number): string[][];
//# sourceMappingURL=community-split.d.ts.map