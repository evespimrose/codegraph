import type { SqliteDatabase } from '../db/sqlite-adapter';
export declare const SEMANTIC_EDGES_ENV_VAR = "CODEGRAPH_SEMANTIC_EDGES";
export declare const SEMANTIC_EDGES_META_KEY = "semantic_edges_enabled";
export declare const SEMANTIC_TOP_K_META_KEY = "semantic_edges_top_k";
export declare const SEMANTIC_THRESHOLD_META_KEY = "semantic_edges_min_similarity";
export interface SemanticEdgeOptions {
    enabled?: boolean;
    topK?: number;
    minSimilarity?: number;
    modelId?: string;
}
export interface SemanticEdgeResult {
    enabled: boolean;
    available: boolean;
    created: number;
    edgeCount: number;
    skipped: number;
    rebuilt: boolean;
    unchanged: boolean;
    reusedDocuments: number;
    knnQueries: number;
    similarityComparisons: number;
    corpusFingerprint?: string;
    reason?: 'disabled' | 'vector-table-missing';
}
export declare function resolveSemanticEdgesEnabled(db?: SqliteDatabase): boolean;
export declare function setSemanticEdgesEnabled(db: SqliteDatabase, enabled: boolean): void;
export declare function setSemanticEdgeConfig(db: SqliteDatabase, options: {
    enabled: boolean;
    topK: number;
    minSimilarity: number;
}): void;
export declare function buildSemanticEdges(db: SqliteDatabase, options?: SemanticEdgeOptions): SemanticEdgeResult;
//# sourceMappingURL=semantic-edges.d.ts.map