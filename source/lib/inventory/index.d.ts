import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { FileInventoryStatus } from '../types';
export interface FileInventoryResult {
    scanned: number;
    updated: number;
    removed: number;
    byStatus: Record<FileInventoryStatus, number>;
}
export declare function refreshFileInventory(db: SqliteDatabase, projectRoot: string, opts?: {
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
}): FileInventoryResult;
export declare function getFileInventorySummary(db: SqliteDatabase): FileInventoryResult['byStatus'];
//# sourceMappingURL=index.d.ts.map