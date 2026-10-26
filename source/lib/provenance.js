"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVENANCE_REBUILD_REASON = exports.PROVENANCE_REBUILD_META_KEY = void 0;
exports.summarizeProvenance = summarizeProvenance;
exports.getProvenanceRebuildReason = getProvenanceRebuildReason;
exports.clearProvenanceRebuildMarker = clearProvenanceRebuildMarker;
exports.finishProvenanceRebuild = finishProvenanceRebuild;
exports.needsSourceParserRebuild = needsSourceParserRebuild;
exports.SOURCE_PARSER_REVISION = 'team-source-v4';
exports.SOURCE_PARSER_REVISION_META_KEY = 'source_parser_revision';
exports.PROVENANCE_REBUILD_META_KEY = 'graph_rebuild_required';
exports.PROVENANCE_REBUILD_REASON = 'provenance-v10';
/**
 * Count edges per provenance. Untagged edges land in `unknown`, which is the
 * expected bucket for any index built before provenance stamping.
 */
function summarizeProvenance(edges) {
    const counts = {
        'tree-sitter': 0,
        scip: 0,
        resolver: 0,
        heuristic: 0,
        adapter: 0,
        inferred: 0,
        unknown: 0,
    };
    for (const edge of edges) {
        counts[edge.provenance ?? 'unknown']++;
    }
    return counts;
}
function getProvenanceRebuildReason(db) {
    const row = db.prepare('SELECT value FROM project_metadata WHERE key = ?')
        .get(exports.PROVENANCE_REBUILD_META_KEY);
    return row?.value ?? (needsSourceParserRebuild(db) ? exports.SOURCE_PARSER_REVISION : null);
}
function needsSourceParserRebuild(db) {
    const row = db.prepare('SELECT value FROM project_metadata WHERE key = ?')
        .get(exports.SOURCE_PARSER_REVISION_META_KEY);
    return row?.value !== exports.SOURCE_PARSER_REVISION;
}
function clearProvenanceRebuildMarker(db) {
    db.prepare('DELETE FROM project_metadata WHERE key = ?').run(exports.PROVENANCE_REBUILD_META_KEY);
}
/**
 * Publish a completed provenance rebuild atomically. Legacy untagged edges
 * remain queryable until the replacement index has finished without errors.
 */
function finishProvenanceRebuild(db) {
    return db.transaction(() => {
        const removed = db.prepare('DELETE FROM edges WHERE provenance IS NULL').run().changes;
        db.prepare('INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
            .run(exports.SOURCE_PARSER_REVISION_META_KEY, exports.SOURCE_PARSER_REVISION, Date.now());
        clearProvenanceRebuildMarker(db);
        return removed;
    })();
}
//# sourceMappingURL=provenance.js.map
