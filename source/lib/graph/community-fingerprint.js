"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphFingerprint = graphFingerprint;
exports.skippedGraphFingerprint = skippedGraphFingerprint;
exports.communityConfigFingerprint = communityConfigFingerprint;
const node_crypto_1 = require("node:crypto");
const order_1 = require("./order");
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => (0, order_1.compareText)(left, right))
            .map(([key, child]) => [key, canonicalize(child)]));
    }
    return value;
}
function digest(value) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}
function canonicalText(value) {
    return JSON.stringify(canonicalize(value));
}
function nodeFact(node) {
    const { id, kind, name, qualifiedName, filePath, language, domainKind, metadata } = node;
    return { id, kind, name, qualifiedName, filePath, language, domainKind, metadata };
}
function edgeFact(edge) {
    const { source, target, kind, provenance, metadata } = edge;
    return { source, target, kind, provenance, metadata };
}
function sortFacts(values) {
    return values
        .map((value) => ({ value, key: canonicalText(value) }))
        .sort((left, right) => (0, order_1.compareText)(left.key, right.key))
        .map(({ value }) => value);
}
function graphFingerprint(nodes, edges) {
    return digest({
        nodes: sortFacts(nodes.map(nodeFact)),
        edges: sortFacts(edges.map(edgeFact)),
    });
}
function skippedGraphFingerprint(nodeCount, edgeCount) {
    return digest({ skipped: true, nodeCount, edgeCount });
}
function communityConfigFingerprint(options) {
    return digest(options);
}
//# sourceMappingURL=community-fingerprint.js.map