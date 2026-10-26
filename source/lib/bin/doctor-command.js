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
exports.addDoctor = addDoctor;
function addDoctor(program, cli) {
    program
        .command('doctor [path]')
        .description('Diagnose runtime, offline model, database, and derived-cache health')
        .option('-j, --json', 'Output as JSON')
        .action(async (pathArg, options) => {
        const projectPath = cli.resolvePath(pathArg);
        try {
            if (!cli.ready(projectPath))
                throw new Error(`CodeGraph not initialized in ${projectPath}`);
            const { default: CodeGraph } = await cli.loadGraph();
            const { buildDoctorReport } = await Promise.resolve().then(() => __importStar(require('../doctor')));
            const graph = CodeGraph.openSync(projectPath);
            try {
                const report = await buildDoctorReport(graph.getDb(), projectPath, cli.version);
                if (options.json) {
                    console.log(JSON.stringify(report, null, 2));
                }
                else {
                    console.log(cli.chalk.bold(`CodeGraph doctor: ${report.ok ? 'OK' : 'FAILED'}`));
                    console.log(`Runtime: Transformers.js=${report.runtime.transformers ? 'ready' : 'missing'}, sqlite-vec=${report.runtime.sqliteVec ? 'ready' : 'missing'}`);
                    console.log(`Model: ${report.model.mode}, ${report.model.offlineReady ? 'offline-ready' : 'not offline-ready'}`);
                    console.log(`Database: schema ${report.database.schema}/${report.database.expectedSchema}, semantic edges ${cli.format(report.database.semanticEdges)}`);
                    console.log(`Communities: ${report.communities.state}`);
                    for (const warning of report.warnings)
                        console.log(cli.chalk.yellow(`Warning: ${warning}`));
                }
                if (!report.ok)
                    process.exitCode = 1;
            }
            finally {
                graph.close();
            }
        }
        catch (caught) {
            cli.error(`Doctor failed: ${caught instanceof Error ? caught.message : String(caught)}`);
            process.exitCode = 1;
        }
    });
}
//# sourceMappingURL=doctor-command.js.map