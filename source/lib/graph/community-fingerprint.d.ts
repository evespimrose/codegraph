import type { Edge, Node } from '../types';
import type { ResolvedCommunityOptions } from './community-types';
export declare function graphFingerprint(nodes: Node[], edges: Edge[]): string;
export declare function skippedGraphFingerprint(nodeCount: number, edgeCount: number): string;
export declare function communityConfigFingerprint(options: ResolvedCommunityOptions): string;
//# sourceMappingURL=community-fingerprint.d.ts.map