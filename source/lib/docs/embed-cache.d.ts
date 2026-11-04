export declare const CACHE_ENV = "CODEGRAPH_EMBED_CACHE";
/** Hash of the exact model input (prefix included); with the model ID it keys the cache. */
export declare function embedTextKey(text: string): string;
export declare function cacheDirectory(): string;
export declare class EmbedCache {
    private db;
    private insert;
    constructor(dbPath: string);
    get(model: string, keys: string[]): Map<string, Float32Array>;
    put(model: string, entries: Array<{
        key: string;
        vector: Float32Array | number[];
    }>): void;
    close(): void;
}
/** Null when the cache is disabled or cannot be opened. */
export declare function openEmbedCache(): EmbedCache | null;
