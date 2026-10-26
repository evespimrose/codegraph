"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCommunityGraph = loadCommunityGraph;
exports.inducedCommunityGraph = inducedCommunityGraph;
const graphology_1 = require("graphology");
const order_1 = require("./order");
function addEdge(graph, edge) {
    if (edge.source === edge.target || !graph.hasNode(edge.source) || !graph.hasNode(edge.target))
        return;
    if (graph.hasEdge(edge.source, edge.target)) {
        graph.updateEdgeAttribute(edge.source, edge.target, 'weight', (weight) => (weight ?? 0) + 1);
        graph.updateEdgeAttribute(edge.source, edge.target, 'edges', (current) => [...(current ?? []), edge]);
    }
    else {
        graph.addEdge(edge.source, edge.target, { weight: 1, edges: [edge] });
    }
}
function loadCommunityGraph(nodes, edges) {
    const graph = new graphology_1.UndirectedGraph({
        allowSelfLoops: false,
        multi: false,
    });
    for (const node of [...nodes].sort((left, right) => (0, order_1.compareText)(left.id, right.id))) {
        if (!graph.hasNode(node.id))
            graph.addNode(node.id, { node });
    }
    const orderedEdges = [...edges].sort((left, right) => (0, order_1.compareText)(`${left.source}\0${left.target}\0${left.kind}`, `${right.source}\0${right.target}\0${right.kind}`));
    for (const edge of orderedEdges)
        addEdge(graph, edge);
    return graph;
}
function inducedCommunityGraph(graph, members) {
    const selected = new Set(members);
    const nodes = members.map((id) => graph.getNodeAttribute(id, 'node'));
    const edges = [];
    graph.forEachEdge((_key, attributes, source, target) => {
        if (selected.has(source) && selected.has(target))
            edges.push(...attributes.edges);
    });
    return loadCommunityGraph(nodes, edges);
}
//# sourceMappingURL=community-graph.js.map