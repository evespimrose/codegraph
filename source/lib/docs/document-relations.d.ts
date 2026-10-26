import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { DocLinksResult, GoverningDoc } from './search-types';
export declare function findGoverningDocs(db: SqliteDatabase, filePaths: string[]): GoverningDoc[];
export declare function findBacklinks(db: SqliteDatabase, filePath: string, maxDepth?: number): DocLinksResult | null;
//# sourceMappingURL=document-relations.d.ts.map