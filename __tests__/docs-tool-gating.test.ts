/**
 * MCP tool docs-gating — the no-regression contract.
 *
 * When the docs feature is off (the default) or no doc governs the symbol's
 * file, codegraph_node / codegraph_impact / codegraph_context must emit NO
 * "Related docs" section — byte-identical to before the feature. When a
 * governing doc exists and the feature is on, node/impact append it.
 *
 * Uses the real index + real ToolHandler.execute() (pattern from
 * mcp-staleness-banner.test.ts). Governing docs are inserted directly into
 * mdast_metadata, so NO sqlite-vec / embeddings are needed — findGoverningDocs
 * is pure metadata. The docs-ON path deliberately exercises only node/impact
 * (NOT context), so searchDocs/embed is never invoked and no model is fetched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodeGraph } from '../src';
import { ToolHandler } from '../src/mcp/tools';
import { setDocsEnabled } from '../src/docs/config';
import { getServerInstructions, SERVER_INSTRUCTIONS } from '../src/mcp/server-instructions';

const ENV = 'CODEGRAPH_DOCS';

describe('MCP docs gating (node / impact / context)', () => {
  let dir: string;
  let cg: CodeGraph;
  let handler: ToolHandler;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    savedEnv = process.env[ENV];
    delete process.env[ENV]; // feature controlled via the persisted flag only
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-docs-gate-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'foo.ts'), 'export function fooFn() { return 1; }\n');
    cg = CodeGraph.initSync(dir, { config: { include: ['**/*.ts'], exclude: [] } });
    await cg.indexAll();
    handler = new ToolHandler(cg);
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
    try { cg.close(); } catch { /* ignore */ }
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const text = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const res = await handler.execute(name, args);
    return res.content[0]!.text;
  };

  const insertGoverningDoc = (file: string, codeRefs: string[]): void => {
    cg.getDb()
      .prepare(
        `INSERT INTO mdast_metadata (file_path, blk_tags, code_refs, content_summary, content_hash, last_updated)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(file, 'BLK-1', JSON.stringify(codeRefs), 'design summary', 'hash', '');
  };

  it('emits NO Related docs section when the feature is off (byte-identical default)', async () => {
    expect(await text('codegraph_node', { symbol: 'fooFn' })).not.toContain('Related docs');
    expect(await text('codegraph_impact', { symbol: 'fooFn' })).not.toContain('Related docs');
    // context's semantic section is searchDocs-driven; with docs off it returns
    // early (no embed) and must add nothing.
    expect(await text('codegraph_context', { task: 'the fooFn function' })).not.toContain('## Related docs');
  });

  it('appends a governing doc to node and impact when the feature is enabled', async () => {
    insertGoverningDoc('docs/foo.md', ['src/foo.ts']);
    setDocsEnabled(cg.getDb(), true);

    const node = await text('codegraph_node', { symbol: 'fooFn' });
    expect(node).toContain('### Related docs');
    expect(node).toContain('docs/foo.md');

    const impact = await text('codegraph_impact', { symbol: 'fooFn' });
    expect(impact).toContain('### Related docs');
    expect(impact).toContain('docs/foo.md');
  });

  it('stays byte-identical (no section) for a symbol no doc governs, even with the feature on', async () => {
    insertGoverningDoc('docs/other.md', ['src/other.ts']); // governs a DIFFERENT file
    setDocsEnabled(cg.getDb(), true);

    const node = await text('codegraph_node', { symbol: 'fooFn' });
    expect(node).not.toContain('Related docs');
  });
});

describe('getServerInstructions (opt-in instructions gate)', () => {
  it('returns the base instructions unchanged when docs are disabled', () => {
    expect(getServerInstructions(false)).toBe(SERVER_INSTRUCTIONS);
  });

  it('appends the Markdown-docs guidance when docs are enabled', () => {
    const on = getServerInstructions(true);
    expect(on.startsWith(SERVER_INSTRUCTIONS)).toBe(true);
    expect(on.length).toBeGreaterThan(SERVER_INSTRUCTIONS.length);
    expect(on).toContain('codegraph_docs');
    expect(on).toContain('Markdown docs');
  });
});
