import type { Edge, Node, NodeKind } from '../types';
import type { ProvenanceCounts } from '../provenance';
import type { CommunitySummary } from './community-types';
export interface GodNode {
    id: string;
    label: string;
    kind: NodeKind;
    degree: number;
}
export interface SurprisingConnection {
    source: string;
    target: string;
    sourceLabel: string;
    targetLabel: string;
    edgeKind: string;
    score: number;
    factors: {
        confidence: number;
        crossCommunity: number;
        semantic: number;
        peripheralToHub: number;
    };
}
export type QuestionStrategy = 'ambiguous' | 'bridge' | 'god-with-inferred' | 'isolated' | 'low-cohesion';
export interface SuggestedQuestion {
    strategy: QuestionStrategy;
    question: string;
    nodeIds: string[];
}
export interface GraphReportData {
    nodes: Node[];
    edges: Edge[];
    graphFingerprint: string;
    nodeCount: number;
    edgeCount: number;
    provenance: ProvenanceCounts;
    godNodes: GodNode[];
    surprisingConnections: SurprisingConnection[];
    importCycles: string[][];
    communities: Record<string, CommunitySummary>;
    nodeCommunities: Record<string, string>;
    isolatedNodeIds: string[];
    suggestedQuestions: SuggestedQuestion[];
    warnings: string[];
}
export interface GraphReportOptions {
    topGodNodes?: number;
    topConnections?: number;
    topQuestions?: number;
    maxCycleLength?: number;
    topCycles?: number;
    maxLines?: number;
    maxCommunityCharts?: number;
    maxChartNodes?: number;
}
//# sourceMappingURL=report-types.d.ts.map