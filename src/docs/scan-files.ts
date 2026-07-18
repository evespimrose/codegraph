/**
 * Markdown file discovery for the docs indexer.
 *
 * The code scanner (scanDirectory) filters to *source* files and drops
 * Markdown, so the docs feature needs its own .md lister. Mirrors the code
 * scanner's git-first strategy: `git ls-files` respects .gitignore at every
 * level; a non-git project falls back to a bounded filesystem walk.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { Ignore } from 'ignore';
import { buildDefaultIgnore, type ScanOptions } from '../extraction/index';

const MD_EXT = /\.(md|markdown|mdx)$/i;

/**
 * Whether a path is a Markdown file the docs indexer picks up
 * (.md / .markdown / .mdx). Single source of truth shared with the file
 * watcher's watch gate, so the gate and `listMarkdownFiles` can never disagree
 * on what counts as Markdown.
 */
export function isMarkdownFile(filePath: string): boolean {
  return MD_EXT.test(filePath);
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.codegraph', 'dist', 'build', '.next', 'out', 'coverage',
]);

/** Absolute paths of Markdown files under root, respecting .gitignore when possible. */
export function listMarkdownFiles(root: string, opts?: ScanOptions): string[] {
  // Apply the same ignore matcher the code scanner uses. With respectGitignore
  // false it drops root .gitignore (built-in defaults + .codegraphignore only),
  // so .codegraphignore acts as an independent spec, not an additive layer.
  const ig = buildDefaultIgnore(root, opts);
  // --no-gitignore: skip the git fast path entirely — `git ls-files` always
  // honors .gitignore at the git level, so a git-ignored doc dir (e.g. an
  // ignored docs/) would never be listed and could not be re-included. Walk the
  // filesystem instead, pruning via the matcher. Otherwise prefer git.
  const found = opts?.respectGitignore === false
    ? walkMarkdown(root, ig)
    : (gitMarkdownFiles(root) ?? walkMarkdown(root, ig));
  return found.filter((abs) => {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    return rel !== '' && !rel.startsWith('..') && !ig.ignores(rel);
  });
}

function gitMarkdownFiles(root: string): string[] | null {
  try {
    // --cached + --others --exclude-standard = tracked AND untracked-not-ignored,
    // matching what the code scanner considers "visible".
    // -c core.quotepath=false: emit non-ASCII paths as-is instead of \octal escapes.
    // -z: NUL-terminated output so paths with any whitespace are safe.
    // windowsHide: Windows 11 hands the allocated console to the default
    // terminal, so without it every scan pops a window and steals focus.
    const out = execFileSync(
      'git',
      ['-C', root, '-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    );
    const files: string[] = [];
    for (const rel of out.split('\0')) {
      const trimmed = rel.trim();
      if (trimmed && MD_EXT.test(trimmed)) files.push(path.resolve(root, trimmed));
    }
    // Dedup (a path can appear in both cached and others lists in edge cases).
    return [...new Set(files)];
  } catch {
    return null; // not a git repo / git unavailable
  }
}

function walkMarkdown(root: string, ig?: Ignore): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        // Prune directories the matcher excludes (built-in defaults +
        // .codegraphignore) so a large vendored tree like Unity's Library/ isn't
        // walked in full just to be dropped by the post-filter. (Only matters on
        // the --no-gitignore walk path, where git isn't doing the pruning.)
        if (ig) {
          const rel = path.relative(root, full).split(path.sep).join('/');
          if (rel && ig.ignores(rel + '/')) continue;
        }
        stack.push(full);
      } else if (e.isFile() && MD_EXT.test(e.name)) {
        files.push(full);
      }
    }
  }
  return files;
}
