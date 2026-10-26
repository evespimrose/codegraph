/**
 * Extraction Orchestrator
 *
 * Coordinates file scanning, parsing, and database storage.
 */
import * as fs from 'fs';
import { ExtractionResult, ExtractionError } from '../types';
import { QueryBuilder } from '../db/queries';
import { Ignore } from 'ignore';
/**
 * Progress callback for indexing operations
 */
export interface IndexProgress {
    phase: 'scanning' | 'parsing' | 'storing' | 'resolving' | 'references-recovery';
    current: number;
    total: number;
    currentFile?: string;
}
/**
 * Result of an indexing operation
 */
export interface IndexResult {
    success: boolean;
    filesIndexed: number;
    filesSkipped: number;
    filesErrored: number;
    filesRemoved: number;
    nodesCreated: number;
    edgesCreated: number;
    errors: ExtractionError[];
    durationMs: number;
    inventory?: import('../inventory').FileInventoryResult;
    indexHealth?: import('../inventory/health').IndexHealth;
    semanticEdges?: import('../docs/semantic-edges').SemanticEdgeResult;
    /**
     * Markdown docs indexing summary — present only when the opt-in docs feature
     * actually ran (enabled). Undefined on code-only / docs-off runs, so the
     * default output is unchanged.
     */
    docs?: {
        enabled: boolean;
        available: boolean;
        scanned: number;
        indexed: number;
        skipped: number;
        errors?: Array<{ filePath: string; message: string }>;
        /** governs edges created by linkGovernsEdges after indexMarkdown */
        governsLinked?: number;
        /**
         * Total `concept` nodes in the markdown graph after this index (not the
         * delta). Surfaced so the CLI can report markdown nodes distinctly from
         * code nodes.
         */
        conceptNodes?: number;
        /**
         * Total `governs` edges in the markdown graph after this index (not the
         * delta). Reported alongside conceptNodes, distinct from code edges.
         */
        governsEdges?: number;
        /** `doc` nodes promoted from Markdown files by linkDocEdges (pure-MD / override). */
        docLinkNodes?: number;
        /** `doc_link` edges (citing → cited) created by linkDocEdges. */
        docLinkEdges?: number;
    };
}
/**
 * Result of a sync operation
 */
export interface SyncResult {
    /** Whether the graph was refreshed successfully and is safe for derived publication. */
    status?: 'current' | 'blocked' | 'failed';
    filesChecked: number;
    filesAdded: number;
    filesModified: number;
    filesRemoved: number;
    nodesUpdated: number;
    durationMs: number;
    changedFilePaths?: string[];
    docsUpdated?: number;
    docPaths?: string[];
    errors?: ExtractionError[];
    warnings?: string[];
    inventory?: import('../inventory').FileInventoryResult;
    indexHealth?: import('../inventory/health').IndexHealth;
    semanticEdges?: import('../docs/semantic-edges').SemanticEdgeResult;
}
/**
 * Calculate SHA256 hash of file contents
 */
export declare function hashContent(content: string): string;
/**
 * An `ignore` matcher seeded with the built-in defaults, then layered with the
 * project's root `.gitignore` (a negation there like `!vendor/` overrides a
 * default) and finally the root `.codegraphignore` — an *additive* exclude layer
 * in identical gitignore syntax, merged into the same matcher so it's a union
 * (anything matched by either file is excluded). It is added last, so last-match-
 * wins lets it also negation-override an earlier rule. Shared by both enumeration
 * paths so behavior is identical with or without git — and so the defaults apply
 * to tracked files too (committing a dependency dir doesn't make it project code;
 * the explicit negation is the only opt-in).
 *
 * `opts.respectGitignore` (default true): when `false`, the root `.gitignore` is
 * NOT merged — only the built-in defaults plus `.codegraphignore` apply.
 * `.codegraphignore` is always honored regardless of this flag.
 */
export declare function buildDefaultIgnore(rootDir: string, opts?: {
    respectGitignore?: boolean;
}): Ignore;
/**
 * Recursively scan a directory for source files.
 *
 * In git repos, uses `git ls-files` (inherently respects .gitignore at all
 * levels), then keeps files with a supported source extension. For non-git
 * projects, falls back to a filesystem walk that parses .gitignore itself.
 */
/**
 * Options shared by the directory scanners and the file watcher.
 */
export interface ScanOptions {
    /**
     * When `false`, the project's root `.gitignore` is NOT consulted (built-in
     * defaults and `.codegraphignore` still apply). Default `true`. On the git
     * fast path this only relaxes the post-filter — `git ls-files` itself still
     * honors .gitignore (re-including git-ignored files is out of scope, §1.3-C).
     */
    respectGitignore?: boolean;
}
export declare function scanDirectory(rootDir: string, onProgress?: (current: number, file: string) => void, opts?: ScanOptions): string[];
/**
 * Async variant of scanDirectory that yields to the event loop periodically,
 * allowing worker threads to receive and render progress messages.
 */
export declare function scanDirectoryAsync(rootDir: string, onProgress?: (current: number, file: string) => void, opts?: ScanOptions): Promise<string[]>;
/**
 * Extraction orchestrator
 */
export declare class ExtractionOrchestrator {
    private rootDir;
    private queries;
    /**
     * Names of frameworks detected for this project, populated by indexAll().
     * Passed to extractFromSource so framework-specific extractors (route nodes,
     * middleware, etc.) run after the tree-sitter pass. Cleared if detection
     * hasn't run yet so single-file re-index paths can detect on the spot.
     */
    private detectedFrameworkNames;
    constructor(rootDir: string, queries: QueryBuilder);
    /**
     * Build a filesystem-backed ResolutionContext sufficient for framework
     * detection. Graph-query methods (getNodesByName etc.) return empty because
     * the DB hasn't been populated yet, but detect() only uses readFile,
     * fileExists, and getAllFiles, so that's fine.
     */
    private buildDetectionContext;
    /**
     * Detect frameworks on demand using the current scanned files (or a fresh
     * scan if none are provided). Cached on the orchestrator so repeat calls
     * inside a single run don't re-scan.
     */
    private ensureDetectedFrameworks;
    /**
     * Index all files in the project
     */
    indexAll(onProgress?: (progress: IndexProgress) => void, signal?: AbortSignal, verbose?: boolean, scanOpts?: ScanOptions): Promise<IndexResult>;
    /**
     * Index specific files
     */
    indexFiles(filePaths: string[]): Promise<IndexResult>;
    /**
     * Index a single file
     */
    indexFile(relativePath: string): Promise<ExtractionResult>;
    /**
     * Index a single file with pre-read content and stats.
     * Used by the parallel batch reader to avoid redundant file I/O.
     */
    indexFileWithContent(relativePath: string, content: string, stats: fs.Stats): Promise<ExtractionResult>;
    /**
     * Store extraction result in database
     */
    private storeExtractionResult;
    /**
     * Sync the index with the current file state.
     *
     * Change detection is filesystem-based, never git: a (size, mtime) stat
     * pre-filter skips unchanged files, then a content-hash compare confirms real
     * changes. This works in non-git projects and catches committed changes from
     * `git pull`/`checkout`/`merge`/`rebase` that `git status` cannot see.
     */
    sync(onProgress?: (progress: IndexProgress) => void, scanOpts?: ScanOptions): Promise<SyncResult>;
    /**
     * Get files that have changed since last index.
     * Uses git status as a fast path when available, falling back to full scan.
     */
    getChangedFiles(): {
        added: string[];
        modified: string[];
        removed: string[];
    };
}
export { extractFromSource } from './tree-sitter';
export { detectLanguage, isSourceFile, isLanguageSupported, isGrammarLoaded, getSupportedLanguages, initGrammars, loadGrammarsForLanguages, loadAllGrammars } from './grammars';
//# sourceMappingURL=index.d.ts.map
