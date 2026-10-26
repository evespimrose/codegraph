"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenizePtn = tokenizePtn;
function tokenizePtn(source) {
    const tokens = [];
    let index = 0;
    let line = 1;
    let column = 0;
    const advance = () => {
        const char = source[index++] ?? '';
        if (char === '\n') {
            line++;
            column = 0;
        }
        else {
            column++;
        }
        return char;
    };
    while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
            advance();
            continue;
        }
        if (char === '/' && source[index + 1] === '/') {
            while (index < source.length && advance() !== '\n') { }
            continue;
        }
        if (char === '/' && source[index + 1] === '*') {
            advance();
            advance();
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/'))
                advance();
            if (index < source.length) {
                advance();
                advance();
            }
            continue;
        }
        const start = index;
        const startLine = line;
        const startColumn = column;
        if (/[A-Za-z_]/.test(char)) {
            while (index < source.length && /[A-Za-z0-9_.]/.test(source[index]))
                advance();
            tokens.push({ kind: 'identifier', value: source.slice(start, index), start, end: index, line: startLine, column: startColumn });
            continue;
        }
        if (/\d/.test(char)) {
            while (index < source.length && /[0-9A-Fa-f_xX.]/.test(source[index]))
                advance();
            tokens.push({ kind: 'number', value: source.slice(start, index), start, end: index, line: startLine, column: startColumn });
            continue;
        }
        if (char === '"' || char === "'") {
            const quote = advance();
            while (index < source.length) {
                const current = advance();
                if (current === '\\')
                    advance();
                else if (current === quote)
                    break;
            }
            tokens.push({ kind: 'string', value: source.slice(start, index), start, end: index, line: startLine, column: startColumn });
            continue;
        }
        advance();
        tokens.push({ kind: 'symbol', value: char, start, end: index, line: startLine, column: startColumn });
    }
    tokens.push({ kind: 'eof', value: '', start: index, end: index, line, column });
    return tokens;
}
//# sourceMappingURL=ptn-tokenizer.js.map