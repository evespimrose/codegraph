/**
 * Provenance aggregation shared by graph queries and reports.
 */
import type { Edge, EdgeProvenance } from './types';
import type { SqliteDatabase } from './db/sqlite-adapter';
export declare const PROVENANCE_REBUILD_META_KEY = "graph_rebuild_required";
export declare const PROVENANCE_REBUILD_REASON = "provenance-v10";
export declare const SOURCE_PARSER_REVISION = "team-source-v4";
export declare const SOURCE_PARSER_REVISION_META_KEY = "source_parser_revision";
export declare function needsSourceParserRebuild(db: SqliteDatabase): boolean;
/** Every provenance bucket, plus `unknown` for edges from a pre-tagging index. */
export type ProvenanceCounts = Record<EdgeProvenance | 'unknown', number>;
/**
 * Count edges per provenance. Untagged edges land in `unknown`, which is the
 * expected bucket for any index built before provenance stamping.
 */
export declare function summarizeProvenance(edges: Array<Pick<Edge, 'provenance'>>): ProvenanceCounts;
export declare function getProvenanceRebuildReason(db: SqliteDatabase): string | null;
export declare function clearProvenanceRebuildMarker(db: SqliteDatabase): void;
/**
 * Publish a completed provenance rebuild atomically. Legacy untagged edges
 * remain queryable until the replacement index has finished without errors.
 */
export declare function finishProvenanceRebuild(db: SqliteDatabase): number;
//# sourceMappingURL=provenance.d.ts.map
