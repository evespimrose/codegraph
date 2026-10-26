"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.partitionGraph = partitionGraph;
exports.splitOversizedCommunities = splitOversizedCommunities;
const graphology_communities_louvain_1 = __importDefault(require("graphology-communities-louvain"));
const community_graph_1 = require("./community-graph");
const community_rng_1 = require("./community-rng");
const order_1 = require("./order");
function groupMapping(mapping) {
    const groups = new Map();
    for (const [nodeId, community] of Object.entries(mapping)) {
        const members = groups.get(community) ?? [];
        members.push(nodeId);
        groups.set(community, members);
    }
    return [...groups.values()]
        .map((members) => members.sort(order_1.compareText))
        .sort((a, b) => (0, order_1.compareText)(a[0], b[0]));
}
function partitionGraph(graph, seed, resolution) {
    const members = graph.nodes().sort();
    if (members.length < 2 || graph.size === 0)
        return members.map((member) => [member]);
    return groupMapping((0, graphology_communities_louvain_1.default)(graph, {
        getEdgeWeight: 'weight',
        randomWalk: true,
        resolution,
        rng: (0, community_rng_1.seededRandom)(seed, `${resolution}:${members.join('\0')}`),
    }));
}
function structuralChunks(graph, members, maxSize) {
    const remaining = new Set(members);
    const chunks = [];
    while (remaining.size > 0) {
        const first = [...remaining].sort()[0];
        const queue = [first];
        const queued = new Set(queue);
        const chunk = [];
        while (queue.length > 0 && chunk.length < maxSize) {
            const current = queue.shift();
            if (!remaining.delete(current))
                continue;
            chunk.push(current);
            for (const neighbor of graph.neighbors(current).sort()) {
                if (remaining.has(neighbor) && !queued.has(neighbor)) {
                    queued.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        chunks.push(chunk.sort());
    }
    return chunks;
}
function splitGroup(graph, members, maxSize, minSize, seed, resolution, depth) {
    if (members.length <= maxSize || members.length < minSize)
        return [members.sort()];
    const subgraph = (0, community_graph_1.inducedCommunityGraph)(graph, members);
    const detected = partitionGraph(subgraph, seed, resolution * (depth + 2));
    const parts = detected.length > 1 ? detected : structuralChunks(subgraph, members, maxSize);
    if (parts.length === 1)
        return [members.sort()];
    return parts.flatMap((part) => splitGroup(graph, part, maxSize, minSize, seed, resolution, depth + 1));
}
function splitOversizedCommunities(graph, initial, totalNodes, maxFraction, minSplitSize, seed, resolution) {
    const maxSize = Math.max(1, Math.floor(totalNodes * maxFraction));
    return initial
        .flatMap((members) => splitGroup(graph, members, maxSize, minSplitSize, seed, resolution, 0))
        .sort((left, right) => (0, order_1.compareText)(left[0], right[0]));
}
//# sourceMappingURL=community-split.js.map