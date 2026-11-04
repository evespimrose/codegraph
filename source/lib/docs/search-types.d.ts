export interface DocCodeSymbol {
    symbol: string;
    kind: string;
    file: string;
    line: number;
    signature: string | null;
}
export interface DocHit {
    file: string;
    blk: string | null;
    summary: string;
    distance: number;
    codeRefs: string[];
    symbols: DocCodeSymbol[];
    format: string;
    title: string | null;
    retrieval: Array<'lexical' | 'vector'>;
    rerankScore?: number;
}
export interface SearchDocsResult {
    schemaVersion: 1;
    enabled: boolean;
    available: boolean;
    hits: DocHit[];
    warnings: string[];
    semanticState: 'ready' | 'unavailable' | 'disabled' | 'stale';
    rerank?: RerankSummary;
}
export interface RerankSummary {
    enabled: boolean;
    depth: number;
    model: string | null;
    ms: number;
}
export interface GoverningDoc {
    file: string;
    blk: string | null;
    summary: string;
    codeRefs: string[];
}
export interface DocLinksResult {
    file: string;
    forwardLinks: string[];
    backLinks: string[];
}
export interface SearchDocsOptions {
    topk?: number;
    codeLimit?: number;
    rerank?: boolean;
    rerankDepth?: number;
}
//# sourceMappingURL=search-types.d.ts.map