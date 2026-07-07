import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodeGraph } from '../src';
import { setDocsEnabled, DOC_GRAPH_ENV_VAR } from '../src/docs/config';
import {
  linkDocEdges,
  isPureMarkdownProject,
  shouldPromoteDocGraph,
} from '../src/docs/doc-links-linker';
import type { QueryBuilder } from '../src/db/queries';
import type { SqliteDatabase } from '../src/db/sqlite-adapter';

// These tests seed `mdast_metadata` directly (bypassing embeddings/sqlite-vec)
// and drive the linker, so no grammar load / indexAll is needed.

function getDbAndQueries(cg: CodeGraph): { db: SqliteDatabase; queries: QueryBuilder } {
  return {
    db: (cg as any).db.getDb() as SqliteDatabase,
    queries: (cg as any).queries as QueryBuilder,
  };
}

/** Seed an mdast_metadata row directly (what indexMarkdown would persist). */
function seedDoc(db: SqliteDatabase, filePath: string, docLinks: string[] | null): void {
  db.prepare(
    `INSERT OR REPLACE INTO mdast_metadata (file_path, doc_links, last_updated)
     VALUES (?, ?, datetime('now'))`
  ).run(filePath, docLinks ? JSON.stringify(docLinks) : null);
}

/** Seed a minimal code node so the project is NOT pure-Markdown. */
function seedCodeNode(db: SqliteDatabase, name: string, filePath: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO nodes
     (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
     VALUES (?, 'function', ?, ?, ?, 'typescript', 1, 1, 0, 0, ?)`
  ).run(`fn::${name}`, name, name, filePath, Date.now());
}

function docNodeId(db: SqliteDatabase, rel: string): string | undefined {
  const row = db
    .prepare("SELECT id FROM nodes WHERE kind = 'doc' AND qualified_name = ?")
    .get(rel) as { id?: string } | undefined;
  return row?.id;
}

const count = (db: SqliteDatabase, sql: string): number =>
  (db.prepare(sql).get() as { n: number }).n;
const countDocNodes = (db: SqliteDatabase) =>
  count(db, "SELECT count(*) AS n FROM nodes WHERE kind = 'doc'");
const countDocLinkEdges = (db: SqliteDatabase) =>
  count(db, "SELECT count(*) AS n FROM edges WHERE kind = 'doc_link'");

describe('doc-links-linking', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    delete process.env[DOC_GRAPH_ENV_VAR];
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDir = undefined;
  });

  // (a) pure-Markdown auto-detect: doc nodes + doc_link edges, with
  //     callers = backlinks and callees = forward links.
  it('promotes doc_links into doc nodes + doc_link edges (pure-Markdown auto-detect)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedDoc(db, 'a.md', ['b.md']); // a → b
    seedDoc(db, 'b.md', ['c.md']); // b → c
    seedDoc(db, 'c.md', null);     // c → (none)

    expect(isPureMarkdownProject(db)).toBe(true);

    const res = linkDocEdges(db, queries);
    expect(res.nodes).toBe(3);
    expect(res.edges).toBe(2);
    expect(res.skipped).toBe(0);
    expect(countDocNodes(db)).toBe(3);
    expect(countDocLinkEdges(db)).toBe(2);

    const aId = docNodeId(db, 'a.md');
    const bId = docNodeId(db, 'b.md');
    const cId = docNodeId(db, 'c.md');
    expect(aId && bId && cId).toBeTruthy();

    // callers(b) = backlinks (who links TO b) = [a]
    const callers = cg.getCallers(bId!).map((r) => r.node.id);
    expect(callers).toContain(aId);
    // callees(b) = forward links (what b links to) = [c]
    const callees = cg.getCallees(bId!).map((r) => r.node.id);
    expect(callees).toContain(cId);

    // edge direction citing → cited, with heuristic provenance + synthesizedBy
    const edge = db
      .prepare("SELECT * FROM edges WHERE kind = 'doc_link' AND source = ? AND target = ?")
      .get(aId, bId) as { provenance?: string; metadata?: string } | undefined;
    expect(edge).toBeTruthy();
    expect(edge!.provenance).toBe('heuristic');
    expect(JSON.parse(edge!.metadata ?? '{}').synthesizedBy).toBe('doc-links-linker');

    cg.close();
  });

  // (b) code project without override → promotion gated OFF, graph byte-stable.
  it('is gated off on a code project without override', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-off-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedCodeNode(db, 'solve', 'solver.ts');
    seedDoc(db, 'a.md', ['b.md']);
    seedDoc(db, 'b.md', null);

    expect(isPureMarkdownProject(db)).toBe(false);
    expect(shouldPromoteDocGraph(db)).toBe(false);

    const nodesBefore = count(db, 'SELECT count(*) AS n FROM nodes');
    const edgesBefore = count(db, 'SELECT count(*) AS n FROM edges');

    const res = linkDocEdges(db, queries);
    expect(res).toEqual({ nodes: 0, edges: 0, skipped: 0 });
    expect(count(db, 'SELECT count(*) AS n FROM nodes')).toBe(nodesBefore);
    expect(count(db, 'SELECT count(*) AS n FROM edges')).toBe(edgesBefore);
    expect(countDocNodes(db)).toBe(0);

    cg.close();
  });

  // (c1) CODEGRAPH_DOC_GRAPH=1 forces promotion ON even on a code project.
  it('CODEGRAPH_DOC_GRAPH=1 forces promotion on a code project', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-on-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedCodeNode(db, 'solve', 'solver.ts'); // would otherwise gate OFF
    seedDoc(db, 'a.md', ['b.md']);
    seedDoc(db, 'b.md', null);

    process.env[DOC_GRAPH_ENV_VAR] = '1';
    expect(shouldPromoteDocGraph(db)).toBe(true);

    const res = linkDocEdges(db, queries);
    expect(res.nodes).toBe(2);
    expect(res.edges).toBe(1);
    expect(countDocLinkEdges(db)).toBe(1);

    cg.close();
  });

  // (c2) CODEGRAPH_DOC_GRAPH=0 forces promotion OFF even on a pure-MD project.
  it('CODEGRAPH_DOC_GRAPH=0 forces promotion off on a pure-Markdown project', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-force-off-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedDoc(db, 'a.md', ['b.md']);
    seedDoc(db, 'b.md', null);

    expect(isPureMarkdownProject(db)).toBe(true); // would auto-promote
    process.env[DOC_GRAPH_ENV_VAR] = '0';
    expect(shouldPromoteDocGraph(db)).toBe(false); // override wins

    const res = linkDocEdges(db, queries);
    expect(res).toEqual({ nodes: 0, edges: 0, skipped: 0 });
    expect(countDocNodes(db)).toBe(0);

    cg.close();
  });

  // (d) idempotent: re-running leaves the doc_link edge count unchanged
  //     (INSERT OR REPLACE on doc nodes cascade-clears stale edges; rebuilt).
  it('is idempotent across re-runs (edge count stable)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-idem-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedDoc(db, 'a.md', ['b.md']);
    seedDoc(db, 'b.md', ['c.md']);
    seedDoc(db, 'c.md', null);

    linkDocEdges(db, queries);
    expect(countDocLinkEdges(db)).toBe(2);
    // second pass must NOT duplicate edges
    linkDocEdges(db, queries);
    expect(countDocLinkEdges(db)).toBe(2);
    expect(countDocNodes(db)).toBe(3);

    cg.close();
  });

  // (e) basename tolerance: a bare "인물_강은휘.md" link resolves to the
  //     full "character/인물_강은휘.md" path (Obsidian-style).
  it('resolves bare basename links to their full path', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-doclink-base-'));
    const cg = CodeGraph.initSync(tmpDir);
    const { db, queries } = getDbAndQueries(cg);
    setDocsEnabled(db, true);

    seedDoc(db, 'index.md', ['인물_강은휘.md']);     // bare basename link
    seedDoc(db, 'character/인물_강은휘.md', null);   // lives under a subdir

    const res = linkDocEdges(db, queries);
    expect(res.edges).toBe(1);
    expect(res.skipped).toBe(0);

    const indexId = docNodeId(db, 'index.md');
    const charId = docNodeId(db, 'character/인물_강은휘.md');
    const callees = cg.getCallees(indexId!).map((r) => r.node.id);
    expect(callees).toContain(charId);

    cg.close();
  });
});
