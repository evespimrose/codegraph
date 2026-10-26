"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestQuestions = suggestQuestions;
const betweenness_1 = __importDefault(require("graphology-metrics/centrality/betweenness"));
const community_graph_1 = require("./community-graph");
const report_god_nodes_1 = require("./report-god-nodes");
const order_1 = require("./order");
const EXACT_CENTRALITY_MAX_NODES = 500;
const EXACT_CENTRALITY_MAX_EDGES = 50_000;
function item(strategy, question, nodeIds) {
    return { strategy, question, nodeIds };
}
function bridgeScores(nodes, edges, mapping) {
    const graph = (0, community_graph_1.loadCommunityGraph)(nodes, edges);
    if (graph.order <= 2 || graph.size === 0)
        return new Map();
    if (graph.order <= EXACT_CENTRALITY_MAX_NODES && graph.size <= EXACT_CENTRALITY_MAX_EDGES) {
        const scores = (0, betweenness_1.default)(graph, { normalized: true, getEdgeWeight: null });
        return new Map(Object.entries(scores).map(([id, score]) => [id, Number.isFinite(score) ? score : 0]));
    }
    const scores = new Map();
    for (const edge of edges) {
        if (!mapping[edge.source] || mapping[edge.source] === mapping[edge.target])
            continue;
        scores.set(edge.source, (scores.get(edge.source) ?? 0) + 1);
        scores.set(edge.target, (scores.get(edge.target) ?? 0) + 1);
    }
    return scores;
}
function ambiguous(nodes, edges) {
    return edges
        .filter((edge) => edge.provenance === 'heuristic')
        .map((edge) => {
        const source = nodes.get(edge.source)?.name ?? edge.source;
        const target = nodes.get(edge.target)?.name ?? edge.target;
        return item('ambiguous', `Is the inferred ${edge.kind} relationship from ${source} to ${target} correct?`, [edge.source, edge.target]);
    });
}
function bridges(nodes, edges, mapping) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const crossNodes = new Set();
    for (const edge of edges) {
        if (!mapping[edge.source] || !mapping[edge.target] || mapping[edge.source] === mapping[edge.target])
            continue;
        crossNodes.add(edge.source);
        crossNodes.add(edge.target);
    }
    return [...bridgeScores(nodes, edges, mapping)]
        .filter(([id, score]) => score > 0 && crossNodes.has(id))
        .sort((left, right) => right[1] - left[1] || (0, order_1.compareText)(left[0], right[0]))
        .map(([id]) => item('bridge', `Why does ${nodeById.get(id)?.name ?? id} bridge otherwise separate communities?`, [id]));
}
function inferredGods(gods, edges) {
    return gods
        .filter((god) => edges.some((edge) => (edge.source === god.id || edge.target === god.id) &&
        (edge.provenance === 'heuristic' || edge.provenance === 'inferred')))
        .map((god) => item('god-with-inferred', `Which inferred relationships make ${god.label} unusually central?`, [god.id]));
}
function isolated(nodes, edges) {
    const degrees = (0, report_god_nodes_1.nodeDegrees)(nodes, edges);
    return nodes
        .filter((node) => (degrees.get(node.id) ?? 0) === 0)
        .sort((left, right) => (0, order_1.compareText)(left.id, right.id))
        .map((node) => item('isolated', `Why is ${node.name || node.id} isolated from the indexed graph?`, [node.id]));
}
function lowCohesion(communities) {
    return Object.values(communities)
        .filter((community) => community.size > 1)
        .sort((left, right) => left.cohesion - right.cohesion || (0, order_1.compareText)(left.id, right.id))
        .map((community) => item('low-cohesion', `Why is the ${community.label} community weakly connected?`, community.members));
}
function suggestQuestions(nodes, edges, mapping, communities, gods, topN = 7) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const groups = [
        ambiguous(nodeById, edges),
        bridges(nodes, edges, mapping),
        inferredGods(gods, edges),
        isolated(nodes, edges),
        lowCohesion(communities),
    ];
    const diverse = groups.flatMap((questions) => questions.slice(0, 1));
    const remainder = groups.flatMap((questions) => questions.slice(1));
    return [...diverse, ...remainder].slice(0, Math.max(0, topN));
}
//# sourceMappingURL=report-questions.js.map