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
exports.addCommunity = addCommunity;
const path = __importStar(require("path"));
const directory_1 = require("../directory");
const analysis_cli_1 = require("./analysis-cli");
function addCommunity(program, cli) {
    program
        .command('communities [path]')
        .description('Detect deterministic Louvain communities and publish the derived cache')
        .option('--max-nodes <number>', 'Refuse whole-graph loading above this node count', '20000')
        .option('--max-edges <number>', 'Refuse whole-graph loading above this edge count', '1000000')
        .option('--max-community-fraction <number>', 'Recursively split communities larger than this graph fraction', '0.25')
        .option('--exclude-hubs-percentile <number>', 'Temporarily exclude nodes above this degree percentile')
        .option('--resolution <number>', 'Louvain resolution', '1')
        .option('--seed <value>', 'Deterministic Louvain seed', '0')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-j, --json', 'Output as JSON')
        .action(async (pathArg, options) => {
        const projectPath = cli.resolvePath(pathArg);
        try {
            if (!cli.ready(projectPath))
                throw new Error(`CodeGraph not initialized in ${projectPath}`);
            const { default: CodeGraph } = await cli.loadGraph();
            const community = await Promise.resolve().then(() => __importStar(require('../graph')));
            const graph = await CodeGraph.open(projectPath);
            try {
                if (options.sync !== false)
                    (0, analysis_cli_1.requireFresh)(await graph.sync());
                const maxNodes = (0, analysis_cli_1.readPositive)(options.maxNodes, '--max-nodes');
                const maxEdges = (0, analysis_cli_1.readPositive)(options.maxEdges, '--max-edges');
                const snapshot = graph.getGraphSnapshot(maxNodes, maxEdges);
                const warning = (0, analysis_cli_1.limitReason)(snapshot, maxNodes, maxEdges);
                const cachePath = path.join((0, directory_1.getCodeGraphDir)(projectPath), 'communities.json');
                if (warning) {
                    const output = {
                        schemaVersion: 1,
                        projectPath,
                        cachePath,
                        status: 'skipped',
                        communityCount: 0,
                        assignedNodes: 0,
                        excludedHubs: 0,
                        warnings: [warning],
                    };
                    if (options.json)
                        console.log(JSON.stringify(output, null, 2));
                    else
                        console.log(cli.chalk.yellow(warning));
                    process.exitCode = 1;
                    return;
                }
                const result = community.detectCommunities(snapshot.nodes, snapshot.edges, {
                    maxNodes,
                    maxCommunityFraction: (0, analysis_cli_1.readNumber)(options.maxCommunityFraction, '--max-community-fraction'),
                    excludeHubPercentile: (0, analysis_cli_1.readNumber)(options.excludeHubsPercentile, '--exclude-hubs-percentile'),
                    resolution: (0, analysis_cli_1.readNumber)(options.resolution, '--resolution'),
                    seed: options.seed,
                });
                community.writeCommunitiesCache(cachePath, result);
                const output = {
                    schemaVersion: 1,
                    projectPath,
                    cachePath,
                    status: result.status,
                    graphFingerprint: result.graphFingerprint,
                    communityCount: Object.keys(result.communities).length,
                    assignedNodes: Object.keys(result.nodeCommunities).length,
                    excludedHubs: result.excludedHubs.length,
                    warnings: result.warnings,
                };
                if (options.json)
                    console.log(JSON.stringify(output, null, 2));
                else {
                    console.log(cli.chalk.bold('Graph communities'));
                    console.log(`${cli.format(output.communityCount)} communities, ${cli.format(output.assignedNodes)} assigned nodes`);
                    console.log(cli.chalk.dim(cachePath));
                    for (const item of output.warnings)
                        console.log(cli.chalk.yellow(`Warning: ${item}`));
                }
                if (result.status === 'skipped')
                    process.exitCode = 1;
            }
            finally {
                graph.close();
            }
        }
        catch (caught) {
            (0, analysis_cli_1.failAnalysis)(cli, 'Community detection failed', caught, { json: options.json, projectPath });
        }
    });
}
//# sourceMappingURL=community-command.js.map