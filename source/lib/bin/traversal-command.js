"use strict";
const { isInitialized } = require('../directory');
const { syncForRead } = require('./freshness');

function lookup(graph, symbol) {
    return graph.getDb().prepare(`SELECT id FROM nodes
        WHERE id = ? OR name = ? OR qualified_name = ?
        OR replace(qualified_name, '::', '.') = ? ORDER BY file_path, start_line`)
        .all(symbol, symbol, symbol, symbol).map(row => graph.getNode(row.id)).filter(Boolean);
}

function describe(node) {
    return { id: node.id, name: node.name, qualifiedName: node.qualifiedName,
        kind: node.kind, filePath: node.filePath, startLine: node.startLine };
}

function positive(value, maximum) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum) {
        throw new Error(`Expected an integer between 1 and ${maximum}`);
    }
    return number;
}

function collect(graph, matches, command, options) {
    const nodes = new Map();
    const edges = new Set();
    for (const match of matches) {
        if (command === 'impact') {
            const impact = graph.getImpactRadius(match.id, positive(options.depth, 10));
            for (const [id, node] of impact.nodes) nodes.set(id, describe(node));
            for (const edge of impact.edges) edges.add(`${edge.source}:${edge.target}:${edge.kind}`);
        } else {
            const related = command === 'callers' ? graph.getCallers(match.id) : graph.getCallees(match.id);
            for (const item of related) nodes.set(item.node.id, describe(item.node));
        }
    }
    if (command === 'impact') {
        return { depth: positive(options.depth, 10), nodeCount: nodes.size,
            edgeCount: edges.size, affected: [...nodes.values()] };
    }
    return { [command]: [...nodes.values()].slice(0, positive(options.limit, 10000)) };
}

function addTraversal(program, resolvePath) {
    for (const command of ['callers', 'callees', 'impact']) {
        const registration = program.command(`${command} <symbol>`)
            .description(command === 'impact' ? 'Find indexed dependents of a symbol' : `Find indexed ${command} of a symbol`)
            .option('-p, --path <path>', 'Project path')
            .option('--no-sync', 'Read the existing index without a freshness check')
            .option('-j, --json', 'Output JSON');
        if (command === 'impact') registration.option('-d, --depth <number>', 'Traversal depth', '2');
        else registration.option('-l, --limit <number>', 'Maximum results', '20');
        registration.action(async (symbol, options) => {
            let graph;
            try {
                const projectPath = resolvePath(options.path);
                if (!isInitialized(projectPath)) throw new Error(`CodeGraph not initialized in ${projectPath}`);
                const { CodeGraph } = require('../index');
                graph = await CodeGraph.open(projectPath);
                const sync = options.sync === false ? null : await syncForRead(graph, projectPath);
                const matches = lookup(graph, symbol);
                const result = { schemaVersion: 1, projectPath, symbol, found: matches.length > 0,
                    freshness: { state: sync?.status === 'current' ? 'current' : 'unknown', checkedAt: Date.now() },
                    warnings: sync?.warnings || [], ...collect(graph, matches, command, options) };
                if (options.json) console.log(JSON.stringify(result, null, 2));
                else {
                    const related = result[command] || result.affected;
                    console.log(`${command} of ${symbol}: ${related.length}`);
                    for (const node of related) console.log(`${node.qualifiedName || node.name}  ${node.filePath}:${node.startLine}`);
                    for (const warning of result.warnings) console.error(warning);
                }
                if (sync && sync.status !== 'current') process.exitCode = 1;
            } catch (caught) {
                const error = caught instanceof Error ? caught.message : String(caught);
                if (options.json) console.log(JSON.stringify({ schemaVersion: 1, symbol, error }));
                else console.error(error);
                process.exitCode = 1;
            } finally {
                graph?.close();
            }
        });
    }
}

module.exports = { addTraversal };
