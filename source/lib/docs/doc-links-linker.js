"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPureMarkdownProject = isPureMarkdownProject;
exports.shouldPromoteDocGraph = shouldPromoteDocGraph;
exports.linkDocEdges = linkDocEdges;
/**
 * doc-links-linker — post-indexMarkdown pass that promotes the Obsidian/wiki
 * links already stored in `mdast_metadata.doc_links` (JSON) into first-class
 * graph rows: ONE `doc` node per Markdown file + a `doc_link` edge per
 * citing→cited reference. This lets the four core graph queries follow doc
 * links — `codegraph_callers` (= backlinks), `codegraph_callees` (= forward
 * links) and `codegraph_impact` — not just the separate `codegraph_backlinks`.
 *
 * Mirrors governs-linker: a deterministic pass run right after indexMarkdown,
 * sharing its phase-gap rationale (doc_links exist only once indexMarkdown has
 * parsed the files).
 *
 * Gated so code projects stay byte-identical:
 *   1. docs feature must be ON (resolveDocsEnabled) — else nothing was parsed.
 *   2. promotion must be ON — auto for pure-Markdown projects, or forced via
 *      CODEGRAPH_DOC_GRAPH (1/0). A code project with docs on but no override
 *      promotes ZERO rows → its code graph is untouched.
 *
 * Best-effort: any DB/shape error degrades to {0,0,0} with no side effect.
 *
 * Idempotency: `insertNode` is INSERT OR REPLACE; replacing a doc node
 * cascade-deletes its old `doc_link` edges (FK ON DELETE CASCADE, foreign_keys
 * pragma ON), and we rebuild them in the same pass — so a re-index leaves the
 * edge set unchanged.
 */
const crypto_1 = require("crypto");
const config_1 = require("./config");
const links_util_1 = require("./links-util");
const ZERO = { nodes: 0, edges: 0, skipped: 0 };
/** Stable node id for a Markdown file's `doc` node. */
function docId(rel) {
    return (0, crypto_1.createHash)('sha1').update(`doc::${(0, links_util_1.normPath)(rel)}`).digest('hex');
}
/** Drop a trailing file extension (e.g. "인물_강은휘.md" → "인물_강은휘"). */
function stripExt(name) {
    return name.replace(/\.[^.]+$/, '');
}
/**
 * Is this a pure-Markdown project? True when the graph holds NO code nodes
 * (everything is `doc`/`concept`) AND at least one Markdown file is indexed.
 * Evaluated AFTER indexMarkdown so the code-node count is final — avoids the
 * mid-index timing trap where not all code nodes are in yet. (Markdown files
 * are NOT scanned as code, so they never create `file` nodes.)
 */
function isPureMarkdownProject(db) {
    try {
        const code = db
            .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE kind NOT IN ('doc', 'concept')`)
            .get();
        if (Number(code.n) > 0)
            return false;
        const docs = db.prepare('SELECT COUNT(*) AS n FROM mdast_metadata').get();
        return Number(docs.n) > 0;
    }
    catch {
        return false;
    }
}
/** Should doc_links be promoted? Env override wins; else auto-detect pure-MD. */
function shouldPromoteDocGraph(db) {
    return (0, config_1.docGraphEnvOverride)() ?? isPureMarkdownProject(db);
}
/**
 * Promote `mdast_metadata.doc_links` into `doc` nodes + `doc_link` edges.
 * Called by CodeGraph.indexAll/sync immediately after indexMarkdown.
 * Returns {0,0,0} when docs are off, promotion is gated off, or nothing indexed.
 */
function linkDocEdges(db, queries) {
    // Gate 1 — docs feature off → never touch the graph.
    if (!(0, config_1.resolveDocsEnabled)(db))
        return ZERO;
    // Gate 2 — promotion gated off (code project without override).
    if (!shouldPromoteDocGraph(db))
        return ZERO;
    let rows;
    try {
        rows = db
            .prepare('SELECT file_path, doc_links FROM mdast_metadata')
            .all();
    }
    catch {
        return ZERO; // mdast_metadata missing (docs forced on but never indexed)
    }
    if (rows.length === 0)
        return ZERO;
    // basename → full file_path. doc_links are stored as basenames (e.g.
    // "인물_강은휘.md"), so resolve them against full paths the same way
    // findBacklinks does (exact, then basename fallback).
    const basenameIndex = new Map();
    // A basename claimed by two files makes the index lossy — the second set()
    // wins and the link silently points at whichever file was scanned last. Those
    // resolutions are guesses, so they get tagged `heuristic` below.
    const collisions = new Set();
    for (const r of rows) {
        const name = (0, links_util_1.baseName)(r.file_path);
        if (basenameIndex.has(name))
            collisions.add(name);
        basenameIndex.set(name, (0, links_util_1.normPath)(r.file_path));
    }
    // 1) One `doc` node per Markdown file. Raw INSERT OR REPLACE mirrors how
    //    indexMarkdown creates concept nodes: `language='markdown'` is outside
    //    the code Language union by design, so the markdown layer bypasses the
    //    typed queries.insertNode (same precedent). MUST run before edges —
    //    insertEdges drops any edge whose endpoint node is absent.
    const insNode = db.prepare(`
    INSERT OR REPLACE INTO nodes
    (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
    VALUES (?, 'doc', ?, ?, ?, 'markdown', 1, 1, 0, 0, ?)
  `);
    const now = Date.now();
    let nodes = 0;
    for (const r of rows) {
        const rel = (0, links_util_1.normPath)(r.file_path);
        insNode.run(docId(rel), stripExt((0, links_util_1.baseName)(rel)), rel, rel, now);
        nodes++;
    }
    // 2) A `doc_link` edge per resolved citing→cited reference (forward link).
    const edges = [];
    let skipped = 0;
    for (const r of rows) {
        const src = (0, links_util_1.normPath)(r.file_path);
        for (const link of (0, links_util_1.parseRefs)(r.doc_links)) {
            const matched = basenameIndex.has(link) ? link : (0, links_util_1.baseName)(link);
            const resolved = basenameIndex.get(matched);
            if (!resolved) {
                skipped++;
                continue;
            }
            if (resolved === src)
                continue; // self-link — ignore
            edges.push({
                source: docId(src),
                target: docId(resolved),
                kind: 'doc_link',
                provenance: collisions.has(matched) ? 'heuristic' : 'resolver',
                metadata: {
                    synthesizedBy: 'doc-links-linker',
                    registeredAt: 'src/index.ts:linkDocEdges',
                },
            });
        }
    }
    if (edges.length > 0)
        queries.insertEdges(edges);
    return { nodes, edges: edges.length, skipped };
}
//# sourceMappingURL=doc-links-linker.js.map