"use strict";
/**
 * CodeGraph
 *
 * A local-first code intelligence system that builds a semantic
 * knowledge graph from any codebase.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGraph = exports.LockUnavailableError = exports.FileWatcher = exports.MemoryMonitor = exports.throttle = exports.debounce = exports.processInBatches = exports.FileLock = exports.Mutex = exports.defaultLogger = exports.silentLogger = exports.getLogger = exports.setLogger = exports.ConfigError = exports.VectorError = exports.SearchError = exports.DatabaseError = exports.ParseError = exports.FileError = exports.CodeGraphError = exports.loadAllGrammars = exports.loadGrammarsForLanguages = exports.initGrammars = exports.getSupportedLanguages = exports.isGrammarLoaded = exports.isLanguageSupported = exports.detectLanguage = exports.CODEGRAPH_DIR = exports.findNearestCodeGraphRoot = exports.isInitialized = exports.getCodeGraphDir = exports.QueryBuilder = exports.DatabaseConnection = exports.getDatabasePath = void 0;
const path = __importStar(require("path"));
const db_1 = require("./db");
const indexer_1 = require("./docs/indexer");
const scan_files_1 = require("./docs/scan-files");
const config_1 = require("./docs/config");
const governs_linker_1 = require("./docs/governs-linker");
const doc_links_linker_1 = require("./docs/doc-links-linker");
const semantic_edges_1 = require("./docs/semantic-edges");
const queries_1 = require("./db/queries");
const directory_1 = require("./directory");
const extraction_1 = require("./extraction");
const resolution_1 = require("./resolution");
const graph_1 = require("./graph");
const context_1 = require("./context");
const utils_1 = require("./utils");
const sync_1 = require("./sync");
const inventory_1 = require("./inventory");
const index_health_1 = require("./inventory/health");
const provenance_1 = require("./provenance");
// Re-export types for consumers
__exportStar(require("./types"), exports);
// Storage building blocks for embedded/SDK consumers that drive the graph
// directly (open a DB, run prepared queries) rather than through the CodeGraph
// facade. Exposed from the package entry so they no longer require deep imports
// into dist/ (issue #354).
var db_2 = require("./db");
Object.defineProperty(exports, "getDatabasePath", { enumerable: true, get: function () { return db_2.getDatabasePath; } });
Object.defineProperty(exports, "DatabaseConnection", { enumerable: true, get: function () { return db_2.DatabaseConnection; } });
var queries_2 = require("./db/queries");
Object.defineProperty(exports, "QueryBuilder", { enumerable: true, get: function () { return queries_2.QueryBuilder; } });
var directory_2 = require("./directory");
Object.defineProperty(exports, "getCodeGraphDir", { enumerable: true, get: function () { return directory_2.getCodeGraphDir; } });
Object.defineProperty(exports, "isInitialized", { enumerable: true, get: function () { return directory_2.isInitialized; } });
Object.defineProperty(exports, "findNearestCodeGraphRoot", { enumerable: true, get: function () { return directory_2.findNearestCodeGraphRoot; } });
Object.defineProperty(exports, "CODEGRAPH_DIR", { enumerable: true, get: function () { return directory_2.CODEGRAPH_DIR; } });
var extraction_2 = require("./extraction");
Object.defineProperty(exports, "detectLanguage", { enumerable: true, get: function () { return extraction_2.detectLanguage; } });
Object.defineProperty(exports, "isLanguageSupported", { enumerable: true, get: function () { return extraction_2.isLanguageSupported; } });
Object.defineProperty(exports, "isGrammarLoaded", { enumerable: true, get: function () { return extraction_2.isGrammarLoaded; } });
Object.defineProperty(exports, "getSupportedLanguages", { enumerable: true, get: function () { return extraction_2.getSupportedLanguages; } });
Object.defineProperty(exports, "initGrammars", { enumerable: true, get: function () { return extraction_2.initGrammars; } });
Object.defineProperty(exports, "loadGrammarsForLanguages", { enumerable: true, get: function () { return extraction_2.loadGrammarsForLanguages; } });
Object.defineProperty(exports, "loadAllGrammars", { enumerable: true, get: function () { return extraction_2.loadAllGrammars; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "CodeGraphError", { enumerable: true, get: function () { return errors_1.CodeGraphError; } });
Object.defineProperty(exports, "FileError", { enumerable: true, get: function () { return errors_1.FileError; } });
Object.defineProperty(exports, "ParseError", { enumerable: true, get: function () { return errors_1.ParseError; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return errors_1.DatabaseError; } });
Object.defineProperty(exports, "SearchError", { enumerable: true, get: function () { return errors_1.SearchError; } });
Object.defineProperty(exports, "VectorError", { enumerable: true, get: function () { return errors_1.VectorError; } });
Object.defineProperty(exports, "ConfigError", { enumerable: true, get: function () { return errors_1.ConfigError; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return errors_1.setLogger; } });
Object.defineProperty(exports, "getLogger", { enumerable: true, get: function () { return errors_1.getLogger; } });
Object.defineProperty(exports, "silentLogger", { enumerable: true, get: function () { return errors_1.silentLogger; } });
Object.defineProperty(exports, "defaultLogger", { enumerable: true, get: function () { return errors_1.defaultLogger; } });
var utils_2 = require("./utils");
Object.defineProperty(exports, "Mutex", { enumerable: true, get: function () { return utils_2.Mutex; } });
Object.defineProperty(exports, "FileLock", { enumerable: true, get: function () { return utils_2.FileLock; } });
Object.defineProperty(exports, "processInBatches", { enumerable: true, get: function () { return utils_2.processInBatches; } });
Object.defineProperty(exports, "debounce", { enumerable: true, get: function () { return utils_2.debounce; } });
Object.defineProperty(exports, "throttle", { enumerable: true, get: function () { return utils_2.throttle; } });
Object.defineProperty(exports, "MemoryMonitor", { enumerable: true, get: function () { return utils_2.MemoryMonitor; } });
var sync_2 = require("./sync");
Object.defineProperty(exports, "FileWatcher", { enumerable: true, get: function () { return sync_2.FileWatcher; } });
Object.defineProperty(exports, "LockUnavailableError", { enumerable: true, get: function () { return sync_2.LockUnavailableError; } });
// filePath 가 있는 오류는 그 파일 한정임. 해당 파일은 다음 증분 동기화에서 다시 처리됨
function isSystemicError(entry) {
    return entry.severity === 'error' && !entry.filePath;
}
const MAX_FAILURE_SUMMARY_CHARS = 2000;
function summarizeFailure(messages) {
    const summary = [...new Set(messages.filter(Boolean))].join('; ');
    return summary.length > MAX_FAILURE_SUMMARY_CHARS ? `${summary.slice(0, MAX_FAILURE_SUMMARY_CHARS)}...` : summary;
}
/**
 * Main CodeGraph class
 *
 * Provides the primary interface for interacting with the code knowledge graph.
 */
class CodeGraph {
    db;
    queries;
    projectRoot;
    orchestrator;
    resolver;
    graphManager;
    traverser;
    contextBuilder;
    // Mutex for preventing concurrent indexing operations (in-process)
    indexMutex = new utils_1.Mutex();
    // File lock for preventing concurrent writes across processes such as CLI and git hooks.
    fileLock;
    // File watcher for auto-sync on file changes
    watcher = null;
    constructor(db, queries, projectRoot) {
        this.db = db;
        this.queries = queries;
        this.projectRoot = projectRoot;
        this.fileLock = new utils_1.FileLock(path.join(projectRoot, '.codegraph', 'codegraph.lock'));
        this.orchestrator = new extraction_1.ExtractionOrchestrator(projectRoot, queries);
        this.resolver = (0, resolution_1.createResolver)(projectRoot, queries);
        this.graphManager = new graph_1.GraphQueryManager(queries);
        this.traverser = new graph_1.GraphTraverser(queries);
        this.contextBuilder = (0, context_1.createContextBuilder)(projectRoot, queries, this.traverser, db.getDb());
    }
    // ===========================================================================
    // Lifecycle Methods
    // ===========================================================================
    /**
     * Initialize a new CodeGraph project
     *
     * Creates the .CodeGraph directory, database, and configuration.
     *
     * @param projectRoot - Path to the project root directory
     * @param options - Initialization options
     * @returns A new CodeGraph instance
     */
    static async init(projectRoot, options = {}) {
        await (0, extraction_1.initGrammars)();
        const resolvedRoot = path.resolve(projectRoot);
        // Check if already initialized
        if ((0, directory_1.isInitialized)(resolvedRoot)) {
            throw new Error(`CodeGraph already initialized in ${resolvedRoot}`);
        }
        // Create directory structure
        (0, directory_1.createDirectory)(resolvedRoot);
        // Initialize database
        const dbPath = (0, db_1.getDatabasePath)(resolvedRoot);
        const db = db_1.DatabaseConnection.initialize(dbPath);
        const queries = new queries_1.QueryBuilder(db.getDb());
        const instance = new CodeGraph(db, queries, resolvedRoot);
        // Run initial indexing if requested
        if (options.index) {
            await instance.indexAll({ onProgress: options.onProgress });
        }
        return instance;
    }
    /**
     * Initialize synchronously (without indexing)
     */
    static initSync(projectRoot) {
        const resolvedRoot = path.resolve(projectRoot);
        // Check if already initialized
        if ((0, directory_1.isInitialized)(resolvedRoot)) {
            throw new Error(`CodeGraph already initialized in ${resolvedRoot}`);
        }
        // Create directory structure
        (0, directory_1.createDirectory)(resolvedRoot);
        // Initialize database
        const dbPath = (0, db_1.getDatabasePath)(resolvedRoot);
        const db = db_1.DatabaseConnection.initialize(dbPath);
        const queries = new queries_1.QueryBuilder(db.getDb());
        return new CodeGraph(db, queries, resolvedRoot);
    }
    /**
     * Open an existing CodeGraph project
     *
     * @param projectRoot - Path to the project root directory
     * @param options - Open options
     * @returns A CodeGraph instance
     */
    static async open(projectRoot, options = {}) {
        await (0, extraction_1.initGrammars)();
        const resolvedRoot = path.resolve(projectRoot);
        // Check if initialized
        if (!(0, directory_1.isInitialized)(resolvedRoot)) {
            throw new Error(`CodeGraph not initialized in ${resolvedRoot}. Run init() first.`);
        }
        // Validate directory structure
        const validation = (0, directory_1.validateDirectory)(resolvedRoot);
        if (!validation.valid) {
            throw new Error(`Invalid CodeGraph directory: ${validation.errors.join(', ')}`);
        }
        // Open database
        const dbPath = (0, db_1.getDatabasePath)(resolvedRoot);
        const db = db_1.DatabaseConnection.open(dbPath);
        const queries = new queries_1.QueryBuilder(db.getDb());
        const instance = new CodeGraph(db, queries, resolvedRoot);
        // Sync if requested
        if (options.sync) {
            await instance.sync();
        }
        return instance;
    }
    /**
     * Open synchronously (without sync)
     */
    static openSync(projectRoot) {
        const resolvedRoot = path.resolve(projectRoot);
        // Check if initialized
        if (!(0, directory_1.isInitialized)(resolvedRoot)) {
            throw new Error(`CodeGraph not initialized in ${resolvedRoot}. Run init() first.`);
        }
        // Validate directory structure
        const validation = (0, directory_1.validateDirectory)(resolvedRoot);
        if (!validation.valid) {
            throw new Error(`Invalid CodeGraph directory: ${validation.errors.join(', ')}`);
        }
        // Open database
        const dbPath = (0, db_1.getDatabasePath)(resolvedRoot);
        const db = db_1.DatabaseConnection.open(dbPath);
        const queries = new queries_1.QueryBuilder(db.getDb());
        return new CodeGraph(db, queries, resolvedRoot);
    }
    /**
     * Check if a directory has been initialized as a CodeGraph project
     */
    static isInitialized(projectRoot) {
        return (0, directory_1.isInitialized)(path.resolve(projectRoot));
    }
    /**
     * Close the CodeGraph instance and release resources
     */
    close() {
        this.unwatch();
        // Release file lock if held
        this.fileLock.release();
        this.db.close();
    }
    /**
     * Get the project root directory
     */
    getProjectRoot() {
        return this.projectRoot;
    }
    /**
     * Get the underlying SQLite database handle.
     *
     * Exposed for the optional Markdown docs feature (hybrid search + the
     * governing-doc relevance gate), which queries the shared codegraph.db
     * directly. Returns the same live connection the code graph uses — callers
     * must NOT close it.
     */
    getDb() {
        return this.db.getDb();
    }
    // ===========================================================================
    // Indexing
    // ===========================================================================
    /**
     * Index all files in the project
     *
     * Uses a mutex to prevent concurrent indexing operations.
     */
    async indexAll(options = {}) {
        const operationStartedAt = Date.now();
        const provenanceRebuildReason = (0, provenance_1.getProvenanceRebuildReason)(this.db.getDb());
        return this.indexMutex.withLock(async () => {
            try {
                this.fileLock.acquire();
            }
            catch {
                return { success: false, filesIndexed: 0, filesSkipped: 0, filesErrored: 0, filesRemoved: 0, nodesCreated: 0, edgesCreated: 0, errors: [{ message: 'Could not acquire file lock - another process may be indexing', severity: 'error', code: 'lock_unavailable' }], durationMs: 0 };
            }
            try {
                if (options.force || (0, provenance_1.needsSourceParserRebuild)(this.db.getDb())) this.clear();
                await require('./resolution/incremental').recoverReferenceIntent(this.orchestrator, this.queries, this.db.getDb(), options.onProgress);
                const before = this.queries.getNodeAndEdgeCount();
                const result = await this.orchestrator.indexAll(options.onProgress, options.signal, options.verbose, {
                    respectGitignore: options.respectGitignore,
                });
                // Re-detect frameworks now that the index is populated. The resolver
                // is constructed with createResolver() before any files exist, so
                // framework resolvers whose detect() consults the indexed file list
                // (e.g. UIKit/SwiftUI scanning for imports, swift-objc-bridge looking
                // for both Swift and ObjC files) all return false on that initial pass
                // and silently drop themselves. Re-initializing here gives them a
                // chance to see the actual project before resolution runs.
                if (result.success && result.filesIndexed > 0) {
                    this.resolver.initialize();
                    // Cross-file finalization (e.g. NestJS RouterModule prefixes). Runs
                    // before resolution so updated names show up in subsequent reads.
                    this.resolver.runPostExtract();
                }
                // Resolve references to create call/import/extends edges
                if (result.success && result.filesIndexed > 0) {
                    // Get count without loading all refs into memory
                    const unresolvedCount = this.queries.getUnresolvedReferencesCount();
                    options.onProgress?.({
                        phase: 'resolving',
                        current: 0,
                        total: unresolvedCount,
                    });
                    await this.resolveReferencesBatched((current, total) => {
                        options.onProgress?.({
                            phase: 'resolving',
                            current,
                            total,
                        });
                    });
                }
                // Refresh planner stats + checkpoint the WAL after bulk writes.
                // Cheap and non-blocking; never load-bearing for correctness.
                if (result.success && result.filesIndexed > 0) {
                    this.db.runMaintenance();
                }
                // The orchestrator only sees extraction-phase counts; resolution and
                // synthesizer edges (often >50% of the graph on JVM repos) come later.
                // Recompute against the DB so the CLI summary reports the true totals.
                if (result.success && result.filesIndexed > 0) {
                    const after = this.queries.getNodeAndEdgeCount();
                    result.nodesCreated = after.nodes - before.nodes;
                    result.edgesCreated = after.edges - before.edges;
                }
                if (result.success) {
                    const visibleFiles = (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                    });
                    try {
                        const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                            respectGitignore: options.respectGitignore,
                            visibleFiles,
                        });
                        // Surface the summary to callers (CLI index/init reporting) only
                        // when the feature actually ran, so docs-off runs stay unchanged.
                        if (docs.enabled) {
                            result.docs = {
                                enabled: docs.enabled,
                                available: docs.available,
                                scanned: docs.scanned,
                                indexed: docs.indexed,
                                skipped: docs.skipped,
                                errors: docs.errors,
                            };
                            // Link governs edges: concept nodes now exist, resolve preserved refs.
                            // Barrier: no-op for projects without BLK markers or non-canonical docs.
                            try {
                                const governs = (0, governs_linker_1.linkGovernsEdges)(this.db.getDb(), this.queries);
                                if (governs.linked > 0)
                                    result.docs.governsLinked = governs.linked;
                            }
                            catch (error) {
                                result.errors.push({
                                    message: `Document governs linking failed: ${error instanceof Error ? error.message : String(error)}`,
                                    severity: 'warning',
                                    code: 'document_link',
                                });
                            }
                            // Markdown-graph totals (concept nodes + governs edges) for the CLI
                            // index/init summary, reported distinctly from the code node/edge
                            // counts. Best-effort: a count failure never breaks the code index.
                            try {
                                const md = this.queries.getMarkdownGraphCounts();
                                result.docs.conceptNodes = md.nodes;
                                result.docs.governsEdges = md.edges;
                            }
                            catch (error) {
                                result.errors.push({
                                    message: `Document graph count failed: ${error instanceof Error ? error.message : String(error)}`,
                                    severity: 'warning',
                                    code: 'document_link',
                                });
                            }
                            // Promote Obsidian/wiki doc_links into doc nodes + doc_link edges
                            // so callers/callees/impact follow them. Gated: pure-Markdown
                            // projects (or CODEGRAPH_DOC_GRAPH override) only — code projects
                            // get zero rows. Best-effort: never breaks the code index.
                            try {
                                const dl = (0, doc_links_linker_1.linkDocEdges)(this.db.getDb(), this.queries);
                                if (dl.nodes > 0)
                                    result.docs.docLinkNodes = dl.nodes;
                                if (dl.edges > 0)
                                    result.docs.docLinkEdges = dl.edges;
                            }
                            catch (error) {
                                result.errors.push({
                                    message: `Document link promotion failed: ${error instanceof Error ? error.message : String(error)}`,
                                    severity: 'warning',
                                    code: 'document_link',
                                });
                            }
                            for (const warning of docs.warnings) {
                                result.errors.push({ message: warning, severity: 'warning', code: 'document_index' });
                            }
                            for (const failure of docs.errors) {
                                result.errors.push({ ...failure, severity: 'error', code: 'document_index' });
                            }
                        }
                    }
                    catch (error) {
                        result.errors.push({
                            message: `Document indexing failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error',
                            code: 'document_index',
                        });
                    }
                    if ((0, semantic_edges_1.resolveSemanticEdgesEnabled)(this.db.getDb())) {
                        try {
                            result.semanticEdges = (0, semantic_edges_1.buildSemanticEdges)(this.db.getDb(), { enabled: true });
                            if (!result.semanticEdges.available) {
                                result.errors.push({
                                    message: `Semantic edge generation unavailable: ${result.semanticEdges.reason ?? 'unknown reason'}`,
                                    severity: 'warning',
                                    code: 'document_link',
                                });
                            }
                        }
                        catch (error) {
                            result.errors.push({
                                message: `Semantic edge generation failed: ${error instanceof Error ? error.message : String(error)}`,
                                severity: 'warning',
                                code: 'document_link',
                            });
                        }
                    }
                    try {
                        result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                            respectGitignore: options.respectGitignore,
                            visibleFiles,
                        });
                        if (result.inventory.byStatus.error > 0) {
                            result.errors.push({
                                message: `File inventory contains ${result.inventory.byStatus.error} error entries.`,
                                severity: 'warning',
                                code: 'file_inventory',
                            });
                        }
                    }
                    catch (error) {
                        result.errors.push({
                            message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error',
                            code: 'file_inventory',
                        });
                    }
                }
                result.indexHealth = (0, index_health_1.readIndexHealth)(this.db.getDb());
                result.success = result.success
                    && !result.errors.some(isSystemicError)
                    && result.indexHealth.queryErrors === 0;
                const rebuildComplete = result.success;
                if (rebuildComplete && provenanceRebuildReason) {
                    const db = this.db.getDb();
                    try {
                        db.prepare('DELETE FROM edges WHERE provenance IS NULL').run();
                        const remaining = db.prepare('SELECT COUNT(*) AS count FROM edges WHERE provenance IS NULL')
                            .get();
                        if (Number(remaining.count) !== 0)
                            throw new Error('Untagged edges remain after provenance rebuild');
                        (0, provenance_1.finishProvenanceRebuild)(db);
                    }
                    catch (error) {
                        result.success = false;
                        result.filesErrored++;
                        result.errors.push({
                            message: `Provenance rebuild publish failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error',
                            code: 'provenance_rebuild',
                        });
                    }
                }
                result.durationMs = Date.now() - operationStartedAt;
                return result;
            }
            finally {
                this.fileLock.release();
            }
        });
    }
    /**
     * Index specific files
     *
     * Uses a mutex to prevent concurrent indexing operations.
     */
    async indexFiles(filePaths) {
        return this.indexMutex.withLock(async () => {
            try {
                this.fileLock.acquire();
            }
            catch {
                return { success: false, filesIndexed: 0, filesSkipped: 0, filesErrored: 0, filesRemoved: 0, nodesCreated: 0, edgesCreated: 0, errors: [{ message: 'Could not acquire file lock - another process may be indexing', severity: 'error' }], durationMs: 0 };
            }
            try {
                return this.orchestrator.indexFiles(filePaths);
            }
            finally {
                this.fileLock.release();
            }
        });
    }
    /**
     * Sync with current file state (incremental update)
     *
     * Uses a mutex to prevent concurrent indexing operations.
     */
    async sync(options = {}) {
        const operationStartedAt = Date.now();
        const provenanceRebuildReason = (0, provenance_1.getProvenanceRebuildReason)(this.db.getDb());
        if (provenanceRebuildReason) {
            const rebuilt = await this.indexAll(options);
            if (rebuilt.errors.some((entry) => entry.code === 'lock_unavailable')) {
                return {
                    status: 'blocked',
                    filesChecked: 0,
                    filesAdded: 0,
                    filesModified: 0,
                    filesRemoved: 0,
                    nodesUpdated: 0,
                    durationMs: Date.now() - operationStartedAt,
                    warnings: [`Required full graph rebuild (${provenanceRebuildReason}) is running in another process; graph freshness is unknown.`],
                };
            }
            const markerCleared = (0, provenance_1.getProvenanceRebuildReason)(this.db.getDb()) === null;
            const warnings = rebuilt.errors.map((entry) => entry.message);
            if (!markerCleared) {
                warnings.unshift(`Required full graph rebuild failed (${provenanceRebuildReason}); the rebuild marker was preserved.`);
            }
            const current = markerCleared && rebuilt.success;
            return {
                status: current ? 'current' : 'failed',
                filesChecked: rebuilt.filesIndexed + rebuilt.filesSkipped + rebuilt.filesErrored,
                filesAdded: 0,
                filesModified: rebuilt.filesIndexed,
                filesRemoved: rebuilt.filesRemoved,
                nodesUpdated: rebuilt.nodesCreated,
                durationMs: Date.now() - operationStartedAt,
                docsUpdated: rebuilt.docs?.indexed,
                errors: rebuilt.errors.length > 0 ? rebuilt.errors : undefined,
                warnings: warnings.length > 0 ? [...new Set(warnings)] : undefined,
                inventory: rebuilt.inventory,
                semanticEdges: rebuilt.semanticEdges,
                indexHealth: rebuilt.indexHealth,
            };
        }
        return this.indexMutex.withLock(async () => {
            try {
                this.fileLock.acquire();
            }
            catch {
                return {
                    status: 'blocked',
                    filesChecked: 0,
                    filesAdded: 0,
                    filesModified: 0,
                    filesRemoved: 0,
                    nodesUpdated: 0,
                    durationMs: 0,
                    warnings: ['Could not acquire file lock; graph freshness is unknown.'],
                };
            }
            try {
                await require('./resolution/incremental').recoverReferenceIntent(this.orchestrator, this.queries, this.db.getDb(), options.onProgress);
                this.queries.beginReferenceUpdate();
                const result = await this.orchestrator.sync(options.onProgress, {
                    respectGitignore: options.respectGitignore,
                });
                // Cross-file finalization (e.g. NestJS RouterModule prefixes). Run on
                // every sync that touched files so edits to `app.module.ts` propagate
                // to controllers in unchanged files. The pass is idempotent and cheap
                // (regex over *.module.ts only).
                if (result.filesAdded > 0 || result.filesModified > 0) {
                    this.resolver.runPostExtract();
                }
                if (result.filesAdded > 0 || result.filesModified > 0 || result.filesRemoved > 0) {
                    this.resolver.clearCaches();
                    const { referenceKey } = require('./resolution/incremental');
                    const changedNames = this.queries.takeChangedSymbolNames();
                    const files = [...new Set([...(result.changedFilePaths ?? []), ...this.queries.takeInvalidatedReferenceFiles()])];
                    const candidates = [
                        ...this.queries.getUnresolvedReferencesByFiles(files),
                        ...this.queries.getUnresolvedReferencesMatchingSymbols(changedNames),
                    ];
                    const unresolvedRefs = [...new Map(candidates.map(ref => [referenceKey(ref), ref])).values()];
                    options.onProgress?.({
                        phase: 'resolving',
                        current: 0,
                        total: unresolvedRefs.length,
                    });
                    this.resolver.resolveAndPersist(unresolvedRefs, (current, total) => {
                        options.onProgress?.({
                            phase: 'resolving',
                            current,
                            total,
                        });
                    });
                }
                // Re-link governs edges: code changes may create new governs refs.
                // Concept nodes persist from the last full index (or indexMarkdown run).
                // Barrier: no-op for projects without BLK markers — returns {0,0} immediately.
                if (result.filesAdded > 0 || result.filesModified > 0) {
                    try {
                        (0, governs_linker_1.linkGovernsEdges)(this.db.getDb(), this.queries);
                    }
                    catch (error) {
                        result.warnings = [...(result.warnings ?? []),
                            `Document governs relink failed: ${error instanceof Error ? error.message : String(error)}`];
                    }
                    // Re-promote doc_links after edits (gated; no-op on code projects).
                    try {
                        (0, doc_links_linker_1.linkDocEdges)(this.db.getDb(), this.queries);
                    }
                    catch (error) {
                        result.warnings = [...(result.warnings ?? []),
                            `Document link relink failed: ${error instanceof Error ? error.message : String(error)}`];
                    }
                }
                // Refresh planner stats + checkpoint the WAL after bulk writes.
                if (result.filesAdded > 0 || result.filesModified > 0 || result.filesRemoved > 0) {
                    this.db.runMaintenance();
                }
                const visibleFiles = (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                    respectGitignore: options.respectGitignore,
                });
                try {
                    const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                    });
                    // New/updated concept nodes — re-link governs + doc edges so
                    // callers/impact follow them. Skipped when nothing was (re)indexed.
                    if (docs.enabled && docs.indexed > 0) {
                        try {
                            (0, governs_linker_1.linkGovernsEdges)(this.db.getDb(), this.queries);
                        }
                        catch (error) {
                            result.warnings = [...(result.warnings ?? []),
                                `Document governs linking failed: ${error instanceof Error ? error.message : String(error)}`];
                        }
                        try {
                            (0, doc_links_linker_1.linkDocEdges)(this.db.getDb(), this.queries);
                        }
                        catch (error) {
                            result.warnings = [...(result.warnings ?? []),
                                `Document link promotion failed: ${error instanceof Error ? error.message : String(error)}`];
                        }
                    }
                    result.docsUpdated = docs.indexed + docs.removed;
                    if (docs.changedPaths.length > 0)
                        result.docPaths = docs.changedPaths;
                    if (docs.warnings.length > 0) {
                        result.warnings = [...new Set([...(result.warnings ?? []), ...docs.warnings])];
                    }
                    if (docs.errors.length > 0) {
                        result.errors = [...(result.errors ?? []),
                            ...docs.errors.map((failure) => ({ ...failure, severity: 'error', code: 'document_index' }))];
                    }
                }
                catch (error) {
                    result.errors = [...(result.errors ?? []), {
                        message: `Document indexing failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error', code: 'document_index',
                    }];
                }
                if ((0, semantic_edges_1.resolveSemanticEdgesEnabled)(this.db.getDb())) {
                    try {
                        result.semanticEdges = (0, semantic_edges_1.buildSemanticEdges)(this.db.getDb(), { enabled: true });
                        if (!result.semanticEdges.available) {
                            result.warnings = [...(result.warnings ?? []),
                                `Semantic edge generation unavailable: ${result.semanticEdges.reason ?? 'unknown reason'}`];
                        }
                    }
                    catch (error) {
                        result.warnings = [...(result.warnings ?? []),
                            `Semantic edge generation failed: ${error instanceof Error ? error.message : String(error)}`,
                        ];
                    }
                }
                try {
                    result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                    });
                    if (result.inventory.byStatus.error > 0) {
                        result.warnings = [...(result.warnings ?? []),
                            `File inventory contains ${result.inventory.byStatus.error} error entries.`];
                    }
                }
                catch (error) {
                    result.errors = [...(result.errors ?? []), {
                        message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error', code: 'file_inventory',
                    }];
                }
                result.indexHealth = (0, index_health_1.readIndexHealth)(this.db.getDb());
                if (!result.indexHealth.healthy)
                    result.warnings = [...(result.warnings ?? []), ...result.indexHealth.warnings];
                if (result.warnings)
                    result.warnings = [...new Set(result.warnings)];
                result.status = !(result.errors ?? []).some(isSystemicError)
                    && result.indexHealth.queryErrors === 0
                    ? 'current'
                    : 'failed';
                result.durationMs = Date.now() - operationStartedAt;
                return result;
            }
            finally {
                this.fileLock.release();
            }
        });
    }
    /**
     * Check if an indexing operation is currently in progress
     */
    isIndexing() {
        return this.indexMutex.isLocked();
    }
    // ===========================================================================
    // File Watching
    // ===========================================================================
    /**
     * Start watching for file changes and auto-syncing.
     *
     * Uses native OS file events (FSEvents on macOS, inotify on Linux 19+,
     * ReadDirectoryChangesW on Windows) with debouncing to avoid thrashing.
     *
     * @param options - Watch options (debounce delay, callbacks)
     * @returns true if watching started successfully
     */
    watch(options = {}) {
        if (this.watcher?.isActive())
            return true;
        // Resolve the docs opt-in once at watch start so the watcher lets .md edits
        // through (docs-on only — a no-op gate otherwise, avoiding a full reconcile
        // sync per Markdown edit). Re-enabling docs after watch starts needs a
        // re-watch, same as respectGitignore.
        const docsEnabled = (0, config_1.resolveDocsEnabled)(this.db.getDb());
        this.watcher = new sync_1.FileWatcher(this.projectRoot, async () => {
            const result = await this.sync({ respectGitignore: options.respectGitignore });
            if (result.status === 'blocked') {
                throw new sync_1.LockUnavailableError();
            }
            if (result.status === 'failed') {
                throw new Error(summarizeFailure([...(result.errors ?? []).map(error => error.message), ...(result.warnings ?? [])]) || 'Incremental reconciliation failed');
            }
            const filesChanged = result.filesAdded + result.filesModified + result.filesRemoved;
            return { filesChanged, durationMs: result.durationMs, warnings: result.warnings ?? [] };
        }, { ...options, docsEnabled });
        return this.watcher.start();
    }
    /**
     * Stop watching for file changes.
     */
    unwatch() {
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
    }
    /**
     * Check if the file watcher is active.
     */
    isWatching() {
        return this.watcher?.isActive() ?? false;
    }
    /**
     * Files seen by the file watcher since the last successful sync —
     * the per-file "stale" signal clients can attach to responses so an agent
     * can fall back to {@link Read} for just the affected file without
     * waiting for a debounced sync to complete (issue #403).
     *
     * Returns an empty list when the watcher isn't active, or no events have
     * arrived. Each entry includes `firstSeenMs` and `lastSeenMs` (wall-clock
     * `Date.now()` values) so callers can render "edited Nms ago", plus an
     * `indexing` flag indicating whether the in-flight sync (if any) will
     * absorb that file.
     */
    getPendingFiles() {
        return this.watcher?.getPendingFiles() ?? [];
    }
    /**
     * Resolves once the file watcher has finished its initial chokidar scan.
     * Useful for tests that need a deterministic boundary before asserting on
     * `getPendingFiles()`. Resolves immediately when no watcher is active.
     */
    waitUntilWatcherReady(timeoutMs) {
        return this.watcher ? this.watcher.waitUntilReady(timeoutMs) : Promise.resolve();
    }
    /**
     * Get files that have changed since last index
     */
    getChangedFiles() {
        return this.orchestrator.getChangedFiles();
    }
    /**
     * Extract nodes and edges from source code (without storing)
     */
    extractFromSource(filePath, source) {
        return (0, extraction_1.extractFromSource)(filePath, source);
    }
    // ===========================================================================
    // Reference Resolution
    // ===========================================================================
    /**
     * Resolve unresolved references and create edges
     *
     * This method takes unresolved references from extraction and attempts
     * to resolve them using multiple strategies:
     * - Framework-specific patterns (React, Express, Laravel)
     * - Import-based resolution
     * - Name-based symbol matching
     */
    resolveReferences(onProgress) {
        // Get all unresolved references from the database
        const unresolvedRefs = this.queries.getUnresolvedReferences();
        return this.resolver.resolveAndPersist(unresolvedRefs, onProgress);
    }
    /**
     * Resolve references in batches to keep memory bounded on large codebases.
     * Processes chunks of unresolved refs, persisting results after each batch.
     */
    async resolveReferencesBatched(onProgress) {
        return this.resolver.resolveAndPersistBatched(onProgress);
    }
    /**
     * Get detected frameworks in the project
     */
    getDetectedFrameworks() {
        return this.resolver.getDetectedFrameworks();
    }
    /**
     * Re-initialize the resolver (useful after adding new files)
     */
    reinitializeResolver() {
        this.resolver.initialize();
    }
    // ===========================================================================
    // Graph Statistics
    // ===========================================================================
    /**
     * Get statistics about the knowledge graph
     */
    getStats() {
        const stats = this.queries.getStats();
        stats.dbSizeBytes = this.db.getSize();
        return stats;
    }
    getFileInventorySummary() {
        return (0, inventory_1.getFileInventorySummary)(this.db.getDb());
    }
    /**
     * Active SQLite backend for this project's connection (`node-sqlite` — Node's
     * built-in real-SQLite module). Surfaced via `codegraph status` and the
     * CLI status output alongside the effective journal mode.
     */
    getBackend() {
        return this.db.getBackend();
    }
    /**
     * The journal mode actually in effect ('wal', 'delete', …). 'wal' means
     * readers never block on a concurrent writer; anything else means they can,
     * which is the precondition for the "database is locked" failures in issue
     * #238. Surfaced via `codegraph status`.
     */
    getJournalMode() {
        return this.db.getJournalMode();
    }
    // ===========================================================================
    // Node Operations
    // ===========================================================================
    /**
     * Get a node by ID
     */
    getNode(id) {
        return this.queries.getNodeById(id);
    }
    /**
     * Get all nodes in a file
     */
    getNodesInFile(filePath) {
        return this.queries.getNodesByFile(filePath);
    }
    /**
     * Get all nodes of a specific kind
     */
    getNodesByKind(kind) {
        return this.queries.getNodesByKind(kind);
    }
    /** Get every indexed node for bounded whole-graph analysis. */
    getAllNodes() {
        return this.queries.getAllNodes();
    }
    /**
     * Read a consistent whole-graph snapshot without allocating beyond the
     * caller's declared node/edge limits.
     */
    getGraphSnapshot(maxNodes, maxEdges) {
        return this.db.getDb().transaction(() => {
            const counts = this.queries.getNodeAndEdgeCount();
            if (counts.nodes > maxNodes || counts.edges > maxEdges) {
                return { nodeCount: counts.nodes, edgeCount: counts.edges, nodes: [], edges: [] };
            }
            return {
                nodeCount: counts.nodes,
                edgeCount: counts.edges,
                nodes: this.queries.getAllNodes(),
                edges: this.queries.getAllEdges(),
            };
        })();
    }
    /**
     * Search nodes by text
     */
    searchNodes(query, options) {
        return this.queries.searchNodes(query, options);
    }
    /**
     * Find the project's "primary route file" — the file with the densest
     * concentration of framework-emitted `route` nodes (≥3 routes, ≥30%
     * of all non-test routes). Used to inline the routing config in
     * `codegraph_context` responses on small realworld template repos
     * (rails-realworld, laravel-realworld, drupal-admintoolbar, …) where
     * Glob+Read of `routes.rb`/`urls.py`/etc. otherwise beats codegraph.
     */
    getTopRouteFile() {
        return this.queries.getTopRouteFile();
    }
    /**
     * Build a URL → handler routing manifest from the index. Each entry
     * pairs a route node (URL + method) with its handler function/method
     * via the `references` edge that framework resolvers emit. Returns
     * null when fewer than 3 valid (non-test) routes exist.
     */
    getRoutingManifest(limit) {
        return this.queries.getRoutingManifest(limit);
    }
    // ===========================================================================
    // Edge Operations
    // ===========================================================================
    /**
     * Get outgoing edges from a node
     */
    getOutgoingEdges(nodeId) {
        return this.queries.getOutgoingEdges(nodeId);
    }
    /**
     * Get incoming edges to a node
     */
    getIncomingEdges(nodeId) {
        return this.queries.getIncomingEdges(nodeId);
    }
    /** Get every indexed edge for bounded whole-graph analysis. */
    getAllEdges() {
        return this.queries.getAllEdges();
    }
    // ===========================================================================
    // File Operations
    // ===========================================================================
    /**
     * Get a file record by path
     */
    getFile(filePath) {
        return this.queries.getFileByPath(filePath);
    }
    /**
     * Get all tracked files
     */
    getFiles() {
        return this.queries.getAllFiles();
    }
    // ===========================================================================
    // Graph Query Methods
    // ===========================================================================
    /**
     * Get the context for a node (ancestors, children, references)
     *
     * Returns comprehensive context about a node including its containment
     * hierarchy, children, incoming/outgoing references, type information,
     * and relevant imports.
     *
     * @param nodeId - ID of the focal node
     * @returns Context object with all related information
     */
    getContext(nodeId) {
        return this.graphManager.getContext(nodeId);
    }
    /**
     * Traverse the graph from a starting node
     *
     * Uses breadth-first search by default. Supports filtering by edge types,
     * node types, and traversal direction.
     *
     * @param startId - Starting node ID
     * @param options - Traversal options
     * @returns Subgraph containing traversed nodes and edges
     */
    traverse(startId, options) {
        return this.traverser.traverseBFS(startId, options);
    }
    /**
     * Get the call graph for a function
     *
     * Returns both callers (functions that call this function) and
     * callees (functions called by this function) up to the specified depth.
     *
     * @param nodeId - ID of the function/method node
     * @param depth - Maximum depth in each direction (default: 2)
     * @returns Subgraph containing the call graph
     */
    getCallGraph(nodeId, depth = 2) {
        return this.traverser.getCallGraph(nodeId, depth);
    }
    /**
     * Get the type hierarchy for a class/interface
     *
     * Returns both ancestors (types this extends/implements) and
     * descendants (types that extend/implement this).
     *
     * @param nodeId - ID of the class/interface node
     * @returns Subgraph containing the type hierarchy
     */
    getTypeHierarchy(nodeId) {
        return this.traverser.getTypeHierarchy(nodeId);
    }
    /**
     * Find all usages of a symbol
     *
     * Returns all nodes that reference the specified symbol through
     * any edge type (calls, references, type_of, etc.).
     *
     * @param nodeId - ID of the symbol node
     * @returns Array of nodes and edges that reference this symbol
     */
    findUsages(nodeId) {
        return this.traverser.findUsages(nodeId);
    }
    /**
     * Get callers of a function/method
     *
     * @param nodeId - ID of the function/method node
     * @param maxDepth - Maximum depth to traverse (default: 1)
     * @returns Array of nodes that call this function
     */
    getCallers(nodeId, maxDepth = 1) {
        return this.traverser.getCallers(nodeId, maxDepth);
    }
    /**
     * Get callees of a function/method
     *
     * @param nodeId - ID of the function/method node
     * @param maxDepth - Maximum depth to traverse (default: 1)
     * @returns Array of nodes called by this function
     */
    getCallees(nodeId, maxDepth = 1) {
        return this.traverser.getCallees(nodeId, maxDepth);
    }
    /**
     * Calculate the impact radius of a node
     *
     * Returns all nodes that could be affected by changes to this node.
     *
     * @param nodeId - ID of the node
     * @param maxDepth - Maximum depth to traverse (default: 3)
     * @returns Subgraph containing potentially impacted nodes
     */
    getImpactRadius(nodeId, maxDepth = 3) {
        return this.traverser.getImpactRadius(nodeId, maxDepth);
    }
    /**
     * Find the shortest path between two nodes
     *
     * @param fromId - Starting node ID
     * @param toId - Target node ID
     * @param edgeKinds - Edge types to consider (all if empty)
     * @returns Array of nodes and edges forming the path, or null if no path exists
     */
    findPath(fromId, toId, edgeKinds) {
        return this.traverser.findPath(fromId, toId, edgeKinds);
    }
    /**
     * Get ancestors of a node in the containment hierarchy
     *
     * @param nodeId - ID of the node
     * @returns Array of ancestor nodes from immediate parent to root
     */
    getAncestors(nodeId) {
        return this.traverser.getAncestors(nodeId);
    }
    /**
     * Get immediate children of a node
     *
     * @param nodeId - ID of the node
     * @returns Array of child nodes
     */
    getChildren(nodeId) {
        return this.traverser.getChildren(nodeId);
    }
    /**
     * Get dependencies of a file
     *
     * @param filePath - Path to the file
     * @returns Array of file paths this file depends on
     */
    getFileDependencies(filePath) {
        return this.graphManager.getFileDependencies(filePath);
    }
    /**
     * Get dependents of a file
     *
     * @param filePath - Path to the file
     * @returns Array of file paths that depend on this file
     */
    getFileDependents(filePath) {
        return this.graphManager.getFileDependents(filePath);
    }
    /**
     * Find circular dependencies in the codebase
     *
     * @returns Array of cycles, each cycle is an array of file paths
     */
    findCircularDependencies() {
        return this.graphManager.findCircularDependencies();
    }
    /**
     * Find dead code (unreferenced symbols)
     *
     * @param kinds - Node kinds to check (default: functions, methods, classes)
     * @returns Array of unreferenced nodes
     */
    findDeadCode(kinds) {
        return this.graphManager.findDeadCode(kinds);
    }
    /**
     * Get complexity metrics for a node
     *
     * @param nodeId - ID of the node
     * @returns Object containing various complexity metrics
     */
    getNodeMetrics(nodeId) {
        return this.graphManager.getNodeMetrics(nodeId);
    }
    // ===========================================================================
    // Context Building
    // ===========================================================================
    /**
     * Get the source code for a node
     *
     * Reads the file and extracts the code between startLine and endLine.
     *
     * @param nodeId - ID of the node
     * @returns Code string or null if not found
     */
    async getCode(nodeId) {
        return this.contextBuilder.getCode(nodeId);
    }
    /**
     * Find relevant subgraph for a query
     *
     * Combines semantic search with graph traversal to find the most
     * relevant nodes and their relationships for a given query.
     *
     * @param query - Natural language query describing the task
     * @param options - Search and traversal options
     * @returns Subgraph of relevant nodes and edges
     */
    async findRelevantContext(query, options) {
        return this.contextBuilder.findRelevantContext(query, options);
    }
    /**
     * Build context for a task
     *
     * Creates comprehensive context by:
     * 1. Running FTS search to find entry points
     * 2. Expanding the graph around entry points
     * 3. Extracting code blocks for key nodes
     * 4. Formatting output for Claude
     *
     * @param input - Task description (string or {title, description})
     * @param options - Build options (maxNodes, includeCode, format, etc.)
     * @returns TaskContext object or formatted string (markdown/JSON)
     */
    async buildContext(input, options) {
        return this.contextBuilder.buildContext(input, options);
    }
    // ===========================================================================
    // Database Management
    // ===========================================================================
    /**
     * Optimize the database (vacuum and analyze)
     */
    optimize() {
        this.db.optimize();
    }
    /**
     * Clear all data from the graph
     */
    clear() {
        this.queries.clear();
    }
    /**
     * Alias for close() for backwards compatibility.
     * @deprecated Use close() instead
     */
    destroy() {
        this.close();
    }
    /**
     * Completely remove CodeGraph from the project.
     * This closes the database and deletes the .CodeGraph directory.
     *
     * WARNING: This permanently deletes all CodeGraph data for the project.
     */
    uninitialize() {
        this.close();
        (0, directory_1.removeDirectory)(this.projectRoot);
    }
}
exports.CodeGraph = CodeGraph;
// Default export
exports.default = CodeGraph;
//# sourceMappingURL=index.js.map
