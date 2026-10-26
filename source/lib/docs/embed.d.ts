export declare const EMBED_MODEL_ID = "Xenova/multilingual-e5-small";
export declare const EMBED_QUERY_PREFIX = "query: ";
export declare const EMBED_PASSAGE_PREFIX = "passage: ";
export declare const EMBEDDINGS_DISABLE_ENV = "CODEGRAPH_DISABLE_EMBEDDINGS";
/** Lazy singleton. First call loads the model; subsequent runs are offline. */
export declare function getEmbedder(): Promise<any>;
/** Embed a single string → Float32Array(EMBED_DIM). */
export declare function embed(text: string): Promise<Float32Array>;
/** Embed batches in order, tokenizing batch N+1 while the model runs batch N. */
export declare function embedBatches(textBatches: string[][]): AsyncGenerator<Float32Array[], void, undefined>;
/** Whether the Transformers.js runtime and configured model assets are available. */
export declare function isEmbedAvailable(): Promise<boolean>;
//# sourceMappingURL=embed.d.ts.map