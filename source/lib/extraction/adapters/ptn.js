"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ptnAdapter = void 0;
exports.extractPtn = extractPtn;
const path = __importStar(require("path"));
const ptn_members_1 = require("./ptn-members");
const ptn_model_1 = require("./ptn-model");
const ptn_tokenizer_1 = require("./ptn-tokenizer");
const DECLARATION_KINDS = {
    component: { kind: 'component', domainKind: 'ptn.component', named: true },
    struct: { kind: 'struct', domainKind: 'ptn.struct', named: true },
    command: { kind: 'class', domainKind: 'ptn.command', named: true },
    event: { kind: 'class', domainKind: 'ptn.event', named: true },
    input: { kind: 'config', domainKind: 'ptn.input', named: false },
    enum: { kind: 'enum', domainKind: 'ptn.enum', named: true },
};
exports.ptnAdapter = {
    manifest: {
        schemaVersion: 1,
        id: 'ptn',
        version: '1.0.0',
        displayName: 'Percent Type Notation',
        language: 'ptn',
        extensions: ['.ptn'],
        priority: 100,
        capabilities: {
            entities: true,
            relations: true,
            metadata: true,
            chunks: true,
            diagnostics: true,
        },
    },
    extract: extractPtn,
};
function extractPtn(filePath, source) {
    const startedAt = Date.now();
    const tokens = (0, ptn_tokenizer_1.tokenizePtn)(source);
    const nodes = [];
    const edges = [];
    const unresolvedReferences = [];
    const errors = [];
    const fileName = path.basename(filePath);
    const fileNode = (0, ptn_model_1.createPtnNode)(filePath, source, 'file', fileName, filePath, tokens[0], tokens[tokens.length - 1], {
        domainKind: 'ptn.file',
        metadata: { adapterId: 'ptn', adapterVersion: exports.ptnAdapter.manifest.version },
    });
    nodes.push(fileNode);
    let cursor = 0;
    while (cursor < tokens.length) {
        const keyword = tokens[cursor];
        if (keyword.kind === 'eof')
            break;
        const declaration = DECLARATION_KINDS[keyword.value.toLowerCase()];
        if (!declaration) {
            cursor++;
            continue;
        }
        let nameToken = declaration.named ? tokens[cursor + 1] : keyword;
        if (!nameToken || (declaration.named && nameToken.kind !== 'identifier')) {
            (0, ptn_model_1.pushPtnDiagnostic)(errors, filePath, keyword, `Expected a name after '${keyword.value}'`);
            cursor++;
            continue;
        }
        let open = cursor + (declaration.named ? 2 : 1);
        while (open < tokens.length && tokens[open].value !== '{')
            open++;
        if (tokens[open]?.value !== '{') {
            (0, ptn_model_1.pushPtnDiagnostic)(errors, filePath, keyword, `Expected '{' for '${nameToken.value}'`);
            cursor++;
            continue;
        }
        const close = (0, ptn_model_1.findClosingBrace)(tokens, open);
        if (close < 0) {
            (0, ptn_model_1.pushPtnDiagnostic)(errors, filePath, tokens[open], `Unclosed declaration '${nameToken.value}'`);
            break;
        }
        const declarationName = declaration.named ? nameToken.value : keyword.value.toLowerCase();
        const declarationNode = (0, ptn_model_1.createPtnNode)(filePath, source, declaration.kind, declarationName, `${filePath}::${declarationName}`, keyword, tokens[close], { domainKind: declaration.domainKind });
        nodes.push(declarationNode);
        edges.push({ source: fileNode.id, target: declarationNode.id, kind: 'contains', provenance: 'adapter' });
        const sink = { filePath, source, owner: declarationNode, nodes, edges, unresolvedReferences, errors };
        if (declaration.kind === 'enum')
            (0, ptn_members_1.extractPtnEnumMembers)(tokens, open + 1, close, sink);
        else
            (0, ptn_members_1.extractPtnFields)(tokens, open + 1, close, sink);
        cursor = close + 1;
    }
    return { nodes, edges, unresolvedReferences, errors, durationMs: Date.now() - startedAt };
}
//# sourceMappingURL=ptn.js.map