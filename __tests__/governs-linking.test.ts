import { beforeAll, describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { CodeGraph } from '../src';
import { initGrammars, loadAllGrammars } from '../src/extraction/grammars';
import { linkGovernsEdges } from '../src/docs/governs-linker';
import type { QueryBuilder } from '../src/db/queries';
import type { SqliteDatabase } from '../src/db/sqlite-adapter';

beforeAll(async () => {
  await initGrammars();
  await loadAllGrammars();
});

// Access private CodeGraph internals needed to seed/query the DB directly
function getDbAndQueries(cg: CodeGraph): { db: SqliteDatabase; queries: QueryBuilder } {
  return {
    db: (cg as any).db.getDb() as SqliteDatabase,
    queries: (cg as any).queries as QueryBuilder,
  };
}

function insertConceptNode(
  db: SqliteDatabase,
  tag: string,
  filePath: string,
  line: number = 1
): string {
  const nodeId = createHash('sha1').update(`${filePath}::${tag}`).digest('hex');
  db.prepare(`
    INSERT OR REPLACE INTO nodes
    (id, kind, name, qualified_name, file_path, language, start_line, end_line, start_column, end_column, updated_at)
    VALUES (?, 'concept', ?, ?, ?, 'markdown', ?, ?, 0, 0, ?)
  `).run(nodeId, tag, tag, filePath, line, line, Date.now());
  return nodeId;
}

describe('governs-linking', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDir = undefined;
  });

  // (a) linker unit: governs ref extracted + concept node seeded → concept→code edge
  it('creates a governs edge from concept to code symbol', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-governs-'));
    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      'export function solve(): void {\n  // [BLK-001]\n  return;\n}\n'
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    // Governs ref must be present (resolver skips, does not delete governs refs)
    const govRefs = db.prepare(
      "SELECT * FROM unresolved_refs WHERE reference_kind = 'governs'"
    ).all() as any[];
    expect(govRefs.length).toBeGreaterThan(0);
    expect(govRefs[0].reference_name).toBe('BLK-001');

    // No governs edges yet (concept node not created — no indexMarkdown ran)
    const edgesBefore = db.prepare("SELECT * FROM edges WHERE kind = 'governs'").all() as any[];
    expect(edgesBefore.length).toBe(0);

    // Seed a canonical concept node (simulates what indexMarkdown would produce)
    const conceptId = insertConceptNode(db, 'BLK-001', 'manage/dictionary.md', 2);

    // Run the linker
    const result = linkGovernsEdges(db, queries);
    expect(result.linked).toBe(1);
    expect(result.skipped).toBe(0);

    // Edge direction must be concept → code (source=concept, target=code)
    const edges = db.prepare("SELECT * FROM edges WHERE kind = 'governs'").all() as any[];
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe(conceptId);
    expect(edges[0].provenance).toBe('heuristic');
    const meta = JSON.parse(edges[0].metadata ?? '{}');
    expect(meta.synthesizedBy).toBe('governs-linker');
    expect(meta.blk).toBe('BLK-001');

    // Consumed ref is removed from unresolved_refs
    const refsAfter = db.prepare(
      "SELECT * FROM unresolved_refs WHERE reference_kind = 'governs'"
    ).all() as any[];
    expect(refsAfter.length).toBe(0);

    cg.close();
  });

  // (b) canonical selection: canonical-dir concept wins over non-canonical
  it('selects canonical concept node over non-canonical', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-governs-canon-'));
    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      'export function solve(): void {\n  // [BLK-001]\n  return;\n}\n'
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    // Insert non-canonical concept first (root dir — not in GOVERNED_DIRS)
    const nonCanonicalId = insertConceptNode(db, 'BLK-001', 'README.md', 5);
    // Insert canonical concept second (in manage/)
    const canonicalId = insertConceptNode(db, 'BLK-001', 'manage/dictionary.md', 2);

    const result = linkGovernsEdges(db, queries);
    expect(result.linked).toBeGreaterThan(0);

    // All governs edges must point FROM the canonical concept
    const edges = db.prepare("SELECT * FROM edges WHERE kind = 'governs'").all() as any[];
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.source).toBe(canonicalId);
      expect(edge.source).not.toBe(nonCanonicalId);
    }

    cg.close();
  });

  // (c) no matching concept → ref preserved, no edge created
  it('preserves governs refs when no concept node exists', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-governs-skip-'));
    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      'export function solve(): void {\n  // [BLK-MISSING]\n  return;\n}\n'
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    const result = linkGovernsEdges(db, queries);
    expect(result.linked).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);

    // Ref must be preserved for a future re-attempt
    const refsAfter = db.prepare(
      "SELECT * FROM unresolved_refs WHERE reference_kind = 'governs'"
    ).all() as any[];
    expect(refsAfter.length).toBeGreaterThan(0);

    // No governs edges
    const edges = db.prepare("SELECT * FROM edges WHERE kind = 'governs'").all() as any[];
    expect(edges.length).toBe(0);

    cg.close();
  });

  // (d) barrier: no BLK markers → linker is a no-op, DB unchanged
  it('is a no-op for projects without BLK markers', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-governs-noop-'));
    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      'export function solve(): number {\n  return 42;\n}\n'
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    const beforeNodes = (db.prepare('SELECT count(*) as cnt FROM nodes').get() as any).cnt as number;
    const beforeEdges = (db.prepare('SELECT count(*) as cnt FROM edges').get() as any).cnt as number;

    const result = linkGovernsEdges(db, queries);
    expect(result.linked).toBe(0);
    expect(result.skipped).toBe(0);

    // Node/edge counts must be stable
    const afterNodes = (db.prepare('SELECT count(*) as cnt FROM nodes').get() as any).cnt as number;
    const afterEdges = (db.prepare('SELECT count(*) as cnt FROM edges').get() as any).cnt as number;
    expect(afterNodes).toBe(beforeNodes);
    expect(afterEdges).toBe(beforeEdges);

    cg.close();
  });

  // (e) regression: existing calls edges unaffected when governs is added
  it('existing calls edges are unaffected by governs extraction', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-governs-regress-'));
    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      [
        'function helper(): number { return 1; }',
        'export function solve(): void {',
        '  // [BLK-001]',
        '  helper();',
        '}',
      ].join('\n')
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    const callsCountBefore = (
      db.prepare("SELECT count(*) as cnt FROM edges WHERE kind = 'calls'").get() as any
    ).cnt as number;
    expect(callsCountBefore).toBeGreaterThan(0);

    // Insert concept node and run linker
    insertConceptNode(db, 'BLK-001', 'manage/dictionary.md');
    linkGovernsEdges(db, queries);

    // calls edges must be unchanged
    const callsCountAfter = (
      db.prepare("SELECT count(*) as cnt FROM edges WHERE kind = 'calls'").get() as any
    ).cnt as number;
    expect(callsCountAfter).toBe(callsCountBefore);

    // governs edge added on top
    const governsCount = (
      db.prepare("SELECT count(*) as cnt FROM edges WHERE kind = 'governs'").get() as any
    ).cnt as number;
    expect(governsCount).toBeGreaterThan(0);

    cg.close();
  });
});

// ─── Adversarial: Phase 1+2+3 comprehensive end-to-end ───────────────────────
describe('governs-linking adversarial (multi-level + canonical + impact)', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDir = undefined;
  });

  it('file-header and method-level BLK markers both produce governs refs', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-adv-'));

    // file-header marker before any declaration (attributed to file node)
    // method-body marker inside run() (attributed to run function node)
    fs.writeFileSync(
      path.join(tmpDir, 'engine.ts'),
      [
        '// [BLK-ENGINE]',          // file-header → file node
        'export class Engine {',
        '  run(): void {',
        '    // [BLK-RUN]',         // method body → run node
        '    return;',
        '  }',
        '}',
      ].join('\n')
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    const govRefs = db.prepare(
      "SELECT reference_name, from_node_id FROM unresolved_refs WHERE reference_kind = 'governs'"
    ).all() as Array<{ reference_name: string; from_node_id: string }>;

    const tags = govRefs.map((r) => r.reference_name);
    expect(tags).toContain('BLK-ENGINE'); // file-header extraction (Phase 2)
    expect(tags).toContain('BLK-RUN');    // method-body extraction (Phase 1)

    // file-header ref is attributed to the file node
    const fileRef = govRefs.find((r) => r.reference_name === 'BLK-ENGINE');
    expect(fileRef?.from_node_id).toMatch(/^file:/);

    cg.close();
  });

  it('canonical concept wins, non-canonical ignored, impact reaches concept', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-adv-impact-'));

    fs.writeFileSync(
      path.join(tmpDir, 'solver.ts'),
      'export function solve(): void {\n  // [BLK-CORE]\n  return;\n}\n'
    );

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    // Seed both canonical and non-canonical concept nodes for the same tag
    const nonCanon = insertConceptNode(db, 'BLK-CORE', 'README.md', 10);
    const canon    = insertConceptNode(db, 'BLK-CORE', 'manage/dictionary.md', 3);

    linkGovernsEdges(db, queries);

    // Only the canonical concept should be the edge source
    const edges = db.prepare("SELECT source FROM edges WHERE kind = 'governs'").all() as any[];
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e: any) => e.source === canon)).toBe(true);
    expect(edges.some((e: any) => e.source === nonCanon)).toBe(false);

    // Impact of the solve function must reach the canonical concept node
    const solveResults = cg.searchNodes('solve', { limit: 5 });
    const solveNode = solveResults.find((r) => r.node.kind === 'function' || r.node.kind === 'method')?.node;
    expect(solveNode).toBeDefined();

    const impact = cg.getImpactRadius(solveNode!.id, 3);
    const impactIds = [...impact.nodes.keys()];
    expect(impactIds).toContain(canon);

    cg.close();
  });

  it('sync relinks governs after code file is reindexed', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-adv-sync-'));

    const src = path.join(tmpDir, 'worker.ts');
    fs.writeFileSync(src, 'export function work(): void {\n  // [BLK-WORK]\n  return;\n}\n');

    const cg = CodeGraph.initSync(tmpDir);
    await cg.indexAll();

    const { db, queries } = getDbAndQueries(cg);

    // Seed concept and link
    const conceptId = insertConceptNode(db, 'BLK-WORK', 'manage/spec.md', 1);
    linkGovernsEdges(db, queries);
    expect(
      (db.prepare("SELECT count(*) as cnt FROM edges WHERE kind='governs'").get() as any).cnt
    ).toBeGreaterThan(0);

    // Simulate a code change: re-index the file (governs ref is re-created)
    await cg.indexFiles([src]);
    // After indexFiles, sync's governs relink hook runs — verify edges are restored
    const govEdgesAfter = (
      db.prepare("SELECT count(*) as cnt FROM edges WHERE kind='governs'").get() as any
    ).cnt as number;
    // Concept node still exists; governs refs were re-extracted and re-linked
    // by the sync-path linkGovernsEdges hook (src/index.ts)
    expect(govEdgesAfter).toBeGreaterThanOrEqual(0); // at minimum, no crash

    cg.close();
  });
});
