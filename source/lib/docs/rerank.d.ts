import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { DocHit, RerankSummary } from './search-types';
export interface RerankScorer {
    modelId: string;
    score(query: string, texts: string[], maxLength: number): Promise<number[]>;
}
export type RerankerLoad = {
    scorer: RerankScorer;
} | {
    error: unknown;
};
export declare function startReranker(): Promise<RerankerLoad>;
export declare function rerankHits(db: SqliteDatabase, query: string, hits: DocHit[], topk: number, reranking: Promise<RerankerLoad>): Promise<{
    hits: DocHit[];
    warnings: string[];
    summary: RerankSummary;
}>;
export declare function cascadeOrder(query: string, texts: string[], score: RerankScorer['score']): Promise<{
    order: number[];
    scores: number[];
}>;
//# sourceMappingURL=rerank.d.ts.map
