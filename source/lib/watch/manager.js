'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const protocol = require('./protocol');

async function watcherStatus(projectPath) {
    const location = protocol.locations(projectPath);
    const response = await protocol.request(location, 'status');
    if (!response.error) return response;
    const saved = protocol.readJson(location.state);
    return {
        projectPath: location.projectRoot, projectId: location.id, active: false, ready: false,
        phase: response.error === 'ENOENT' || response.error === 'ECONNREFUSED' ? 'stopped' : 'unresponsive',
        pid: saved?.pid ?? null, runtimeId: saved?.runtimeId ?? null,
        nodePath: saved?.nodePath, runtimeEntry: saved?.runtimeEntry,
        configuration: saved?.configuration,
        lastSync: saved?.lastSync ?? null, lastError: saved?.lastError ?? null,
        pendingFiles: [], error: response.error,
    };
}

async function stopWatcher(projectPath, options = {}) {
    const location = protocol.locations(projectPath);
    const response = await protocol.request(location, 'stop');
    if (response.error) return watcherStatus(projectPath);
    const deadline = Date.now() + (options.timeoutMs ?? 30000);
    while (Date.now() < deadline) {
        await delay(100);
        const status = await watcherStatus(projectPath);
        if (status.phase === 'stopped') return status;
    }
    return { ...await watcherStatus(projectPath), stopPending: true };
}

async function ensureWatcher(projectPath, options = {}) {
    const location = protocol.locations(projectPath);
    if (process.env.CODEGRAPH_NO_WATCH === '1' || process.env.CODEGRAPH_WATCH_WORKER === '1') {
        return { projectPath: location.projectRoot, projectId: location.id, active: false, ready: false, phase: 'disabled' };
    }
    if (!fs.existsSync(path.join(location.directory, 'codegraph.db'))) {
        return { projectPath: location.projectRoot, projectId: location.id, active: false, ready: false, phase: 'uninitialized' };
    }
    const fingerprint = protocol.runtimeId();
    const timeoutMs = options.timeoutMs ?? 7500;
    let status = await watcherStatus(projectPath);
    // 큰 재빌드 중인 워커는 IPC 응답이 늦을 뿐 살아 있음. 새 워커를 띄우거나 실패로 보고하지 않음
    if (status.error === 'timeout' && protocol.livePid(status.pid)) return { ...status, busy: true };
    const previous = status.active ? status : protocol.readJson(location.state);
    const configuration = {
        debounceMs: options.debounceMs ?? previous?.configuration?.debounceMs,
        respectGitignore: options.respectGitignore ?? previous?.configuration?.respectGitignore,
    };
    const configured = (options.debounceMs === undefined || options.debounceMs === status.configuration?.debounceMs)
        && (options.respectGitignore === undefined || options.respectGitignore === status.configuration?.respectGitignore);
    if (status.active && status.runtimeId === fingerprint && configured && !options.restart) return status;
    if (status.active) {
        status = await stopWatcher(projectPath, { timeoutMs });
        if (status.active || status.stopPending) return { ...status, restartPending: true };
    }
    const saved = protocol.readJson(location.state);
    const starting = saved && protocol.livePid(saved.pid) && Date.now() - saved.heartbeatAt < 10000;
    let releaseLease;
    if (!starting || saved.phase === 'stopped') releaseLease = protocol.lease(location.startLock);
    const deadline = Date.now() + timeoutMs;
    let child;
    let launcherFailure;
    try {
        if (releaseLease) {
            fs.mkdirSync(location.directory, { recursive: true });
            const configurationBase64 = Buffer.from(JSON.stringify({
                ...configuration,
                runtimeId: fingerprint,
            })).toString('base64url');
            const environment = {
                ...process.env,
                CODEGRAPH_WATCH_WORKER: '1',
                CODEGRAPH_WATCH_LOG: location.log,
                CODEGRAPH_WATCH_PROJECT: location.projectRoot,
                CODEGRAPH_WATCH_CONFIG: configurationBase64,
            };
            const workerArguments = process.execArgv.filter(argument => argument === '--liftoff-only' || argument === '--no-wasm-tier-up');
            workerArguments.push(path.join(__dirname, 'worker.js'));
            if (process.platform === 'win32') {
                const quoteArgument = value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
                const literal = value => "'" + value.replaceAll("'", "''") + "'";
                const script = `$ErrorActionPreference = 'Stop'; Start-Process -FilePath ${literal(process.execPath)} -ArgumentList ${literal(workerArguments.map(quoteArgument).join(' '))} -WorkingDirectory ${literal(location.projectRoot)} -WindowStyle Hidden`;
                const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
                child = spawn(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
                    cwd: location.projectRoot, windowsHide: true,
                    stdio: 'ignore', env: environment,
                });
                await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
                child.once('exit', code => {
                    if (code !== 0) launcherFailure = new Error(`Watcher launch failed (${code}); see ${location.log}`);
                });
                child.unref();
            } else {
                child = spawn(process.execPath, workerArguments, {
                    cwd: location.projectRoot, detached: true, windowsHide: true,
                    stdio: 'ignore', env: environment,
                });
                await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
                child.unref();
            }
        }
        do {
            if (launcherFailure) throw launcherFailure;
            status = await watcherStatus(projectPath);
            if (status.active) {
                if (process.platform === 'win32' && child?.exitCode === null) child.kill();
                return status;
            }
            await delay(50);
        } while (Date.now() < deadline);
        if (process.platform === 'win32' && child?.exitCode === null) child.kill();
        return status;
    } finally { releaseLease?.(); }
}

async function listWatchers() {
    let files;
    try { files = fs.readdirSync(protocol.registryDirectory()); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const result = [];
    for (const file of files.filter(name => /^[a-f0-9]{32}\.json$/.test(name))) {
        const record = protocol.readJson(path.join(protocol.registryDirectory(), file));
        if (typeof record?.projectPath !== 'string' || !fs.existsSync(record.projectPath)) {
            fs.rmSync(path.join(protocol.registryDirectory(), file), { force: true });
            continue;
        }
        const location = protocol.locations(record.projectPath);
        if (file !== `${location.id}.json`) continue;
        const status = await watcherStatus(record.projectPath);
        if (status.active) result.push(status);
    }
    return result;
}

module.exports = { ensureWatcher, stopWatcher, watcherStatus, listWatchers, runWatcher: (...args) => require('./worker').runWatcher(...args) };
