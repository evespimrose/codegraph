import type { SqliteDatabase } from '../db/sqlite-adapter';
import { type DirectedSemanticNeighbor, type SemanticEdgeState, type SemanticPair, type VectorDocument } from './semantic-edge-model';
export declare function readAlignedDocuments(db: SqliteDatabase, modelId: string): VectorDocument[];
export declare function readState(db: SqliteDatabase): SemanticEdgeState | undefined;
export declare function stateMatches(db: SqliteDatabase, state: SemanticEdgeState, corpusFingerprint: string, modelId: string, configFingerprint: string): boolean;
export declare function publishSemanticEdges(db: SqliteDatabase, documents: VectorDocument[], neighbors: DirectedSemanticNeighbor[], pairs: SemanticPair[], corpusFingerprint: string, modelId: string, configFingerprint: string): void;
export declare function invalidateSemanticEdges(db: SqliteDatabase): void;
export declare function tableExists(db: SqliteDatabase, name: string): boolean;
//# sourceMappingURL=semantic-edge-store.d.ts.map