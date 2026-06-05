/**
 * Markdown parsing (src/docs/parse.ts) — pure, dependency-free.
 *
 * parseDoc is the front of the docs write-path: it extracts the line-2 BLK tag,
 * frontmatter title/code_refs, and a stripped search summary. No sqlite-vec or
 * transformers involved, so these run unconditionally.
 */
import { describe, it, expect } from 'vitest';
import { parseDoc, BLK_RE } from '../src/docs/parse';

describe('parseDoc', () => {
  it('reads a line-2 BLK tag', () => {
    const raw = '# Title\n<!-- BLK: BLK-123 -->\n\nSome body text.';
    const doc = parseDoc(raw);
    expect(doc.blk).toBe('BLK-123');
    expect(doc.title).toBe('Title');
  });

  it('reads frontmatter code_refs (bracketed) and title', () => {
    const raw = [
      '---',
      'title: My Design Doc',
      'code_refs: [src/a.ts, "src/b.ts"]',
      '---',
      '# Heading',
      'Body prose here.',
    ].join('\n');
    const doc = parseDoc(raw);
    expect(doc.title).toBe('My Design Doc');
    expect(doc.codeRefs).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns blk=null and falls back to the first H1 for a doc with no BLK', () => {
    const raw = '# Just A Heading\n\nplain markdown, no blk, no frontmatter.';
    const doc = parseDoc(raw);
    expect(doc.blk).toBeNull();
    expect(doc.codeRefs).toBeNull();
    expect(doc.title).toBe('Just A Heading');
    expect(doc.summary).toContain('plain markdown');
  });

  it('finds a BLK within the first 400 chars (not just line 2) and strips code/comments from the summary', () => {
    const raw = [
      '# Title',
      '',
      'Intro paragraph before the marker.',
      '<!-- BLK: BLK-INLINE -->',
      '',
      '```ts',
      'const SHOULD_NOT_APPEAR = 1;',
      '```',
      '',
      'Visible prose after the fence.',
    ].join('\n');
    const doc = parseDoc(raw);
    expect(doc.blk).toBe('BLK-INLINE');
    // code fences and HTML comments are stripped from the summary
    expect(doc.summary).not.toContain('SHOULD_NOT_APPEAR');
    expect(doc.summary).not.toContain('<!--');
    expect(doc.summary).toContain('Visible prose after the fence');
    expect(doc.summary.length).toBeLessThanOrEqual(600);
  });

  it('BLK_RE matches the canonical comment form', () => {
    expect(BLK_RE.test('<!-- BLK: BLK-1 -->')).toBe(true);
    expect(BLK_RE.test('no marker here')).toBe(false);
  });
});
