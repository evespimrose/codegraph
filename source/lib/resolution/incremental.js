"use strict";
const REFERENCE_REVISION = 'source-reference-intent-v1';

function referenceKey(ref) {
    return JSON.stringify([ref.fromNodeId, ref.referenceName, ref.referenceKind, ref.line, ref.column]);
}

function restoreIncomingReferences(db, filePath) {
    const rows = db.prepare(`SELECT e.metadata FROM edges e
        JOIN nodes target ON target.id = e.target JOIN nodes source ON source.id = e.source
        WHERE target.file_path = ? AND source.file_path != ? AND e.metadata IS NOT NULL`).all(filePath, filePath);
    const references = [];
    for (const row of rows) {
        const reference = JSON.parse(row.metadata).sourceReference;
        if (reference) references.push(reference);
    }
    return references;
}

function matchingReferenceNames(referenceNames, symbolNames) {
    const symbols = new Set(symbolNames.flatMap(name => [name.toLowerCase(), name.toLowerCase().replace(/attribute$/, '')]));
    return referenceNames.filter(name => [name, ...name.split(/::|[./\\]/)].some(part => symbols.has(part.toLowerCase())));
}

async function recoverReferenceIntent(orchestrator, queries, db, onProgress) {
    if (db.prepare('SELECT value FROM project_metadata WHERE key = ?').get(REFERENCE_REVISION)?.value === 'ready') return;
    const { initGrammars, loadGrammarsForLanguages } = require('../extraction/grammars');
    const files = queries.getAllFiles();
    await initGrammars();
    await loadGrammarsForLanguages([...new Set(files.map(file => file.language).concat('cpp'))]);
    const existing = new Set(queries.getUnresolvedReferences().map(referenceKey));
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress?.({ phase: 'references-recovery', current: i + 1, total: files.length, currentFile: file.path });
        const result = extractLegacyFile(orchestrator, file);
        if (result) publishRecoveredReferences(queries, db, file, result, existing);
        if (i % 25 === 0) await new Promise(resolve => setImmediate(resolve));
    }
    db.prepare('INSERT OR REPLACE INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)').run(REFERENCE_REVISION, 'ready', Date.now());
}

function extractLegacyFile(orchestrator, file) {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const { extractFromSource } = require('../extraction/tree-sitter');
    let content;
    try { content = fs.readFileSync(path.join(orchestrator.rootDir, file.path), 'utf8'); }
    catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    if (crypto.createHash('sha256').update(content).digest('hex') !== file.contentHash) return null;
    const result = extractFromSource(file.path, content, file.language, orchestrator.ensureDetectedFrameworks());
    const errors = result.errors.filter(error => error.severity === 'error');
    if (errors.length) throw new Error(`Reference recovery failed for ${file.path}: ${errors.map(error => error.message).join('; ')}`);
    return result;
}

function resolvedByLocation(db, filePath) {
    const edges = db.prepare(`SELECT e.id, e.source, e.kind, e.line, e.col, e.metadata FROM edges e
            JOIN nodes n ON n.id = e.source WHERE n.file_path = ? AND e.metadata IS NOT NULL`).all(filePath);
    const byLocation = new Map();
    for (const edge of edges) {
        const metadata = JSON.parse(edge.metadata);
        if (!metadata.resolvedBy) continue;
        const key = JSON.stringify([edge.source, edge.line, edge.col]);
        const entries = byLocation.get(key) ?? [];
        entries.push({ ...edge, metadata });
        byLocation.set(key, entries);
    }
    return byLocation;
}

function publishRecoveredReferences(queries, db, file, result, existing) {
    const nodeIds = new Set(queries.getNodesByFile(file.path).map(node => node.id));
    const byLocation = resolvedByLocation(db, file.path);
    const update = db.prepare('UPDATE edges SET metadata = ? WHERE id = ?');
    queries.transaction(() => {
        for (const original of result.unresolvedReferences) {
            if (!nodeIds.has(original.fromNodeId)) continue;
            const ref = { ...original, filePath: file.path, language: file.language };
            if (stampReference(byLocation, ref, update)) continue;
            if (existing.has(referenceKey(ref))) continue;
            queries.insertUnresolvedRef(ref);
            existing.add(referenceKey(ref));
        }
    });
}

function stampReference(byLocation, ref, update) {
    const matching = byLocation.get(JSON.stringify([ref.fromNodeId, ref.line, ref.column]))?.filter(edge =>
        edge.kind === ref.referenceKind || (ref.referenceKind === 'calls' && edge.kind === 'instantiates')
        || (ref.referenceKind === 'extends' && edge.kind === 'implements'));
    if (!matching?.length) return false;
    for (const edge of matching) update.run(JSON.stringify({ ...edge.metadata, sourceReference: ref }), edge.id);
    return true;
}

module.exports = { referenceKey, restoreIncomingReferences, matchingReferenceNames, recoverReferenceIntent };
