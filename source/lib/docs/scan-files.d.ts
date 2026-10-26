import { type ScanOptions } from '../extraction/index';
export type DocumentFormat = 'markdown' | 'html' | 'structured' | 'dsl' | 'text';
export interface TextDocumentFile {
    absolutePath: string;
    format: DocumentFormat;
    mimeType: string;
}
/**
 * Whether a path is a Markdown file the docs indexer picks up
 * (.md / .markdown / .mdx). Single source of truth shared with the file
 * watcher's watch gate, so the gate and `listMarkdownFiles` can never disagree
 * on what counts as Markdown.
 */
export declare function isMarkdownFile(filePath: string): boolean;
/** Absolute paths of Markdown files under root, respecting .gitignore when possible. */
export declare function listMarkdownFiles(root: string, opts?: ScanOptions): string[];
export declare function listVisibleFiles(root: string, opts?: ScanOptions): string[];
export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[]): TextDocumentFile[];
export declare function classifyTextDocument(absolutePath: string): TextDocumentFile | null;
export declare function detectDocumentFormat(filePath: string): DocumentFormat | null;
export declare function isSecretPath(filePath: string): boolean;
//# sourceMappingURL=scan-files.d.ts.map