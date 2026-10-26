"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMetadataSyntax = parseMetadataSyntax;
exports.parseGoStructTags = parseGoStructTags;
function parseMetadataSyntax(raw, language) {
    const trimmed = raw.trim();
    if (!trimmed)
        return [];
    let inner = trimmed;
    let splitApplications = false;
    if (inner.startsWith('[[') && inner.endsWith(']]')) {
        inner = inner.slice(2, -2).trim();
        splitApplications = true;
    }
    else if (inner.startsWith('#[') && inner.endsWith(']')) {
        inner = inner.slice(2, -1).trim();
        splitApplications = language === 'php';
    }
    else if (inner.startsWith('[') && inner.endsWith(']')) {
        inner = inner.slice(1, -1).trim();
        splitApplications = true;
    }
    else if (inner.startsWith('@')) {
        inner = inner.slice(1).trim();
    }
    const expressions = splitApplications ? splitTopLevel(inner, ',') : [inner];
    return expressions.map(parseApplication).filter((value) => value !== null);
}
function parseGoStructTags(raw) {
    const value = raw.trim().replace(/^`|`$/g, '');
    const tags = [];
    let index = 0;
    while (index < value.length) {
        while (/\s/.test(value[index] ?? ''))
            index++;
        const nameStart = index;
        while (/[A-Za-z0-9_.-]/.test(value[index] ?? ''))
            index++;
        const name = value.slice(nameStart, index);
        if (!name || value[index] !== ':' || value[index + 1] !== '"') {
            index++;
            continue;
        }
        index += 2;
        let argument = '';
        while (index < value.length) {
            const char = value[index++];
            if (char === '\\' && index < value.length) {
                argument += char + value[index++];
            }
            else if (char === '"') {
                break;
            }
            else {
                argument += char;
            }
        }
        tags.push({
            name,
            qualifiedName: `go.struct_tag.${name}`,
            arguments: [argument],
            target: 'field',
            rawText: `${name}:"${argument}"`,
        });
    }
    return tags;
}
function parseApplication(expression) {
    const rawText = expression.trim();
    if (!rawText)
        return null;
    let target;
    let body = rawText.replace(/^@/, '').trim();
    const targetColon = findTargetColon(body);
    if (targetColon >= 0) {
        target = body.slice(0, targetColon).trim();
        body = body.slice(targetColon + 1).trim();
    }
    const openParen = findTopLevel(body, '(');
    const qualifiedName = (openParen >= 0 ? body.slice(0, openParen) : body).trim();
    if (!qualifiedName)
        return null;
    const argsText = openParen >= 0 ? body.slice(openParen + 1, matchingClose(body, openParen)) : '';
    const argumentsList = argsText ? splitTopLevel(argsText, ',').map((argument) => argument.trim()).filter(Boolean) : [];
    const name = qualifiedName.split(/::|\.|\\/).filter(Boolean).at(-1) ?? qualifiedName;
    return { name, qualifiedName, arguments: argumentsList, target, rawText };
}
function splitTopLevel(value, separator) {
    const result = [];
    let start = 0;
    let quote = '';
    const stack = [];
    const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (quote) {
            if (char === '\\')
                index++;
            else if (char === quote)
                quote = '';
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char in pairs) {
            stack.push(pairs[char]);
            continue;
        }
        if (stack.at(-1) === char) {
            stack.pop();
            continue;
        }
        if (char === separator && stack.length === 0) {
            result.push(value.slice(start, index));
            start = index + 1;
        }
    }
    result.push(value.slice(start));
    return result;
}
function findTopLevel(value, expected) {
    let quote = '';
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (quote) {
            if (char === '\\')
                index++;
            else if (char === quote)
                quote = '';
            continue;
        }
        if (char === '"' || char === "'")
            quote = char;
        else if (char === expected)
            return index;
    }
    return -1;
}
function findTargetColon(value) {
    const colon = findTopLevel(value, ':');
    if (colon < 0)
        return -1;
    if (value[colon - 1] === ':' || value[colon + 1] === ':')
        return -1;
    const candidate = value.slice(0, colon).trim();
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) ? colon : -1;
}
function matchingClose(value, open) {
    let depth = 0;
    let quote = '';
    for (let index = open; index < value.length; index++) {
        const char = value[index];
        if (quote) {
            if (char === '\\')
                index++;
            else if (char === quote)
                quote = '';
            continue;
        }
        if (char === '"' || char === "'")
            quote = char;
        else if (char === '(')
            depth++;
        else if (char === ')' && --depth === 0)
            return index;
    }
    return value.length;
}
//# sourceMappingURL=metadata.js.map