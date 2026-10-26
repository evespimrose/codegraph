"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOVERNED_DIRS = void 0;
exports.ensureVectorTable = ensureVectorTable;
exports.ensureDocumentFtsTable = ensureDocumentFtsTable;
exports.indexMarkdown = indexMarkdown;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const config_1 = require("./config");
const document_parser_1 = require("./document-parser");
const document_store_1 = require("./document-store");
const embed_1 = require("./embed");
const parse_1 = require("./parse");
const scan_files_1 = require("./scan-files");
const vec_1 = require("./vec");
exports.GOVERNED_DIRS = ['cxt/', 'docs/contextmd/', 'manage/'];
const EMBEDDING_BATCH_SIZE = 16;
function ensureVectorTable(db) {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS mdast_vectors USING vec0(embedding float[${config_1.EMBED_DIM}]);`);
}
function ensureDocumentFtsTable(db) {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(file_path, title, summary, structure);`);
}
async function indexMarkdown(db, projectRoot, opts = {}) {
    const result = {
        enabled: false,
        available: false,
        scanned: 0,
        indexed: 0,
        skipped: 0,
        removed: 0,
        warnings: [],
        errors: [],
        semanticState: 'disabled',
        formats: {},
        changedPaths: [],
    };
    if (!(0, config_1.resolveDocsEnabled)(db))
        return result;
    result.enabled = true;
    result.semanticState = 'unavailable';
    const vectorAvailable = (0, vec_1.loadVecExtension)(db);
    const embeddingAvailable = await (0, embed_1.isEmbedAvailable)();
    let semanticAvailable = vectorAvailable && embeddingAvailable;
    result.available = semanticAvailable;
    if (!vectorAvailable)
        pushWarn(result, opts, 'sqlite-vec unavailable; lexical document indexing remains active.');
    if (!embeddingAvailable)
        pushWarn(result, opts, 'Document embeddings unavailable; lexical document indexing remains active.');
    if (semanticAvailable)
        result.semanticState = 'ready';
    (0, config_1.setDocsEnabled)(db, true);
    ensureDocumentFtsTable(db);
    if (vectorAvailable)
        ensureVectorTable(db);
    const store = new document_store_1.DocumentStore(db, vectorAvailable);
    const pendingEmbeddings = [];
    let documents;
    try {
        documents = (0, scan_files_1.listTextDocumentFiles)(projectRoot, { respectGitignore: opts.respectGitignore }, opts.visibleFiles);
    }
    catch (error) {
        recordDocumentFailure(result, opts, '.', error);
        persistDocumentFailures(db, result.errors);
        throw error;
    }
    result.scanned = documents.length;
    for (const document of documents) {
        result.formats[document.format] = (result.formats[document.format] ?? 0) + 1;
    }
    const diskPaths = new Set(documents.map((document) => normalizeRelative(projectRoot, document.absolutePath)));
    const storedDocuments = store.listDocuments();
    const removedDocuments = storedDocuments.filter((document) => !diskPaths.has(document.file_path));
    if (removedDocuments.length > 0) {
        store.removeDocuments(removedDocuments);
        result.removed = removedDocuments.length;
        result.changedPaths.push(...removedDocuments.map((document) => document.file_path));
    }
    for (const document of documents) {
        const relativePath = normalizeRelative(projectRoot, document.absolutePath);
        let stat;
        try {
            stat = fs.statSync(document.absolutePath);
        }
        catch (error) {
            recordDocumentFailure(result, opts, relativePath, error);
            continue;
        }
        const existing = store.getMetadata(relativePath);
        const vectorIsCurrent = !semanticAvailable || existing?.embedding_model === embed_1.EMBED_MODEL_ID;
        if (existing
            && existing.file_size === stat.size
            && Math.floor(existing.modified_at ?? -1) === Math.floor(stat.mtimeMs)
            && vectorIsCurrent) {
            result.skipped++;
            continue;
        }
        let raw;
        try {
            raw = fs.readFileSync(document.absolutePath, 'utf8');
        }
        catch (error) {
            recordDocumentFailure(result, opts, relativePath, error);
            continue;
        }
        const contentHash = (0, crypto_1.createHash)('sha256').update(raw).digest('hex');
        if (existing?.content_hash === contentHash
            && (!semanticAvailable || existing.embedding_model === embed_1.EMBED_MODEL_ID)) {
            store.updateStats(existing.id, stat.size, stat.mtimeMs);
            result.skipped++;
            continue;
        }
        try {
            const parsed = (0, document_parser_1.parseDocument)(raw, document.format);
            const blkTags = document.format === 'markdown' ? (0, parse_1.extractBlkTags)(raw) : [];
            if (document.format === 'markdown' && !parsed.blk && exports.GOVERNED_DIRS.some((prefix) => relativePath.startsWith(prefix))) {
                pushWarn(result, opts, `${relativePath}: missing line-2 <!-- BLK: BLK-XXX --> tag`);
            }
            const publishedRowId = store.publish({
                filePath: relativePath,
                parsed,
                blkTags,
                contentHash,
                fileSize: stat.size,
                modifiedAt: stat.mtimeMs,
                publishConcepts: document.format === 'markdown' && exports.GOVERNED_DIRS.some((prefix) => relativePath.startsWith(prefix)),
            });
            if (semanticAvailable) {
                pendingEmbeddings.push({ rowId: publishedRowId, text: parsed.embeddingText, filePath: relativePath });
            }
        }
        catch (error) {
            recordDocumentFailure(result, opts, relativePath, error);
            continue;
        }
        result.indexed++;
        result.changedPaths.push(relativePath);
    }
    if (semanticAvailable) {
        const failure = await publishPendingEmbeddings(store, pendingEmbeddings);
        if (failure) {
            semanticAvailable = false;
            result.available = false;
            result.semanticState = 'unavailable';
            pushWarn(result, opts, `${failure.filePath}: embedding batch unavailable: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
        }
    }
    persistDocumentFailures(db, result.errors);
    return result;
}
// 실패하면 앞 배치까지는 이미 게시된 채로 첫 실패 배치의 경로와 오류를 돌려줌
async function publishPendingEmbeddings(store, pendingEmbeddings) {
    const batches = [];
    for (let offset = 0; offset < pendingEmbeddings.length; offset += EMBEDDING_BATCH_SIZE) {
        batches.push(pendingEmbeddings.slice(offset, offset + EMBEDDING_BATCH_SIZE));
    }
    let published = 0;
    try {
        const texts = batches.map((batch) => batch.map((item) => embed_1.EMBED_PASSAGE_PREFIX + item.text));
        for await (const vectors of (0, embed_1.embedBatches)(texts)) {
            store.publishEmbeddings(batches[published].map((item, index) => ({ rowId: item.rowId, vector: vectors[index] })));
            published++;
        }
        return null;
    }
    catch (error) {
        return { error, filePath: batches[published]?.[0]?.filePath ?? 'document batch' };
    }
}
function recordDocumentFailure(result, opts, filePath, error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push({ filePath, message });
    pushWarn(result, opts, `${filePath}: ${message}`);
}
function persistDocumentFailures(db, errors) {
    db.prepare(`INSERT INTO project_metadata (key, value, updated_at) VALUES ('document_index_errors', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(JSON.stringify(errors), Date.now());
}
function pushWarn(result, opts, message) {
    result.warnings.push(message);
    opts.onWarn?.(message);
}
function normalizeRelative(root, absolutePath) {
    return path.relative(root, absolutePath).split(path.sep).join('/');
}
//# sourceMappingURL=indexer.js.map
