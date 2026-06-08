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
export const BLK_RE = /<!--\s*BLK:\s*(BLK-[\w.-]+)\s*-->/i;

export interface BlkTag {
  tag: string;
  line: number;
}

export function extractBlkTags(raw: string): BlkTag[] {
  const tags: BlkTag[] = [];
  const lines = raw.split(/\r?\n/);
  const re = /(?:<!--\s*BLK:\s*(BLK-[\w.-]+)\s*-->|\[BLK:\s*(BLK-[\w.-]+)\]|\/\/\s*\[(BLK-[\w.-]+)\])/gi;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = re.exec(line)) !== null) {
      const tag = match[1] || match[2] || match[3];
      if (tag) {
        tags.push({ tag, line: i + 1 });
      }
    }
  }
  return tags;
}

/**
 * Parse frontmatter (minimal), BLK tag (line 2), title, and a search summary.
 */
export function parseDoc(raw: string): ParsedDoc {
  const lines = raw.split(/\r?\n/);
  const blkMatch = (lines[1] || '').match(BLK_RE) || raw.slice(0, 400).match(BLK_RE);
  const blk = blkMatch?.[1] ?? null;

  let body = raw;
  let fmCodeRefs: string[] | null = null;
  let title: string | null = null;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      const fm = lines.slice(1, end).join('\n');
      body = lines.slice(end + 1).join('\n');
      const cr = fm.match(/^code_refs:\s*\[(.*)\]/m) || fm.match(/^code_refs:\s*(.+)$/m);
      const crBody = cr?.[1];
      if (crBody !== undefined) {
        fmCodeRefs = crBody
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      const t = fm.match(/^title:\s*(.+)$/m);
      const tBody = t?.[1];
      if (tBody !== undefined) title = tBody.trim().replace(/['"]/g, '');
    }
  }
  if (!title) {
    const h = body.match(/^#\s+(.+)$/m);
    const hBody = h?.[1];
    title = hBody !== undefined ? hBody.trim() : null;
  }
  const cleanBody = body
    .replace(/```[\s\S]*?```/g, ' ')   // drop code fences
    .replace(/<!--[\s\S]*?-->/g, ' '); // drop comments

  // Extract WikiLinks [[Link]] or [[Link|Alias]]
  const wikiLinks = [...cleanBody.matchAll(/\[\[(.*?)\]\]/g)].map(m => (m[1] || '').split('|')[0].trim());
  
  // Extract Markdown links [Text](Link)
  const mdLinks = [...cleanBody.matchAll(/\[.*?\]\((.*?)\)/g)].map(m => (m[1] || '').trim());

  const docLinksRaw = [...wikiLinks, ...mdLinks].filter(link => {
    if (!link || link.startsWith('http://') || link.startsWith('https://')) return false;
    // skip fragment-only links
    if (link.startsWith('#')) return false;
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
    .replace(/[#>*_`~\-\[\]\(\)]+/g, ' ')      // strip md punctuation including brackets
    .replace(/\s+/g, ' ')
    .trim();
  const summary = text.slice(0, 600);
  return { blk, title, summary, codeRefs: fmCodeRefs, docLinks: docLinks && docLinks.length > 0 ? docLinks : null };
}
