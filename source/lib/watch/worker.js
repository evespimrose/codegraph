'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const protocol = require('./protocol');

const LOG_BYTES = 10 * 1024 * 1024;
const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const MAX_START_ATTEMPTS = 5;

function writeDiagnostic(message) {
    if (process.env.CODEGRAPH_WATCH_LOG) fs.appendFileSync(process.env.CODEGRAPH_WATCH_LOG, message);
    else process.stderr.write(message);
}

function rotateLog(file) {
    if (!fs.existsSync(file) || fs.statSync(file).size <= LOG_BYTES) return;
    try { fs.renameSync(file, `${file}.1`); }
    catch (error) { writeDiagnostic(`Watcher log rotation skipped: ${error.message}\n`); }
}

function idleLimitMs() {
    const configured = Number(process.env.CODEGRAPH_WATCH_IDLE_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_IDLE_MS;
}

async function runWatcher(projectPath, options = {}) {
    process.env.CODEGRAPH_WATCH_WORKER = '1';
    const location = protocol.locations(projectPath);
    if (process.env.CODEGRAPH_NO_WATCH === '1') return;
    if (!fs.existsSync(path.join(location.directory, 'codegraph.db'))) throw new Error('CodeGraph must be initialized before watching');
    const releaseLease = protocol.lease(location.ownerLock);
    if (!releaseLease) return;
    const token = crypto.randomBytes(32).toString('hex');
    let graph = null;
    let closing = false;
    let initializing = false;
    let heartbeat;
    let retryTimer;
    let lastRequestAt = Date.now();
    let startFailures = 0;
    const idleMs = idleLimitMs();
    const state = {
        schemaVersion: 1, projectPath: location.projectRoot, projectId: location.id,
        pid: process.pid, runtimeId: options.runtimeId ?? protocol.runtimeId(),
        nodePath: process.execPath, runtimeEntry: __filename,
        endpoint: location.endpoint, token, active: true, ready: false, watching: false,
        phase: 'starting', startedAt: Date.now(), heartbeatAt: Date.now(), pendingFiles: [],
        configuration: { debounceMs: options.debounceMs, respectGitignore: options.respectGitignore ?? true },
        lastSync: null, lastError: null,
    };
    const snapshot = () => {
        const { token: secret, ...publicState } = state;
        const pendingFiles = graph?.getPendingFiles() ?? [];
        const reconciling = graph?.isIndexing() ?? false;
        return { ...publicState, ready: state.ready && !reconciling && pendingFiles.length === 0,
            watching: graph?.isWatching() ?? false, pendingFiles };
    };
    const persist = () => {
        state.heartbeatAt = Date.now();
        Object.assign(state, snapshot());
        protocol.writeJson(location.state, state);
    };
    let resolveDone;
    const done = new Promise(resolve => { resolveDone = resolve; });
    const sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
        socket.on('error', () => socket.destroy());
        socket.setTimeout(2000, () => socket.destroy());
        let buffer = '';
        socket.on('data', chunk => {
            buffer += chunk.toString('utf8');
            if (buffer.length > 8192) return socket.destroy();
            const newline = buffer.indexOf('\n');
            if (newline < 0) return;
            socket.removeAllListeners('data');
            let request;
            try { request = JSON.parse(buffer.slice(0, newline)); }
            catch { return socket.destroy(); }
            if (request.token !== token || request.projectId !== location.id) {
                return socket.end(JSON.stringify({ projectId: location.id, error: 'authentication failed' }) + '\n');
            }
            if (request.command === 'stop') {
                state.phase = 'stopping';
                socket.end(JSON.stringify(snapshot()) + '\n');
                void shutdown();
            } else if (request.command === 'status') {
                lastRequestAt = Date.now();
                socket.end(JSON.stringify(snapshot()) + '\n');
            } else {
                socket.end(JSON.stringify({ projectId: location.id, error: 'unknown command' }) + '\n');
            }
        });
    });
    const listen = () => new Promise((resolve, reject) => {
        const onError = error => { server.removeListener('listening', onListening); reject(error); };
        const onListening = () => { server.removeListener('error', onError); resolve(); };
        server.once('error', onError); server.once('listening', onListening); server.listen(location.endpoint);
    });
    try { await listen(); }
    catch (error) {
        if (error.code !== 'EADDRINUSE') { releaseLease(); throw error; }
        if (process.platform === 'win32') { releaseLease(); return; }
        const existing = await protocol.request(location, 'status');
        if (existing.error !== 'ECONNREFUSED' && existing.error !== 'ENOENT') { releaseLease(); return; }
        try { fs.unlinkSync(location.endpoint); } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') { releaseLease(); throw unlinkError; } }
        try { await listen(); } catch (retryError) { releaseLease(); if (retryError.code === 'EADDRINUSE') return; throw retryError; }
    }
    server.on('error', error => { state.lastError = { message: error.message, at: Date.now() }; void shutdown(); });

    async function shutdown() {
        if (closing) return done;
        closing = true;
        state.phase = 'stopping'; state.ready = false;
        clearInterval(heartbeat); clearTimeout(retryTimer);
        graph?.unwatch();
        while (initializing || graph?.isIndexing()) await delay(100);
        try { graph?.close(); } catch (error) { recordError(error); }
        graph = null;
        state.active = false; state.watching = false; state.phase = 'stopped';
        try { persist(); } catch (error) { writeDiagnostic(`Watcher state write failed: ${error.message}\n`); }
        for (const socket of sockets) { socket.end(); socket.destroySoon(); }
        await new Promise(resolve => server.close(resolve));
        releaseLease();
        if (process.platform !== 'win32') { try { fs.unlinkSync(location.endpoint); } catch (error) { if (error.code !== 'ENOENT') writeDiagnostic(`${error.message}\n`); } }
        process.removeListener('SIGTERM', onSignal); process.removeListener('SIGINT', onSignal);
        resolveDone();
    }

    function recordError(error) {
        state.lastError = { message: error.message || String(error), at: Date.now() };
        state.ready = false; state.phase = 'retrying';
        writeDiagnostic(`Watcher error: ${state.lastError.message}\n`);
    }

    // 시작 실패는 백오프로 재시도하고, 한도를 넘으면 종료함. 다음 CLI 요청이 새 프로세스를 띄움
    function retryStart() {
        startFailures++;
        if (startFailures >= MAX_START_ATTEMPTS) {
            writeDiagnostic(`Watcher stopped after ${startFailures} failed starts.\n`);
            void shutdown();
            return;
        }
        retryTimer = setTimeout(() => void initialize(), Math.min(60000, 1000 * 2 ** (startFailures - 1)));
    }

    async function initialize() {
        if (closing || initializing) return;
        initializing = true;
        try {
            const { CodeGraph } = require('../index');
            if (!graph) graph = await CodeGraph.open(location.projectRoot, { sync: false });
            if (closing) return;
            const envDebounce = Number(process.env.CODEGRAPH_WATCH_DEBOUNCE_MS);
            const debounceMs = options.debounceMs ?? (Number.isFinite(envDebounce) && envDebounce >= 100 && envDebounce <= 60000 ? envDebounce : 300);
            const started = graph.watch({
                debounceMs, respectGitignore: options.respectGitignore,
                onSyncComplete: result => {
                    if (closing) return;
                    state.lastSync = { ...result, at: Date.now() };
                    state.lastError = null; state.ready = true; state.phase = 'watching';
                },
                onSyncError: (error, { willRetry } = {}) => {
                    recordError(error);
                    if (closing) return;
                    if (!graph?.isWatching()) retryStart();
                    else if (willRetry === false) state.phase = 'failed';
                },
            });
            if (!started) throw new Error('Native file watcher is disabled or unavailable');
            state.phase = 'reconciling';
            await graph.waitUntilWatcherReady(120000);
            startFailures = 0;
        } catch (error) {
            if (!closing) {
                recordError(error);
                graph?.unwatch();
                retryStart();
            }
        } finally { initializing = false; }
    }

    const onSignal = () => { void shutdown(); };
    process.on('SIGTERM', onSignal); process.on('SIGINT', onSignal);
    try {
        persist();
        protocol.writeJson(location.registry, { projectPath: location.projectRoot, projectId: location.id, runtimeId: state.runtimeId });
    } catch (error) {
        await shutdown();
        throw error;
    }
    heartbeat = setInterval(() => {
        if (!fs.existsSync(path.join(location.directory, 'codegraph.db'))) { void shutdown(); return; }
        if (Date.now() - lastRequestAt >= idleMs && !initializing && !graph?.isIndexing()) {
            writeDiagnostic(`Watcher stopped after ${Math.round(idleMs / 1000)} s without CLI requests.\n`);
            void shutdown();
            return;
        }
        try { persist(); } catch (error) { writeDiagnostic(`Watcher state write failed: ${error.message}\n`); }
    }, 1000);
    retryTimer = setTimeout(() => void initialize(), 150);
    return done;
}

module.exports = { runWatcher };
if (require.main === module) {
    if (process.env.CODEGRAPH_WATCH_LOG) {
        rotateLog(process.env.CODEGRAPH_WATCH_LOG);
        const output = fs.createWriteStream(process.env.CODEGRAPH_WATCH_LOG, { flags: 'a' });
        global.console = new (require('node:console').Console)({ stdout: output, stderr: output });
    }
    const projectPath = process.argv[2] || process.env.CODEGRAPH_WATCH_PROJECT;
    const configuration = process.argv[3] || process.env.CODEGRAPH_WATCH_CONFIG;
    let options;
    try { options = configuration ? JSON.parse(Buffer.from(configuration, 'base64url').toString('utf8')) : {}; }
    catch (error) { writeDiagnostic(`${error.message}\n`); process.exitCode = 1; }
    if (options) runWatcher(projectPath, options).catch(error => { writeDiagnostic(`${error.stack || error}\n`); process.exitCode = 1; });
}
