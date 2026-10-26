"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDirectives = readDirectives;
exports.evaluate = evaluate;
exports.firstUnassigned = firstUnassigned;
const STRING_START = /(\$*)(@?)(\$*)("+)/y;
const CHAR_LITERAL = /'(?:\\.[^'\r\n]*|[^'\\\r\n])'/y;

/**
 * Reads `#if`, `#elif`, `#else`, and `#endif` lines with their byte ranges and
 * parsed conditions. Directives are read from the text, not from a syntax tree,
 * because parser error recovery can swallow them.
 */
function readDirectives(source) {
    const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const offsets = [];
    let offset = 0;
    for (const line of lines) {
        offsets.push(offset);
        offset += line.length;
    }
    const directives = [];
    for (const row of directiveRows(lines)) {
        const match = /^\s*#\s*(if|elif|else|endif)\b(.*)$/.exec(lines[row].replace(/\r?\n$/, ''));
        if (!match) continue;
        const [, keyword, rest] = match;
        const text = rest.replace(/\/\*.*?\*\//g, ' ').replace(/\/\/.*$/, '').trim();
        const conditional = keyword === 'if' || keyword === 'elif';
        const condition = conditional ? parseCondition(text) : null;
        if (conditional && !condition) return { error: 'C# conditional analysis found a malformed directive.' };
        if (!conditional && text) return { error: 'C# conditional analysis found unexpected text on a directive line.' };
        directives.push({ keyword, condition, start: offsets[row], end: offsets[row] + lines[row].length });
    }
    return { directives };
}

// A `#` line inside a delimited comment, a multi-line string literal, or an interpolation hole is text, so the
// lexical context is carried from line to line.
function directiveRows(lines) {
    const rows = [];
    const contexts = [];
    lines.forEach((line, row) => {
        if (!contexts.length && /^\s*#/.test(line)) rows.push(row);
        else scanLine(line, contexts);
    });
    return rows;
}

function scanLine(line, contexts) {
    let index = 0;
    while (index < line.length) {
        const context = contexts[contexts.length - 1];
        if (context?.kind === 'comment') {
            const end = line.indexOf('*/', index);
            if (end < 0) return;
            contexts.pop();
            index = end + 2;
        }
        else if (context?.kind === 'string') index = scanStringText(line, index, contexts, context);
        else if (context?.kind === 'hole') index = scanHole(line, index, contexts, context);
        else index = scanCode(line, index, contexts);
    }
    // A regular string literal cannot continue on the next line; recover as the compiler would after its error.
    while (contexts.at(-1)?.kind === 'string' && !contexts.at(-1).verbatim && !contexts.at(-1).quotes) contexts.pop();
}

function scanCode(line, index, contexts) {
    const char = line[index];
    if (char === '/' && line[index + 1] === '/') return line.length;
    if (char === '/' && line[index + 1] === '*') {
        contexts.push({ kind: 'comment' });
        return index + 2;
    }
    if (char === "'") {
        CHAR_LITERAL.lastIndex = index;
        return CHAR_LITERAL.test(line) ? CHAR_LITERAL.lastIndex : index + 1;
    }
    return char === '"' || char === '$' || char === '@' ? openString(line, index, contexts) : index + 1;
}

function openString(line, index, contexts) {
    STRING_START.lastIndex = index;
    const literal = STRING_START.exec(line);
    if (!literal) return index + 1;
    const [text, before, verbatim, after, quotes] = literal;
    const dollars = before.length + after.length;
    if (verbatim) {
        contexts.push({ kind: 'string', verbatim: true, quotes: 0, dollars });
        return index + text.length - quotes.length + 1;
    }
    if (quotes.length !== 2) contexts.push({ kind: 'string', verbatim: false, quotes: quotes.length >= 3 ? quotes.length : 0, dollars });
    return index + text.length;
}

// Brackets nest inside an interpolation hole; a colon outside them starts the format clause, which is text.
function scanHole(line, index, contexts, hole) {
    const char = line[index];
    if (char === '(' || char === '[' || char === '{') hole.depth++;
    else if ((char === ')' || char === ']' || char === '}') && hole.depth) hole.depth--;
    else if (char === '}') {
        contexts.pop();
        return index + hole.braces;
    }
    else if (char === ':' && !hole.depth) {
        const end = line.indexOf('}', index);
        return end < 0 ? line.length : end;
    }
    else return scanCode(line, index, contexts);
    return index + 1;
}

// A raw literal closes on enough quotes and opens a hole on enough braces; elsewhere doubled quotes and braces are
// escapes, so an odd run ends the text.
function scanStringText(line, index, contexts, string) {
    for (let position = index; position < line.length; position++) {
        const char = line[position];
        if (char === '\\' && !string.verbatim && !string.quotes) {
            position++;
            continue;
        }
        const closing = char === '"';
        if (!closing && (char !== '{' || !string.dollars)) continue;
        let run = 1;
        while (line[position + run] === char) run++;
        const ends = string.quotes ? run >= (closing ? string.quotes : string.dollars) : run % 2 === 1;
        if (!ends) {
            position += run - 1;
            continue;
        }
        if (closing) contexts.pop();
        else contexts.push({ kind: 'hole', braces: string.quotes ? string.dollars : 1, depth: 0 });
        return position + run;
    }
    return line.length;
}

function parseCondition(text) {
    const tokens = text.match(/[A-Za-z_]\w*|&&|\|\||==|!=|\S/g) ?? [];
    let position = 0;
    const binary = (operators, operand) => () => {
        let left = operand();
        while (left && operators.includes(tokens[position])) {
            const operator = tokens[position++];
            const right = operand();
            left = right && { kind: 'binary', operator, left, right };
        }
        return left;
    };
    const unary = () => {
        const token = tokens[position++];
        if (token === '!') {
            const operand = unary();
            return operand && { kind: 'not', operand };
        }
        if (token === '(') {
            const inner = or();
            return inner && tokens[position++] === ')' ? inner : null;
        }
        if (token === 'true' || token === 'false') return { kind: 'value', value: token === 'true' };
        return /^[A-Za-z_]\w*$/.test(token ?? '') ? { kind: 'symbol', name: token } : null;
    };
    const or = binary(['||'], binary(['&&'], binary(['==', '!='], unary)));
    const condition = or();
    return condition && position === tokens.length ? condition : null;
}

// Kleene logic: undefined means the value still depends on an unassigned symbol. A closed evaluation treats
// unassigned symbols as undefined preprocessor symbols (false).
function evaluate(condition, assignment, closed) {
    switch (condition.kind) {
        case 'symbol': return assignment.has(condition.name) ? assignment.get(condition.name) : closed ? false : undefined;
        case 'value': return condition.value;
        case 'not': {
            const value = evaluate(condition.operand, assignment, closed);
            return value === undefined ? undefined : !value;
        }
        default: {
            const left = evaluate(condition.left, assignment, closed);
            const right = evaluate(condition.right, assignment, closed);
            switch (condition.operator) {
                case '&&': return left === false || right === false ? false : left && right ? true : undefined;
                case '||': return left === true || right === true ? true : left === false && right === false ? false : undefined;
                case '==': return left === undefined || right === undefined ? undefined : left === right;
                default: return left === undefined || right === undefined ? undefined : left !== right;
            }
        }
    }
}

function firstUnassigned(condition, assignment) {
    switch (condition.kind) {
        case 'symbol': return assignment.has(condition.name) ? undefined : condition.name;
        case 'value': return undefined;
        case 'not': return firstUnassigned(condition.operand, assignment);
        default: return firstUnassigned(condition.left, assignment) ?? firstUnassigned(condition.right, assignment);
    }
}
