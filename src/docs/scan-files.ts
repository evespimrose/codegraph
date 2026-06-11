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

const MD_EXT = /\.(md|markdown|mdx)$/i;
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.codegraph', 'dist', 'build', '.next', 'out', 'coverage',
]);

/** Absolute paths of Markdown files under root, respecting .gitignore when possible. */
export function listMarkdownFiles(root: string): string[] {
  return gitMarkdownFiles(root) ?? walkMarkdown(root);
}

function gitMarkdownFiles(root: string): string[] | null {
  try {
    // --cached + --others --exclude-standard = tracked AND untracked-not-ignored,
    // matching what the code scanner considers "visible".
    // -c core.quotepath=false: emit non-ASCII paths as-is instead of \octal escapes.
    // -z: NUL-terminated output so paths with any whitespace are safe.
    const out = execFileSync(
      'git',
      ['-C', root, '-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
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

function walkMarkdown(root: string): string[] {
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
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) stack.push(full);
      } else if (e.isFile() && MD_EXT.test(e.name)) {
        files.push(full);
      }
    }
  }
  return files;
}
