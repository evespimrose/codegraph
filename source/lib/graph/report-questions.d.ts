import type { Edge, Node } from '../types';
import type { CommunitySummary } from './community-types';
import type { GodNode, SuggestedQuestion } from './report-types';
export declare function suggestQuestions(nodes: Node[], edges: Edge[], mapping: Record<string, string>, communities: Record<string, CommunitySummary>, gods: GodNode[], topN?: number): SuggestedQuestion[];
//# sourceMappingURL=report-questions.d.ts.map