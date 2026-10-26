import type { ExtractionResult, Language } from '../../types';
export interface AdapterCapabilities {
    entities: boolean;
    relations: boolean;
    metadata: boolean;
    chunks: boolean;
    diagnostics: boolean;
}
export interface AdapterManifest {
    schemaVersion: 1;
    id: string;
    version: string;
    displayName: string;
    language: Language;
    extensions: readonly string[];
    priority: number;
    capabilities: AdapterCapabilities;
}
export interface SourceAdapter {
    manifest: AdapterManifest;
    matches?: (filePath: string, source: string) => boolean;
    extract: (filePath: string, source: string) => ExtractionResult;
}
export declare class AdapterRegistry {
    private readonly adapters;
    private readonly byExtension;
    private readonly languages;
    register(adapter: SourceAdapter): void;
    find(filePath: string, source: string, language?: Language): SourceAdapter | undefined;
    detectLanguage(filePath: string): Language | undefined;
    supportsLanguage(language: Language): boolean;
    list(): Array<AdapterManifest & {
        fingerprint: string;
    }>;
}
//# sourceMappingURL=registry.d.ts.map