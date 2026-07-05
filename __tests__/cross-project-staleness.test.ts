/**
 * Cross-project staleness (PLAN-2 Step 1-2, 2026-07-02 실측 구멍 A).
 *
 * Opening another project via `projectPath` merely opens its DB in-process —
 * no watcher, no catch-up sync. Changes made to that project after the open
 * are invisible to queries until someone runs `codegraph sync` *in* that
 * project. These tests pin that behavior, then verify the two mitigations:
 *
 *   1. a stale-notice footer appended to cross-project responses when the
 *      target's filesystem is newer than its index DB, and
 *   2. `CODEGRAPH_CROSS_PROJECT_SYNC=1` → catch-up sync at first open.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CodeGraph from '../src/index';
import { ToolHandler } from '../src/mcp/tools';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('cross-project staleness (projectPath opens)', () => {
  let dirA: string;
  let dirB: string;
  let cgA: CodeGraph;
  const handlers: ToolHandler[] = [];
  const makeHandler = (cg: CodeGraph): ToolHandler => {
    const h = new ToolHandler(cg);
    handlers.push(h);
    return h;
  };

  beforeAll(async () => {
    dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-xproj-a-'));
    dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-xproj-b-'));

    fs.mkdirSync(path.join(dirA, 'src'));
    fs.writeFileSync(path.join(dirA, 'src', 'alpha.ts'), 'export function alphaHome() { return 1; }\n');
    cgA = CodeGraph.initSync(dirA);
    await cgA.indexAll();

    fs.mkdirSync(path.join(dirB, 'src'));
    fs.writeFileSync(path.join(dirB, 'src', 'bravo.ts'), 'export function bravoBase() { return 2; }\n');
    const cgB = CodeGraph.initSync(dirB);
    await cgB.indexAll();
    cgB.close();
  });

  afterAll(() => {
    // Cross-project opens are cached inside each handler — close them all or
    // Windows keeps B's DB locked and the temp-dir removal EPERMs.
    for (const h of handlers) {
      try { h.closeAll(); } catch { /* ignore */ }
    }
    try { cgA.close(); } catch { /* ignore */ }
    for (const d of [dirA, dirB]) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* Windows lock lag — temp dir */ }
    }
  });

  afterEach(() => {
    delete process.env.CODEGRAPH_CROSS_PROJECT_SYNC;
  });

  it('serves the other project via projectPath (sanity)', async () => {
    const handler = makeHandler(cgA);
    const res = await handler.execute('codegraph_search', { query: 'bravoBase', projectPath: dirB });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('bravoBase');
  });

  it('does NOT reflect changes made after the cross-project open (pinned gap) and appends a stale notice', async () => {
    const handler = makeHandler(cgA);
    // Open B first so the instance is cached (the real usage shape).
    await handler.execute('codegraph_search', { query: 'bravoBase', projectPath: dirB });

    // Mutate B on disk — no watcher is attached to a cross-project open.
    await sleep(30); // mtime resolution guard
    fs.writeFileSync(path.join(dirB, 'src', 'later.ts'), 'export function bravoLater() { return 3; }\n');

    // New handler = fresh open + fresh staleness check (per-open detection).
    const handler2 = makeHandler(cgA);
    const res = await handler2.execute('codegraph_search', { query: 'bravoLater', projectPath: dirB });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    // The gap: the new symbol is NOT in the index…
    expect(text).not.toContain('src/later.ts');
    // …and the response says so (Step 2 mitigation).
    expect(text).toMatch(/may be stale/);
    expect(text).toMatch(/codegraph sync/);
    expect(text).toMatch(/CODEGRAPH_CROSS_PROJECT_SYNC/);
  });

  it('CODEGRAPH_CROSS_PROJECT_SYNC=1 catches up on open and finds the new symbol', async () => {
    process.env.CODEGRAPH_CROSS_PROJECT_SYNC = '1';
    const handler = makeHandler(cgA);
    const res = await handler.execute('codegraph_search', { query: 'bravoLater', projectPath: dirB });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain('bravoLater');
    // Fresh after sync — no stale notice.
    expect(text).not.toMatch(/may be stale/);
  });

  it('never appends the cross-project notice for the default project', async () => {
    const handler = makeHandler(cgA);
    const res = await handler.execute('codegraph_search', { query: 'alphaHome', projectPath: dirA });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).not.toMatch(/may be stale/);
  });
});
