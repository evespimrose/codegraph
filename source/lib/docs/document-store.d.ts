import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { ParsedDocument } from './document-parser';
export interface StoredDocument {
    id: number;
    file_path: string;
}
export interface StoredMetadata extends StoredDocument {
    content_hash: string | null;
    embedding_model: string | null;
    file_size: number | null;
    modified_at: number | null;
}
interface PublishInput {
    filePath: string;
    parsed: ParsedDocument;
    blkTags: Array<{
        tag: string;
        line: number;
    }>;
    contentHash: string;
    fileSize: number;
    modifiedAt: number;
    publishConcepts: boolean;
}
export declare class DocumentStore {
    private readonly db;
    private readonly selectMetadata;
    private readonly selectId;
    private readonly updateFileStats;
    private readonly upsertMetadata;
    private readonly deleteFts;
    private readonly insertFts;
    private readonly deleteMetadata;
    private readonly selectDocumentNodes;
    private readonly deleteEdges;
    private readonly deleteDocumentNodes;
    private readonly insertConcept;
    private readonly deleteVector;
    private readonly insertVector;
    private readonly markEmbedded;
    constructor(db: SqliteDatabase, vectorAvailable: boolean);
    getMetadata(filePath: string): StoredMetadata | undefined;
    listDocuments(): StoredDocument[];
    updateStats(id: number, fileSize: number, modifiedAt: number): void;
    removeDocuments(documents: StoredDocument[]): void;
    publish(input: PublishInput): bigint;
    publishEmbeddings(items: Array<{
        rowId: bigint;
        vector: Float32Array;
    }>): void;
    private removeDocumentNodes;
    private publishConceptNodes;
}
export {};
//# sourceMappingURL=document-store.d.ts.map