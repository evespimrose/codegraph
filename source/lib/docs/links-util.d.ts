/**
 * Shared Markdown link helpers — pure, IO-free, dependency-free.
 *
 * Extracted from `search.ts` so the doc-links promotion pass
 * (`doc-links-linker.ts`) and backlink search (`findBacklinks`) share ONE
 * implementation of basename-tolerant link resolution. Obsidian/wiki links are
 * stored as basenames (e.g. "인물_강은휘.md"), so resolving them against full
 * paths (e.g. "character/인물_강은휘.md") must behave identically on both paths.
 */
/** Normalize a path for comparison: backslashes → '/', drop leading './'. */
export declare function normPath(p: string): string;
/** Extract the filename from a path (last segment). */
export declare function baseName(p: string): string;
/** Parse a JSON string[] column (doc_links / code_refs) into a string[] (defensive). */
export declare function parseRefs(json: string | null): string[];
//# sourceMappingURL=links-util.d.ts.map