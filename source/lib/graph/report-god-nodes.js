"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeDegrees = nodeDegrees;
exports.godNodes = godNodes;
const order_1 = require("./order");
const EXCLUDED_KINDS = new Set(['file', 'import', 'concept']);
const BUILTIN_NOISE = new Set([
    'any',
    'array',
    'boolean',
    'error',
    'function',
    'number',
    'object',
    'promise',
    'string',
    'undefined',
    'unknown',
    'void',
]);
function nodeDegrees(nodes, edges) {
    const degrees = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
        if (degrees.has(edge.source))
            degrees.set(edge.source, degrees.get(edge.source) + 1);
        if (degrees.has(edge.target))
            degrees.set(edge.target, degrees.get(edge.target) + 1);
    }
    return degrees;
}
function godNodes(nodes, edges, topN = 10) {
    const degrees = nodeDegrees(nodes, edges);
    return nodes
        .filter((node) => !EXCLUDED_KINDS.has(node.kind) && !BUILTIN_NOISE.has(node.name.trim().toLocaleLowerCase()))
        .map((node) => ({
        id: node.id,
        label: node.name || node.id,
        kind: node.kind,
        degree: degrees.get(node.id) ?? 0,
    }))
        .sort((left, right) => right.degree - left.degree || (0, order_1.compareText)(left.id, right.id))
        .slice(0, Math.max(0, topN));
}
//# sourceMappingURL=report-god-nodes.js.map