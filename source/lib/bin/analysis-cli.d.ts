import type { SyncResult } from '../extraction';
type Chalk = {
    bold(value: string): string;
    dim(value: string): string;
    yellow(value: string): string;
};
export type AnalysisCli = {
    resolvePath(pathArg?: string): string;
    loadGraph(): Promise<typeof import('../index')>;
    ready(projectPath: string): boolean;
    version: string;
    format(value: number): string;
    error(message: string): void;
    chalk: Chalk;
};
export declare function requireFresh(sync: SyncResult): void;
export declare function failAnalysis(cli: AnalysisCli, label: string, caught: unknown, options: {
    json?: boolean;
    projectPath: string;
}): void;
export declare function readNumber(value: string | undefined, label: string): number | undefined;
export declare function readPositive(value: string | undefined, label: string): number;
export declare function limitReason(stats: {
    nodeCount: number;
    edgeCount: number;
}, maxNodes: number, maxEdges: number): string | undefined;
export declare function writeAtomic(targetPath: string, content: string): void;
export declare function dateStamp(date?: Date): string;
export {};
//# sourceMappingURL=analysis-cli.d.ts.map