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
exports.requireFresh = requireFresh;
exports.failAnalysis = failAnalysis;
exports.readNumber = readNumber;
exports.readPositive = readPositive;
exports.limitReason = limitReason;
exports.writeAtomic = writeAtomic;
exports.dateStamp = dateStamp;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function syncWarnings(sync) {
    const badFiles = sync.inventory?.byStatus.error ?? 0;
    return [...new Set([
            ...(sync.warnings ?? []),
            ...(sync.errors ?? []).map((entry) => entry.filePath ? `${entry.filePath}: ${entry.message}` : entry.message),
            ...(badFiles > 0
                ? [`File inventory contains ${badFiles} error entries.`]
                : []),
            ...(sync.semanticEdges?.enabled && !sync.semanticEdges.available
                ? [`Semantic edge generation unavailable: ${sync.semanticEdges.reason ?? 'unknown reason'}`]
                : []),
        ])];
}
class SyncError extends Error {
    sync;
    constructor(sync) {
        const warnings = syncWarnings(sync);
        const message = sync.status === 'blocked'
            ? 'Graph refresh was blocked by another indexing process.'
            : 'Graph refresh failed; derived output was not published.';
        super(warnings[0] ?? message);
        this.name = 'SyncError';
        this.sync = {
            ...sync,
            status: sync.status === 'blocked' ? 'blocked' : 'failed',
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
}
function requireFresh(sync) {
    const degraded = sync.status !== 'current' ||
        (sync.errors?.length ?? 0) > 0 ||
        (sync.warnings?.length ?? 0) > 0 ||
        (sync.inventory?.byStatus.error ?? 0) > 0 ||
        Boolean(sync.semanticEdges?.enabled && !sync.semanticEdges.available);
    if (degraded)
        throw new SyncError(sync);
}
function failureData(caught, projectPath) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const sync = caught instanceof SyncError ? caught.sync : undefined;
    return {
        message,
        json: {
            schemaVersion: 1,
            projectPath,
            status: 'failed',
            syncStatus: sync?.status ?? 'failed',
            error: message,
            warnings: sync?.warnings ?? [],
            errors: sync?.errors ?? (sync ? [] : [{ message, severity: 'error' }]),
            ...(sync ? { sync } : {}),
        },
    };
}
function failAnalysis(cli, label, caught, options) {
    const failure = failureData(caught, options.projectPath);
    if (options.json)
        console.log(JSON.stringify(failure.json, null, 2));
    cli.error(`${label}: ${failure.message}`);
    process.exitCode = 1;
}
function readNumber(value, label) {
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        throw new Error(`${label} must be a finite number.`);
    return parsed;
}
function readPositive(value, label) {
    const parsed = readNumber(value, label);
    if (parsed === undefined || !Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error(`${label} must be a positive safe integer.`);
    }
    return parsed;
}
function limitReason(stats, maxNodes, maxEdges) {
    if (stats.nodeCount > maxNodes) {
        return `Analysis skipped: ${stats.nodeCount} nodes exceed --max-nodes ${maxNodes}.`;
    }
    if (stats.edgeCount > maxEdges) {
        return `Analysis skipped: ${stats.edgeCount} edges exceed --max-edges ${maxEdges}.`;
    }
    return undefined;
}
function writeAtomic(targetPath, content) {
    const directory = path.dirname(targetPath);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
    try {
        fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temporary, targetPath);
    }
    finally {
        fs.rmSync(temporary, { force: true });
    }
}
function dateStamp(date = new Date()) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
        .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
        .join('-');
}
//# sourceMappingURL=analysis-cli.js.map