/**
 * Markdown parsing (src/docs/parse.ts) — pure, dependency-free.
 *
 * parseDoc is the front of the docs write-path: it extracts the line-2 BLK tag,
 * frontmatter title/code_refs, and a stripped search summary. No sqlite-vec or
 * transformers involved, so these run unconditionally.
 */
import { describe, it, expect } from 'vitest';
import { parseDoc, BLK_RE, extractBlkTags } from '../src/docs/parse';

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

describe('extractBlkTags', () => {
  const tagsOf = (raw: string) => extractBlkTags(raw).map((t) => t.tag);

  it('extracts the three comment/bracket/code forms', () => {
    expect(tagsOf('<!-- BLK: BLK-001 -->')).toEqual(['BLK-001']);
    expect(tagsOf('text [BLK: BLK-002] text')).toEqual(['BLK-002']);
    expect(tagsOf('  // [BLK-003] trailing')).toEqual(['BLK-003']);
  });

  it('extracts a BLK id from a dictionary-style table cell', () => {
    const row = '| `Domain/TurnAwareAStar.cs` | BLK-001 | [1] PathSolver | `TurnAwareAStar` |';
    expect(tagsOf(row)).toEqual(['BLK-001']);
  });

  it('splits comma-separated multi-tags in both comment and table forms', () => {
    expect(tagsOf('<!-- BLK: BLK-005, BLK-006 -->')).toEqual(['BLK-005', 'BLK-006']);
    expect(tagsOf('| `Phase2UI.cs` | BLK-004, BLK-013 | [2] PhaseUI | `Phase2UI` |')).toEqual([
      'BLK-004',
      'BLK-013',
    ]);
  });

  it('does NOT match a bare BLK id mentioned in prose (pipe-bounded only)', () => {
    expect(tagsOf('See BLK-001 for the pathfinding contract.')).toEqual([]);
    // text inside a cell that is not *only* the id must not match
    expect(tagsOf('| 정렬 BLK-001 참조 | x |')).toEqual([]);
  });

  it('drops the BLK-XXX placeholder used in format docs', () => {
    expect(tagsOf('형식: `<!-- BLK: BLK-XXX -->`')).toEqual([]);
    expect(tagsOf('| BLK-XXX |')).toEqual([]);
  });

  it('records the 1-based line number of each tag', () => {
    const raw = ['# Title', '<!-- BLK: BLK-001 -->', '', '| x | BLK-002 |'].join('\n');
    expect(extractBlkTags(raw)).toEqual([
      { tag: 'BLK-001', line: 2 },
      { tag: 'BLK-002', line: 4 },
    ]);
  });
});
