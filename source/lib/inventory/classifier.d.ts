import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { FileInventoryRecord } from '../types';
export interface InventorySources {
    sourceHash: ReturnType<SqliteDatabase['prepare']>;
    documentHash: ReturnType<SqliteDatabase['prepare']>;
    documentErrors?: ReadonlyMap<string, string>;
}
export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string): FileInventoryRecord;
export declare function hasSourceErrors(value: unknown): boolean;
//# sourceMappingURL=classifier.d.ts.map
