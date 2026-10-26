"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommunitiesCache = createCommunitiesCache;
exports.writeCommunitiesCache = writeCommunitiesCache;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function createCommunitiesCache(result, generatedAt = new Date()) {
    return {
        schemaVersion: 1,
        generatedAt: generatedAt.toISOString(),
        graphFingerprint: result.graphFingerprint,
        configFingerprint: result.configFingerprint,
        nodeCommunities: result.nodeCommunities,
        communities: result.communities,
        excludedHubs: result.excludedHubs,
        warnings: result.warnings,
    };
}
function writeCommunitiesCache(path, result, generatedAt = new Date()) {
    const cache = createCommunitiesCache(result, generatedAt);
    const directory = (0, node_path_1.dirname)(path);
    (0, node_fs_1.mkdirSync)(directory, { recursive: true });
    const temporary = (0, node_path_1.join)(directory, `.${(0, node_path_1.basename)(path)}.${process.pid}.${(0, node_crypto_1.randomBytes)(6).toString('hex')}.tmp`);
    try {
        (0, node_fs_1.writeFileSync)(temporary, `${JSON.stringify(cache, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        (0, node_fs_1.renameSync)(temporary, path);
    }
    finally {
        (0, node_fs_1.rmSync)(temporary, { force: true });
    }
    return cache;
}
//# sourceMappingURL=community-cache.js.map