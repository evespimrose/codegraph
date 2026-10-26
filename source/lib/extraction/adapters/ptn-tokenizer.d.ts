export interface PtnToken {
    kind: 'identifier' | 'number' | 'string' | 'symbol' | 'eof';
    value: string;
    start: number;
    end: number;
    line: number;
    column: number;
}
export declare function tokenizePtn(source: string): PtnToken[];
//# sourceMappingURL=ptn-tokenizer.d.ts.map