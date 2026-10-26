"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReport = addReport;
const path = __importStar(require("path"));
const directory_1 = require("../directory");
const analysis_cli_1 = require("./analysis-cli");
function addReport(program, cli) {
    program
        .command('report [path]')
        .description('Generate a bounded Markdown report from the current graph')
        .option('-o, --out <file>', 'Output path (default: docs/output/YYYY-MM-DD-graph-report.md)')
        .option('--max-nodes <number>', 'Refuse whole-graph loading above this node count', '20000')
        .option('--max-edges <number>', 'Refuse whole-graph loading above this edge count', '1000000')
        .option('--max-lines <number>', 'Maximum Markdown report lines', '399')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-j, --json', 'Output result metadata as JSON')
        .action(async (pathArg, options) => {
        const projectPath = cli.resolvePath(pathArg);
        try {
            if (!cli.ready(projectPath))
                throw new Error(`CodeGraph not initialized in ${projectPath}`);
            const { default: CodeGraph } = await cli.loadGraph();
            const report = await Promise.resolve().then(() => __importStar(require('../graph')));
            const graph = await CodeGraph.open(projectPath);
            try {
                if (options.sync !== false)
                    (0, analysis_cli_1.requireFresh)(await graph.sync());
                const maxNodes = (0, analysis_cli_1.readPositive)(options.maxNodes, '--max-nodes');
                const maxEdges = (0, analysis_cli_1.readPositive)(options.maxEdges, '--max-edges');
                const snapshot = graph.getGraphSnapshot(maxNodes, maxEdges);
                const warning = (0, analysis_cli_1.limitReason)(snapshot, maxNodes, maxEdges);
                if (warning) {
                    if (options.json) {
                        console.log(JSON.stringify({
                            schemaVersion: 1,
                            projectPath,
                            status: 'skipped',
                            warnings: [warning],
                        }, null, 2));
                    }
                    else {
                        console.log(cli.chalk.yellow(warning));
                    }
                    process.exitCode = 1;
                    return;
                }
                const detection = report.detectCommunities(snapshot.nodes, snapshot.edges, { maxNodes });
                const cachePath = path.join((0, directory_1.getCodeGraphDir)(projectPath), 'communities.json');
                report.writeCommunitiesCache(cachePath, detection);
                const maxLines = (0, analysis_cli_1.readNumber)(options.maxLines, '--max-lines');
                const data = report.buildGraphReportData(snapshot.nodes, snapshot.edges, detection, { maxLines });
                const markdown = report.renderGraphReport(data, { maxLines });
                const defaultOutput = path.join('docs', 'output', `${(0, analysis_cli_1.dateStamp)()}-graph-report.md`);
                const outputPath = path.resolve(projectPath, options.out ?? defaultOutput);
                (0, analysis_cli_1.writeAtomic)(outputPath, markdown);
                const output = {
                    schemaVersion: 1,
                    projectPath,
                    outputPath,
                    cachePath,
                    graphFingerprint: data.graphFingerprint,
                    nodes: data.nodeCount,
                    edges: data.edgeCount,
                    communities: Object.keys(data.communities).length,
                    lines: markdown.split('\n').length - 1,
                    warnings: data.warnings,
                };
                if (options.json)
                    console.log(JSON.stringify(output, null, 2));
                else {
                    console.log(cli.chalk.bold('Graph report generated'));
                    console.log(outputPath);
                    for (const item of output.warnings)
                        console.log(cli.chalk.yellow(`Warning: ${item}`));
                }
            }
            finally {
                graph.close();
            }
        }
        catch (caught) {
            (0, analysis_cli_1.failAnalysis)(cli, 'Graph report failed', caught, { json: options.json, projectPath });
        }
    });
}
//# sourceMappingURL=report-command.js.map