"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectCSharpDiagnostics = collectCSharpDiagnostics;

function collectCSharpDiagnostics(root, source, filePath, parser) {
    const diagnostics = [];
    const pending = [root];
    while (pending.length) {
        const node = pending.pop();
        if (node.type === 'ERROR' || node.isMissing) {
            const limitation = knownGrammarLimitation(node, source, parser);
            diagnostics.push({
                filePath,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                message: limitation ?? 'C# syntax tree contains errors; symbol extraction may be incomplete.',
                severity: limitation ? 'warning' : 'error',
                code: limitation ? 'grammar_limitation' : 'syntax_error',
            });
            continue;
        }
        if (node.hasError) {
            for (let index = node.childCount - 1; index >= 0; index--) {
                const child = node.child(index);
                if (child && (child.hasError || child.type === 'ERROR' || child.isMissing))
                    pending.push(child);
            }
        }
    }
    if (!diagnostics.length && root.hasError) {
        diagnostics.push({ filePath, line: root.startPosition.row + 1, column: root.startPosition.column + 1,
            message: 'C# syntax tree contains an unrepresented recovery error; symbol extraction may be incomplete.', severity: 'error', code: 'syntax_error' });
    }
    return diagnostics;
}

function knownGrammarLimitation(node, source, parser) {
    if (isConditionalMethodSignature(node, source, parser)) {
        return 'Bundled C# grammar cannot combine conditional method signatures sharing one body; both signatures remain indexed.';
    }
    return null;
}

function isConditionalMethodSignature(node, source, parser) {
    const method = node.parent;
    if (!node.isMissing || node.type !== ';' || method?.type !== 'method_declaration') return false;
    const alternative = method.nextNamedSibling;
    if (alternative?.type !== 'method_declaration' || alternative.hasError) return false;
    if (method.childForFieldName('name')?.text !== alternative.childForFieldName('name')?.text) return false;
    if (!/^if\s+/.test(method.previousNamedSibling?.text ?? '')) return false;
    const first = /^(.*?)\s*#else\s*$/s.exec(source.slice(method.startIndex, method.endIndex));
    const second = /^(.*?)\s*#endif\s*(\{[\s\S]*\})\s*$/.exec(source.slice(alternative.startIndex, alternative.endIndex));
    if (!first || !second || /#/.test(first[1]) || /#/.test(second[1])) return false;
    return parsesAsMethod(first[1], second[2], parser) && parsesAsMethod(second[1], second[2], parser);
}

function parsesAsMethod(signature, body, parser) {
    const tree = parser.parse(`class __CodeGraphConditional { ${signature} ${body} }`);
    try {
        return Boolean(tree) && !tree.rootNode.hasError;
    }
    finally {
        tree?.delete();
    }
}
