"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImportCycles = analyzeImportCycles;
exports.findImportCycles = findImportCycles;
const order_1 = require("./order");
const MAX_CYCLE_STEPS = 100_000;
const MAX_CYCLE_LENGTH = 12;
function normalize(cycle) {
    const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)]);
    return rotations.sort((left, right) => (0, order_1.compareText)(left.join('\0'), right.join('\0')))[0];
}
function adjacency(nodes, edges) {
    const files = new Map(nodes.map((node) => [node.id, node.filePath || node.id]));
    const graph = new Map();
    for (const edge of edges) {
        if (edge.kind !== 'imports')
            continue;
        const source = files.get(edge.source);
        const target = files.get(edge.target);
        if (!source || !target || source === target)
            continue;
        const targets = graph.get(source) ?? new Set();
        targets.add(target);
        graph.set(source, targets);
    }
    return graph;
}
function compareCycles(left, right) {
    return left.length - right.length || (0, order_1.compareText)(left.join('\0'), right.join('\0'));
}
function keepBest(found, cycle, limit) {
    const key = cycle.join('\0');
    if (found.has(key))
        return;
    found.set(key, cycle);
    if (found.size <= limit)
        return;
    const ranked = [...found.values()].sort(compareCycles);
    const worst = ranked[ranked.length - 1];
    found.delete(worst.join('\0'));
}
function cyclesFrom(start, graph, maxLength, limit, budget, found) {
    const visit = (current, path, seen) => {
        if (path.length > maxLength || budget.remaining <= 0)
            return;
        for (const next of [...(graph.get(current) ?? [])].sort()) {
            if (budget.remaining-- <= 0)
                return;
            if (next === start && path.length > 1) {
                keepBest(found, normalize(path), limit);
            }
            else if (!seen.has(next) && path.length < maxLength && next >= start) {
                seen.add(next);
                visit(next, [...path, next], seen);
                seen.delete(next);
            }
        }
    };
    visit(start, [start], new Set([start]));
}
function analyzeImportCycles(nodes, edges, maxLength = 5, topN = 20) {
    const limit = Number.isFinite(topN) ? Math.max(0, Math.floor(topN)) : 0;
    if (limit === 0)
        return { cycles: [], truncated: false };
    const lengthLimit = Number.isFinite(maxLength)
        ? Math.min(MAX_CYCLE_LENGTH, Math.max(2, Math.floor(maxLength)))
        : 5;
    const graph = adjacency(nodes, edges);
    const starts = [...new Set([...graph.keys(), ...[...graph.values()].flatMap((targets) => [...targets])])].sort();
    const found = new Map();
    const budget = { remaining: MAX_CYCLE_STEPS };
    for (const start of starts) {
        cyclesFrom(start, graph, lengthLimit, limit, budget, found);
        if (budget.remaining <= 0)
            break;
    }
    return {
        cycles: [...found.values()].sort(compareCycles),
        truncated: budget.remaining <= 0,
    };
}
function findImportCycles(nodes, edges, maxLength = 5, topN = 20) {
    return analyzeImportCycles(nodes, edges, maxLength, topN).cycles;
}
//# sourceMappingURL=report-cycles.js.map