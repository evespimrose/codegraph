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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDoctorReport = buildDoctorReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const migrations_1 = require("./db/migrations");
const model_assets_1 = require("./docs/model-assets");
const vec_1 = require("./docs/vec");
const { readIndexHealth } = require("./inventory/health");
exports.readIndexHealth = readIndexHealth;
const MAX_COMMUNITY_CACHE_BYTES = 16 * 1024 * 1024;
async function buildDoctorReport(db, projectRoot, packageVersion) {
    const warnings = [];
    const transformers = await transformersAvailable();
    const sqliteVec = (0, vec_1.loadVecExtension)(db);
    const model = (0, model_assets_1.inspectModelAssets)();
    const offlineReady = model.mode === 'bundled' && model.valid;
    const provenanceCheck = queryCount(db, 'SELECT COUNT(*) AS count FROM edges WHERE provenance IS NULL');
    const semanticCheck = queryCount(db, "SELECT COUNT(*) AS count FROM edges WHERE kind = 'semantically_related'");
    const database = {
        readable: provenanceCheck.ok && semanticCheck.ok,
        schema: (0, migrations_1.getCurrentVersion)(db),
        expectedSchema: migrations_1.CURRENT_SCHEMA_VERSION,
        nullProvenanceEdges: provenanceCheck.value,
        semanticEdges: semanticCheck.value,
    };
    const communities = inspectCommunities(projectRoot);
    const indexHealth = readIndexHealth(db);
    warnings.push(...indexHealth.warnings);
    if (!transformers)
        warnings.push('@huggingface/transformers is unavailable.');
    if (!sqliteVec)
        warnings.push('sqlite-vec is unavailable.');
    if (!offlineReady)
        warnings.push('Pinned offline embedding model is not active.');
    if (model.issues.length > 0)
        warnings.push(...model.issues);
    if (database.schema !== migrations_1.CURRENT_SCHEMA_VERSION)
        warnings.push('Database schema is not current.');
    if (!provenanceCheck.ok)
        warnings.push(`Database provenance query failed: ${provenanceCheck.issue}`);
    if (!semanticCheck.ok)
        warnings.push(`Database semantic-edge query failed: ${semanticCheck.issue}`);
    if (database.nullProvenanceEdges > 0)
        warnings.push(`${database.nullProvenanceEdges} edges have unknown provenance.`);
    if (communities.state === 'invalid' && communities.issue)
        warnings.push(communities.issue);
    const modelRequired = Boolean(process.env.TEAM_HARNESS_CODEGRAPH || process.env.CODEGRAPH_MODEL_ROOT);
    return {
        schemaVersion: 1,
        packageVersion,
        ok: transformers && sqliteVec && database.readable && database.schema === migrations_1.CURRENT_SCHEMA_VERSION
            && database.nullProvenanceEdges === 0 && communities.state !== 'invalid'
            && indexHealth.healthy
            && (!modelRequired || offlineReady) && model.valid,
        runtime: { transformers, sqliteVec },
        model: { ...model, offlineReady },
        database,
        indexHealth,
        communities,
        warnings,
    };
}
async function transformersAvailable() {
    try {
        await Promise.resolve().then(() => __importStar(require('@huggingface/transformers')));
        return true;
    }
    catch {
        return false;
    }
}
function queryCount(db, sql) {
    try {
        return { ok: true, value: Number(db.prepare(sql).get().count) };
    }
    catch (error) {
        return { ok: false, value: 0, issue: error instanceof Error ? error.message : String(error) };
    }
}
function inspectCommunities(projectRoot) {
    const cachePath = path_1.default.join(projectRoot, '.codegraph', 'communities.json');
    if (!fs_1.default.existsSync(cachePath))
        return { state: 'absent', path: cachePath };
    try {
        if (fs_1.default.lstatSync(cachePath).isSymbolicLink())
            throw new Error('symbolic links are not allowed');
        if (fs_1.default.statSync(cachePath).size > MAX_COMMUNITY_CACHE_BYTES)
            throw new Error('file exceeds 16 MiB');
        const parsed = JSON.parse(fs_1.default.readFileSync(cachePath, 'utf8'));
        if (parsed.schemaVersion !== 1)
            throw new Error('unsupported community cache schema');
        if (!isRecord(parsed.nodeCommunities) || !isRecord(parsed.communities)
            || typeof parsed.graphFingerprint !== 'string'
            || typeof parsed.configFingerprint !== 'string') {
            throw new Error('community cache fields are incomplete');
        }
        return { state: 'ready', path: cachePath };
    }
    catch (error) {
        return {
            state: 'invalid',
            path: cachePath,
            issue: `Community cache is invalid: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
//# sourceMappingURL=doctor.js.map
