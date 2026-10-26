import type { CommunitySummary } from './community-types';
import type { GraphReportData } from './report-types';
export declare function markdown(value: string): string;
export declare function table(headers: string[], rows: string[][]): string[];
export declare function communityChart(data: GraphReportData, community: CommunitySummary, maxNodes: number): string[];
//# sourceMappingURL=report-format.d.ts.map