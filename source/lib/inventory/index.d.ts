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
    classify?: import('../docs/scan-files').DocumentClassifier;
    /** 감시기의 국소 sync 범위. 있으면 이 경로의 항목만 고치거나 지움 */
    paths?: readonly string[];
}): FileInventoryResult;
export declare function getFileInventorySummary(db: SqliteDatabase): FileInventoryResult['byStatus'];
//# sourceMappingURL=index.d.ts.map