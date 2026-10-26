"use strict";
/**
 * Shared Markdown link helpers — pure, IO-free, dependency-free.
 *
 * Extracted from `search.ts` so the doc-links promotion pass
 * (`doc-links-linker.ts`) and backlink search (`findBacklinks`) share ONE
 * implementation of basename-tolerant link resolution. Obsidian/wiki links are
 * stored as basenames (e.g. "인물_강은휘.md"), so resolving them against full
 * paths (e.g. "character/인물_강은휘.md") must behave identically on both paths.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normPath = normPath;
exports.baseName = baseName;
exports.parseRefs = parseRefs;
/** Normalize a path for comparison: backslashes → '/', drop leading './'. */
function normPath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}
/** Extract the filename from a path (last segment). */
function baseName(p) {
    return normPath(p).split('/').pop() ?? p;
}
/** Parse a JSON string[] column (doc_links / code_refs) into a string[] (defensive). */
function parseRefs(json) {
    if (!json)
        return [];
    try {
        const v = JSON.parse(json);
        return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=links-util.js.map