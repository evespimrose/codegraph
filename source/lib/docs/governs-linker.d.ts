/**
 * governs-linker — post-indexMarkdown pass that resolves preserved
 * `governs` UnresolvedRefs into `governs` edges (concept → code symbol).
 *
 * Why a separate pass: concept nodes are created by indexMarkdown, which runs
 * AFTER the general resolver. By the time concept nodes exist, the resolver
 * has already finished. This linker bridges that phase gap.
 *
 * Barrier: projects that don't use `// [BLK-XXX]` markers produce zero
 * governs refs → this function is a no-op for them.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { QueryBuilder } from '../db/queries';
export interface GovernsLinkResult {
    /** governs edges successfully created */
    linked: number;
    /** governs refs with no matching concept node (preserved for future re-attempt) */
    skipped: number;
}
/**
 * Resolve all preserved `governs` unresolved refs into graph edges.
 * Called by CodeGraph.indexAll immediately after indexMarkdown succeeds.
 * Safe to call when docs are disabled or no BLK markers exist — returns {0,0}.
 */
export declare function linkGovernsEdges(db: SqliteDatabase, queries: QueryBuilder): GovernsLinkResult;
//# sourceMappingURL=governs-linker.d.ts.map