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
/** 문서 판별기의 결과. outside 는 실제 경로가 프로젝트 루트 밖이라는 뜻이고, document 가 null 이면 문서가 아님 */
export interface DocumentVerdict {
    document?: TextDocumentFile | null;
    outside?: boolean;
}
export type DocumentClassifier = (absolutePath: string, relativePath: string, stat?: import('fs').Stats) => DocumentVerdict;
export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[], classify?: DocumentClassifier): TextDocumentFile[];
export declare function classifyTextDocument(absolutePath: string): TextDocumentFile | null;
export declare function detectDocumentFormat(filePath: string): DocumentFormat | null;
export declare function isSecretPath(filePath: string): boolean;
/** 확장자만으로 바이너리임을 아는 경로인지 */
export declare function isBinaryPath(filePath: string): boolean;
//# sourceMappingURL=scan-files.d.ts.map