"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PTN_DIAGNOSTIC_LIMIT = void 0;
exports.createPtnNode = createPtnNode;
exports.ptnDiagnostic = ptnDiagnostic;
exports.pushPtnDiagnostic = pushPtnDiagnostic;
exports.findClosingBrace = findClosingBrace;
const tree_sitter_helpers_1 = require("../tree-sitter-helpers");
exports.PTN_DIAGNOSTIC_LIMIT = 100;
function createPtnNode(filePath, source, kind, name, qualifiedName, start, end, extra = {}) {
    return {
        id: (0, tree_sitter_helpers_1.generateNodeId)(filePath, kind, qualifiedName, start.line),
        kind,
        name,
        qualifiedName,
        filePath,
        language: 'ptn',
        startLine: start.line,
        endLine: end.line,
        startColumn: start.column,
        endColumn: end.column + Math.max(0, source.slice(end.start, end.end).length),
        updatedAt: Date.now(),
        ...extra,
    };
}
function ptnDiagnostic(filePath, token, message) {
    return {
        message,
        filePath,
        line: token.line,
        column: token.column,
        severity: 'warning',
        code: 'ptn_parse',
    };
}
function pushPtnDiagnostic(errors, filePath, token, message) {
    if (errors.length < exports.PTN_DIAGNOSTIC_LIMIT)
        errors.push(ptnDiagnostic(filePath, token, message));
}
function findClosingBrace(tokens, open) {
    let depth = 0;
    for (let cursor = open; cursor < tokens.length; cursor++) {
        if (tokens[cursor].value === '{')
            depth++;
        if (tokens[cursor].value === '}' && --depth === 0)
            return cursor;
    }
    return -1;
}
//# sourceMappingURL=ptn-model.js.map