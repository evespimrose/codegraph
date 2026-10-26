"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readIndexHealth = readIndexHealth;
const { hasSourceErrors } = require("./classifier");
const { resolveDocsEnabled } = require("../docs/config");

function readIndexHealth(db) {
    const health = {
        healthy: true,
        inventoryErrors: 0,
        sourceErrors: 0,
        documentErrors: 0,
        queryErrors: 0,
        warnings: [],
    };
    const failedDocuments = new Set();
    const docsEnabled = resolveDocsEnabled(db);
    try {
        const rows = db.prepare("SELECT path, adapter_id FROM file_inventory WHERE status = 'error'").all();
        health.inventoryErrors = rows.filter((row) => docsEnabled || !row.adapter_id?.startsWith('document.')).length;
        for (const row of rows) {
            if (docsEnabled && row.adapter_id?.startsWith('document.'))
                failedDocuments.add(row.path);
        }
    }
    catch (error) {
        health.queryErrors++;
        health.warnings.push(`Inventory health query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        const rows = db.prepare("SELECT errors FROM files WHERE errors IS NOT NULL AND errors <> ''").all();
        health.sourceErrors = rows.filter((row) => hasSourceErrors(row.errors)).length;
    }
    catch (error) {
        health.queryErrors++;
        health.warnings.push(`Source health query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        const row = db.prepare("SELECT value FROM project_metadata WHERE key = 'document_index_errors'").get();
        if (docsEnabled && row) {
            const failures = JSON.parse(row.value);
            if (!Array.isArray(failures))
                throw new Error('Document index error metadata must be an array.');
            for (const failure of failures) {
                if (!failure || typeof failure.filePath !== 'string' || typeof failure.message !== 'string')
                    throw new Error('Document index error metadata contains an invalid record.');
                failedDocuments.add(failure.filePath);
            }
        }
    }
    catch (error) {
        health.queryErrors++;
        health.warnings.push(`Document health query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    health.documentErrors = failedDocuments.size;
    if (health.inventoryErrors)
        health.warnings.push(`${health.inventoryErrors} files have inventory errors.`);
    if (health.sourceErrors)
        health.warnings.push(`${health.sourceErrors} source files have indexing errors.`);
    if (health.documentErrors)
        health.warnings.push(`${health.documentErrors} documents have indexing errors.`);
    health.healthy = health.inventoryErrors === 0 && health.sourceErrors === 0
        && health.documentErrors === 0 && health.queryErrors === 0;
    return health;
}
