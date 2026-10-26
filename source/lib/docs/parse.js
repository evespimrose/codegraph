"use strict";
/**
 * PURE Markdown parsing (no IO, no heavy deps) — ported from codegraph-mdast.
 *
 * Kept dependency-free and side-effect-free so it is unit-testable without
 * sqlite-vec / transformers, and cheap to import from the indexer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLK_RE = void 0;
exports.extractBlkTags = extractBlkTags;
exports.parseDoc = parseDoc;
/** line-2 `<!-- BLK: BLK-XXX -->` convention. */
exports.BLK_RE = /<!--\s*BLK:\s*(BLK-[\w.-]+)\s*-->/i;
/** A single BLK id, e.g. `BLK-001` / `BLK-INLINE`. */
const BLK_ID = String.raw `BLK-[\w.-]+`;
/** One-or-more comma-separated BLK ids — a cell/comment may carry several. */
const BLK_LIST = String.raw `${BLK_ID}(?:\s*,\s*${BLK_ID})*`;
function extractBlkTags(raw) {
    const tags = [];
    const lines = raw.split(/\r?\n/);
    // Four sites where a BLK id is *declared* (not merely mentioned in prose):
    //   1) <!-- BLK: ids -->  HTML comment (cxt line-2 convention; multi-id ok)
    //   2) [BLK: ids]         inline bracket form (multi-id ok)
    //   3) // [BLK-XXX]       code-comment form (single id)
    //   4) | ids |            a markdown table cell whose content is *only* BLK
    //                         ids — the dictionary.md catalog form. Pipe-bounded
    //                         so a prose "see BLK-001" never matches; the closing
    //                         `|` is a lookahead, so adjacent BLK cells in one row
    //                         both resolve (the shared pipe is not consumed).
    const re = new RegExp(`<!--\\s*BLK:\\s*(${BLK_LIST})\\s*-->` +
        `|\\[BLK:\\s*(${BLK_LIST})\\]` +
        `|//\\s*\\[(${BLK_ID})\\]` +
        `|\\|\\s*(${BLK_LIST})\\s*(?=\\|)`, 'gi');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line)
            continue;
        let match;
        while ((match = re.exec(line)) !== null) {
            const captured = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
            for (const part of captured.split(',')) {
                const tag = part.trim();
                // Drop the `BLK-XXX` (all-X) placeholder used in format docs/examples.
                if (tag && !/^BLK-X+$/i.test(tag)) {
                    tags.push({ tag, line: i + 1 });
                }
            }
        }
    }
    return tags;
}
/**
 * Parse frontmatter (minimal), BLK tag (line 2), title, and a search summary.
 */
function parseDoc(raw) {
    const lines = raw.split(/\r?\n/);
    const blkMatch = (lines[1] || '').match(exports.BLK_RE) || raw.slice(0, 400).match(exports.BLK_RE);
    const blk = blkMatch?.[1] ?? null;
    let body = raw;
    let fmCodeRefs = null;
    let title = null;
    if (lines[0]?.trim() === '---') {
        const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
        if (end > 0) {
            const fm = lines.slice(1, end).join('\n');
            body = lines.slice(end + 1).join('\n');
            const inlineRefs = fm.match(/^code_refs:[ \t]*\[(.*)\]/m) || fm.match(/^code_refs:[ \t]*(\S.+)$/m);
            const blockRefs = fm.match(/^code_refs:[ \t]*\r?\n((?:[ \t]*-[ \t]*[^\r\n]+\r?\n?)*)/m);
            if (inlineRefs?.[1] !== undefined) {
                fmCodeRefs = splitCodeRefs(inlineRefs[1]);
            }
            else if (blockRefs?.[1]) {
                fmCodeRefs = blockRefs[1]
                    .split(/\r?\n/)
                    .map((line) => line.replace(/^\s*-\s*/, ''))
                    .flatMap(splitCodeRefs)
                    .filter(Boolean);
            }
            const t = fm.match(/^title:\s*(.+)$/m);
            const tBody = t?.[1];
            if (tBody !== undefined)
                title = tBody.trim().replace(/['"]/g, '');
        }
    }
    if (!title) {
        const h = body.match(/^#\s+(.+)$/m);
        const hBody = h?.[1];
        title = hBody !== undefined ? hBody.trim() : null;
    }
    const cleanBody = body
        .replace(/(```|~~~)[^\n]*\n[\s\S]*?\1/g, ' ') // drop matching code fences
        .replace(/<!--[\s\S]*?-->/g, ' '); // drop comments
    // Extract WikiLinks [[Link]] or [[Link|Alias]]
    const wikiLinks = [...cleanBody.matchAll(/\[\[(.*?)\]\]/g)].map(m => (m[1] ?? '').split('|')[0]?.trim() ?? '');
    // Extract Markdown links [Text](Link)
    const mdLinks = [...cleanBody.matchAll(/\[.*?\]\((.*?)\)/g)].map(m => (m[1] || '').trim());
    const docLinksRaw = [...wikiLinks, ...mdLinks].filter(link => {
        if (!link || link.startsWith('http://') || link.startsWith('https://'))
            return false;
        // skip fragment-only links
        if (link.startsWith('#'))
            return false;
        return true;
    });
    const docLinks = docLinksRaw.length > 0 ? Array.from(new Set(docLinksRaw.map(link => {
        // Strip fragment if present (e.g. file.md#section -> file.md)
        let pathPart = link.split('#')[0] || '';
        let normalized = pathPart.replace(/\\/g, '/').trim();
        // Auto-append .md if it has no extension
        if (normalized && !normalized.match(/\.[a-zA-Z0-9]+$/)) {
            normalized += '.md';
        }
        return normalized;
    }))).filter(Boolean) : null;
    const text = cleanBody
        .replace(/[#>*_`~\-\[\]\(\)]+/g, ' ') // strip md punctuation including brackets
        .replace(/\s+/g, ' ')
        .trim();
    const summary = text.slice(0, 600);
    return { blk, title, summary, codeRefs: fmCodeRefs, docLinks: docLinks && docLinks.length > 0 ? docLinks : null };
}
function splitCodeRefs(value) {
    return value
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}
//# sourceMappingURL=parse.js.map