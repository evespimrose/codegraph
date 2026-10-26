import type { Language } from '../types';
export interface ParsedMetadataApplication {
    name: string;
    qualifiedName: string;
    arguments: string[];
    target?: string;
    rawText: string;
}
export declare function parseMetadataSyntax(raw: string, language: Language): ParsedMetadataApplication[];
export declare function parseGoStructTags(raw: string): ParsedMetadataApplication[];
//# sourceMappingURL=metadata.d.ts.map