import type { Edge, ExtractionError, Node, UnresolvedReference } from '../../types';
import type { PtnToken } from './ptn-tokenizer';
export interface PtnMemberSink {
    filePath: string;
    source: string;
    owner: Node;
    nodes: Node[];
    edges: Edge[];
    unresolvedReferences: UnresolvedReference[];
    errors: ExtractionError[];
}
export declare function extractPtnFields(tokens: PtnToken[], start: number, end: number, sink: PtnMemberSink): void;
export declare function extractPtnEnumMembers(tokens: PtnToken[], start: number, end: number, sink: Pick<PtnMemberSink, 'filePath' | 'source' | 'owner' | 'nodes' | 'edges'>): void;
//# sourceMappingURL=ptn-members.d.ts.map