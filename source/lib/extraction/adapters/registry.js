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
exports.AdapterRegistry = void 0;
const crypto_1 = require("crypto");
const path = __importStar(require("path"));
class AdapterRegistry {
    adapters = new Map();
    byExtension = new Map();
    languages = new Set();
    register(adapter) {
        const { manifest } = adapter;
        const validCapabilities = Object.values(manifest.capabilities).every((value) => typeof value === 'boolean');
        const validExtensions = manifest.extensions.length > 0
            && new Set(manifest.extensions).size === manifest.extensions.length
            && manifest.extensions.every((extension) => /^\.[a-z0-9][a-z0-9+_-]*$/.test(extension));
        if (!manifest.id || !manifest.version || !manifest.displayName || !manifest.language
            || manifest.schemaVersion !== 1 || !Number.isFinite(manifest.priority)
            || !validCapabilities || !validExtensions) {
            throw new Error('Invalid adapter manifest');
        }
        if (this.adapters.has(manifest.id)) {
            throw new Error(`Adapter '${manifest.id}' is already registered`);
        }
        this.adapters.set(manifest.id, adapter);
        this.languages.add(manifest.language);
        for (const extension of manifest.extensions) {
            const candidates = this.byExtension.get(extension) ?? [];
            candidates.push(adapter);
            candidates.sort((left, right) => right.manifest.priority - left.manifest.priority);
            this.byExtension.set(extension, candidates);
        }
    }
    find(filePath, source, language) {
        const extension = path.extname(filePath).toLowerCase();
        return this.byExtension.get(extension)?.find((adapter) => {
            if (language && adapter.manifest.language !== language)
                return false;
            return adapter.matches?.(filePath, source) ?? true;
        });
    }
    detectLanguage(filePath) {
        const extension = path.extname(filePath).toLowerCase();
        return this.byExtension.get(extension)?.[0]?.manifest.language;
    }
    supportsLanguage(language) {
        return this.languages.has(language);
    }
    list() {
        return [...this.adapters.values()]
            .map(({ manifest }) => ({ ...manifest, fingerprint: fingerprintManifest(manifest) }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }
}
exports.AdapterRegistry = AdapterRegistry;
function fingerprintManifest(manifest) {
    const normalized = JSON.stringify({
        ...manifest,
        extensions: [...manifest.extensions].sort(),
        capabilities: Object.fromEntries(Object.entries(manifest.capabilities).sort(([a], [b]) => a.localeCompare(b))),
    });
    return (0, crypto_1.createHash)('sha256').update(normalized).digest('hex');
}
//# sourceMappingURL=registry.js.map