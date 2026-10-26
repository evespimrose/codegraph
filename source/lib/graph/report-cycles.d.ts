import type { Edge, Node } from '../types';
export interface ImportCycleAnalysis {
    cycles: string[][];
    truncated: boolean;
}
export declare function analyzeImportCycles(nodes: Node[], edges: Edge[], maxLength?: number, topN?: number): ImportCycleAnalysis;
export declare function findImportCycles(nodes: Node[], edges: Edge[], maxLength?: number, topN?: number): string[][];
//# sourceMappingURL=report-cycles.d.ts.map