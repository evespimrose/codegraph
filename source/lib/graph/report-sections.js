"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportBlocks = reportBlocks;
const report_format_1 = require("./report-format");
const order_1 = require("./order");
const MAX_TABLE_ITEMS = 15;
const MAX_LIST_ITEMS = 10;
const MAX_CHARTS = 4;
const MAX_CHART_NODES = 10;
function corpus(data) {
    return [
        '## Corpus Check',
        '',
        `- Graph fingerprint: \`${data.graphFingerprint}\``,
        `- Nodes: ${data.nodeCount}`,
        `- Edges: ${data.edgeCount}`,
    ];
}
function summary(data) {
    const total = Math.max(1, Object.values(data.provenance).reduce((sum, count) => sum + count, 0));
    return [
        '## Summary',
        '',
        `- Communities: ${Object.keys(data.communities).length}`,
        `- Isolated nodes: ${data.isolatedNodeIds.length}`,
        '',
        ...(0, report_format_1.table)(['Provenance', 'Count', 'Share'], Object.entries(data.provenance).map(([name, count]) => [
            name,
            String(count),
            `${((count / total) * 100).toFixed(1)}%`,
        ])),
    ];
}
function gods(data) {
    return [
        '## God Nodes',
        '',
        ...(0, report_format_1.table)(['Node', 'Kind', 'Degree'], data.godNodes.slice(0, MAX_TABLE_ITEMS).map((node) => [node.label, node.kind, String(node.degree)])),
    ];
}
function connections(data) {
    const rows = data.surprisingConnections.slice(0, MAX_LIST_ITEMS).map((connection) => [
        `${connection.sourceLabel} to ${connection.targetLabel}`,
        connection.edgeKind,
        connection.score.toFixed(3),
        connection.factors.confidence.toFixed(2),
        connection.factors.crossCommunity.toFixed(2),
        connection.factors.semantic.toFixed(2),
        connection.factors.peripheralToHub.toFixed(2),
    ]);
    return [
        '## Surprising Connections',
        '',
        ...(0, report_format_1.table)(['Connection', 'Kind', 'Score', 'Confidence', 'Cross', 'Semantic', 'Peripheral to hub'], rows),
    ];
}
function cycles(data) {
    const rows = data.importCycles
        .slice(0, MAX_LIST_ITEMS)
        .map((cycle) => `- ${cycle.map(report_format_1.markdown).join(' to ')} to ${(0, report_format_1.markdown)(cycle[0])}`);
    return ['## Import Cycles', '', ...(rows.length > 0 ? rows : ['_None._'])];
}
function communityRows(data) {
    const ordered = Object.values(data.communities).sort((left, right) => right.size - left.size || (0, order_1.compareText)(left.id, right.id));
    const rows = ordered.slice(0, MAX_TABLE_ITEMS).map((community) => [
        community.id,
        community.label,
        String(community.size),
        community.cohesion.toFixed(3),
    ]);
    if (ordered.length > MAX_TABLE_ITEMS) {
        rows.push([`+${ordered.length - MAX_TABLE_ITEMS} more communities omitted`, '', '', '']);
    }
    return rows;
}
function charts(data, options) {
    const count = Math.min(MAX_CHARTS, Math.max(0, options.maxCommunityCharts ?? MAX_CHARTS));
    const nodeCount = Math.min(MAX_CHART_NODES, Math.max(1, options.maxChartNodes ?? MAX_CHART_NODES));
    return Object.values(data.communities)
        .sort((left, right) => right.size - left.size || (0, order_1.compareText)(left.id, right.id))
        .slice(0, count)
        .map((community) => [
        `### ${(0, report_format_1.markdown)(community.label)} (${(0, report_format_1.markdown)(community.id)})`,
        '',
        `Members: ${community.members.slice(0, nodeCount).map(report_format_1.markdown).join(', ') || '_none_'}`,
        '',
        ...(0, report_format_1.communityChart)(data, community, nodeCount),
    ]);
}
function gaps(data) {
    const isolated = data.isolatedNodeIds.length
        ? [`- Isolated nodes: ${data.isolatedNodeIds.slice(0, MAX_LIST_ITEMS).map(report_format_1.markdown).join(', ')}`]
        : ['- No isolated nodes detected.'];
    return [
        '## Knowledge Gaps',
        '',
        ...isolated,
        ...data.warnings.slice(0, MAX_LIST_ITEMS).map((warning) => `- ${(0, report_format_1.markdown)(warning)}`),
    ];
}
function questions(data) {
    const rows = data.suggestedQuestions
        .slice(0, MAX_LIST_ITEMS)
        .map((item) => `- **${(0, report_format_1.markdown)(item.strategy)}:** ${(0, report_format_1.markdown)(item.question)}`);
    return ['## Suggested Questions', '', ...(rows.length > 0 ? rows : ['_None._'])];
}
function reportBlocks(data, options) {
    return [
        ['# CodeGraph Graph Report'],
        corpus(data),
        summary(data),
        gods(data),
        connections(data),
        cycles(data),
        ['## Communities', '', ...(0, report_format_1.table)(['ID', 'Label', 'Size', 'Cohesion'], communityRows(data))],
        ...charts(data, options),
        gaps(data),
        questions(data),
    ];
}
//# sourceMappingURL=report-sections.js.map