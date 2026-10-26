const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { FileLock } = require('../lib/utils');

function lockPath(context) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-lock-'));
    context.after(() => {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return path.join(root, 'index.lock');
}

test('another process cannot evict an aged live indexing lock', context => {
    const file = lockPath(context);
    fs.writeFileSync(file, String(process.pid));
    const old = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(file, old, old);
    const contender = spawnSync(process.execPath, ['-e', 'const { FileLock } = require(process.argv[1]); new FileLock(process.argv[2]).acquire();', require.resolve('../lib/utils'), file], { encoding: 'utf8', windowsHide: true });
    assert.equal(contender.status, 1);
    assert.match(contender.stderr, /locked by another process/);
    assert.equal(fs.readFileSync(file, 'utf8'), String(process.pid));
});

test('a lock belonging to a exited process is recovered', context => {
    const file = lockPath(context);
    const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true });
    assert.equal(exited.status, 0);
    fs.writeFileSync(file, String(exited.pid));
    const lock = new FileLock(file);
    lock.acquire();
    assert.equal(fs.readFileSync(file, 'utf8'), String(process.pid));
    lock.release();
    assert.equal(fs.existsSync(file), false);
});

test('malformed and nonpositive lock owners are recoverable', context => {
    const file = lockPath(context);
    for (const owner of ['malformed', '', '0', '-1', '1.5']) {
        fs.writeFileSync(file, owner);
        const lock = new FileLock(file);
        lock.acquire();
        assert.equal(fs.readFileSync(file, 'utf8'), String(process.pid));
        lock.release();
    }
});

test('a permission-denied process probe does not declare a live owner dead', context => {
    const file = lockPath(context);
    fs.writeFileSync(file, String(process.pid));
    context.mock.method(process, 'kill', () => { throw Object.assign(new Error('Permission denied'), { code: 'EPERM' }); });
    assert.throws(() => new FileLock(file).acquire(), /locked by another process/);
    assert.equal(fs.readFileSync(file, 'utf8'), String(process.pid));
});

test('exclusive creation still rejects a contender arriving after the precheck', context => {
    const file = lockPath(context);
    fs.writeFileSync(file, String(process.pid));
    const exists = fs.existsSync;
    context.mock.method(fs, 'existsSync', candidate => candidate === file ? false : exists(candidate));
    assert.throws(() => new FileLock(file).acquire(), /locked by another process/);
    assert.equal(fs.readFileSync(file, 'utf8'), String(process.pid));
});

test('an asynchronous indexing failure releases its owned lock', async context => {
    const file = lockPath(context);
    const lock = new FileLock(file);
    await assert.rejects(lock.withLockAsync(async () => { throw new Error('Indexing failed'); }), /Indexing failed/);
    assert.equal(fs.existsSync(file), false);
});
