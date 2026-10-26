"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLED_MODEL_DIMENSION = exports.BUNDLED_MODEL_LICENSE = exports.BUNDLED_MODEL_REVISION = exports.BUNDLED_MODEL_ID = exports.MODEL_ROOT_ENV = void 0;
exports.inspectModelAssets = inspectModelAssets;
exports.configureModelEnvironment = configureModelEnvironment;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.MODEL_ROOT_ENV = 'CODEGRAPH_MODEL_ROOT';
exports.BUNDLED_MODEL_ID = 'Xenova/multilingual-e5-small';
exports.BUNDLED_MODEL_REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
exports.BUNDLED_MODEL_LICENSE = 'MIT';
exports.BUNDLED_MODEL_DIMENSION = 384;
const REQUIRED_MODEL_PATHS = new Set([
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'onnx/model_quantized.onnx',
    'LICENSE.txt',
]);
function isSafeRelativePath(parent, candidate) {
    const relative = path_1.default.relative(parent, candidate);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path_1.default.sep}`)
        && !path_1.default.isAbsolute(relative);
}
const inspections = new Map();
function inspectModelAssets(rootOverride) {
    const configured = rootOverride ?? process.env[exports.MODEL_ROOT_ENV]?.trim();
    const key = configured ?? '';
    if (!inspections.has(key))
        inspections.set(key, readModelAssets(configured));
    return inspections.get(key);
}
function readModelAssets(configured) {
    const defaultRoot = path_1.default.resolve(__dirname, '../../models');
    const root = configured || (fs_1.default.existsSync(path_1.default.join(defaultRoot, 'model-manifest.json')) ? defaultRoot : undefined);
    if (!root)
        return { mode: 'remote-cache', valid: true, issues: [] };
    const resolvedRoot = path_1.default.resolve(root);
    const manifestPath = path_1.default.join(resolvedRoot, 'model-manifest.json');
    let manifest;
    try {
        manifest = JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf8'));
    }
    catch (error) {
        return bundledFailure(resolvedRoot, `model manifest unavailable: ${messageOf(error)}`);
    }
    let issues;
    try {
        issues = validateManifest(resolvedRoot, manifest);
    }
    catch (error) {
        return bundledFailure(resolvedRoot, `invalid model manifest: ${messageOf(error)}`);
    }
    return {
        mode: 'bundled',
        valid: issues.length === 0,
        modelRoot: resolvedRoot,
        modelId: manifest.modelId,
        revision: manifest.revision,
        license: manifest.license,
        issues,
    };
}
function configureModelEnvironment(env) {
    const status = inspectModelAssets();
    env.allowLocalModels = true;
    if (status.mode === 'remote-cache')
        return status;
    if (!status.valid || !status.modelRoot)
        throw new Error(status.issues.join('; '));
    env.localModelPath = status.modelRoot + path_1.default.sep;
    env.allowRemoteModels = false;
    return status;
}
function validateManifest(root, manifest) {
    const issues = [];
    if (manifest.schemaVersion !== 1)
        issues.push(`unsupported model manifest schema: ${manifest.schemaVersion}`);
    if (manifest.modelId !== exports.BUNDLED_MODEL_ID
        || manifest.revision !== exports.BUNDLED_MODEL_REVISION
        || manifest.license !== exports.BUNDLED_MODEL_LICENSE
        || manifest.dimension !== exports.BUNDLED_MODEL_DIMENSION) {
        issues.push('unexpected bundled model identity');
        return issues;
    }
    const resolvedRoot = path_1.default.resolve(root);
    const modelRoot = path_1.default.resolve(resolvedRoot, ...manifest.modelId.split('/'));
    if (!isSafeRelativePath(resolvedRoot, modelRoot)) {
        issues.push(`unsafe model id: ${manifest.modelId}`);
        return issues;
    }
    if (!Array.isArray(manifest.files) || !isManifestFile(manifest.licenseFile)) {
        issues.push('invalid bundled model file list');
        return issues;
    }
    let realRoot;
    let realModelRoot;
    try {
        realRoot = fs_1.default.realpathSync(resolvedRoot);
        realModelRoot = fs_1.default.realpathSync(modelRoot);
        if (!isSafeRelativePath(realRoot, realModelRoot)) {
            issues.push('bundled model directory resolves outside the configured root');
            return issues;
        }
    }
    catch (error) {
        issues.push(`model directory unavailable: ${messageOf(error)}`);
        return issues;
    }
    const entries = [...manifest.files, manifest.licenseFile];
    if (!entries.every(isManifestFile)) {
        issues.push('invalid bundled model file entry');
        return issues;
    }
    const paths = new Set(entries.map((entry) => entry.path));
    if (paths.size !== entries.length || paths.size !== REQUIRED_MODEL_PATHS.size
        || [...REQUIRED_MODEL_PATHS].some((required) => !paths.has(required))) {
        issues.push('bundled model file set is incomplete or unexpected');
        return issues;
    }
    for (const entry of entries) {
        const file = path_1.default.resolve(modelRoot, entry.path);
        if (!isSafeRelativePath(modelRoot, file)) {
            issues.push(`unsafe model path: ${entry.path}`);
            continue;
        }
        try {
            const realFile = fs_1.default.realpathSync(file);
            if (!isSafeRelativePath(realModelRoot, realFile)) {
                issues.push(`unsafe model path: ${entry.path}`);
                continue;
            }
            const body = fs_1.default.readFileSync(file);
            if (body.length !== entry.size)
                issues.push(`model size mismatch: ${entry.path}`);
            else if ((0, crypto_1.createHash)('sha256').update(body).digest('hex') !== entry.sha256) {
                issues.push(`model checksum mismatch: ${entry.path}`);
            }
        }
        catch (error) {
            issues.push(`model file unavailable: ${entry.path}: ${messageOf(error)}`);
        }
    }
    return issues;
}
function isManifestFile(value) {
    if (!value || typeof value !== 'object')
        return false;
    const file = value;
    return typeof file.path === 'string'
        && Number.isSafeInteger(file.size) && Number(file.size) > 0
        && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256);
}
function bundledFailure(root, issue) {
    return { mode: 'bundled', valid: false, modelRoot: root, issues: [issue] };
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=model-assets.js.map