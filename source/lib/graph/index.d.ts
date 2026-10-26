/**
 * Graph Module
 *
 * Provides graph traversal and query functionality for the code knowledge graph.
 */
export { GraphTraverser } from './traversal';
export { GraphQueryManager } from './queries';
export { detectCommunities } from './community-detection';
export { createCommunitiesCache, writeCommunitiesCache } from './community-cache';
export { cohesionScore, labelByHub } from './community-summary';
export { loadCommunityGraph } from './community-graph';
export { buildGraphReportData } from './graph-report';
export { renderGraphReport } from './report-render';
export { godNodes } from './report-god-nodes';
export { surprisingConnections } from './report-surprising';
export { suggestQuestions } from './report-questions';
export { analyzeImportCycles, findImportCycles } from './report-cycles';
export type { ImportCycleAnalysis } from './report-cycles';
export type { CommunitiesCache, CommunityDetectionOptions, CommunityDetectionResult, CommunitySummary, } from './community-types';
export type { GodNode, GraphReportData, GraphReportOptions, QuestionStrategy, SuggestedQuestion, SurprisingConnection, } from './report-types';
//# sourceMappingURL=index.d.ts.map