'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');

function locations(projectPath) {
    const projectRoot = fs.realpathSync.native(path.resolve(projectPath));
    const key = process.platform === 'win32' ? projectRoot.toLowerCase() : projectRoot;
    const id = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
    const directory = path.join(projectRoot, '.codegraph');
    return {
        projectRoot, id, directory,
        state: path.join(directory, 'watcher.json'),
        log: path.join(directory, 'watcher.log'),
        startLock: path.join(directory, 'watcher-start.db'),
        ownerLock: path.join(directory, 'watcher-owner.db'),
        endpoint: process.platform === 'win32' ? `\\\\.\\pipe\\codegraph-watch-${id}` : path.join(os.tmpdir(), `codegraph-watch-${id}.sock`),
        registry: path.join(registryDirectory(), `${id}.json`),
    };
}

function registryDirectory() {
    return process.env.CODEGRAPH_WATCH_REGISTRY || path.join(os.homedir(), '.codegraph', 'watchers');
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return null; }
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(value) + '\n', { mode: 0o600 });
        renameWithRetry(temporary, file);
    } finally {
        try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}

// Windows 는 다른 프로세스가 대상 파일을 읽는 동안 교체 rename 을 잠깐 거부함
function renameWithRetry(source, target) {
    for (let attempt = 1; ; attempt++) {
        try { return fs.renameSync(source, target); }
        catch (error) {
            if (attempt === 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * attempt);
        }
    }
}

function runtimeId() {
    const hash = crypto.createHash('sha256').update(process.execPath);
    for (const relative of ['../../package.json', '../index.js', '../sync/watcher.js', '../extraction/grammars.js', './protocol.js', './manager.js', './worker.js']) {
        hash.update(fs.readFileSync(path.resolve(__dirname, relative)));
    }
    return hash.digest('hex').slice(0, 24);
}

function request(location, command, timeoutMs = 800) {
    return new Promise((resolve) => {
        const state = readJson(location.state);
        let finished = false;
        let buffer = '';
        const socket = net.createConnection(location.endpoint);
        const finish = (result) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            resolve(result);
        };
        socket.setTimeout(timeoutMs, () => finish({ error: 'timeout' }));
        socket.on('error', error => finish({ error: error.code || error.message }));
        socket.on('end', () => finish({ error: 'connection closed' }));
        socket.on('connect', () => socket.write(JSON.stringify({ command, token: state?.token, projectId: location.id }) + '\n'));
        socket.on('data', chunk => {
            buffer += chunk.toString('utf8');
            if (buffer.length > 1024 * 1024) return finish({ error: 'response too large' });
            const newline = buffer.indexOf('\n');
            if (newline < 0) return;
            try {
                const response = JSON.parse(buffer.slice(0, newline));
                if (response.projectId !== location.id) return finish({ error: 'project identity mismatch' });
                finish(response);
            } catch { finish({ error: 'invalid response' }); }
        });
    });
}

function livePid(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function lease(file) {
    const { createDatabase } = require('../db/sqlite-adapter');
    const { db } = createDatabase(file);
    try {
        db.exec('BEGIN EXCLUSIVE');
    } catch (error) {
        db.close();
        if (error.errcode === 5 || error.errcode === 6 || /database is locked/.test(error.message)) return null;
        throw error;
    }
    return () => db.close();
}

module.exports = { locations, registryDirectory, readJson, writeJson, runtimeId, request, livePid, lease };
