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
}): Promise<MarkdownIndexResult>;
//# sourceMappingURL=indexer.d.ts.map
