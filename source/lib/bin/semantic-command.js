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
exports.addSemantic = addSemantic;
const analysis_cli_1 = require("./analysis-cli");
function addSemantic(program, cli) {
    program
        .command('semantic-edges [path]')
        .description('Materialize bounded document-similarity edges using the local embedding index')
        .option('--top-k <number>', 'Maximum semantic degree per document', '5')
        .option('--threshold <number>', 'Minimum cosine similarity in the range 0..1', '0.75')
        .option('--persist', 'Enable automatic semantic-edge refresh after future index/sync runs')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-j, --json', 'Output as JSON')
        .action(async (pathArg, options) => {
        const projectPath = cli.resolvePath(pathArg);
        try {
            if (!cli.ready(projectPath))
                throw new Error(`CodeGraph not initialized in ${projectPath}`);
            const { default: CodeGraph } = await cli.loadGraph();
            const { buildSemanticEdges, setSemanticEdgeConfig } = await Promise.resolve().then(() => __importStar(require('../docs/semantic-edges')));
            const graph = await CodeGraph.open(projectPath);
            try {
                if (options.sync !== false)
                    (0, analysis_cli_1.requireFresh)(await graph.sync());
                const topK = (0, analysis_cli_1.readPositive)(options.topK, '--top-k');
                if (topK > 50)
                    throw new Error('--top-k must be at most 50.');
                const minSimilarity = (0, analysis_cli_1.readNumber)(options.threshold, '--threshold');
                if (minSimilarity < 0 || minSimilarity > 1) {
                    throw new Error('--threshold must be between 0 and 1.');
                }
                if (options.persist) {
                    setSemanticEdgeConfig(graph.getDb(), { enabled: true, topK, minSimilarity });
                }
                const result = buildSemanticEdges(graph.getDb(), { enabled: true, topK, minSimilarity });
                const output = { schemaVersion: 1, projectPath, persisted: Boolean(options.persist), ...result };
                if (options.json)
                    console.log(JSON.stringify(output, null, 2));
                else {
                    console.log(cli.chalk.bold('Semantic edges'));
                    console.log(`Edges: ${cli.format(result.edgeCount)} (${result.unchanged ? 'unchanged' : `${cli.format(result.created)} written`})`);
                    if (result.reason)
                        console.log(cli.chalk.yellow(`Status: ${result.reason}`));
                }
                if (!result.available)
                    process.exitCode = 1;
            }
            finally {
                graph.close();
            }
        }
        catch (caught) {
            (0, analysis_cli_1.failAnalysis)(cli, 'Semantic edge generation failed', caught, { json: options.json, projectPath });
        }
    });
}
//# sourceMappingURL=semantic-command.js.map