/**
 * PURE Markdown parsing (no IO, no heavy deps) — ported from codegraph-mdast.
 *
 * Kept dependency-free and side-effect-free so it is unit-testable without
 * sqlite-vec / transformers, and cheap to import from the indexer.
 */
export interface ParsedDoc {
    /** BLK tag from line 2 (or within the first 400 chars), else null. */
    blk: string | null;
    /** Frontmatter `title:` or first `# H1`, else null. */
    title: string | null;
    /** Prose summary (≤600 chars), code fences / comments / md punctuation stripped. */
    summary: string;
    /** Frontmatter `code_refs` — code files this doc governs — else null. */
    codeRefs: string[] | null;
    /** Extracted markdown and WikiLinks to other documents. */
    docLinks: string[] | null;
}
/** line-2 `<!-- BLK: BLK-XXX -->` convention. */
export declare const BLK_RE: RegExp;
export interface BlkTag {
    tag: string;
    line: number;
}
export declare function extractBlkTags(raw: string): BlkTag[];
/**
 * Parse frontmatter (minimal), BLK tag (line 2), title, and a search summary.
 */
export declare function parseDoc(raw: string): ParsedDoc;
//# sourceMappingURL=parse.d.ts.map