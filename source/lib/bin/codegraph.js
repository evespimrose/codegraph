#!/usr/bin/env node
"use strict";
/**
 * CodeGraph CLI
 *
 * Command-line interface for CodeGraph code intelligence.
 *
 * Usage:
 *   codegraph                    Show command help
 *   codegraph init [path]        Initialize CodeGraph in a project
 *   codegraph uninit [path]      Remove CodeGraph from a project
 *   codegraph index [path]       Index all files in the project
 *   codegraph sync [path]        Sync changes since last index
 *   codegraph status [path]      Show index status
 *   codegraph query <search>     Search for symbols
 *   codegraph files [options]    Show project file structure
 *   codegraph adapter list       Show registered source adapters
 *   codegraph adapter inspect    Inspect adapter output for one file
 *   codegraph doctor [path]      Diagnose runtime, model, database, and cache health
 *   codegraph semantic-edges     Materialize bounded local-vector similarity edges
 *   codegraph communities        Detect and cache deterministic graph communities
 *   codegraph report [path]      Generate a bounded Markdown graph report
 *   codegraph context <task>     Build context for a task
 *   codegraph callers <symbol>   Find what calls a function/method
 *   codegraph callees <symbol>   Find what a function/method calls
 *   codegraph impact <symbol>    Analyze what code is affected by changing a symbol
 *   codegraph affected [files]   Find test files affected by changes
 */
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
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const directory_1 = require("../directory");
const config_1 = require("../docs/config");
const worktree_1 = require("../sync/worktree");
const shimmer_progress_1 = require("../ui/shimmer-progress");
const glyphs_1 = require("../ui/glyphs");
const utils_1 = require("../utils");
const node_version_check_1 = require("./node-version-check");
const community_command_1 = require("./community-command");
const doctor_command_1 = require("./doctor-command");
const report_command_1 = require("./report-command");
const semantic_command_1 = require("./semantic-command");
const wasm_runtime_flags_1 = require("../extraction/wasm-runtime-flags");
const types_1 = require("../types");
const jsonOutput = process.argv.includes('--json') || process.argv.includes('-j')
    || process.argv.some((argument, index) => ['--format', '-f'].includes(argument) && process.argv[index + 1] === 'json');
// Lazy-load CodeGraph so basic CLI startup does not initialize native modules.
async function loadCodeGraph() {
    try {
        return await Promise.resolve().then(() => __importStar(require('../index')));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\x1b[31m${(0, glyphs_1.getGlyphs)().err}\x1b[0m Failed to load CodeGraph modules.`);
        console.error(`\n  Node: ${process.version}  Platform: ${process.platform} ${process.arch}`);
        console.error(`\n  Error: ${msg}`);
        console.error('\n  Reinstall the team CodeGraph bundle, then run `codegraph doctor --json`.\n');
        process.exit(1);
    }
}
// Dynamic import helper — tsc compiles import() to require() in CJS mode,
// which fails for ESM-only packages. This bypasses the transformation.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importESM = new Function('specifier', 'return import(specifier)');
// Block CodeGraph on Node.js 25.x — V8's turboshaft WASM JIT has a Zone
// allocator bug that reliably crashes when compiling tree-sitter
// grammars (see #54, #81, #140). The previous behaviour was a soft
// console.warn that scrolls off-screen before the OOM crash 30 seconds
// later, leading to a steady stream of "what is this OOM" reports.
// Hard-exit before any WASM work; allow override via env var for users
// who patched V8 themselves or want to test a future fix.
const nodeVersion = process.versions.node;
const nodeMajor = parseInt(nodeVersion.split('.')[0] ?? '0', 10);
if (nodeMajor >= 25) {
    process.stderr.write((0, node_version_check_1.buildNode25BlockBanner)(nodeVersion) + '\n');
    if (!process.env.CODEGRAPH_ALLOW_UNSAFE_NODE) {
        process.exit(1);
    }
    // Override active — banner shown for visibility, continuing.
}
// Enforce the supported Node floor. `engines` in package.json only *warns* on
// install (unless engine-strict), so hard-block here to actually keep users off
// unsupported versions. Mirrors the 25+ block above. See package.json `engines`.
if (nodeMajor < node_version_check_1.MIN_NODE_MAJOR) {
    process.stderr.write((0, node_version_check_1.buildNodeTooOldBanner)(nodeVersion) + '\n');
    if (!process.env.CODEGRAPH_ALLOW_UNSAFE_NODE) {
        process.exit(1);
    }
    // Override active — banner shown for visibility, continuing.
}
// Re-exec with V8's `--liftoff-only` if it isn't already set, so tree-sitter's
// large WASM grammars never hit the turboshaft Zone OOM (`Fatal process out of
// memory: Zone`) on Node >= 22. No-op under the bundled launcher, which already
// passes the flag. Must run before any grammar (in the parse worker, which
// inherits this process's flags) is compiled. See ../extraction/wasm-runtime-flags.
(0, wasm_runtime_flags_1.relaunchWithWasmRuntimeFlagsIfNeeded)(__filename);
main().catch(caught => {
    const message = caught instanceof Error ? caught.message : String(caught);
    if (jsonOutput) {
        console.log(JSON.stringify({ schemaVersion: 1, error: message }));
    } else console.error(message);
    process.exitCode = 1;
});
process.on('uncaughtException', (error) => {
    console.error('[CodeGraph] Uncaught exception:', error);
    process.exitCode = 1;
});
process.on('unhandledRejection', (reason) => {
    console.error('[CodeGraph] Unhandled rejection:', reason);
    process.exitCode = 1;
});
async function main() {
    const program = new commander_1.Command();
    // Version from package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    // =============================================================================
    // ANSI Color Helpers (avoid chalk ESM issues)
    // =============================================================================
    const colors = {
        reset: '\x1b[0m',
        bold: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        gray: '\x1b[90m',
    };
    const chalk = {
        bold: (s) => `${colors.bold}${s}${colors.reset}`,
        dim: (s) => `${colors.dim}${s}${colors.reset}`,
        red: (s) => `${colors.red}${s}${colors.reset}`,
        green: (s) => `${colors.green}${s}${colors.reset}`,
        yellow: (s) => `${colors.yellow}${s}${colors.reset}`,
        blue: (s) => `${colors.blue}${s}${colors.reset}`,
        cyan: (s) => `${colors.cyan}${s}${colors.reset}`,
        white: (s) => `${colors.white}${s}${colors.reset}`,
        gray: (s) => `${colors.gray}${s}${colors.reset}`,
    };
    program
        .name('codegraph')
        .description('Code intelligence and knowledge graph for any codebase')
        .version(packageJson.version);
    // =============================================================================
    // Helper Functions
    // =============================================================================
    const { resolveProjectPath } = require('./project-path');
    const { syncForRead, resolveGitignore } = require('./freshness');
    function syncFreshness(sync) {
        const sourceChanges = sync.filesAdded + sync.filesModified + sync.filesRemoved;
        const changedPaths = sync.changedFilePaths
            ? new Set([...sync.changedFilePaths, ...(sync.docPaths ?? [])]).size
            : sourceChanges + (sync.docsUpdated ?? 0);
        return {
            state: sync.status === 'current' || sync.status === undefined ? 'current' : 'unknown',
            checkedAt: Date.now(),
            filesChecked: sync.inventory?.scanned ?? sync.filesChecked,
            filesChanged: changedPaths,
        };
    }
    function unknownFreshness() {
        return { state: 'unknown', checkedAt: Date.now() };
    }
    /**
     * Format a number with commas
     */
    function formatNumber(n) {
        return n.toLocaleString();
    }
    /**
     * Format duration in milliseconds to human readable
     */
    function formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        const seconds = ms / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }
    // Shimmer progress renderer (runs in a worker thread for smooth animation)
    // Imported at top of file from '../ui/shimmer-progress'
    /**
     * Create a plain-text progress callback for --verbose mode.
     * No animations, no ANSI tricks — just timestamped lines to stdout.
     */
    function createVerboseProgress() {
        let lastPhase = '';
        let lastPct = -1;
        const startTime = Date.now();
        return (progress) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            if (progress.phase !== lastPhase) {
                lastPhase = progress.phase;
                lastPct = -1;
                console.log(`[${elapsed}s] Phase: ${progress.phase}`);
            }
            if (progress.total > 0) {
                const pct = Math.floor((progress.current / progress.total) * 100);
                // Log every 5% to keep output manageable
                if (pct >= lastPct + 5 || progress.current === progress.total) {
                    lastPct = pct;
                    console.log(`[${elapsed}s]   ${progress.current}/${progress.total} (${pct}%)${progress.currentFile ? ` ${(0, glyphs_1.getGlyphs)().dash} ${progress.currentFile}` : ''}`);
                }
            }
            else if (progress.current > 0) {
                // Scanning phase (no total yet) — log periodically
                if (progress.current % 1000 === 0 || progress.current === 1) {
                    console.log(`[${elapsed}s]   ${formatNumber(progress.current)} files found`);
                }
            }
        };
    }
    /**
     * Print success message
     */
    function success(message) {
        console.log(chalk.green((0, glyphs_1.getGlyphs)().ok) + ' ' + message);
    }
    /**
     * Print error message
     */
    function error(message) {
        if (jsonOutput) {
            console.log(JSON.stringify({ schemaVersion: 1, error: message }));
        } else console.error(chalk.red((0, glyphs_1.getGlyphs)().err) + ' ' + message);
    }
    /**
     * Print info message
     */
    function info(message) {
        if (jsonOutput) return;
        console.log(chalk.blue((0, glyphs_1.getGlyphs)().info) + ' ' + message);
    }
    /**
     * Print warning message
     */
    function warn(message) {
        console.log(chalk.yellow((0, glyphs_1.getGlyphs)().warn) + ' ' + message);
    }
    function hasFileDiagnostics(result) {
        return result.errors.some(entry => entry.severity === 'error' && entry.filePath);
    }
    /**
     * Print indexing results using clack log methods
     */
    function printIndexResult(clack, result, projectPath) {
        const hasErrors = result.filesErrored > 0;
        const fileDiagnostics = hasFileDiagnostics(result);
        if (!result.success || hasErrors || fileDiagnostics || result.docs?.errors?.length) process.exitCode = 1;
        if ((!result.success || fileDiagnostics) && !hasErrors && result.filesIndexed > 0) {
            const failures = result.errors.filter(entry => entry.severity === 'error').map(entry => {
                const location = entry.filePath ? `${entry.filePath}${entry.line ? ':' + entry.line : ''}: ` : '';
                return location + entry.message;
            });
            clack.log.error(failures.length ? failures.join('\n') : 'Indexing completed with errors. Run codegraph doctor --json for details.');
            if (projectPath) writeErrorLog(projectPath, result.errors);
        }
        // Surface non-file-level failures (e.g. lock-acquisition failure
        // when another indexer is running) before the file-count branches.
        // Without this the CLI falls through to "No files found to index",
        // which is actively misleading — the index DID run, it just couldn't
        // get the lock.
        //
        // If success is false but no severity:'error' entry exists in
        // `result.errors` (degenerate case — shouldn't happen in practice
        // but worth guarding because the result shape is plumbed through
        // multiple call sites), fall back to a generic message rather than
        // continuing to the misleading "No files found" branch or throwing.
        if (!result.success && !hasErrors && result.filesIndexed === 0) {
            const generic = result.errors.find((e) => e.severity === 'error');
            clack.log.error(generic?.message ?? `Indexing failed ${(0, glyphs_1.getGlyphs)().dash} no further details available`);
            return;
        }
        if (result.filesIndexed > 0) {
            if (hasErrors) {
                clack.log.success(`Indexed ${formatNumber(result.filesIndexed)} files (${formatNumber(result.filesErrored)} could not be parsed)`);
            }
            else {
                clack.log.success(`Indexed ${formatNumber(result.filesIndexed)} files`);
            }
            clack.log.info(`${formatNumber(result.nodesCreated)} nodes, ${formatNumber(result.edgesCreated)} edges in ${formatDuration(result.durationMs)}`);
        }
        else if (hasErrors) {
            clack.log.error(`Indexing failed ${(0, glyphs_1.getGlyphs)().dash} all ${formatNumber(result.filesErrored)} files had errors`);
        }
        else {
            clack.log.warn('No files found to index');
        }
        // Markdown docs (opt-in): report the re-index summary when the feature ran.
        // The concept-node / governs-edge totals are appended so the markdown graph
        // reads distinctly from the code nodes/edges line above.
        if (result.docs?.enabled) {
            if (result.docs.available) {
                let line = `Markdown: ${formatNumber(result.docs.indexed)} indexed, ${formatNumber(result.docs.skipped)} unchanged of ${formatNumber(result.docs.scanned)} docs`;
                const concepts = result.docs.conceptNodes ?? 0;
                const governs = result.docs.governsEdges ?? 0;
                if (concepts > 0 || governs > 0) {
                    line += ` ${(0, glyphs_1.getGlyphs)().dash} ${formatNumber(concepts)} concept nodes, ${formatNumber(governs)} governs edges`;
                }
                clack.log.info(line);
                for (const error of result.docs.errors || []) clack.log.warn(`${error.filePath}: ${error.message}`);
            }
            else {
                clack.log.warn(`Document embeddings unavailable ${(0, glyphs_1.getGlyphs)().dash} run codegraph doctor for diagnostics`);
            }
        }
        if (hasErrors) {
            const errorsByCode = new Map();
            for (const err of result.errors) {
                if (err.severity === 'error') {
                    const code = err.code || 'unknown';
                    errorsByCode.set(code, (errorsByCode.get(code) || 0) + 1);
                }
            }
            const codeLabels = {
                parse_error: 'files failed to parse',
                read_error: 'files could not be read',
                size_exceeded: 'files exceeded size limit',
                path_traversal: 'blocked paths',
                unsupported_language: 'unsupported language',
                parser_error: 'parser initialization failures',
            };
            const breakdown = Array.from(errorsByCode)
                .map(([code, count]) => `${formatNumber(count)} ${codeLabels[code] || code}`)
                .join('\n');
            clack.note(breakdown, 'Error breakdown');
            if (projectPath) {
                writeErrorLog(projectPath, result.errors);
                clack.log.info('See .codegraph/errors.log for details');
            }
            if (result.filesIndexed > 0) {
                clack.log.info(`The index is fully usable ${(0, glyphs_1.getGlyphs)().dash} only the failed files are missing.`);
            }
        }
        else if (projectPath && result.success && !fileDiagnostics) {
            const logPath = path.join(projectPath, '.codegraph', 'errors.log');
            if (fs.existsSync(logPath)) {
                fs.unlinkSync(logPath);
            }
        }
    }
    /**
     * Write detailed error log to .codegraph/errors.log
     */
    function writeErrorLog(projectPath, errors) {
        const cgDir = path.join(projectPath, '.codegraph');
        if (!fs.existsSync(cgDir))
            return;
        const logPath = path.join(cgDir, 'errors.log');
        // Group errors by file path
        const errorsByFile = new Map();
        const noFileErrors = [];
        for (const err of errors) {
            if (err.severity !== 'error')
                continue;
            if (err.filePath) {
                let list = errorsByFile.get(err.filePath);
                if (!list) {
                    list = [];
                    errorsByFile.set(err.filePath, list);
                }
                list.push({ message: err.message, code: err.code });
            }
            else {
                noFileErrors.push({ message: err.message, code: err.code });
            }
        }
        const lines = [
            `CodeGraph Error Log - ${new Date().toISOString()}`,
            `${errorsByFile.size} files with errors`,
            '',
        ];
        for (const [filePath, fileErrors] of errorsByFile) {
            for (const err of fileErrors) {
                lines.push(`${filePath}: ${err.message}`);
            }
        }
        for (const err of noFileErrors) {
            lines.push(err.message);
        }
        fs.writeFileSync(logPath, lines.join('\n') + '\n');
    }
    // =============================================================================
    // Commands
    // =============================================================================
    /**
     * codegraph init [path]
     */
    program
        .command('init [path]')
        .description('Initialize CodeGraph in a project directory and build the initial index')
        .option('-i, --index', 'Deprecated: indexing now runs by default; flag accepted for backward compatibility')
        .option('-v, --verbose', 'Show detailed worker lifecycle and memory info')
        .option('--with-docs', 'Also index repository documents into the local vector store; persists the choice for this project')
        .option('--gitignore', 'Respect the project root .gitignore, overriding the saved watcher setting')
        .option('--no-gitignore', 'Include files ignored by the project root .gitignore')
        .action(async (pathArg, options) => {
        const projectPath = resolveProjectPath(pathArg || process.cwd());
        const respectGitignore = await resolveGitignore(projectPath, options.gitignore);
        // init always builds a full index into a fresh DB — exactly like
        // `index --force`, so it implies --with-docs: build the docs/concept layer
        // now rather than leave it empty until a later --with-docs run. Graceful
        // no-op when the embedding runtime is unavailable (warn only). An explicit
        // CODEGRAPH_DOCS=0 still wins, since resolveDocsEnabled honors the env.
        if (options.withDocs || process.env.CODEGRAPH_DOCS === undefined) {
            process.env.CODEGRAPH_DOCS = '1';
        }
        const clack = await importESM('@clack/prompts');
        clack.intro('Initializing CodeGraph');
        try {
            if ((0, directory_1.isInitialized)(projectPath)) {
                clack.log.warn(`Already initialized in ${projectPath}`);
                clack.log.info('Use "codegraph index" to re-index or "codegraph sync" to update');
                clack.outro('');
                return;
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.init(projectPath, { index: false });
            clack.log.success(`Initialized in ${projectPath}`);
            // Indexing runs by default now. The legacy -i/--index flag is still
            // accepted (so existing muscle memory and scripts don't break) but is a
            // no-op — initializing always builds the initial index.
            let result;
            if (options.verbose) {
                result = await cg.indexAll({
                    onProgress: createVerboseProgress(),
                    verbose: true,
                    respectGitignore,
                });
            }
            else {
                process.stdout.write(`${colors.dim}${(0, glyphs_1.getGlyphs)().rail}${colors.reset}\n`);
                const progress = (0, shimmer_progress_1.createShimmerProgress)();
                result = await cg.indexAll({
                    onProgress: progress.onProgress,
                    respectGitignore,
                });
                await progress.stop();
            }
            printIndexResult(clack, result, projectPath);
            clack.outro('Done');
            cg.destroy();
        }
        catch (err) {
            clack.log.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph uninit [path]
     */
    program
        .command('uninit [path]')
        .description('Remove CodeGraph from a project (deletes .codegraph/ directory)')
        .option('-f, --force', 'Skip confirmation prompt')
        .action(async (pathArg, options) => {
        const projectPath = resolveProjectPath(pathArg);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                warn(`CodeGraph is not initialized in ${projectPath}`);
                return;
            }
            if (!options.force) {
                // Confirm with user
                const readline = await Promise.resolve().then(() => __importStar(require('readline')));
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const answer = await new Promise((resolve) => {
                    rl.question(chalk.yellow(`${(0, glyphs_1.getGlyphs)().warn} This will permanently delete all CodeGraph data. Continue? (y/N) `), resolve);
                });
                rl.close();
                if (answer.toLowerCase() !== 'y') {
                    info('Cancelled');
                    return;
                }
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const stopped = await require('../watch/manager').stopWatcher(projectPath);
            if (stopped.active || stopped.stopPending || stopped.phase === 'unresponsive') {
                throw new Error('Automatic watcher has not stopped; retry after current indexing finishes');
            }
            const cg = CodeGraph.openSync(projectPath);
            cg.uninitialize();
            // Clean up any git sync hooks we installed (no-op if none / not a repo).
            try {
                const { removeGitSyncHook } = await Promise.resolve().then(() => __importStar(require('../sync/git-hooks')));
                const removed = removeGitSyncHook(projectPath);
                if (removed.installed.length > 0) {
                    info(`Removed git ${removed.installed.join(', ')} sync hook${removed.installed.length > 1 ? 's' : ''}`);
                }
            }
            catch { /* non-fatal */ }
            success(`Removed CodeGraph from ${projectPath}`);
        }
        catch (err) {
            error(`Failed to uninitialize: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph index [path]
     */
    program
        .command('index [path]')
        .description('Index all files in the project')
        .option('-f, --force', 'Force full re-index even if already indexed')
        .option('-q, --quiet', 'Suppress progress output')
        .option('-v, --verbose', 'Show detailed worker lifecycle and memory info')
        .option('--with-docs', 'Also index repository documents into the local vector store; persists the choice for this project')
        .option('--gitignore', 'Respect the project root .gitignore, overriding the saved watcher setting')
        .option('--no-gitignore', 'Ignore the project root .gitignore when scanning (built-in defaults and .codegraphignore still apply)')
        .action(async (pathArg, options) => {
        const projectPath = resolveProjectPath(pathArg);
        const respectGitignore = await resolveGitignore(projectPath, options.gitignore);
        // --with-docs opts this process into Markdown indexing; indexAll then
        // persists the flag to project_metadata so later CLI runs pick it up.
        // --force implies --with-docs: a force re-index wipes the whole graph
        // (concept nodes included), so it must also rebuild the docs/concept layer
        // rather than leave it permanently empty until a doc's content changes.
        // When the docs deps are absent this is a graceful no-op (warn only).
        if (options.withDocs || options.force)
            process.env.CODEGRAPH_DOCS = '1';
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                info('Run "codegraph init" first');
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            if (options.quiet) {
                // Quiet mode: no UI, just run
                const result = await cg.indexAll({ respectGitignore, force: options.force });
                if (!result.success || hasFileDiagnostics(result)) process.exitCode = 1;
                cg.destroy();
                return;
            }
            const clack = await importESM('@clack/prompts');
            clack.intro('Indexing project');
            let result;
            if (options.verbose) {
                result = await cg.indexAll({
                    onProgress: createVerboseProgress(),
                    verbose: true,
                    respectGitignore,
                    force: options.force,
                });
            }
            else {
                process.stdout.write(`${colors.dim}${(0, glyphs_1.getGlyphs)().rail}${colors.reset}\n`);
                const progress = (0, shimmer_progress_1.createShimmerProgress)();
                result = await cg.indexAll({
                    onProgress: progress.onProgress,
                    respectGitignore,
                    force: options.force,
                });
                await progress.stop();
            }
            printIndexResult(clack, result, projectPath);
            if (!result.success) process.exitCode = 1;
            clack.outro('Done');
            cg.destroy();
        }
        catch (err) {
            error(`Failed to index: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph sync [path]
     */
    program
        .command('sync [path]')
        .description('Sync changes since last index')
        .option('-q, --quiet', 'Suppress output (for git hooks)')
        .option('--gitignore', 'Respect the project root .gitignore, overriding the saved watcher setting')
        .option('--no-gitignore', 'Ignore the project root .gitignore when scanning (built-in defaults and .codegraphignore still apply)')
        .action(async (pathArg, options) => {
        const projectPath = resolveProjectPath(pathArg);
        const respectGitignore = await resolveGitignore(projectPath, options.gitignore);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                if (!options.quiet) {
                    error(`CodeGraph not initialized in ${projectPath}`);
                }
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            if (options.quiet) {
                const result = await cg.sync({ respectGitignore });
                if (result.status !== 'current') process.exitCode = 1;
                cg.destroy();
                return;
            }
            const clack = await importESM('@clack/prompts');
            clack.intro('Syncing CodeGraph');
            process.stdout.write(`${colors.dim}${(0, glyphs_1.getGlyphs)().rail}${colors.reset}\n`);
            const progress = (0, shimmer_progress_1.createShimmerProgress)();
            const result = await cg.sync({
                onProgress: progress.onProgress,
                respectGitignore,
            });
            await progress.stop();
            const totalChanges = result.filesAdded + result.filesModified + result.filesRemoved;
            if (result.status !== 'current') {
                for (const warning of result.warnings || []) clack.log.warn(warning);
                process.exitCode = 1;
            }
            else if (totalChanges === 0) {
                clack.log.info('Already up to date');
            }
            else {
                clack.log.success(`Synced ${formatNumber(totalChanges)} changed files`);
                const details = [];
                if (result.filesAdded > 0)
                    details.push(`Added: ${result.filesAdded}`);
                if (result.filesModified > 0)
                    details.push(`Modified: ${result.filesModified}`);
                if (result.filesRemoved > 0)
                    details.push(`Removed: ${result.filesRemoved}`);
                clack.log.info(`${details.join(', ')} ${(0, glyphs_1.getGlyphs)().dash} ${formatNumber(result.nodesUpdated)} nodes in ${formatDuration(result.durationMs)}`);
            }
            clack.outro('Done');
            cg.destroy();
        }
        catch (err) {
            if (!options.quiet) {
                error(`Failed to sync: ${err instanceof Error ? err.message : String(err)}`);
            }
            process.exit(1);
        }
    });
    /**
     * codegraph status [path]
     */
    program
        .command('status [path]')
        .description('Show index status and statistics')
        .option('-j, --json', 'Output as JSON')
        .action(async (pathArg, options) => {
        const projectPath = resolveProjectPath(pathArg);
        // The directory the user actually ran from, before walking up to the index
        // root. Used to detect when the resolved index lives in a different git
        // working tree (e.g. a nested worktree borrowing the main checkout's index).
        const startPath = path.resolve(pathArg || process.cwd());
        const worktreeMismatch = (0, worktree_1.detectWorktreeIndexMismatch)(startPath, projectPath);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                if (options.json) {
                    console.log(JSON.stringify({ schemaVersion: 1, initialized: false, projectPath }));
                    process.exitCode = 1;
                    return;
                }
                console.log(chalk.bold('\nCodeGraph Status\n'));
                info(`Project: ${projectPath}`);
                warn('Not initialized');
                info('Run "codegraph init" to initialize');
                process.exitCode = 1;
                return;
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            try {
                const stats = cg.getStats();
                const changes = cg.getChangedFiles();
                const backend = cg.getBackend();
                const journalMode = cg.getJournalMode();
                const indexHealth = require('../doctor').readIndexHealth(cg.getDb());
                const watcher = await require('../watch/manager').watcherStatus(projectPath);
                if (indexHealth.queryErrors > 0) process.exitCode = 1;
                let inventory = null;
                try {
                    inventory = cg.getFileInventorySummary();
                }
                catch {
                    inventory = null;
                }
                // Markdown docs count — only when the opt-in feature is enabled (else
                // null, so code-only projects render exactly as before).
                let docsCount = null;
                try {
                    if ((0, config_1.resolveDocsEnabled)(cg.getDb())) {
                        const row = cg.getDb().prepare('SELECT count(*) AS c FROM mdast_metadata').get();
                        docsCount = row?.c ?? 0;
                    }
                }
                catch { /* mdast_metadata absent (pre-v5 DB) — leave null */ }
                // JSON output mode
                if (options.json) {
                    console.log(JSON.stringify({
                        schemaVersion: 1,
                        initialized: true,
                        projectPath,
                        fileCount: stats.fileCount,
                        nodeCount: stats.nodeCount,
                        edgeCount: stats.edgeCount,
                        dbSizeBytes: stats.dbSizeBytes,
                        backend,
                        journalMode,
                        docsIndexed: docsCount,
                        inventory,
                        indexHealth,
                        watcher,
                        nodesByKind: stats.nodesByKind,
                        languages: Object.entries(stats.filesByLanguage).filter(([, count]) => count > 0).map(([lang]) => lang),
                        pendingChanges: {
                            added: changes.added.length,
                            modified: changes.modified.length,
                            removed: changes.removed.length,
                        },
                        worktreeMismatch: worktreeMismatch
                            ? { worktreeRoot: worktreeMismatch.worktreeRoot, indexRoot: worktreeMismatch.indexRoot }
                            : null,
                    }));
                    return;
                }
                console.log(chalk.bold('\nCodeGraph Status\n'));
                // Project info
                console.log(chalk.cyan('Project:'), projectPath);
                if (worktreeMismatch) {
                    warn((0, worktree_1.worktreeMismatchWarning)(worktreeMismatch));
                }
                console.log();
                // Markdown graph (concept nodes + governs edges) is the layer derived
                // from docs; report it distinctly from the tree-sitter code graph. Only
                // split the labels when a markdown graph actually exists, so plain code
                // projects keep the original output.
                const hasMarkdownGraph = stats.markdownNodeCount > 0 || stats.markdownEdgeCount > 0;
                const codeNodes = stats.nodeCount - stats.markdownNodeCount;
                const codeEdges = stats.edgeCount - stats.markdownEdgeCount;
                const codeTag = hasMarkdownGraph ? `   ${chalk.dim('(code)')}` : '';
                // Index stats — these counts are the code graph; the markdown graph is
                // reported in its own section below.
                console.log(chalk.bold('Index Statistics:'));
                console.log(`  Files:     ${formatNumber(stats.fileCount)}`);
                console.log(`  Nodes:     ${formatNumber(codeNodes)}${codeTag}`);
                console.log(`  Edges:     ${formatNumber(codeEdges)}${codeTag}`);
                console.log(`  DB Size:   ${(stats.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`);
                // Surface the active SQLite backend (node:sqlite — Node's built-in real
                // SQLite, full WAL + FTS5, no native build).
                const backendLabel = chalk.green(`node:sqlite ${(0, glyphs_1.getGlyphs)().dash} built-in (full WAL)`);
                console.log(`  Backend:   ${backendLabel}`);
                // Effective journal mode: 'wal' means concurrent reads never block on a
                // writer; anything else means they can ("database is locked"). node:sqlite
                // supports WAL everywhere, so a non-wal mode means the filesystem can't
                // (network mounts, WSL2 /mnt). See issue #238.
                const journalLabel = journalMode === 'wal'
                    ? chalk.green('wal')
                    : chalk.yellow(`${journalMode || 'unknown'} ${(0, glyphs_1.getGlyphs)().dash} WAL inactive; reads can block on writes`);
                console.log(`  Journal:   ${journalLabel}`);
                console.log();
                // Markdown graph — concept nodes + governs edges + doc count, kept
                // distinct from the code graph above. Shown whenever docs exist in any
                // form (indexed docs, or a concept/governs layer).
                if (docsCount !== null || hasMarkdownGraph) {
                    console.log(chalk.bold('Document Graph:'));
                    if (docsCount !== null) {
                        console.log(`  Documents: ${formatNumber(docsCount)} indexed`);
                    }
                    console.log(`  Concepts:  ${formatNumber(stats.markdownNodeCount)} nodes`);
                    console.log(`  Governs:   ${formatNumber(stats.markdownEdgeCount)} edges`);
                    console.log();
                }
                if (inventory) {
                    const covered = Object.values(inventory).reduce((sum, count) => sum + count, 0);
                    console.log(chalk.bold('Repository Coverage:'));
                    console.log(`  Accounted: ${formatNumber(covered)} files`);
                    for (const [status, count] of Object.entries(inventory).filter(([, count]) => count > 0)) {
                        console.log(`  ${status.padEnd(15)} ${formatNumber(count)}`);
                    }
                    console.log();
                }
                // Node breakdown — code kinds only; markdown kinds live in Markdown Graph.
                console.log(chalk.bold(hasMarkdownGraph ? 'Nodes by Kind (code):' : 'Nodes by Kind:'));
                const nodesByKind = Object.entries(stats.nodesByKind)
                    .filter(([kind, count]) => count > 0 && !types_1.MARKDOWN_NODE_KINDS.includes(kind))
                    .sort((a, b) => b[1] - a[1]);
                for (const [kind, count] of nodesByKind) {
                    console.log(`  ${kind.padEnd(15)} ${formatNumber(count)}`);
                }
                console.log();
                // Edge breakdown — code kinds only; markdown 'governs' lives in Markdown Graph.
                console.log(chalk.bold(hasMarkdownGraph ? 'Edges by Kind (code):' : 'Edges by Kind:'));
                const edgesByKind = Object.entries(stats.edgesByKind)
                    .filter(([kind, count]) => count > 0 && !types_1.MARKDOWN_EDGE_KINDS.includes(kind))
                    .sort((a, b) => b[1] - a[1]);
                for (const [kind, count] of edgesByKind) {
                    console.log(`  ${kind.padEnd(15)} ${formatNumber(count)}`);
                }
                console.log();
                // Language breakdown
                console.log(chalk.bold('Files by Language:'));
                const filesByLang = Object.entries(stats.filesByLanguage)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1]);
                for (const [lang, count] of filesByLang) {
                    console.log(`  ${lang.padEnd(15)} ${formatNumber(count)}`);
                }
                console.log();
                // Pending changes
                const totalChanges = changes.added.length + changes.modified.length + changes.removed.length;
                if (totalChanges > 0) {
                    console.log(chalk.bold('Pending Changes:'));
                    if (changes.added.length > 0) {
                        console.log(`  Added:     ${changes.added.length} files`);
                    }
                    if (changes.modified.length > 0) {
                        console.log(`  Modified:  ${changes.modified.length} files`);
                    }
                    if (changes.removed.length > 0) {
                        console.log(`  Removed:   ${changes.removed.length} files`);
                    }
                    info('Run "codegraph sync" to update the index');
                }
                else if (!indexHealth.healthy) {
                    for (const warning of indexHealth.warnings) warn(warning);
                }
                else if (watcher.active && (!watcher.ready || watcher.pendingFiles?.length)) {
                    info(`Automatic watcher: ${watcher.phase}, ${watcher.pendingFiles?.length || 0} pending files`);
                }
                else {
                    success('Index is up to date');
                }
                console.log();
            }
            finally {
                cg.destroy();
            }
        }
        catch (err) {
            error(`Failed to get status: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph query <search>
     */
    program
        .command('query <search>')
        .description('Search for symbols in the codebase')
        .option('-p, --path <path>', 'Project path')
        .option('-l, --limit <number>', 'Maximum results', '10')
        .option('-k, --kind <kind>', 'Filter by node kind (function, class, etc.)')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-j, --json', 'Output as JSON')
        .action(async (search, options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            try {
                const limit = parseInt(options.limit || '10', 10);
                const syncResult = options.sync === false ? null : await syncForRead(cg, projectPath);
                if (syncResult && syncResult.status !== 'current') process.exitCode = 1;
                const rawResults = cg.searchNodes(search, {
                    limit,
                    kinds: options.kind ? [options.kind] : undefined,
                });
                // Apply the same down-rank as document search so the CLI surfaces the
                // hand-written implementation before protobuf/gRPC scaffolding
                // when both share a name. See extraction/generated-detection.ts.
                const { isGeneratedFile } = await Promise.resolve().then(() => __importStar(require('../extraction/generated-detection')));
                const results = [...rawResults].sort((a, b) => {
                    const aGen = isGeneratedFile(a.node.filePath) ? 1 : 0;
                    const bGen = isGeneratedFile(b.node.filePath) ? 1 : 0;
                    return aGen - bGen;
                });
                // Thin-result semantic fallback. When lexical search returns very little,
                // supplement with a meaning-based Markdown search so natural-language
                // queries (and pure-Markdown projects whose graph has no code symbols)
                // aren't a dead end. searchDocs is internally gated — opt-in flag +
                // sqlite-vec + embeddings — and a silent no-op otherwise, so code projects
                // and docs-off projects are unaffected (lexical results stand alone). The
                // embedding-model cold start is paid only on this thin path, never when
                // lexical already answered. (try_001 §2.1 / plan Step 7.)
                const THIN_THRESHOLD = 3;
                let docHits = [];
                let semanticState = 'disabled';
                let docWarnings = [];
                if ((0, config_1.resolveDocsEnabled)(cg.getDb())) {
                    const [{ isEmbedAvailable }, { loadVecExtension }] = await Promise.all([
                        Promise.resolve().then(() => __importStar(require('../docs/embed'))),
                        Promise.resolve().then(() => __importStar(require('../docs/vec'))),
                    ]);
                    semanticState = loadVecExtension(cg.getDb()) && await isEmbedAvailable()
                        ? 'ready'
                        : 'unavailable';
                }
                if (rawResults.length < THIN_THRESHOLD) {
                    try {
                        const { searchDocs } = await Promise.resolve().then(() => __importStar(require('../docs/search')));
                        const docResult = await searchDocs(cg.getDb(), search, { topk: limit });
                        docHits = docResult.hits;
                        semanticState = docResult.semanticState;
                        docWarnings = docResult.warnings;
                    }
                    catch (fallbackError) {
                        docWarnings.push(`Document fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                    }
                }
                if (options.json) {
                    console.log(JSON.stringify({
                        schemaVersion: 1,
                        freshness: syncResult ? syncFreshness(syncResult) : unknownFreshness(),
                        semanticState,
                        results,
                        docs: docHits,
                        warnings: [...new Set([...(syncResult?.warnings ?? []), ...docWarnings])],
                    }, null, 2));
                }
                else {
                    if (results.length === 0 && docHits.length === 0) {
                        info(`No results found for "${search}"`);
                    }
                    else {
                        if (results.length > 0) {
                            console.log(chalk.bold(`\nSearch Results for "${search}":\n`));
                            for (const result of results) {
                                const node = result.node;
                                const location = `${node.filePath}:${node.startLine}`;
                                const score = chalk.dim(`(${(result.score * 100).toFixed(0)}%)`);
                                console.log(chalk.cyan(node.kind.padEnd(12)) +
                                    chalk.white(node.name) +
                                    ' ' + score);
                                console.log(chalk.dim(`  ${location}`));
                                if (node.signature) {
                                    console.log(chalk.dim(`  ${node.signature}`));
                                }
                                console.log();
                            }
                        }
                        if (docHits.length > 0) {
                            console.log(chalk.bold(`\nRelated documentation for "${search}":\n`));
                            for (const hit of docHits) {
                                const blk = hit.blk ? ' ' + chalk.dim(`[${hit.blk}]`) : '';
                                console.log(chalk.blue('doc'.padEnd(12)) + chalk.white(hit.file) + blk);
                                if (hit.summary)
                                    console.log(chalk.dim(`  ${hit.summary}`));
                                console.log();
                            }
                        }
                    }
                }
            }
            finally {
                cg.destroy();
            }
        }
        catch (err) {
            error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph backlinks <file>
     *
     * Surfaces the Markdown doc graph (backlinks + forward links) on the CLI —
     * No-op message on projects without the docs graph.
     */
    program
        .command('backlinks <file>')
        .description('Show Markdown backlinks and forward links for a doc (requires the docs feature)')
        .option('-p, --path <path>', 'Project path')
        .option('--no-sync', 'Read the existing index without a freshness check')
        .option('-d, --depth <number>', 'Forward-link traversal depth', '1')
        .option('-j, --json', 'Output as JSON')
        .action(async (file, options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            const { findBacklinks } = await Promise.resolve().then(() => __importStar(require('../docs/search')));
            if (options.sync !== false) {
                const sync = await syncForRead(cg, projectPath);
                if (sync.status !== 'current') process.exitCode = 1;
            }
            const depth = parseInt(options.depth || '1', 10);
            const result = findBacklinks(cg.getDb(), file, depth);
            if (options.json) {
                console.log(JSON.stringify(result ?? { file, forwardLinks: [], backLinks: [] }, null, 2));
            }
            else if (!result) {
                info('Docs graph is not enabled for this project (enable with --with-docs or CODEGRAPH_DOC_GRAPH).');
            }
            else {
                console.log(chalk.bold(`\nBacklinks for ${result.file}:\n`));
                if (result.backLinks.length === 0) {
                    info('No backlinks found.');
                }
                else {
                    for (const b of result.backLinks)
                        console.log('  ' + chalk.cyan('<-') + ' ' + b);
                }
                if (result.forwardLinks.length > 0) {
                    console.log(chalk.bold('\nForward links:\n'));
                    for (const f of result.forwardLinks)
                        console.log('  ' + chalk.blue('->') + ' ' + f);
                }
                console.log();
            }
            cg.destroy();
        }
        catch (err) {
            error(`Backlinks failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph docs <query>
     *
     * Hybrid lexical/vector search over indexed documents.
     * Lexical results remain available when optional vector dependencies are not.
     */
    program
        .command('docs <query>')
        .description('Hybrid search over indexed documents (requires the docs feature)')
        .option('-p, --path <path>', 'Project path')
        .option('-l, --limit <number>', 'Maximum results', '10')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-j, --json', 'Output as JSON')
        .action(async (query, options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            try {
                const limit = parseInt(options.limit || '10', 10);
                const syncResult = options.sync === false ? null : await syncForRead(cg, projectPath);
                if (syncResult && syncResult.status !== 'current') process.exitCode = 1;
                const { searchDocs } = await Promise.resolve().then(() => __importStar(require('../docs/search')));
                const result = await searchDocs(cg.getDb(), query, { topk: limit });
                if (options.json) {
                    console.log(JSON.stringify({
                        ...result,
                        warnings: [...new Set([...result.warnings, ...(syncResult?.warnings ?? [])])],
                        freshness: syncResult ? syncFreshness(syncResult) : unknownFreshness(),
                    }, null, 2));
                }
                else if (!result.enabled) {
                    info('Docs feature is not enabled for this project (index with --with-docs).');
                }
                else if (result.hits.length === 0) {
                    info(`No documentation matches for "${query}".`);
                    for (const w of result.warnings)
                        info(w);
                }
                else {
                    console.log(chalk.bold(`\nDocumentation matches for "${query}":\n`));
                    for (const hit of result.hits) {
                        const blk = hit.blk ? ' ' + chalk.dim(`[${hit.blk}]`) : '';
                        console.log(chalk.blue('doc'.padEnd(12)) + chalk.white(hit.file) + blk +
                            ' ' + chalk.dim(`(d=${hit.distance})`));
                        if (hit.summary)
                            console.log(chalk.dim(`  ${hit.summary}`));
                        console.log();
                    }
                }
            }
            finally {
                cg.destroy();
            }
        }
        catch (err) {
            error(`Docs search failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    const analysisCli = {
        resolvePath: resolveProjectPath,
        loadGraph: loadCodeGraph,
        ready: directory_1.isInitialized,
        version: String(packageJson.version),
        format: formatNumber,
        error,
        chalk,
    };
    (0, doctor_command_1.addDoctor)(program, analysisCli);
    (0, semantic_command_1.addSemantic)(program, analysisCli);
    (0, community_command_1.addCommunity)(program, analysisCli);
    (0, report_command_1.addReport)(program, analysisCli);
    /**
     * codegraph files [path]
     */
    program
        .command('files')
        .description('Show project file structure from the index')
        .option('-p, --path <path>', 'Project path')
        .option('--filter <dir>', 'Filter to files under this directory')
        .option('--pattern <glob>', 'Filter files matching this glob pattern')
        .option('--format <format>', 'Output format (tree, flat, grouped)', 'tree')
        .option('--max-depth <number>', 'Maximum directory depth for tree format')
        .option('--no-metadata', 'Hide file metadata (language, symbol count)')
        .option('-j, --json', 'Output as JSON')
        .option('--no-sync', 'Read the existing index without a freshness check')
        .action(async (options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            if (options.sync !== false) {
                const sync = await syncForRead(cg, projectPath);
                if (sync.status !== 'current') process.exitCode = 1;
            }
            let files = cg.getFiles();
            if (files.length === 0) {
                if (options.json) console.log('[]');
                else info('No files indexed. Run "codegraph index" first.');
                cg.destroy();
                return;
            }
            // Filter by path prefix
            if (options.filter) {
                const filter = options.filter;
                files = files.filter(f => f.path.startsWith(filter) || f.path.startsWith('./' + filter));
            }
            // Filter by glob pattern
            if (options.pattern) {
                const regex = globToRegex(options.pattern);
                files = files.filter(f => regex.test(f.path));
            }
            if (files.length === 0) {
                if (options.json) console.log('[]');
                else info('No files found matching the criteria.');
                cg.destroy();
                return;
            }
            // JSON output
            if (options.json) {
                const output = files.map(f => ({
                    path: f.path,
                    language: f.language,
                    nodeCount: f.nodeCount,
                    size: f.size,
                }));
                console.log(JSON.stringify(output, null, 2));
                cg.destroy();
                return;
            }
            const includeMetadata = options.metadata !== false;
            const format = options.format || 'tree';
            const maxDepth = options.maxDepth ? parseInt(options.maxDepth, 10) : undefined;
            // Format output
            switch (format) {
                case 'flat':
                    console.log(chalk.bold(`\nFiles (${files.length}):\n`));
                    for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
                        if (includeMetadata) {
                            console.log(`  ${file.path} ${chalk.dim(`(${file.language}, ${file.nodeCount} symbols)`)}`);
                        }
                        else {
                            console.log(`  ${file.path}`);
                        }
                    }
                    break;
                case 'grouped':
                    console.log(chalk.bold(`\nFiles by Language (${files.length} total):\n`));
                    const byLang = new Map();
                    for (const file of files) {
                        const existing = byLang.get(file.language) || [];
                        existing.push(file);
                        byLang.set(file.language, existing);
                    }
                    const sortedLangs = [...byLang.entries()].sort((a, b) => b[1].length - a[1].length);
                    for (const [lang, langFiles] of sortedLangs) {
                        console.log(chalk.cyan(`${lang} (${langFiles.length}):`));
                        for (const file of langFiles.sort((a, b) => a.path.localeCompare(b.path))) {
                            if (includeMetadata) {
                                console.log(`  ${file.path} ${chalk.dim(`(${file.nodeCount} symbols)`)}`);
                            }
                            else {
                                console.log(`  ${file.path}`);
                            }
                        }
                        console.log();
                    }
                    break;
                case 'tree':
                default:
                    console.log(chalk.bold(`\nProject Structure (${files.length} files):\n`));
                    printFileTree(files, includeMetadata, maxDepth, chalk);
                    break;
            }
            console.log();
            cg.destroy();
        }
        catch (err) {
            error(`Failed to list files: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * Convert glob pattern to regex
     */
    function globToRegex(pattern) {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');
        return new RegExp(escaped);
    }
    /**
     * Print files as a tree
     */
    function printFileTree(files, includeMetadata, maxDepth, chalk) {
        const root = { name: '', children: new Map() };
        for (const file of files) {
            const parts = file.path.split('/');
            let current = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part)
                    continue;
                if (!current.children.has(part)) {
                    current.children.set(part, { name: part, children: new Map() });
                }
                current = current.children.get(part);
                if (i === parts.length - 1) {
                    current.file = { language: file.language, nodeCount: file.nodeCount };
                }
            }
        }
        const renderNode = (node, prefix, isLast, depth) => {
            if (maxDepth !== undefined && depth > maxDepth)
                return;
            const glyphs = (0, glyphs_1.getGlyphs)();
            const connector = isLast ? glyphs.treeLast : glyphs.treeBranch;
            const childPrefix = isLast ? '    ' : glyphs.treePipe;
            if (node.name) {
                let line = prefix + connector + node.name;
                if (node.file && includeMetadata) {
                    line += chalk.dim(` (${node.file.language}, ${node.file.nodeCount} symbols)`);
                }
                console.log(line);
            }
            const children = [...node.children.values()];
            children.sort((a, b) => {
                const aIsDir = a.children.size > 0 && !a.file;
                const bIsDir = b.children.size > 0 && !b.file;
                if (aIsDir !== bIsDir)
                    return aIsDir ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const nextPrefix = node.name ? prefix + childPrefix : prefix;
                renderNode(child, nextPrefix, i === children.length - 1, depth + 1);
            }
        };
        renderNode(root, '', true, 0);
    }
    const adapterCommand = program.command('adapter').description('Inspect source adapter capabilities');
    adapterCommand
        .command('list')
        .description('List registered source adapters and fingerprints')
        .option('--json', 'Output JSON')
        .action(async (options) => {
        const { sourceAdapterRegistry } = await Promise.resolve().then(() => __importStar(require('../extraction/adapters')));
        const adapters = sourceAdapterRegistry.list();
        if (options.json) {
            console.log(JSON.stringify({ schemaVersion: 1, adapters }, null, 2));
            return;
        }
        for (const adapter of adapters) {
            console.log(`${adapter.id}@${adapter.version} ${adapter.extensions.join(',')} ${adapter.fingerprint.slice(0, 12)}`);
        }
    });
    adapterCommand
        .command('inspect <file>')
        .description('Parse one file and print its canonical adapter output')
        .option('-p, --path <path>', 'Project path')
        .option('--json', 'Output JSON')
        .action(async (file, options) => {
        const projectPath = resolveProjectPath(options.path);
        const absolutePath = path.resolve(projectPath, file);
        const relativePath = path.relative(projectPath, absolutePath).split(path.sep).join('/');
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            error('Adapter inspection path must stay inside the project root');
            process.exit(1);
        }
        if (!(0, utils_1.isPathWithinRootReal)(absolutePath, projectPath)) {
            error('Adapter inspection path resolves outside the project root');
            process.exit(1);
        }
        const source = fs.readFileSync(absolutePath, 'utf8');
        const [{ sourceAdapterRegistry }, { detectLanguage }] = await Promise.all([
            Promise.resolve().then(() => __importStar(require('../extraction/adapters'))),
            Promise.resolve().then(() => __importStar(require('../extraction/grammars'))),
        ]);
        const language = detectLanguage(relativePath, source);
        const adapter = sourceAdapterRegistry.find(relativePath, source, language);
        if (!adapter) {
            error(`No registered source adapter matches ${relativePath}`);
            process.exit(1);
        }
        const extraction = adapter.extract(relativePath, source);
        const output = {
            schemaVersion: 1,
            adapter: { ...adapter.manifest, fingerprint: sourceAdapterRegistry.list().find((item) => item.id === adapter.manifest.id)?.fingerprint },
            file: relativePath,
            language,
            nodes: extraction.nodes,
            edges: extraction.edges,
            unresolvedReferences: extraction.unresolvedReferences,
            diagnostics: extraction.errors,
            durationMs: extraction.durationMs,
        };
        if (options.json)
            console.log(JSON.stringify(output, null, 2));
        else
            console.log(`${adapter.manifest.id}: ${extraction.nodes.length} nodes, ${extraction.edges.length} edges, ${extraction.errors.length} diagnostics`);
    });
    /**
     * codegraph context <task>
     */
    program
        .command('context <task>')
        .description('Build context for a task (outputs markdown)')
        .option('-p, --path <path>', 'Project path')
        .option('-n, --max-nodes <number>', 'Maximum nodes to include', '50')
        .option('-c, --max-code <number>', 'Maximum code blocks', '10')
        .option('-b, --budget <tokens>', 'Approximate output token budget', '4000')
        .option('--no-code', 'Exclude code blocks')
        .option('--no-sync', 'Skip the incremental freshness check')
        .option('-f, --format <format>', 'Output format (markdown, json)', 'markdown')
        .option('-j, --json', 'Output JSON')
        .action(async (task, options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            try {
                let freshness = unknownFreshness();
                let syncWarnings = [];
                if (options.sync !== false) {
                    const sync = await syncForRead(cg, projectPath);
                    if (sync.status !== 'current') process.exitCode = 1;
                    freshness = syncFreshness(sync);
                    syncWarnings = sync.warnings ?? [];
                }
                const { resolveDocsEnabled } = await Promise.resolve().then(() => __importStar(require('../docs/config')));
                let semanticState = 'disabled';
                if (resolveDocsEnabled(cg.getDb())) {
                    const [{ isEmbedAvailable }, { loadVecExtension }] = await Promise.all([
                        Promise.resolve().then(() => __importStar(require('../docs/embed'))),
                        Promise.resolve().then(() => __importStar(require('../docs/vec'))),
                    ]);
                    semanticState = loadVecExtension(cg.getDb()) && await isEmbedAvailable() ? 'ready' : 'unavailable';
                }
                const context = await cg.buildContext(task, {
                    maxNodes: parseInt(options.maxNodes || '50', 10),
                    maxCodeBlocks: parseInt(options.maxCode || '10', 10),
                    includeCode: options.code !== false,
                    format: options.json ? 'json' : options.format,
                    tokenBudget: parseInt(options.budget || '4000', 10),
                    freshness,
                    semanticState,
                    warnings: [...new Set(syncWarnings)],
                });
                // Output the context
                console.log(context);
            }
            finally {
                cg.destroy();
            }
        }
        catch (err) {
            error(`Failed to build context: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    /**
     * codegraph unlock [path]
     */
    program
        .command('unlock [path]')
        .description('Remove a stale lock file that is blocking indexing')
        .action(async (pathArg) => {
        const projectPath = resolveProjectPath(pathArg);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                return;
            }
            const lockPath = path.join((0, directory_1.getCodeGraphDir)(projectPath), 'codegraph.lock');
            if (!fs.existsSync(lockPath)) {
                info(`No lock file found ${(0, glyphs_1.getGlyphs)().dash} nothing to do`);
                return;
            }
            fs.unlinkSync(lockPath);
            success('Removed lock file. You can now run indexing again.');
        }
        catch (err) {
            error(`Failed to remove lock: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    require('./traversal-command').addTraversal(program, resolveProjectPath);
    /**
     * codegraph affected [files...]
     *
     * Find test files affected by the given source files.
     * Traces dependency edges transitively to find test files that depend on changed code.
     *
     * Usage:
     *   git diff --name-only | codegraph affected --stdin
     *   codegraph affected src/lib/components/Editor.svelte src/routes/+page.svelte
     */
    program
        .command('affected [files...]')
        .description('Find test files affected by changed source files')
        .option('-p, --path <path>', 'Project path')
        .option('--stdin', 'Read file list from stdin (one per line)')
        .option('-d, --depth <number>', 'Max dependency traversal depth', '5')
        .option('-f, --filter <glob>', 'Custom glob filter for test files (e.g. "e2e/*.spec.ts")')
        .option('-j, --json', 'Output as JSON')
        .option('-q, --quiet', 'Only output file paths, no decoration')
        .option('--no-sync', 'Read the existing index without a freshness check')
        .action(async (fileArgs, options) => {
        const projectPath = resolveProjectPath(options.path);
        try {
            if (!(0, directory_1.isInitialized)(projectPath)) {
                error(`CodeGraph not initialized in ${projectPath}`);
                process.exit(1);
            }
            // Collect changed files from args or stdin
            let changedFiles = [...(fileArgs || [])];
            if (options.stdin) {
                const stdinData = fs.readFileSync(0, 'utf-8');
                const stdinFiles = stdinData.split('\n').map(f => f.trim()).filter(Boolean);
                changedFiles.push(...stdinFiles);
            }
            if (changedFiles.length === 0) {
                if (options.json) console.log(JSON.stringify({ changedFiles: [], affectedTests: [], totalDependentsTraversed: 0 }));
                else if (!options.quiet)
                    info('No files provided. Use file arguments or --stdin.');
                return;
            }
            const { default: CodeGraph } = await loadCodeGraph();
            const cg = await CodeGraph.open(projectPath);
            if (options.sync !== false) {
                const sync = await syncForRead(cg, projectPath);
                if (sync.status !== 'current') process.exitCode = 1;
            }
            const maxDepth = parseInt(options.depth || '5', 10);
            // Common test file patterns
            const defaultTestPatterns = [
                /\.spec\./,
                /\.test\./,
                /\/__tests__\//,
                /\/tests?\//,
                /\/e2e\//,
                /\/spec\//,
                /(?:Tests?|Specs?)\.(?:cs|java)$/i,
            ];
            // Custom filter pattern
            let customFilter = null;
            if (options.filter) {
                // Convert glob to regex: ** → .+, * → [^/]*, . → \.
                const regex = options.filter
                    .replace(/[+[\]{}()^$|\\]/g, '\\$&')
                    .replace(/\./g, '\\.')
                    .replace(/\*\*/g, '.+')
                    .replace(/\*/g, '[^/]*');
                customFilter = new RegExp(regex);
            }
            function isTestFile(filePath) {
                if (customFilter)
                    return customFilter.test(filePath);
                return defaultTestPatterns.some(p => p.test(filePath));
            }
            // BFS to find all transitive dependents of changed files, filtered to test files
            const affectedTests = new Set();
            const allDependents = new Set();
            for (const file of changedFiles) {
                // If the changed file is itself a test file, include it
                if (isTestFile(file)) {
                    affectedTests.add(file);
                    continue;
                }
                // BFS through dependents
                const queue = [{ file, depth: 0 }];
                const visited = new Set();
                visited.add(file);
                while (queue.length > 0) {
                    const current = queue.shift();
                    if (current.depth >= maxDepth)
                        continue;
                    const dependents = cg.getFileDependents(current.file);
                    for (const dep of dependents) {
                        if (visited.has(dep))
                            continue;
                        visited.add(dep);
                        allDependents.add(dep);
                        if (isTestFile(dep)) {
                            affectedTests.add(dep);
                        }
                        else {
                            queue.push({ file: dep, depth: current.depth + 1 });
                        }
                    }
                }
            }
            const sortedTests = Array.from(affectedTests).sort();
            // Output
            if (options.json) {
                console.log(JSON.stringify({
                    changedFiles,
                    affectedTests: sortedTests,
                    totalDependentsTraversed: allDependents.size,
                }, null, 2));
            }
            else if (options.quiet) {
                for (const t of sortedTests)
                    console.log(t);
            }
            else {
                if (sortedTests.length === 0) {
                    info('No test files affected by the changed files.');
                }
                else {
                    console.log(chalk.bold(`\nAffected test files (${sortedTests.length}):\n`));
                    for (const t of sortedTests) {
                        console.log('  ' + chalk.cyan(t));
                    }
                    console.log();
                }
            }
            cg.destroy();
        }
        catch (err) {
            error(`Affected analysis failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    });
    require('./watch-command').addWatch(program, resolveProjectPath);
    require('./watch-command').autoWatch(program, resolveProjectPath);
    if (process.argv.length === 2) {
        program.outputHelp();
        return;
    }
    await program.parseAsync();
} // end main()
//# sourceMappingURL=codegraph.js.map
