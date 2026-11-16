"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODE_VECTOR_KINDS = void 0;
exports.symbolText = symbolText;
exports.syncCodeVectors = syncCodeVectors;
exports.searchCodeVectors = searchCodeVectors;
exports.fuseNodeResults = fuseNodeResults;
const os = require("os");
const config_1 = require("../docs/config");
const embed_1 = require("../docs/embed");
const embed_cache_1 = require("../docs/embed-cache");
const embed_lock_1 = require("../docs/embed-lock");
const vec_1 = require("../docs/vec");
const search_tuning_1 = require("../search-tuning");
exports.CODE_VECTOR_KINDS = ['class', 'struct', 'interface', 'trait', 'protocol', 'enum', 'function', 'method', 'type_alias'];
const BATCH_SIZE = 32;
function symbolText(row) {
    const docstring = (row.docstring ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    return `${row.kind} ${row.qualified_name}\n${row.file_path}\n${row.signature ?? ''}\n${docstring}`.trim();
}
function tableExists(db, name) {
    try {
        return Boolean(db.prepare('SELECT 1 AS x FROM sqlite_master WHERE name = ? LIMIT 1').get(name));
    }
    catch {
        return false;
    }
}
function ensureTables(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS node_vector_map (
      node_id TEXT PRIMARY KEY,
      vec_rowid INTEGER NOT NULL UNIQUE,
      text_hash TEXT NOT NULL,
      model TEXT NOT NULL
    )`);
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS node_vectors USING vec0(embedding float[${config_1.EMBED_DIM}])`);
}
function inTransaction(db, work) {
    db.exec('BEGIN');
    try {
        work();
        db.exec('COMMIT');
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
// 노드 rowid 는 재색인마다 바뀌어 노드 ID 로 벡터를 잇고, 입력 해시와 모델이 같으면 다시 계산하지 않음
async function syncCodeVectors(db) {
    const summary = { enabled: false, total: 0, embedded: 0, removed: 0 };
    if (!(0, search_tuning_1.loadSearchTuning)().codeVectors)
        return summary;
    if (!(0, vec_1.loadVecExtension)(db) || !(await (0, embed_1.isEmbedAvailable)()))
        return summary;
    summary.enabled = true;
    ensureTables(db);
    const marks = exports.CODE_VECTOR_KINDS.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, kind, qualified_name, file_path, signature, docstring FROM nodes WHERE kind IN (${marks})`).all(...exports.CODE_VECTOR_KINDS);
    const wanted = new Map();
    for (const row of rows) {
        const text = embed_1.EMBED_PASSAGE_PREFIX + symbolText(row);
        wanted.set(row.id, { text, hash: (0, embed_cache_1.embedTextKey)(text) });
    }
    summary.total = wanted.size;
    const kept = new Set();
    const deleteVector = db.prepare('DELETE FROM node_vectors WHERE rowid = ?');
    const deleteMap = db.prepare('DELETE FROM node_vector_map WHERE node_id = ?');
    inTransaction(db, () => {
        for (const row of db.prepare('SELECT node_id, vec_rowid, text_hash, model FROM node_vector_map').all()) {
            const want = wanted.get(row.node_id);
            if (want && want.hash === row.text_hash && row.model === embed_1.EMBED_MODEL_ID) {
                kept.add(row.node_id);
                continue;
            }
            deleteVector.run(BigInt(row.vec_rowid));
            deleteMap.run(row.node_id);
            summary.removed++;
        }
    });
    const pending = [...wanted].filter(([id]) => !kept.has(id)).map(([id, value]) => ({ id, ...value }));
    if (pending.length === 0)
        return summary;
    let nextRowid = Number(db.prepare('SELECT COALESCE(MAX(vec_rowid), 0) AS n FROM node_vector_map').get().n) + 1;
    const insertVector = db.prepare('INSERT INTO node_vectors(rowid, embedding) VALUES (?, ?)');
    const insertMap = db.prepare('INSERT INTO node_vector_map(node_id, vec_rowid, text_hash, model) VALUES (?, ?, ?, ?)');
    const publish = (entries) => {
        inTransaction(db, () => {
            for (const entry of entries) {
                insertVector.run(BigInt(nextRowid), (0, vec_1.floatBlob)(entry.vector));
                insertMap.run(entry.id, nextRowid, entry.hash, embed_1.EMBED_MODEL_ID);
                nextRowid++;
            }
        });
        summary.embedded += entries.length;
    };
    const cache = (0, embed_cache_1.openEmbedCache)();
    let lock = null;
    let previousPriority = null;
    try {
        let hits = new Map();
        try {
            hits = cache ? cache.get(embed_1.EMBED_MODEL_ID, pending.map((entry) => entry.hash)) : new Map();
        }
        catch {
            hits = new Map();
        }
        const cached = pending.filter((entry) => hits.has(entry.hash)).map((entry) => ({ ...entry, vector: hits.get(entry.hash) }));
        const misses = pending.filter((entry) => !hits.has(entry.hash));
        if (cached.length > 0)
            publish(cached);
        if (misses.length === 0)
            return summary;
        lock = await (0, embed_lock_1.acquireEmbedLock)({ dir: (0, embed_cache_1.cacheDirectory)() });
        try {
            previousPriority = os.getPriority();
            os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
        }
        catch {
            previousPriority = null;
        }
        const batches = [];
        for (let offset = 0; offset < misses.length; offset += BATCH_SIZE)
            batches.push(misses.slice(offset, offset + BATCH_SIZE));
        let index = 0;
        for await (const vectors of (0, embed_1.embedBatches)(batches.map((batch) => batch.map((entry) => entry.text)))) {
            const entries = batches[index++].map((entry, position) => ({ ...entry, vector: vectors[position] }));
            publish(entries);
            try {
                cache?.put(embed_1.EMBED_MODEL_ID, entries.map((entry) => ({ key: entry.hash, vector: entry.vector })));
            }
            catch {
                // 캐시 쓰기 실패는 색인을 막지 않음
            }
            lock.touch();
        }
        return summary;
    }
    finally {
        lock?.release();
        cache?.close();
        if (previousPriority !== null) {
            try {
                os.setPriority(previousPriority);
            }
            catch {
                // 우선순위 복원 실패는 무시함
            }
        }
    }
}
async function searchCodeVectors(db, query, k) {
    try {
        if (!(0, search_tuning_1.loadSearchTuning)().codeVectors || !query || !query.trim())
            return [];
        if (!tableExists(db, 'node_vector_map') || !(0, vec_1.loadVecExtension)(db))
            return [];
        if (!db.prepare('SELECT 1 AS x FROM node_vector_map WHERE model = ? LIMIT 1').get(embed_1.EMBED_MODEL_ID))
            return [];
        const vector = await (0, embed_1.embed)(embed_1.EMBED_QUERY_PREFIX + query.trim());
        const depth = Math.max(1, Math.floor(k));
        const rows = db.prepare(`
      WITH knn AS (SELECT rowid, distance FROM node_vectors WHERE embedding MATCH ? AND k = ${depth})
      SELECT m.node_id AS id FROM knn JOIN node_vector_map m ON m.vec_rowid = knn.rowid
      WHERE m.model = ? ORDER BY knn.distance
    `).all((0, vec_1.floatBlob)(vector), embed_1.EMBED_MODEL_ID);
        return rows.map((row) => row.id);
    }
    catch {
        return [];
    }
}
function fuseNodeResults(lexical, vectorIds, getNode, limit, kinds) {
    const weight = (0, search_tuning_1.loadSearchTuning)().codeVectorWeight;
    const ranked = new Map();
    lexical.forEach((result, index) => ranked.set(result.node.id, { node: result.node, score: 1 / (61 + index) }));
    vectorIds.forEach((id, index) => {
        const existing = ranked.get(id);
        if (existing) {
            existing.score += weight / (61 + index);
            return;
        }
        const node = getNode(id);
        if (!node || (kinds && kinds.length > 0 && !kinds.includes(node.kind)))
            return;
        ranked.set(id, { node, score: weight / (61 + index) });
    });
    return [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
