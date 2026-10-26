import type { ExtractionError, Node, NodeKind } from '../../types';
import type { PtnToken } from './ptn-tokenizer';
export declare const PTN_DIAGNOSTIC_LIMIT = 100;
export declare function createPtnNode(filePath: string, source: string, kind: NodeKind, name: string, qualifiedName: string, start: PtnToken, end: PtnToken, extra?: Partial<Node>): Node;
export declare function ptnDiagnostic(filePath: string, token: PtnToken, message: string): ExtractionError;
export declare function pushPtnDiagnostic(errors: ExtractionError[], filePath: string, token: PtnToken, message: string): void;
export declare function findClosingBrace(tokens: PtnToken[], open: number): number;
//# sourceMappingURL=ptn-model.d.ts.map