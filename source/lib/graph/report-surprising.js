"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.surprisingConnections = surprisingConnections;
const report_god_nodes_1 = require("./report-god-nodes");
const order_1 = require("./order");
const CONFIDENCE_WEIGHT = 0.2;
const CROSS_WEIGHT = 0.3;
const SEMANTIC_WEIGHT = 0.3;
const PERIPHERAL_HUB_WEIGHT = 0.2;
const SEMANTIC_EDGE_FLOOR = 0.5;
const HEURISTIC_FLOOR = 0.2;
function bounded(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function semantic(edge) {
    const stored = bounded(edge.metadata?.similarity ?? edge.metadata?.score);
    if (edge.kind === 'semantically_related')
        return Math.max(stored, SEMANTIC_EDGE_FLOOR);
    return edge.provenance === 'heuristic' ? Math.max(stored, HEURISTIC_FLOOR) : stored;
}
function confidence(edge) {
    const stored = edge.metadata?.confidence;
    if (typeof stored === 'number' && Number.isFinite(stored))
        return bounded(stored);
    switch (edge.provenance) {
        case 'tree-sitter':
        case 'scip': return 1;
        case 'adapter': return 0.95;
        case 'resolver': return 0.8;
        case 'inferred': return 0.6;
        case 'heuristic': return 0.3;
        default: return 0.2;
    }
}
function endpoints(edge, nodes) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target || source.id === target.id)
        return null;
    const phantom = edge.provenance === 'heuristic' &&
        edge.kind !== 'semantically_related' &&
        source.language !== target.language;
    return phantom ? null : [source, target];
}
function factors(edge, source, target, degrees, maxDegree, mapping) {
    const cross = mapping[source.id] && mapping[target.id] && mapping[source.id] !== mapping[target.id] ? 1 : 0;
    const semanticScore = semantic(edge);
    const degreeDelta = ((degrees.get(target.id) ?? 0) - (degrees.get(source.id) ?? 0)) / maxDegree;
    const peripheralToHub = edge.kind === 'semantically_related'
        ? Math.abs(degreeDelta)
        : Math.max(0, degreeDelta);
    if (cross === 0 && semanticScore === 0 && peripheralToHub === 0)
        return null;
    return {
        confidence: confidence(edge),
        crossCommunity: cross,
        semantic: semanticScore,
        peripheralToHub,
    };
}
function connection(edge, nodes, degrees, maxDegree, mapping) {
    const pair = endpoints(edge, nodes);
    if (!pair)
        return null;
    const [source, target] = pair;
    const scores = factors(edge, source, target, degrees, maxDegree, mapping);
    if (!scores)
        return null;
    return {
        source: source.id,
        target: target.id,
        sourceLabel: source.name || source.id,
        targetLabel: target.name || target.id,
        edgeKind: edge.kind,
        score: scores.confidence * CONFIDENCE_WEIGHT +
            scores.crossCommunity * CROSS_WEIGHT +
            scores.semantic * SEMANTIC_WEIGHT +
            scores.peripheralToHub * PERIPHERAL_HUB_WEIGHT,
        factors: scores,
    };
}
function compareLinks(left, right) {
    return (right.score - left.score ||
        (0, order_1.compareText)(left.source, right.source) ||
        (0, order_1.compareText)(left.target, right.target) ||
        (0, order_1.compareText)(left.edgeKind, right.edgeKind) ||
        (0, order_1.compareText)(left.sourceLabel, right.sourceLabel) ||
        (0, order_1.compareText)(left.targetLabel, right.targetLabel) ||
        right.factors.confidence - left.factors.confidence ||
        right.factors.crossCommunity - left.factors.crossCommunity ||
        right.factors.semantic - left.factors.semantic ||
        right.factors.peripheralToHub - left.factors.peripheralToHub);
}
function surprisingConnections(nodes, edges, mapping, topN = 5) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const degrees = (0, report_god_nodes_1.nodeDegrees)(nodes, edges);
    const maxDegree = Math.max(1, ...degrees.values());
    const candidates = new Map();
    for (const edge of edges) {
        const candidate = connection(edge, nodeById, degrees, maxDegree, mapping);
        if (!candidate)
            continue;
        const key = [candidate.source, candidate.target].sort().join('\0');
        const current = candidates.get(key);
        if (!current || compareLinks(candidate, current) < 0)
            candidates.set(key, candidate);
    }
    return [...candidates.values()]
        .sort(compareLinks)
        .slice(0, Math.max(0, topN));
}
//# sourceMappingURL=report-surprising.js.map