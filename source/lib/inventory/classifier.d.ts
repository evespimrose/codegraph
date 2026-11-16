import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { FileInventoryRecord } from '../types';
import type { DocumentClassifier } from '../docs/scan-files';
export interface InventorySources {
    sourceHash: ReturnType<SqliteDatabase['prepare']>;
    documentHash: ReturnType<SqliteDatabase['prepare']>;
    documentErrors?: ReadonlyMap<string, string>;
}
export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string, classify?: DocumentClassifier): FileInventoryRecord;
export declare function hasSourceErrors(value: unknown): boolean;
/** 한 번의 sync 안에서 문서 스캔과 파일 목록 갱신이 같이 쓰는 문서 판별기를 만듦 */
export declare function createDocumentClassifier(db: SqliteDatabase, projectRoot: string): DocumentClassifier;
//# sourceMappingURL=classifier.d.ts.map
