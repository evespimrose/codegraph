/**
 * governs-linker — post-indexMarkdown pass that resolves preserved
 * `governs` UnresolvedRefs into `governs` edges (concept → code symbol).
 *
 * Why a separate pass: concept nodes are created by indexMarkdown, which runs
 * AFTER the general resolver. By the time concept nodes exist, the resolver
 * has already finished. This linker bridges that phase gap.
 *
 * Barrier: projects that don't use `// [BLK-XXX]` markers produce zero
 * governs refs → this function is a no-op for them.
 */
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { QueryBuilder } from '../db/queries';
import { GOVERNED_DIRS } from './indexer';

export interface GovernsLinkResult {
  /** governs edges successfully created */
  linked: number;
  /** governs refs with no matching concept node (preserved for future re-attempt) */
  skipped: number;
}

interface ConceptRow {
  id: string;
  file_path: string;
  start_line: number;
}

/**
 * Pick the canonical concept node among candidates:
 * (i) governed/canonical directory preferred
 * (ii) shortest file path, then alphabetical
 * (iii) earliest line
 */
function pickCanonical(candidates: ConceptRow[]): ConceptRow | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.slice().sort((a, b) => {
    const aCanon = GOVERNED_DIRS.some((d) => a.file_path.startsWith(d)) ? 0 : 1;
    const bCanon = GOVERNED_DIRS.some((d) => b.file_path.startsWith(d)) ? 0 : 1;
    if (aCanon !== bCanon) return aCanon - bCanon;
    if (a.file_path.length !== b.file_path.length) return a.file_path.length - b.file_path.length;
    const cmp = a.file_path.localeCompare(b.file_path);
    if (cmp !== 0) return cmp;
    return a.start_line - b.start_line;
  })[0];
}

/**
 * Resolve all preserved `governs` unresolved refs into graph edges.
 * Called by CodeGraph.indexAll immediately after indexMarkdown succeeds.
 * Safe to call when docs are disabled or no BLK markers exist — returns {0,0}.
 */
export function linkGovernsEdges(
  db: SqliteDatabase,
  queries: QueryBuilder
): GovernsLinkResult {
  const govRefs = queries.getUnresolvedReferencesByKind('governs');
  // Barrier: no-op for projects without BLK tag conventions
  if (govRefs.length === 0) return { linked: 0, skipped: 0 };

  const getConceptsByName = db.prepare(
    `SELECT id, file_path, start_line FROM nodes WHERE kind = 'concept' AND name = ?`
  );

  // Cache canonical concept per tag (avoids repeated DB lookups for the same tag)
  const tagToCanonical = new Map<string, ConceptRow | null>();
  const consumed: Array<{ fromNodeId: string; referenceName: string; referenceKind: string }> = [];
  let linked = 0;
  let skipped = 0;

  for (const ref of govRefs) {
    const tag = ref.referenceName;
    if (!tagToCanonical.has(tag)) {
      const rows = getConceptsByName.all(tag) as ConceptRow[];
      tagToCanonical.set(tag, pickCanonical(rows) ?? null);
    }
    const concept = tagToCanonical.get(tag) ?? null;
    if (!concept) {
      // No concept node yet — preserve the ref so a future index pass can link it
      skipped++;
      continue;
    }

    queries.insertEdges([
      {
        source: concept.id,
        target: ref.fromNodeId,
        kind: 'governs',
        provenance: 'heuristic',
        metadata: {
          synthesizedBy: 'governs-linker',
          registeredAt: 'src/index.ts:linkGovernsEdges',
          blk: tag,
          confidence: 0.5,
        },
        line: ref.line,
        column: ref.column,
      },
    ]);
    consumed.push({ fromNodeId: ref.fromNodeId, referenceName: tag, referenceKind: 'governs' });
    linked++;
  }

  if (consumed.length > 0) {
    queries.deleteSpecificResolvedReferences(consumed);
  }

  return { linked, skipped };
}
