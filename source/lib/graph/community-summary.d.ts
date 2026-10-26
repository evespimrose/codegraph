import type { CommunityGraph } from './community-graph';
import type { CommunitySummary } from './community-types';
export declare function cohesionScore(graph: CommunityGraph, nodeIds: string[]): number;
export declare function labelByHub(graph: CommunityGraph, nodeIds: string[]): string;
export declare function summarizeCommunities(graph: CommunityGraph, groups: string[][]): {
    nodeCommunities: Record<string, string>;
    communities: Record<string, CommunitySummary>;
};
//# sourceMappingURL=community-summary.d.ts.map