export declare const MODEL_ROOT_ENV = "CODEGRAPH_MODEL_ROOT";
export declare const BUNDLED_MODEL_ID = "dragonkue/multilingual-e5-small-ko";
export declare const BUNDLED_MODEL_REVISION = "bba4cb8e3299d445c04f62bf62e2b26461d03715";
export declare const BUNDLED_MODEL_LICENSE = "MIT";
export declare const BUNDLED_MODEL_DIMENSION = 384;
export interface ModelAssetStatus {
    mode: 'bundled' | 'remote-cache';
    valid: boolean;
    modelRoot?: string;
    modelId?: string;
    revision?: string;
    license?: string;
    issues: string[];
}
export declare function inspectModelAssets(rootOverride?: string): ModelAssetStatus;
export declare const RERANK_MODEL_ENV = "CODEGRAPH_RERANK_MODEL_ROOT";
export declare const RERANK_MODEL_ID = "nlpai-lab/KURE-Reranker-nano";
export declare const RERANK_MODEL_REVISION = "8514b9e113f3b27c441ed9c2b50f81d80388b2fd";
export interface RerankAssetStatus {
    valid: boolean;
    modelRoot?: string;
    modelId?: string;
    revision?: string;
    license?: string;
    issues: string[];
}
export declare function inspectRerankAssets(rootOverride?: string): RerankAssetStatus;
export declare function configureModelEnvironment(env: Record<string, unknown>): ModelAssetStatus;
//# sourceMappingURL=model-assets.d.ts.map