"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cohesionScore = cohesionScore;
exports.labelByHub = labelByHub;
exports.summarizeCommunities = summarizeCommunities;
const order_1 = require("./order");
function cohesionScore(graph, nodeIds) {
    if (nodeIds.length < 2)
        return 0;
    const selected = new Set(nodeIds);
    let actual = 0;
    graph.forEachEdge((_key, _attributes, source, target) => {
        if (selected.has(source) && selected.has(target))
            actual++;
    });
    return actual / ((nodeIds.length * (nodeIds.length - 1)) / 2);
}
function labelByHub(graph, nodeIds) {
    const weightedDegree = (id) => {
        let degree = 0;
        graph.forEachEdge(id, (_key, attributes) => {
            degree += attributes.weight;
        });
        return degree;
    };
    const hub = [...nodeIds].sort((left, right) => {
        const degreeDelta = weightedDegree(right) - weightedDegree(left);
        return degreeDelta || (0, order_1.compareText)(left, right);
    })[0];
    if (!hub)
        return 'Empty community';
    const node = graph.getNodeAttribute(hub, 'node');
    return node.name || hub;
}
function summarizeCommunities(graph, groups) {
    const nodeCommunities = {};
    const communities = {};
    groups.forEach((unsorted, index) => {
        const members = [...unsorted].sort();
        const id = `c${index}`;
        for (const member of members)
            nodeCommunities[member] = id;
        communities[id] = {
            id,
            label: labelByHub(graph, members),
            size: members.length,
            cohesion: cohesionScore(graph, members),
            members,
        };
    });
    return { nodeCommunities, communities };
}
//# sourceMappingURL=community-summary.js.map