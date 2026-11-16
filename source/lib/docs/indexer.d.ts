import type { SqliteDatabase } from '../db/sqlite-adapter';
export interface MarkdownIndexResult {
    enabled: boolean;
    available: boolean;
    scanned: number;
    indexed: number;
    skipped: number;
    removed: number;
    warnings: string[];
    errors: Array<{ filePath: string; message: string }>;
    semanticState: 'ready' | 'unavailable' | 'disabled';
    formats: Record<string, number>;
    changedPaths: string[];
}
export declare const GOVERNED_DIRS: string[];
export declare function ensureVectorTable(db: SqliteDatabase): void;
export declare function ensureDocumentFtsTable(db: SqliteDatabase): void;
export declare function indexMarkdown(db: SqliteDatabase, projectRoot: string, opts?: {
    onWarn?: (message: string) => void;
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
    classify?: import('./scan-files').DocumentClassifier;
    /** 감시기의 국소 sync 범위. 있으면 이 경로의 문서만 지우고, 실패 기록도 이 경로만 바꿈 */
    paths?: readonly string[];
}): Promise<MarkdownIndexResult>;
//# sourceMappingURL=indexer.d.ts.map
