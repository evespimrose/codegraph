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
exports.isMarkdownFile = isMarkdownFile;
exports.listMarkdownFiles = listMarkdownFiles;
exports.listVisibleFiles = listVisibleFiles;
exports.listTextDocumentFiles = listTextDocumentFiles;
exports.classifyTextDocument = classifyTextDocument;
exports.detectDocumentFormat = detectDocumentFormat;
exports.isSecretPath = isSecretPath;
/**
 * Markdown file discovery for the docs indexer.
 *
 * The code scanner (scanDirectory) filters to *source* files and drops
 * Markdown, so the docs feature needs its own .md lister. Mirrors the code
 * scanner's git-first strategy: `git ls-files` respects .gitignore at every
 * level; a non-git project falls back to a bounded filesystem walk.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const index_1 = require("../extraction/index");
const grammars_1 = require("../extraction/grammars");
const utils_1 = require("../utils");
const MD_EXT = /\.(md|markdown|mdx)$/i;
const HTML_EXT = /\.(html?|xhtml)$/i;
const STRUCTURED_EXT = /\.(jsonc?|ya?ml|toml|xml|ini|cfg|conf|csv|tsv)$/i;
const TEXT_EXT = /\.(txt|rst|adoc|org|log)$/i;
const DSL_EXT = /\.ptn$/i;
const MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024;
const SECRET_PATH = /(?:^|\/)(?:(?:\.ssh|\.aws|\.azure|\.kube)(?:\/|$)|(?:\.env(?:\.|$)|\.(?:npmrc|pypirc|netrc|git-credentials)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|[^/]*(?:credential|secret|private[-_.]?key)[^/]*|[^/]+\.(?:pem|p12|pfx|key|jks|keystore))$)/i;
/**
 * Whether a path is a Markdown file the docs indexer picks up
 * (.md / .markdown / .mdx). Single source of truth shared with the file
 * watcher's watch gate, so the gate and `listMarkdownFiles` can never disagree
 * on what counts as Markdown.
 */
function isMarkdownFile(filePath) {
    return MD_EXT.test(filePath);
}
const SKIP_DIRS = new Set([
    '.git', '.codegraph',
]);
/** Absolute paths of Markdown files under root, respecting .gitignore when possible. */
function listMarkdownFiles(root, opts) {
    return listVisibleFiles(root, opts).filter((absolutePath) => MD_EXT.test(absolutePath));
}
function listVisibleFiles(root, opts) {
    // Apply the same ignore matcher the code scanner uses. With respectGitignore
    // false it drops root .gitignore (built-in defaults + .codegraphignore only),
    // so .codegraphignore acts as an independent spec, not an additive layer.
    const ig = (0, index_1.buildDefaultIgnore)(root, opts);
    // --no-gitignore: skip the git fast path entirely — `git ls-files` always
    // honors .gitignore at the git level, so a git-ignored doc dir (e.g. an
    // ignored docs/) would never be listed and could not be re-included. Walk the
    // filesystem instead, pruning via the matcher. Otherwise prefer git.
    const found = opts?.respectGitignore === false
        ? walkVisibleFiles(root, ig)
        : (gitVisibleFiles(root) ?? walkVisibleFiles(root, ig));
    return found.filter((abs) => {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        return rel !== '' && !rel.startsWith('..') && !ig.ignores(rel);
    });
}
function listTextDocumentFiles(root, opts, visibleFiles) {
    const files = [];
    for (const absolutePath of visibleFiles ?? listVisibleFiles(root, opts)) {
        if (!(0, utils_1.isPathWithinRootReal)(absolutePath, root))
            continue;
        const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
        if (SECRET_PATH.test(relativePath))
            continue;
        if ((0, grammars_1.isSourceFile)(relativePath) && !DSL_EXT.test(relativePath))
            continue;
        const document = classifyTextDocument(absolutePath);
        if (document)
            files.push(document);
    }
    return files;
}
function classifyTextDocument(absolutePath) {
    const format = detectDocumentFormat(absolutePath);
    if (format) {
        return isLikelyTextFile(absolutePath)
            ? { absolutePath, format, mimeType: mimeFor(format) }
            : null;
    }
    return isLikelyTextFile(absolutePath)
        ? { absolutePath, format: 'text', mimeType: 'text/plain' }
        : null;
}
function detectDocumentFormat(filePath) {
    if (MD_EXT.test(filePath))
        return 'markdown';
    if (HTML_EXT.test(filePath))
        return 'html';
    if (STRUCTURED_EXT.test(filePath))
        return 'structured';
    if (DSL_EXT.test(filePath))
        return 'dsl';
    if (TEXT_EXT.test(filePath))
        return 'text';
    return null;
}
function isSecretPath(filePath) {
    return SECRET_PATH.test(filePath.replace(/\\/g, '/'));
}
function gitVisibleFiles(root) {
    let out;
    try {
        // --cached + --others --exclude-standard = tracked AND untracked-not-ignored,
        // matching what the code scanner considers "visible".
        // -c core.quotepath=false: emit non-ASCII paths as-is instead of \octal escapes.
        // -z: NUL-terminated output so paths with any whitespace are safe.
        // windowsHide: Windows 11 hands the allocated console to the default
        // terminal, so without it every scan pops a window and steals focus.
        out = (0, child_process_1.execFileSync)('git', ['-C', root, '-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    }
    catch {
        return null; // not a git repo / git unavailable
    }
    const files = [];
    for (const rel of out.split('\0')) {
        if (!rel)
            continue;
        const absolutePath = path.resolve(root, rel);
        try {
            if (fs.statSync(absolutePath).isFile())
                files.push(absolutePath);
        }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
                throw error;
        }
    }
    return [...new Set(files)];
}
function walkVisibleFiles(root, ig) {
    const files = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (SKIP_DIRS.has(e.name))
                    continue;
                // Prune directories the matcher excludes (built-in defaults +
                // .codegraphignore) so a large vendored tree like Unity's Library/ isn't
                // walked in full just to be dropped by the post-filter. (Only matters on
                // the --no-gitignore walk path, where git isn't doing the pruning.)
                if (ig) {
                    const rel = path.relative(root, full).split(path.sep).join('/');
                    if (rel && ig.ignores(rel + '/'))
                        continue;
                }
                stack.push(full);
            }
            else if (e.isFile()) {
                files.push(full);
            }
        }
    }
    return files;
}
function isLikelyTextFile(filePath) {
    let descriptor;
    try {
        const stat = fs.statSync(filePath);
        if (stat.size === 0 || stat.size > MAX_TEXT_FILE_BYTES)
            return false;
        descriptor = fs.openSync(filePath, 'r');
        const sample = Buffer.alloc(Math.min(stat.size, 8192));
        const bytes = fs.readSync(descriptor, sample, 0, sample.length, 0);
        let controlBytes = 0;
        for (let index = 0; index < bytes; index++) {
            const value = sample[index];
            if (value === 0)
                return false;
            if (value < 9 || (value > 13 && value < 32))
                controlBytes++;
        }
        return controlBytes / Math.max(1, bytes) < 0.02;
    }
    catch {
        return false;
    }
    finally {
        if (descriptor !== undefined)
            fs.closeSync(descriptor);
    }
}
function mimeFor(format) {
    if (format === 'markdown')
        return 'text/markdown';
    if (format === 'html')
        return 'text/html';
    if (format === 'structured')
        return 'application/structured+text';
    if (format === 'dsl')
        return 'text/x-ptn';
    return 'text/plain';
}
//# sourceMappingURL=scan-files.js.map