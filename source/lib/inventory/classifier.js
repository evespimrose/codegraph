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
exports.classifyFile = classifyFile;
exports.hasSourceErrors = hasSourceErrors;
const fs = __importStar(require("fs"));
const scan_files_1 = require("../docs/scan-files");
const adapters_1 = require("../extraction/adapters");
const grammars_1 = require("../extraction/grammars");
const { MAX_SOURCE_FILE_SIZE } = require("../extraction/limits");
const utils_1 = require("../utils");
function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot) {
    const updatedAt = Date.now();
    let stat;
    try {
        stat = fs.statSync(absolutePath);
    }
    catch (error) {
        return {
            path: relativePath,
            status: 'error',
            size: 0,
            modifiedAt: 0,
            diagnostic: error instanceof Error ? error.message : String(error),
            updatedAt,
        };
    }
    if ((0, scan_files_1.isSecretPath)(relativePath)) {
        return { path: relativePath, status: 'secret-excluded', size: stat.size, modifiedAt: stat.mtimeMs, updatedAt };
    }
    if ((0, grammars_1.isSourceFile)(relativePath)) {
        if (stat.size > MAX_SOURCE_FILE_SIZE) {
            return {
                path: relativePath,
                status: 'ignored',
                size: stat.size,
                modifiedAt: stat.mtimeMs,
                diagnostic: `Source file exceeds the indexing size limit (${stat.size} > ${MAX_SOURCE_FILE_SIZE} bytes).`,
                updatedAt,
            };
        }
        const language = (0, grammars_1.detectLanguage)(relativePath);
        const adapter = adapters_1.sourceAdapterRegistry.find(relativePath, '', language);
        const hash = sources.sourceHash.get(relativePath);
        return {
            path: relativePath,
            status: hash?.content_hash && !hasSourceErrors(hash.errors) ? 'indexed' : 'error',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            contentHash: hash?.content_hash,
            language,
            mimeType: 'text/x-source',
            adapterId: adapter?.manifest.id ?? 'tree-sitter',
            adapterVersion: adapter?.manifest.version ?? 'builtin',
            diagnostic: hash?.content_hash ? hash.errors ?? undefined : 'Source index was not published',
            updatedAt,
        };
    }
    if (projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)) {
        return {
            path: relativePath,
            status: 'ignored',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            diagnostic: 'Document content is excluded because the resolved path is outside the project root.',
            updatedAt,
        };
    }
    const document = (0, scan_files_1.classifyTextDocument)(absolutePath);
    if (document) {
        const hash = sources.documentHash.get(relativePath);
        const failure = sources.documentErrors?.get(relativePath);
        const published = !documentsEnabled || (Boolean(hash?.content_hash) && !failure);
        return {
            path: relativePath,
            status: documentsEnabled ? (published ? 'indexed' : 'error') : 'metadata-only',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            contentHash: hash?.content_hash,
            language: document.format === 'markdown' ? 'markdown' : document.format === 'html' ? 'html' : 'text',
            mimeType: document.mimeType,
            adapterId: `document.${document.format}`,
            adapterVersion: '1',
            diagnostic: published ? undefined : failure ?? 'Document index was not published',
            updatedAt,
        };
    }
    return {
        path: relativePath,
        status: 'metadata-only',
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        mimeType: 'application/octet-stream',
        updatedAt,
    };
}
function hasSourceErrors(value) {
    if (!value)
        return false;
    try {
        const diagnostics = typeof value === 'string' ? JSON.parse(value) : value;
        return !Array.isArray(diagnostics)
            || diagnostics.some((diagnostic) => !diagnostic || diagnostic.severity !== 'warning');
    }
    catch {
        return true;
    }
}
//# sourceMappingURL=classifier.js.map
