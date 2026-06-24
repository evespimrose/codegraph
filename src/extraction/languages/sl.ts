import type { Node as SyntaxNode } from 'web-tree-sitter';
import { getChildByField, getNodeText } from '../tree-sitter-helpers';
import type { LanguageExtractor } from '../tree-sitter-types';

/**
 * SL (FEGate FFS Script Language) extractor.
 *
 * SL is C-like, so this mirrors the C/C++ extractor: the tree-sitter-sl grammar
 * deliberately reuses C node names (function_definition, struct_specifier,
 * enum_specifier, call_expression, preproc_include, declaration). The one SL
 * specific is `::` scoped calls/defs (dbNode::First) — handled exactly like C++
 * qualified_identifiers (see resolveName/getReceiverType below, and the
 * qualified_identifier branch in tree-sitter.ts extractCall for call sites).
 */

/** Last segment of a (possibly `::`-qualified) function declarator name. */
function extractSlMethodName(node: SyntaxNode, source: string): string | undefined {
  const declarator = getChildByField(node, 'declarator');
  if (!declarator) return undefined;
  const queue: SyntaxNode[] = [declarator];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.type === 'qualified_identifier') {
      const parts = getNodeText(current, source).split('::').filter(Boolean);
      return parts[parts.length - 1];
    }
    for (let i = 0; i < current.namedChildCount; i++) {
      const child = current.namedChild(i);
      if (child) queue.push(child);
    }
  }
  return undefined; // plain identifier — core falls back to nameField
}

/** Scope/receiver of a `dbNode::First`-style definition (undefined when plain). */
function extractSlReceiverType(node: SyntaxNode, source: string): string | undefined {
  const declarator = getChildByField(node, 'declarator');
  if (!declarator) return undefined;
  const queue: SyntaxNode[] = [declarator];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.type === 'qualified_identifier') {
      const parts = getNodeText(current, source).split('::').filter(Boolean);
      return parts.length > 1 ? parts.slice(0, -1).join('::') : undefined;
    }
    for (let i = 0; i < current.namedChildCount; i++) {
      const child = current.namedChild(i);
      if (child) queue.push(child);
    }
  }
  return undefined;
}

export const slExtractor: LanguageExtractor = {
  functionTypes: ['function_definition'],
  classTypes: [],
  methodTypes: ['function_definition'],
  interfaceTypes: [],
  structTypes: ['struct_specifier'],
  enumTypes: ['enum_specifier'],
  enumMemberTypes: ['enumerator'],
  typeAliasTypes: [],
  importTypes: ['preproc_include'],
  callTypes: ['call_expression'],
  variableTypes: ['declaration'],
  nameField: 'declarator',
  bodyField: 'body',
  paramsField: 'parameters',
  resolveName: extractSlMethodName,
  getReceiverType: extractSlReceiverType,
  extractImport: (node, source) => {
    const importText = source.substring(node.startIndex, node.endIndex).trim();
    // SL only supports `#include <api.h>` / `#include "local.sl"`
    const systemLib = node.namedChildren.find((c: SyntaxNode) => c.type === 'system_lib_string');
    if (systemLib) {
      return { moduleName: getNodeText(systemLib, source).replace(/^<|>$/g, ''), signature: importText };
    }
    const stringLiteral = node.namedChildren.find((c: SyntaxNode) => c.type === 'string_literal');
    if (stringLiteral) {
      return { moduleName: getNodeText(stringLiteral, source).replace(/^"|"$/g, ''), signature: importText };
    }
    return null;
  },
};
