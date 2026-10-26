import type { SqliteDatabase } from '../db/sqlite-adapter';
import { type DirectedSemanticNeighbor, type SemanticNeighborCache, type VectorDocument } from './semantic-edge-model';
export declare function readNeighborCache(db: SqliteDatabase, topK: number): SemanticNeighborCache | undefined;
export declare function cacheMatchesDocuments(cache: SemanticNeighborCache, documents: VectorDocument[]): boolean;
export declare function replaceNeighborCache(db: SqliteDatabase, documents: VectorDocument[], neighbors: DirectedSemanticNeighbor[], updatedAt: number): void;
export declare function clearNeighborCache(db: SqliteDatabase): void;
//# sourceMappingURL=semantic-edge-cache.d.ts.map