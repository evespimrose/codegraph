import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { QueryBuilder } from '../db/queries';
export interface DocLinkResult {
    /** `doc` nodes upserted (≈ one per indexed Markdown file). */
    nodes: number;
    /** `doc_link` edges created (citing → cited). */
    edges: number;
    /** links that resolved to no known doc (skipped, non-fatal). */
    skipped: number;
}
/**
 * Is this a pure-Markdown project? True when the graph holds NO code nodes
 * (everything is `doc`/`concept`) AND at least one Markdown file is indexed.
 * Evaluated AFTER indexMarkdown so the code-node count is final — avoids the
 * mid-index timing trap where not all code nodes are in yet. (Markdown files
 * are NOT scanned as code, so they never create `file` nodes.)
 */
export declare function isPureMarkdownProject(db: SqliteDatabase): boolean;
/** Should doc_links be promoted? Env override wins; else auto-detect pure-MD. */
export declare function shouldPromoteDocGraph(db: SqliteDatabase): boolean;
/**
 * Promote `mdast_metadata.doc_links` into `doc` nodes + `doc_link` edges.
 * Called by CodeGraph.indexAll/sync immediately after indexMarkdown.
 * Returns {0,0,0} when docs are off, promotion is gated off, or nothing indexed.
 */
export declare function linkDocEdges(db: SqliteDatabase, queries: QueryBuilder): DocLinkResult;
//# sourceMappingURL=doc-links-linker.d.ts.map