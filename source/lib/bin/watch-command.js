"use strict";
const { isInitialized } = require('../directory');

function addWatch(program, resolvePath) {
    const watch = program.command('watch').description('Manage automatic project file watching');
    for (const operation of ['start', 'stop', 'status']) {
        watch.command(`${operation} [path]`).option('-j, --json', 'Output JSON')
            .action(async (input, options) => {
                const projectPath = resolvePath(input);
                if (!isInitialized(projectPath)) throw new Error(`CodeGraph not initialized in ${projectPath}`);
                const manager = require('../watch/manager');
                const action = operation === 'start' ? manager.ensureWatcher
                    : operation === 'stop' ? manager.stopWatcher : manager.watcherStatus;
                const result = await action(projectPath);
                console.log(JSON.stringify(result, null, 2));
                if ((operation === 'start' && ((!result.active && !result.busy && result.phase !== 'disabled') || result.restartPending))
                    || (operation === 'stop' && result.phase !== 'stopped')) process.exitCode = 1;
            });
    }
}

function autoWatch(program, resolvePath) {
    const reads = new Set(['query', 'context', 'docs', 'callers', 'callees', 'impact', 'affected', 'files', 'backlinks']);
    const writes = new Set(['init', 'index', 'sync']);
    program.hook('postAction', async (_, command) => {
        if (process.env.CODEGRAPH_NO_WATCH === '1' || process.env.CODEGRAPH_WATCH_WORKER === '1') return;
        const name = command.name();
        if (!reads.has(name) && !writes.has(name)) return;
        const options = command.opts();
        if (options.sync === false) return;
        let projectPath;
        try { projectPath = resolvePath(writes.has(name) ? command.args[0] : options.path); }
        catch (error) { if (process.exitCode) return; throw error; }
        if (!isInitialized(projectPath)) return;
        const { ensureWatcher } = require('../watch/manager');
        // 워처 자동 기동은 부가 기능임. 질의 결과는 이미 출력됐으므로 기동 실패가 종료 코드를 바꾸면 안 됨
        try {
            const result = await ensureWatcher(projectPath, { respectGitignore: options.gitignore });
            if (!result.active && !result.busy && !result.restartPending) throw new Error(result.error || `Watcher is ${result.phase}`);
        } catch (error) {
            console.error(`Automatic file watching could not start (ignored): ${error.message || error}`);
        }
    });
}

module.exports = { addWatch, autoWatch };
