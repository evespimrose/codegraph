"use strict";
/**
 * CodeGraph Type Definitions
 *
 * Core types for the semantic knowledge graph system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANGUAGES = exports.MARKDOWN_EDGE_KINDS = exports.MARKDOWN_NODE_KINDS = exports.NODE_KINDS = void 0;
// =============================================================================
// Union Types
// =============================================================================
/**
 * Types of nodes in the knowledge graph.
 *
 * Defined as a runtime-iterable `as const` array so the same source
 * of truth backs both the TS type and any runtime validation
 * (e.g. the search query parser).
 */
exports.NODE_KINDS = [
    'file',
    'module',
    'class',
    'struct',
    'interface',
    'trait',
    'protocol',
    'function',
    'method',
    'property',
    'field',
    'variable',
    'constant',
    'enum',
    'enum_member',
    'type_alias',
    'namespace',
    'parameter',
    'import',
    'export',
    'route',
    'component',
    'metadata',
    'section',
    'asset',
    'config',
    'concept',
    'doc',
];
/**
 * Node kinds belonging to the markdown graph (derived from Markdown docs),
 * as opposed to the tree-sitter code graph. Used to report and filter the
 * markdown layer distinctly from code nodes. `concept` = a BLK marker;
 * `doc` = one node per Markdown file (for Obsidian/wiki doc-link promotion).
 */
exports.MARKDOWN_NODE_KINDS = ['concept', 'doc'];
/**
 * Edge kinds belonging to the markdown graph, as opposed to the code graph.
 * `governs` = concept → code symbol; `doc_link` = doc → doc (a citing
 * Markdown file links to a cited one — forward link; reverse = backlink).
 * `semantically_related` is a bounded local-vector inference between docs.
 */
exports.MARKDOWN_EDGE_KINDS = ['governs', 'doc_link', 'semantically_related'];
/**
 * Supported programming languages. See NODE_KINDS for why this is a
 * runtime-iterable const array.
 */
exports.LANGUAGES = [
    'typescript',
    'javascript',
    'tsx',
    'jsx',
    'python',
    'go',
    'rust',
    'java',
    'c',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'swift',
    'kotlin',
    'dart',
    'svelte',
    'vue',
    'liquid',
    'pascal',
    'scala',
    'lua',
    'luau',
    'objc',
    'yaml',
    'twig',
    'xml',
    'properties',
    'ptn',
    'markdown',
    'html',
    'text',
    'unknown',
];
//# sourceMappingURL=types.js.map