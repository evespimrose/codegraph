import { UndirectedGraph } from 'graphology';
import type { Edge, Node } from '../types';
export type CommunityGraph = UndirectedGraph<{
    node: Node;
}, {
    weight: number;
    edges: Edge[];
}>;
export declare function loadCommunityGraph(nodes: Node[], edges: Edge[]): CommunityGraph;
export declare function inducedCommunityGraph(graph: CommunityGraph, members: string[]): CommunityGraph;
//# sourceMappingURL=community-graph.d.ts.map