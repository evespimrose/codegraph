/**
 * The V8 flag(s) that keep tree-sitter grammar compilation off the turboshaft
 * optimizing tier. Single source of truth: the relaunch guard and the test
 * suite both read this (a test asserts each is a real flag on the running
 * runtime, so a rename can't silently regress the fix).
 */
export declare const WASM_RUNTIME_FLAGS: readonly string[];
/** True when every required WASM runtime flag is already present in `execArgv`. */
export declare function processHasWasmRuntimeFlags(execArgv?: readonly string[]): boolean;
/**
 * Build the argv for re-execing node with the WASM runtime flags: our flags
 * first, then any node flags already in `execArgv` (deduped), then the script
 * and its args. Pure — exported for unit testing.
 */
export declare function buildRelaunchArgv(scriptPath: string, scriptArgs: readonly string[], execArgv?: readonly string[]): string[];
/**
 * If the current process is missing the WASM runtime flags, re-exec it once
 * with them and exit with the child's status. No-op when the flags are already
 * present (the normal bundled-launcher path), when already relaunched, or when
 * disabled via CODEGRAPH_NO_RELAUNCH.
 *
 * On spawn failure, returns so the caller runs in-process anyway — risking the
 * OOM is still better than refusing to start.
 */
export declare function relaunchWithWasmRuntimeFlagsIfNeeded(scriptPath: string): void;
//# sourceMappingURL=wasm-runtime-flags.d.ts.map