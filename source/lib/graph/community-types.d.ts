export interface CommunityDetectionOptions {
    seed?: number | string;
    maxNodes?: number;
    maxCommunityFraction?: number;
    minSplitSize?: number;
    excludeHubPercentile?: number;
    resolution?: number;
}
export interface ResolvedCommunityOptions {
    seed: number | string;
    maxNodes: number;
    maxCommunityFraction: number;
    minSplitSize: number;
    excludeHubPercentile?: number;
    resolution: number;
}
export interface CommunitySummary {
    id: string;
    label: string;
    size: number;
    cohesion: number;
    members: string[];
}
export interface CommunityDetectionResult {
    status: 'ok' | 'skipped';
    graphFingerprint: string;
    configFingerprint: string;
    nodeCommunities: Record<string, string>;
    communities: Record<string, CommunitySummary>;
    excludedHubs: string[];
    warnings: string[];
}
export interface CommunitiesCache {
    schemaVersion: 1;
    generatedAt: string;
    graphFingerprint: string;
    configFingerprint: string;
    nodeCommunities: Record<string, string>;
    communities: Record<string, CommunitySummary>;
    excludedHubs: string[];
    warnings: string[];
}
//# sourceMappingURL=community-types.d.ts.map