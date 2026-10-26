export declare const SEMANTIC_EDGE_ALGORITHM = "semantic-edges-v2";
export interface VectorDocument {
    id: number;
    filePath: string;
    contentHash: string;
    vector: Float32Array;
    blob: Buffer;
    nodeId: string;
}
export interface SemanticPair {
    source: string;
    target: string;
    similarity: number;
}
export interface SemanticEdgeState {
    corpus_fingerprint: string;
    model_id: string;
    config_fingerprint: string;
    edge_count: number;
}
export interface SemanticDocumentState {
    documentId: number;
    nodeId: string;
    fingerprint: string;
}
export interface DirectedSemanticNeighbor {
    sourceDocumentId: number;
    targetDocumentId: number;
    similarity: number;
    rank: number;
}
export interface SemanticNeighborCache {
    documents: Map<number, SemanticDocumentState>;
    neighbors: Map<number, DirectedSemanticNeighbor[]>;
}
export declare function documentNodeId(filePath: string): string;
export declare function decodeVector(bytes: Uint8Array): Float32Array;
export declare function cosine(left: Float32Array, right: Float32Array): number;
export declare function fingerprintCorpus(documents: VectorDocument[]): string;
export declare function fingerprintDocument(document: VectorDocument): string;
export declare function hashValue(value: string): string;
//# sourceMappingURL=semantic-edge-model.d.ts.map