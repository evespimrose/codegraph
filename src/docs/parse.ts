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
}

/** line-2 `<!-- BLK: BLK-XXX -->` convention. */
export const BLK_RE = /<!--\s*BLK:\s*(BLK-[\w.-]+)\s*-->/i;

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
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')   // drop code fences
    .replace(/<!--[\s\S]*?-->/g, ' ')  // drop comments
    .replace(/[#>*_`~\-]+/g, ' ')      // strip md punctuation
    .replace(/\s+/g, ' ')
    .trim();
  const summary = text.slice(0, 600);
  return { blk, title, summary, codeRefs: fmCodeRefs };
}
