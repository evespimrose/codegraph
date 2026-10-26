"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPtnFields = extractPtnFields;
exports.extractPtnEnumMembers = extractPtnEnumMembers;
const ptn_model_1 = require("./ptn-model");
const BUILTIN_TYPES = new Set([
    'bool', 'button', 'byte', 'double', 'entity', 'fbool', 'fixed', 'float', 'fp',
    'fstring32', 'fstring64', 'fvector2', 'fvector3', 'int', 'long', 'short',
    'string', 'uint', 'ulong', 'ushort', 'assetref',
]);
function extractPtnFields(tokens, start, end, sink) {
    let statementStart = start;
    for (let cursor = start; cursor < end; cursor++) {
        const token = tokens[cursor];
        if (token.value !== ';')
            continue;
        const statement = tokens.slice(statementStart, cursor).filter((part) => part.kind !== 'eof');
        statementStart = cursor + 1;
        if (statement.length === 0)
            continue;
        const assignment = statement.findIndex((part) => part.value === '=');
        const declarator = assignment >= 0 ? statement.slice(0, assignment) : statement;
        const identifiers = declarator.filter((part) => part.kind === 'identifier');
        const fieldName = identifiers[identifiers.length - 1];
        if (!fieldName || identifiers.length < 2) {
            (0, ptn_model_1.pushPtnDiagnostic)(sink.errors, sink.filePath, statement[0], `Malformed field in '${sink.owner.name}'`);
            continue;
        }
        const nameIndex = declarator.lastIndexOf(fieldName);
        const typeTokens = declarator.slice(0, nameIndex);
        const typeText = sink.source.slice(typeTokens[0].start, typeTokens[typeTokens.length - 1].end).trim();
        const fieldNode = (0, ptn_model_1.createPtnNode)(sink.filePath, sink.source, 'field', fieldName.value, `${sink.owner.qualifiedName}.${fieldName.value}`, statement[0], token, { domainKind: 'ptn.field', signature: `${typeText} ${fieldName.value}`, metadata: { type: typeText } });
        sink.nodes.push(fieldNode);
        sink.edges.push({ source: sink.owner.id, target: fieldNode.id, kind: 'contains', provenance: 'adapter' });
        const typeNames = new Set(typeTokens.filter((part) => part.kind === 'identifier').map((part) => part.value));
        for (const typeName of typeNames) {
            if (BUILTIN_TYPES.has(typeName.toLowerCase()))
                continue;
            sink.unresolvedReferences.push({
                fromNodeId: fieldNode.id,
                referenceName: typeName,
                referenceKind: 'type_of',
                line: fieldName.line,
                column: fieldName.column,
                filePath: sink.filePath,
                language: 'ptn',
            });
        }
    }
}
function extractPtnEnumMembers(tokens, start, end, sink) {
    for (let cursor = start; cursor < end; cursor++) {
        const token = tokens[cursor];
        if (token.kind !== 'identifier')
            continue;
        const member = (0, ptn_model_1.createPtnNode)(sink.filePath, sink.source, 'enum_member', token.value, `${sink.owner.qualifiedName}.${token.value}`, token, token, { domainKind: 'ptn.enum_member' });
        sink.nodes.push(member);
        sink.edges.push({ source: sink.owner.id, target: member.id, kind: 'contains', provenance: 'adapter' });
        while (cursor + 1 < end && tokens[cursor + 1].value !== ',')
            cursor++;
    }
}
//# sourceMappingURL=ptn-members.js.map