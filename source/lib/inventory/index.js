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
exports.refreshFileInventory = refreshFileInventory;
exports.getFileInventorySummary = getFileInventorySummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../docs/config");
const scan_files_1 = require("../docs/scan-files");
const classifier_1 = require("./classifier");
const utils_1 = require("../utils");
function refreshFileInventory(db, projectRoot, opts = {}) {
    const result = {
        scanned: 0,
        updated: 0,
        removed: 0,
        byStatus: {
            indexed: 0,
            'metadata-only': 0,
            ignored: 0,
            unsupported: 0,
            error: 0,
            'secret-excluded': 0,
        },
    };
    const documentsEnabled = (0, config_1.resolveDocsEnabled)(db);
    const existingRows = db.prepare('SELECT * FROM file_inventory').all();
    const existing = new Map(existingRows.map((row) => [row.path, row]));
    const sourceHash = db.prepare('SELECT content_hash, errors FROM files WHERE path = ?');
    const documentHash = db.prepare('SELECT content_hash FROM mdast_metadata WHERE file_path = ?');
    const documentErrors = new Map();
    const failureRow = db.prepare("SELECT value FROM project_metadata WHERE key = 'document_index_errors'").get();
    const failures = failureRow ? (0, utils_1.safeJsonParse)(failureRow.value, []) : [];
    if (Array.isArray(failures)) {
        for (const failure of failures) {
            if (typeof failure?.filePath === 'string' && typeof failure?.message === 'string')
                documentErrors.set(failure.filePath, failure.message);
        }
    }
    const upsert = db.prepare(`
    INSERT INTO file_inventory (
      path, status, size, modified_at, content_hash, language, mime_type,
      adapter_id, adapter_version, diagnostic, updated_at
    ) VALUES (
      @path, @status, @size, @modifiedAt, @contentHash, @language, @mimeType,
      @adapterId, @adapterVersion, @diagnostic, @updatedAt
    )
    ON CONFLICT(path) DO UPDATE SET
      status = excluded.status,
      size = excluded.size,
      modified_at = excluded.modified_at,
      content_hash = excluded.content_hash,
      language = excluded.language,
      mime_type = excluded.mime_type,
      adapter_id = excluded.adapter_id,
      adapter_version = excluded.adapter_version,
      diagnostic = excluded.diagnostic,
      updated_at = excluded.updated_at
  `);
    const remove = db.prepare('DELETE FROM file_inventory WHERE path = ?');
    const currentPaths = new Set();
    const pending = [];
    const visibleFiles = opts.visibleFiles ?? (0, scan_files_1.listVisibleFiles)(projectRoot, opts);
    for (const absolutePath of visibleFiles) {
        const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
        if (!relativePath || relativePath.startsWith('..'))
            continue;
        const record = (0, classifier_1.classifyFile)(absolutePath, relativePath, documentsEnabled, { sourceHash, documentHash, documentErrors }, projectRoot);
        if (record.status === 'error') {
            try {
                fs.statSync(absolutePath);
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                    continue;
            }
        }
        currentPaths.add(relativePath);
        result.scanned++;
        result.byStatus[record.status]++;
        if (!sameInventoryRecord(existing.get(relativePath), record))
            pending.push(record);
    }
    db.transaction(() => {
        for (const record of pending) {
            upsert.run({
                path: record.path,
                status: record.status,
                size: record.size,
                modifiedAt: record.modifiedAt,
                contentHash: record.contentHash ?? null,
                language: record.language ?? null,
                mimeType: record.mimeType ?? null,
                adapterId: record.adapterId ?? null,
                adapterVersion: record.adapterVersion ?? null,
                diagnostic: record.diagnostic ?? null,
                updatedAt: record.updatedAt,
            });
        }
        for (const row of existingRows) {
            if (!currentPaths.has(row.path)) {
                remove.run(row.path);
                result.removed++;
            }
        }
    })();
    result.updated = pending.length;
    return result;
}
function getFileInventorySummary(db) {
    const summary = {
        indexed: 0,
        'metadata-only': 0,
        ignored: 0,
        unsupported: 0,
        error: 0,
        'secret-excluded': 0,
    };
    const rows = db.prepare('SELECT status, COUNT(*) AS count FROM file_inventory GROUP BY status').all();
    for (const row of rows)
        summary[row.status] = Number(row.count);
    return summary;
}
function sameInventoryRecord(row, record) {
    if (!row)
        return false;
    return row.status === record.status
        && row.size === record.size
        && Math.floor(row.modified_at) === Math.floor(record.modifiedAt)
        && row.content_hash === (record.contentHash ?? null)
        && row.language === (record.language ?? null)
        && row.mime_type === (record.mimeType ?? null)
        && row.adapter_id === (record.adapterId ?? null)
        && row.adapter_version === (record.adapterVersion ?? null)
        && row.diagnostic === (record.diagnostic ?? null);
}
//# sourceMappingURL=index.js.map
