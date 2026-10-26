import type { ParsedDoc } from '../parse';
import type { DocumentFormat } from '../scan-files';
export interface DocumentSection {
    id: string;
    kind: 'section' | 'code' | 'entry' | 'paragraph';
    title: string;
    breadcrumb: string[];
    startLine: number;
    endLine: number;
    text: string;
    language?: string;
}
export interface ParsedDocument extends ParsedDoc {
    format: DocumentFormat;
    sections: DocumentSection[];
    embeddingText: string;
}
export declare function finishDocument(metadata: ParsedDoc, format: DocumentFormat, sections: DocumentSection[]): ParsedDocument;
export declare function paragraphSection(text: string, startLine: number, endLine: number): DocumentSection;
export declare function sectionId(kind: string, line: number, title: string): string;
export declare function normalizeText(value: string): string;
//# sourceMappingURL=shared.d.ts.map