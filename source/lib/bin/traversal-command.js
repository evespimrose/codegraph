"use strict";

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

module.exports = { lookup, collect };
