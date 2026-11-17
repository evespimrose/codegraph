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
// flush 요청이 감시기의 맞추기를 기다리는 최대 시간. 질의 쪽 직접 sync 의 잠금 대기 한도(bin/freshness.js)와 같음
const FLUSH_WAIT_MS = 30000;
// 상태 파일은 내용이 바뀔 때만 쓰고, 그대로면 이 간격으로만 다시 씀. manager 의 시작 판정(10초)보다 짧아야 함
const STATE_REFRESH_MS = 5000;
const PAUSE_WAIT_MS = 15000;
const HOLD_MAX_MS = 30 * 60 * 1000;

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

// 상태 파일 쓰기 판정(W3). heartbeatAt 을 뺀 내용이 바뀌었거나 마지막 쓰기 뒤 refreshMs 가 지났을 때만 write 를 부름.
// write 가 던지면(Windows 의 EPERM 등) 기록을 바꾸지 않으므로 다음 박동에 다시 씀
function createStateWriter(write, refreshMs = STATE_REFRESH_MS, now = Date.now) {
    let written = null;
    let writtenAt = 0;
    return (state) => {
        const { heartbeatAt, ...content } = state;
        const text = JSON.stringify(content);
        if (text === written && now() - writtenAt < refreshMs)
            return false;
        write(state);
        written = text;
        writtenAt = now();
        return true;
    };
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
    // tasking: index/sync 같은 쓰기 작업이 워처 동기화를 넘겨받은 동안의 홀더. 홀더가 있으면 watching 이 아님
    const holders = new Map();
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
        const tasking = holders.size > 0;
        return { ...publicState, phase: tasking ? 'tasking' : publicState.phase, tasking, holders: [...holders.keys()],
            ready: state.ready && !reconciling && !tasking && pendingFiles.length === 0,
            watching: graph?.isWatching() ?? false, pendingFiles };
    };
    // 상태 파일은 내용이 바뀔 때와 STATE_REFRESH_MS 마다만 씀(W3). 1초마다 쓰면 Windows 에서 교체 rename 이 EPERM 으로 거부되곤 했음
    const writeState = createStateWriter(value => protocol.writeJson(location.state, value));
    let writeFailing = false;
    const persist = () => {
        state.heartbeatAt = Date.now();
        Object.assign(state, snapshot());
        writeState(state);
    };
    let resolveDone;
    const done = new Promise(resolve => { resolveDone = resolve; });
    const sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
        socket.on('error', () => socket.destroy());
        socket.setTimeout(2000, () => socket.destroy());
        const lease = holder => {
            if (typeof holder !== 'string' || holder.length === 0 || holder.length > 128) return false;
            return true;
        };
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
            } else if (request.command === 'flush') {
                // 질의가 직접 sync 하지 않고 감시기의 맞추기를 기다림(W2). 끝나거나 시간 제한에 걸리면 지금 상태를 돌려줌
                lastRequestAt = Date.now();
                socket.setTimeout(FLUSH_WAIT_MS + 2000, () => socket.destroy());
                const flushed = graph && !initializing ? graph.flushWatcher() : Promise.resolve();
                // 시간 제한 타이머는 flush 가 먼저 끝나도 남으므로 ref 를 꺼서 멈춘 뒤 프로세스 종료를 붙잡지 않게 함
                void Promise.race([flushed.catch(() => {}), delay(FLUSH_WAIT_MS, undefined, { ref: false })]).then(() => {
                    if (!socket.destroyed) socket.end(JSON.stringify(snapshot()) + '\n');
                });
            } else if (request.command === 'pause') {
                lastRequestAt = Date.now();
                if (!lease(request.holder) || !Number.isInteger(request.pid) || closing) {
                    return socket.end(JSON.stringify({ projectId: location.id, error: 'invalid pause request' }) + '\n');
                }
                socket.setTimeout(PAUSE_WAIT_MS + 5000, () => socket.destroy());
                holders.set(request.holder, { pid: request.pid, since: Date.now() });
                const reply = error => socket.end(JSON.stringify(error ? { projectId: location.id, error } : snapshot()) + '\n');
                if (!graph) return reply();
                graph.pauseWatch(request.holder, PAUSE_WAIT_MS).then(() => reply(), error => {
                    holders.delete(request.holder);
                    reply(error.message || 'pause failed');
                });
            } else if (request.command === 'resume') {
                lastRequestAt = Date.now();
                if (lease(request.holder) && holders.delete(request.holder)) graph?.resumeWatch(request.holder);
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
            for (const holder of holders.keys()) void graph.pauseWatch(holder, PAUSE_WAIT_MS).catch(() => {});
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
        for (const [holder, info] of holders) {
            if (!protocol.livePid(info.pid) || Date.now() - info.since > HOLD_MAX_MS) {
                holders.delete(holder);
                graph?.resumeWatch(holder);
            }
        }
        if (!fs.existsSync(path.join(location.directory, 'codegraph.db'))) { void shutdown(); return; }
        if (Date.now() - lastRequestAt >= idleMs && holders.size === 0 && !initializing && !graph?.isIndexing()) {
            writeDiagnostic(`Watcher stopped after ${Math.round(idleMs / 1000)} s without CLI requests.\n`);
            void shutdown();
            return;
        }
        try { persist(); writeFailing = false; }
        catch (error) {
            // 실패가 이어지는 동안은 한 번만 기록하고 다음 박동에 다시 씀
            if (!writeFailing) writeDiagnostic(`Watcher state write failed: ${error.message}\n`);
            writeFailing = true;
        }
    }, 1000);
    retryTimer = setTimeout(() => void initialize(), 150);
    return done;
}

module.exports = { runWatcher, createStateWriter };
if (require.main === module) {
    let output = null;
    if (process.env.CODEGRAPH_WATCH_LOG) {
        rotateLog(process.env.CODEGRAPH_WATCH_LOG);
        output = fs.createWriteStream(process.env.CODEGRAPH_WATCH_LOG, { flags: 'a' });
        global.console = new (require('node:console').Console)({ stdout: output, stderr: output });
    }
    const projectPath = process.argv[2] || process.env.CODEGRAPH_WATCH_PROJECT;
    const configuration = process.argv[3] || process.env.CODEGRAPH_WATCH_CONFIG;
    let options;
    try { options = configuration ? JSON.parse(Buffer.from(configuration, 'base64url').toString('utf8')) : {}; }
    catch (error) { writeDiagnostic(`${error.message}\n`); process.exitCode = 1; }
    // chokidar 는 close 뒤에도 ref 된 throttle 타이머를 최대 1초 남겨 프로세스가 늦게 끝남. 정리가 끝났으니 바로 종료함
    const exit = () => process.exit();
    if (options) runWatcher(projectPath, options).then(() => (output ? output.end(exit) : exit())).catch(error => { writeDiagnostic(`${error.stack || error}\n`); process.exitCode = 1; });
}
