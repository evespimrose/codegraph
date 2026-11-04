const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EmbedCache, embedTextKey, openEmbedCache, CACHE_ENV } = require('../lib/docs/embed-cache');
const { acquireEmbedLock } = require('../lib/docs/embed-lock');
const { EMBED_DIM } = require('../lib/docs/config');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-embed-'));
}

function vector(seed) {
    return Float32Array.from({ length: EMBED_DIM }, (_, index) => (seed + index) / 1000);
}

test('캐시는 같은 모델과 키에서만 벡터를 돌려줌', () => {
    const dir = tempDir();
    const cache = new EmbedCache(path.join(dir, 'cache.db'));
    try {
        const key = embedTextKey('passage: hello');
        cache.put('model-a', [{ key, vector: vector(1) }]);
        assert.deepEqual([...cache.get('model-a', [key]).get(key)], [...vector(1)]);
        assert.equal(cache.get('model-b', [key]).size, 0);
        assert.equal(cache.get('model-a', [embedTextKey('passage: other')]).size, 0);
    } finally {
        cache.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('캐시는 먼저 넣은 벡터를 유지하고 차원이 틀린 벡터는 넣지 않음', () => {
    const dir = tempDir();
    const cache = new EmbedCache(path.join(dir, 'cache.db'));
    try {
        const key = embedTextKey('x');
        cache.put('m', [{ key, vector: vector(1) }]);
        cache.put('m', [{ key, vector: vector(9) }, { key: embedTextKey('short'), vector: [1, 2, 3] }]);
        assert.equal(cache.get('m', [key]).get(key)[0], vector(1)[0]);
        assert.equal(cache.get('m', [embedTextKey('short')]).size, 0);
    } finally {
        cache.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('캐시는 조회 키가 많아도 모두 찾음', () => {
    const dir = tempDir();
    const cache = new EmbedCache(path.join(dir, 'cache.db'));
    try {
        const keys = Array.from({ length: 1200 }, (_, index) => embedTextKey(`t${index}`));
        cache.put('m', keys.map((key, index) => ({ key, vector: vector(index) })));
        assert.equal(cache.get('m', keys).size, 1200);
    } finally {
        cache.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('CODEGRAPH_EMBED_CACHE=off 면 캐시를 열지 않음', () => {
    const previous = process.env[CACHE_ENV];
    process.env[CACHE_ENV] = 'off';
    try {
        assert.equal(openEmbedCache(), null);
    } finally {
        if (previous === undefined) delete process.env[CACHE_ENV];
        else process.env[CACHE_ENV] = previous;
    }
});

test('잠금은 한 번에 한 소유자만 얻고 해제하면 다음이 얻음', async () => {
    const dir = tempDir();
    try {
        const first = await acquireEmbedLock({ dir });
        assert.ok(first);
        assert.equal(await acquireEmbedLock({ dir, maxWaitMs: 100 }), null);
        first.release();
        const second = await acquireEmbedLock({ dir, maxWaitMs: 100 });
        assert.ok(second);
        second.release();
        assert.equal(fs.existsSync(path.join(dir, 'embed.lock')), false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('소유 프로세스가 없는 잠금은 빼앗음', async () => {
    const dir = tempDir();
    try {
        fs.writeFileSync(path.join(dir, 'embed.lock'), JSON.stringify({ pid: 2147483646, at: Date.now() }));
        const lock = await acquireEmbedLock({ dir, maxWaitMs: 200 });
        assert.ok(lock);
        lock.release();
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('갱신이 끊긴 잠금은 소유 프로세스가 살아 있어도 빼앗음', async () => {
    const dir = tempDir();
    try {
        const lockPath = path.join(dir, 'embed.lock');
        fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: 0 }));
        const old = new Date(Date.now() - 10 * 60 * 1000);
        fs.utimesSync(lockPath, old, old);
        const lock = await acquireEmbedLock({ dir, maxWaitMs: 200 });
        assert.ok(lock);
        lock.release();
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
