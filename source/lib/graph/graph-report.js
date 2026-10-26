"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraphReportData = buildGraphReportData;
const provenance_1 = require("../provenance");
const report_cycles_1 = require("./report-cycles");
const report_god_nodes_1 = require("./report-god-nodes");
const report_questions_1 = require("./report-questions");
const report_surprising_1 = require("./report-surprising");
function findings(nodes, edges, detection, options) {
    const gods = (0, report_god_nodes_1.godNodes)(nodes, edges, options.topGodNodes ?? 10);
    const cycleAnalysis = (0, report_cycles_1.analyzeImportCycles)(nodes, edges, options.maxCycleLength ?? 5, options.topCycles ?? 20);
    return {
        values: {
            godNodes: gods,
            surprisingConnections: (0, report_surprising_1.surprisingConnections)(nodes, edges, detection.nodeCommunities, options.topConnections ?? 5),
            importCycles: cycleAnalysis.cycles,
            suggestedQuestions: (0, report_questions_1.suggestQuestions)(nodes, edges, detection.nodeCommunities, detection.communities, gods, options.topQuestions ?? 7),
        },
        warnings: cycleAnalysis.truncated
            ? ['Import-cycle search reached its deterministic operation budget; results may be partial.']
            : [],
    };
}
function buildGraphReportData(nodes, edges, detection, options = {}) {
    const degrees = (0, report_god_nodes_1.nodeDegrees)(nodes, edges);
    const reportFindings = findings(nodes, edges, detection, options);
    return {
        nodes,
        edges,
        graphFingerprint: detection.graphFingerprint,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        provenance: (0, provenance_1.summarizeProvenance)(edges),
        ...reportFindings.values,
        communities: detection.communities,
        nodeCommunities: detection.nodeCommunities,
        isolatedNodeIds: nodes
            .filter((node) => (degrees.get(node.id) ?? 0) === 0)
            .map((node) => node.id)
            .sort(),
        warnings: [...detection.warnings, ...reportFindings.warnings],
    };
}
//# sourceMappingURL=graph-report.js.map