# KIT C# grammar

The runtime vendors `source/lib/extraction/wasm/tree-sitter-c_sharp.wasm` as
the primary C# parser. The upstream `tree-sitter-wasms` C# grammar rejects
legal code that occurs in Chronos and in vendor code of the team's Unity
projects. This patch keeps the existing grammar generation and corrects these
cases:

- `void*` pointer types.
- `required` as a contextual keyword.
- Two parameter modifiers, such as `this in`, `ref this`, `scoped ref`, and
  `ref readonly`.
- `async` as a variable or parameter name. `async` lambdas, including
  `async _ =>`, still parse.

Upstream: https://github.com/tree-sitter/tree-sitter-c-sharp

- Tag: `v0.20.0`
- Commit: `7a47daeaf0d410dd1a91c97b274bb7276dd96605`
- License: MIT, reproduced in `LICENSE`
- Exact source changes: `v0.20.0.patch`
- Parser generator: official Tree-sitter CLI `v0.25.10`, ABI 14
- Build metadata: upstream `tree-sitter.json` from tag `v0.23.5`; this supplies
  CLI package metadata only and does not replace the pinned grammar source.

The maintained artifact includes no compiler installation or generated C
source. To rebuild, use an isolated checkout, a Node runtime on PATH, the
pinned Tree-sitter CLI and an Emscripten SDK on PATH:

```powershell
git clone https://github.com/tree-sitter/tree-sitter-c-sharp.git csharp-build
Set-Location csharp-build
git checkout 7a47daeaf0d410dd1a91c97b274bb7276dd96605
git apply '<KIT>/tools/codegraph/grammars/csharp/v0.20.0.patch'
Invoke-WebRequest 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-c-sharp/v0.23.5/tree-sitter.json' -OutFile tree-sitter.json
tree-sitter generate --abi 14
tree-sitter build --wasm --output '<KIT>/tools/codegraph/source/lib/extraction/wasm/tree-sitter-c_sharp.wasm'
```

The recorded Windows build used Emscripten 3.1.39 from the Unity 6000.3 WebGL
toolchain as a standalone C-to-WASM compiler. No Unity Editor or game
compilation was run. Set the toolchain environment before the build:

```powershell
$emsdk = '<Unity>\Editor\Data\PlaybackEngines\WebGLSupport\BuildTools\Emscripten'
$env:EM_CONFIG = "$emsdk\.emscripten"
$env:EMSDK_PYTHON = "$emsdk\python\python.exe"
$env:PATH = "$emsdk\emscripten;$env:PATH"
```

With this toolchain, a fresh checkout reproduces the SHA-256 in
`artifact.json`. Other compiler versions may produce different bytes and must
pass the same parser regressions.

The grammar keeps its handling of preprocessor directives. When the primary
parse reports errors, the C# extraction layer reads `#if`, `#elif`, `#else`, and
`#endif` from the source text, outside comments and multi-line string literals.
It builds variants, and each variant applies one consistent set of defined
symbols, so complementary blocks such as `#if A` and `#if !A` never combine.
Together the variants activate every branch that can compile. Directive lines
and inactive branches are blanked, so source positions do not change. Symbols
and references from all variants are merged. A declaration whose first line
differs between variants stays one symbol. The planner reports an error above 64
distinct variants. If errors remain, the same inputs are parsed with the
upstream grammar in `../csharp-modern`, and that result is used only when it has
no errors. The parser revision in `source/lib/provenance.js` invalidates indexes
when these extraction semantics change.

Verification:

```powershell
node --liftoff-only --test test/indexing-csharp.test.cjs test/indexing-csharp-conditional.test.cjs test/indexing-regression.test.cjs test/indexing-revision.test.cjs test/indexing-lock.test.cjs
```

Run from `tools/codegraph/source`. Runtime installation does not rebuild the
grammar or require Node packages beyond the bundled dependencies.
