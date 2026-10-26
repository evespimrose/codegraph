"use strict";
const { setTimeout: delay } = require('node:timers/promises');
const manager = require('../watch/manager');
const protocol = require('../watch/protocol');
const { getProvenanceRebuildReason } = require('../provenance');

async function resolveGitignore(projectPath, explicitValue) {
    if (typeof explicitValue === 'boolean') return explicitValue;
    const watcher = await manager.watcherStatus(projectPath);
    return watcher.configuration?.respectGitignore ?? true;
}

function publishedByWatcher(graph, watcher) {
    return watcher.active && watcher.ready && watcher.pendingFiles?.length === 0
        && watcher.runtimeId === protocol.runtimeId()
        && getProvenanceRebuildReason(graph.getDb()) === null;
}

async function syncForRead(graph, projectPath) {
    const watcher = await manager.watcherStatus(projectPath);
    if (publishedByWatcher(graph, watcher)) {
        return {
            status: 'current', filesAdded: 0, filesModified: 0, filesRemoved: 0, nodesUpdated: 0, durationMs: 0,
            warnings: watcher.lastSync?.warnings?.length ? watcher.lastSync.warnings : undefined,
        };
    }
    const options = { respectGitignore: watcher.configuration?.respectGitignore ?? true };
    const deadline = Date.now() + 30000;
    let result;
    do {
        result = await graph.sync(options);
        if (result.status !== 'blocked' || Date.now() >= deadline) return result;
        await delay(150);
    } while (true);
}

module.exports = { syncForRead, resolveGitignore };
