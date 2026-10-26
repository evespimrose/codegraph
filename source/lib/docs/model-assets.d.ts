export declare const MODEL_ROOT_ENV = "CODEGRAPH_MODEL_ROOT";
export declare const BUNDLED_MODEL_ID = "Xenova/multilingual-e5-small";
export declare const BUNDLED_MODEL_REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
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
export declare function configureModelEnvironment(env: Record<string, unknown>): ModelAssetStatus;
//# sourceMappingURL=model-assets.d.ts.map