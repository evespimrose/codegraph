/** Hybrid lexical/vector search over the shared CodeGraph database. */
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { SearchDocsOptions, SearchDocsResult } from './search-types';
export type { DocCodeSymbol, DocHit, DocLinksResult, GoverningDoc, SearchDocsOptions, SearchDocsResult, } from './search-types';
export { findBacklinks, findGoverningDocs } from './document-relations';
export declare function searchDocs(db: SqliteDatabase, query: string, opts?: SearchDocsOptions): Promise<SearchDocsResult>;
//# sourceMappingURL=search.d.ts.map