import type { SqliteDatabase } from '../db/sqlite-adapter';
import { type DirectedSemanticNeighbor, type SemanticNeighborCache, type SemanticPair, type VectorDocument } from './semantic-edge-model';
export interface SemanticComputation {
    neighbors: DirectedSemanticNeighbor[];
    pairs: SemanticPair[];
    skipped: number;
    reusedDocuments: number;
    knnQueries: number;
    similarityComparisons: number;
}
export declare function computeSemanticEdges(db: SqliteDatabase, documents: VectorDocument[], topK: number, minSimilarity: number, previous?: SemanticNeighborCache): SemanticComputation;
//# sourceMappingURL=semantic-edge-incremental.d.ts.map