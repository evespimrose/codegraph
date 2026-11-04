"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_ENV = exports.EmbedCache = void 0;
exports.embedTextKey = embedTextKey;
exports.cacheDirectory = cacheDirectory;
exports.openEmbedCache = openEmbedCache;
/**
 * 문서 벡터의 프로젝트 밖 캐시. 같은 모델이 같은 입력 텍스트로 만든 벡터는 한 번만 계산함.
 * 그래프를 다시 만들거나 .codegraph 를 지우거나 복사본을 색인해도 재계산하지 않음.
 * 위치는 ~/.codegraph/embed-cache.db, CODEGRAPH_EMBED_CACHE 로 경로를 바꾸고 off 로 끔.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const config_1 = require("./config");
const sqlite_adapter_1 = require("../db/sqlite-adapter");
exports.CACHE_ENV = 'CODEGRAPH_EMBED_CACHE';
const LOOKUP_CHUNK = 500;
/** 모델에 들어가는 최종 텍스트(접두사 포함)의 해시. 모델 ID 와 함께 캐시 키가 됨 */
function embedTextKey(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
function cacheDirectory() {
    const configured = process.env[exports.CACHE_ENV];
    if (configured && !/^(0|false|no|off)$/i.test(configured))
        return path.dirname(path.resolve(configured));
    return path.join(os.homedir(), '.codegraph');
}
class EmbedCache {
    db;
    insert;
    constructor(dbPath) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = (0, sqlite_adapter_1.createDatabase)(dbPath).db;
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 15000');
        this.db.pragma('synchronous = NORMAL');
        this.db.exec(`CREATE TABLE IF NOT EXISTS vectors (
            model TEXT NOT NULL,
            key TEXT NOT NULL,
            vec BLOB NOT NULL,
            PRIMARY KEY (model, key)
        ) WITHOUT ROWID`);
        this.insert = this.db.prepare('INSERT OR IGNORE INTO vectors (model, key, vec) VALUES (?, ?, ?)');
    }
    /** keys 중 캐시에 있는 것만 Map(key → Float32Array) 으로 돌려줌. 차원이 다른 항목은 무시함 */
    get(model, keys) {
        const found = new Map();
        for (let offset = 0; offset < keys.length; offset += LOOKUP_CHUNK) {
            const chunk = keys.slice(offset, offset + LOOKUP_CHUNK);
            const marks = chunk.map(() => '?').join(',');
            const rows = this.db.prepare(`SELECT key, vec FROM vectors WHERE model = ? AND key IN (${marks})`).all(model, ...chunk);
            for (const row of rows) {
                if (row.vec.byteLength !== config_1.EMBED_DIM * 4)
                    continue;
                const copy = Uint8Array.prototype.slice.call(row.vec);
                found.set(row.key, new Float32Array(copy.buffer, 0, config_1.EMBED_DIM));
            }
        }
        return found;
    }
    put(model, entries) {
        if (entries.length === 0)
            return;
        this.db.transaction(() => {
            for (const entry of entries) {
                const f32 = entry.vector instanceof Float32Array ? entry.vector : Float32Array.from(entry.vector);
                if (f32.length !== config_1.EMBED_DIM)
                    continue;
                this.insert.run(model, entry.key, Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength));
            }
        })();
    }
    close() {
        try {
            this.db.close();
        }
        catch {
            // 이미 닫힘
        }
    }
}
exports.EmbedCache = EmbedCache;
/** 캐시가 꺼져 있거나 열 수 없으면 null. 캐시 실패는 색인을 막지 않음 */
function openEmbedCache() {
    const configured = process.env[exports.CACHE_ENV];
    if (configured && /^(0|false|no|off)$/i.test(configured))
        return null;
    try {
        const dbPath = configured ? path.resolve(configured) : path.join(os.homedir(), '.codegraph', 'embed-cache.db');
        return new EmbedCache(dbPath);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=embed-cache.js.map
