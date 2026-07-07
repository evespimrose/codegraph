/**
 * Late-binding registry for the CodeGraph class.
 *
 * mcp/tools.ts and mcp/engine.ts must stay light at import time (tools/list
 * must answer before sqlite loads), so they lazy-require '../index' on first
 * project open. That require() works in the CJS build but not under the
 * vitest ESM transform (its interop require can't load .ts sources). index.ts
 * registers its class here at module scope, so any context that has already
 * imported the real module — every test, and any embedding app — resolves via
 * this ref with zero require() involved. No imports: cycle-free by design.
 */
let ref: unknown = null;

export function setCodeGraphClass(c: unknown): void {
  ref = c;
}

export function getCodeGraphClass(): unknown {
  return ref;
}
