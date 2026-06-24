import { Edge, ExtractionError, ExtractionResult, Node, UnresolvedReference } from '../types';
import { generateNodeId } from './tree-sitter-helpers';

/**
 * SlHeaderExtractor — parses FEGate SL API headers (`fegate_api/*.h`).
 *
 * FEGate ships its engine API as C-style `.h` headers, but the declarations use
 * SL syntax (`ref type ary[][]`, `dbNode::First`) that the C/C++ tree-sitter
 * grammar cannot parse — each header indexes as only ~3 symbols, so the 1,600+
 * API functions are invisible to `codegraph_search`. They are NOT real C, so a
 * full grammar is overkill; instead each function carries a structured
 * `/**HELP_FUN ... *​/` doc block:
 *
 *     /**HELP_FUN
 *     @decl
 *     int dbNode::First()
 *     @brief
 *     Returns the first node index ...
 *     @return
 *     int
 *     *​/
 *     int First();
 *
 * This regex extractor emits one `function` node per HELP_FUN block, named by
 * the `@decl` signature (qualified `dbNode::First` → name `First`, receiver
 * `dbNode`), with `@brief` as the docstring. That makes engine API functions
 * searchable and lets native `.sl` call sites (`dbNode::First()`, lowered to a
 * `dbNode.First` reference in tree-sitter.ts) resolve to their declaration.
 *
 * Detection (`looksLikeFegateHeader` in grammars.ts) gates this to `.h` files
 * containing `HELP_FUN`/`@decl`, so plain C/C++ headers are unaffected.
 */
export class SlHeaderExtractor {
  private filePath: string;
  private source: string;
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private unresolvedReferences: UnresolvedReference[] = [];
  private errors: ExtractionError[] = [];
  private lineStarts: number[] = [];

  constructor(filePath: string, source: string) {
    this.filePath = filePath;
    this.source = source;
    this.computeLineStarts();
  }

  extract(): ExtractionResult {
    const startTime = Date.now();
    const fileNode = this.createFileNode();

    try {
      this.extractHelpFunBlocks(fileNode.id);
    } catch (error) {
      this.errors.push({
        message: `SL header extraction error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
        code: 'parse_error',
      });
    }

    return {
      nodes: this.nodes,
      edges: this.edges,
      unresolvedReferences: this.unresolvedReferences,
      errors: this.errors,
      durationMs: Date.now() - startTime,
    };
  }

  private createFileNode(): Node {
    const lines = this.source.split('\n');
    const id = generateNodeId(this.filePath, 'file', this.filePath, 1);
    const node: Node = {
      id,
      kind: 'file',
      name: this.filePath.split(/[\\/]/).pop() || this.filePath,
      qualifiedName: this.filePath,
      filePath: this.filePath,
      language: 'slheader',
      startLine: 1,
      endLine: lines.length || 1,
      startColumn: 0,
      endColumn: lines[lines.length - 1]?.length ?? 0,
      updatedAt: Date.now(),
    };
    this.nodes.push(node);
    return node;
  }

  /**
   * Emit one function node per `/**HELP_FUN ... *​/` block, keyed by the `@decl`
   * signature's qualified name.
   */
  private extractHelpFunBlocks(fileNodeId: string): void {
    const blockRe = /\/\*\*\s*HELP_FUN\b([\s\S]*?)\*\//g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(this.source)) !== null) {
      const body = m[1] ?? '';
      const decl = this.section(body, 'decl');
      if (!decl) continue;

      // First `name(` token in @decl is the function (return type precedes it).
      // Captures qualified (`dbNode::First`) or plain (`arySize`) names.
      const nameMatch = /([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*\(/.exec(decl);
      if (!nameMatch) continue;
      const qualified = nameMatch[1]!;
      const name = qualified.split('::').pop()!;

      const startLine = this.getLineNumber(m.index);
      const endLine = this.getLineNumber(m.index + m[0].length);
      const brief = this.section(body, 'brief');
      const signature = decl.replace(/\s+/g, ' ').trim();

      const nodeId = generateNodeId(this.filePath, 'function', qualified, startLine);
      const node: Node = {
        id: nodeId,
        kind: 'function',
        name,
        qualifiedName: qualified,
        filePath: this.filePath,
        language: 'slheader',
        signature,
        startLine,
        endLine,
        startColumn: 0,
        endColumn: 0,
        docstring: brief || undefined,
        updatedAt: Date.now(),
      };
      this.nodes.push(node);
      this.edges.push({ source: fileNodeId, target: nodeId, kind: 'contains' });
    }
  }

  /** Text of a `@tag` section: everything until the next `@tag` or block end. */
  private section(body: string, tag: string): string {
    const re = new RegExp(`@${tag}\\b[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n@[A-Za-z]|$)`);
    const m = re.exec(body);
    return m ? m[1]!.trim() : '';
  }

  private computeLineStarts(): void {
    this.lineStarts = [0];
    for (let i = 0; i < this.source.length; i++) {
      if (this.source.charCodeAt(i) === 10) this.lineStarts.push(i + 1);
    }
  }

  private getLineNumber(offset: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (this.lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }
}
