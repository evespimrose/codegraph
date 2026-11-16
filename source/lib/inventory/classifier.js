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
exports.createDocumentClassifier = createDocumentClassifier;
const fs = __importStar(require("fs"));
const scan_files_1 = require("../docs/scan-files");
const adapters_1 = require("../extraction/adapters");
const grammars_1 = require("../extraction/grammars");
const { MAX_SOURCE_FILE_SIZE } = require("../extraction/limits");
const utils_1 = require("../utils");
function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot, classify) {
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
    const verdict = classify
        ? classify(absolutePath, relativePath, stat)
        : (projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)
            ? { outside: true }
            : { document: (0, scan_files_1.classifyTextDocument)(absolutePath) });
    if (verdict.outside) {
        return {
            path: relativePath,
            status: 'ignored',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            diagnostic: 'Document content is excluded because the resolved path is outside the project root.',
            updatedAt,
        };
    }
    const document = verdict.document;
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
/**
 * 한 번의 sync 안에서 문서 스캔(listTextDocumentFiles)과 파일 목록 갱신(classifyFile)이 같이 쓰는 문서 판별기.
 * file_inventory 에 저장된 크기와 수정 시각이 지금과 같으면 파일을 열지도, 실제 경로를 풀지도 않고 저장된 판별을 씀.
 * 다시 쓰는 판별은 두 가지임. 문서(adapter_id 'document.<형식>', adapter_version '1')이고 형식이 지금 확장자와 맞는 것,
 * 그리고 바이너리(application/octet-stream)이면서 확장자가 문서 형식이 아닌 것임. 문서 확장자(.md 등)의 바이너리
 * 판별은 읽기 실패로 생겼을 수 있어 매번 다시 판별함. 그 밖에는 지금처럼 실제 경로를 확인하고 내용으로 판별함.
 * 경로별 결과는 판별기 안에서 한 번만 정함. 신선도 기준은 코드 쪽(extraction 의 크기·수정 시각 비교)과 같음.
 */
function createDocumentClassifier(db, projectRoot) {
    const stored = new Map();
    try {
        for (const row of db.prepare('SELECT path, size, modified_at, mime_type, adapter_id, adapter_version FROM file_inventory').all())
            stored.set(row.path, row);
    }
    catch {
        // 파일 목록 표를 읽지 못하면 저장된 판별 없이 모두 새로 판별함
    }
    const decided = new Map();
    return (absolutePath, relativePath, stat) => {
        let verdict = decided.get(relativePath);
        if (!verdict) {
            verdict = reuseStoredVerdict(stored.get(relativePath), absolutePath, stat)
                ?? ((0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)
                    ? { document: (0, scan_files_1.classifyTextDocument)(absolutePath) }
                    : { outside: true });
            decided.set(relativePath, verdict);
        }
        return verdict;
    };
}
function reuseStoredVerdict(row, absolutePath, stat) {
    if (!row)
        return null;
    let current = stat;
    if (!current) {
        try {
            current = fs.statSync(absolutePath);
        }
        catch {
            return null;
        }
    }
    if (row.size !== current.size || Math.floor(row.modified_at) !== Math.floor(current.mtimeMs))
        return null;
    const format = (0, scan_files_1.detectDocumentFormat)(absolutePath);
    if (row.mime_type === 'application/octet-stream')
        return format ? null : { document: null };
    if ((0, scan_files_1.isBinaryPath)(absolutePath) || row.adapter_version !== '1' || !row.mime_type
        || row.adapter_id !== `document.${format ?? 'text'}`)
        return null;
    return { document: { absolutePath, format: format ?? 'text', mimeType: row.mime_type } };
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
