"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCommunities = detectCommunities;
const community_fingerprint_1 = require("./community-fingerprint");
const community_graph_1 = require("./community-graph");
const community_split_1 = require("./community-split");
const community_summary_1 = require("./community-summary");
const order_1 = require("./order");
const DEFAULT_MAX_NODES = 20_000;
const DEFAULT_MAX_FRACTION = 0.25;
const DEFAULT_MIN_SPLIT = 10;
function unitFraction(value, allowOne) {
    return Number.isFinite(value) && value > 0 && (allowOne ? value <= 1 : value < 1);
}
function validateOptions(options) {
    if (!Number.isInteger(options.maxNodes) || options.maxNodes < 1) {
        throw new Error('maxNodes must be a positive integer');
    }
    if (!unitFraction(options.maxCommunityFraction, true)) {
        throw new Error('maxCommunityFraction must be greater than 0 and at most 1');
    }
    if (!Number.isInteger(options.minSplitSize) || options.minSplitSize < 2) {
        throw new Error('minSplitSize must be an integer of at least 2');
    }
    if (!Number.isFinite(options.resolution) || options.resolution <= 0) {
        throw new Error('resolution must be greater than 0');
    }
    if (typeof options.seed === 'number' && !Number.isFinite(options.seed))
        throw new Error('seed must be finite');
    const percentile = options.excludeHubPercentile;
    if (percentile !== undefined && !unitFraction(percentile, false)) {
        throw new Error('excludeHubPercentile must be greater than 0 and less than 1');
    }
}
function resolveOptions(input) {
    const options = {
        seed: input.seed ?? 0,
        maxNodes: input.maxNodes ?? DEFAULT_MAX_NODES,
        maxCommunityFraction: input.maxCommunityFraction ?? DEFAULT_MAX_FRACTION,
        minSplitSize: input.minSplitSize ?? DEFAULT_MIN_SPLIT,
        resolution: input.resolution ?? 1,
    };
    if (input.excludeHubPercentile !== undefined)
        options.excludeHubPercentile = input.excludeHubPercentile;
    validateOptions(options);
    return options;
}
function excludedHubs(graph, percentile) {
    if (percentile === undefined || graph.order < 2)
        return [];
    const degrees = graph.nodes().map((id) => graph.degree(id)).sort((a, b) => a - b);
    const cutoff = degrees[Math.ceil(percentile * degrees.length) - 1] ?? Number.POSITIVE_INFINITY;
    return graph.nodes().filter((id) => graph.degree(id) > cutoff).sort();
}
function detectGroups(graph, config) {
    const hubs = excludedHubs(graph, config.excludeHubPercentile);
    const hubSet = new Set(hubs);
    const active = graph.nodes().filter((id) => !hubSet.has(id));
    const activeGraph = (0, community_graph_1.inducedCommunityGraph)(graph, active);
    const initial = (0, community_split_1.partitionGraph)(activeGraph, config.seed, config.resolution);
    const groups = (0, community_split_1.splitOversizedCommunities)(activeGraph, initial, graph.order, config.maxCommunityFraction, config.minSplitSize, config.seed, config.resolution);
    groups.push(...hubs.map((hub) => [hub]));
    groups.sort((left, right) => (0, order_1.compareText)(left[0], right[0]));
    return { groups, hubs };
}
function skipped(graphHash, configHash, nodeCount, maxNodes) {
    return {
        status: 'skipped',
        graphFingerprint: graphHash,
        configFingerprint: configHash,
        nodeCommunities: {},
        communities: {},
        excludedHubs: [],
        warnings: [`Community detection skipped: ${nodeCount} nodes exceed maxNodes ${maxNodes}.`],
    };
}
function detectCommunities(nodes, edges, options = {}) {
    const config = resolveOptions(options);
    const configHash = (0, community_fingerprint_1.communityConfigFingerprint)(config);
    if (nodes.length > config.maxNodes) {
        return skipped((0, community_fingerprint_1.skippedGraphFingerprint)(nodes.length, edges.length), configHash, nodes.length, config.maxNodes);
    }
    const graphHash = (0, community_fingerprint_1.graphFingerprint)(nodes, edges);
    const graph = (0, community_graph_1.loadCommunityGraph)(nodes, edges);
    const { groups, hubs } = detectGroups(graph, config);
    const summaries = (0, community_summary_1.summarizeCommunities)(graph, groups);
    return {
        status: 'ok',
        graphFingerprint: graphHash,
        configFingerprint: configHash,
        ...summaries,
        excludedHubs: hubs,
        warnings: [],
    };
}
//# sourceMappingURL=community-detection.js.map