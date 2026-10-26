import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { DocCodeSymbol, DocHit } from './search-types';
export declare function searchDocsLexical(db: SqliteDatabase, query: string, limit: number, codeLimit: number): {
    hits: DocHit[];
    warnings: string[];
};
export declare function fuseHits(vectorHits: DocHit[], lexicalHits: DocHit[], limit: number): DocHit[];
export declare function resolveCodeSymbols(db: SqliteDatabase, files: string[]): {
    byFile: Map<string, DocCodeSymbol[]>;
    warnings: string[];
};
//# sourceMappingURL=lexical-search.d.ts.map