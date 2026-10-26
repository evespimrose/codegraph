# Upstream C# grammar (fallback)

The runtime vendors `source/lib/extraction/wasm/tree-sitter-c_sharp-modern.wasm`
unchanged from the `tree-sitter-c-sharp@0.23.5` npm package
(`package/tree-sitter-c_sharp.wasm`). It parses C# 11 and 12 syntax that the
primary grammar in `../csharp` rejects: raw string literals, collection
expressions, primary constructors, and type declarations that end with `;`.

It is a fallback, not the primary parser, because it rejects legal code that
the primary grammar accepts: pointer indirection of a cast or a call
(`*(T*)p`, `*Get() = v`), assignment to a method call
(`Unsafe.As<A, B>(ref x) = v`), `#if` blocks inside argument lists, lambda
parameters with modifiers (`(in T x) =>`), and `async` used as a name. Its
loader key is `csharp-modern`. It loads together with `csharp` and is not a
language.

C# extraction uses it only when the primary grammar and the conditional
variants still report errors. It parses the same inputs, and its result
replaces the primary result only when it has no errors. The extraction layer
reads the shapes that differ from the primary grammar: the method return type
field `returns`, the alias in the `name` field of `using A = B;`, and the call
target of `*Foo.Bar()`, which this grammar binds as `(*Foo).Bar()`.

Upstream: https://github.com/tree-sitter/tree-sitter-c-sharp

- Tag: `v0.23.5`, npm `gitHead` `cac6d5fb595f5811a076336682d5d595ac1c9e85`
- License: MIT, reproduced in `LICENSE`
- npm tarball SHA-1, SHA-256, and SHA-512 integrity: `artifact.json`
- ABI 15, loaded by the bundled web-tree-sitter 0.25.10

Verify the vendored file:

```powershell
npm pack tree-sitter-c-sharp@0.23.5
tar -xf tree-sitter-c-sharp-0.23.5.tgz package/tree-sitter-c_sharp.wasm
(Get-FileHash package/tree-sitter-c_sharp.wasm -Algorithm SHA256).Hash
```

The hash must equal `sha256` in `artifact.json`. Regenerating the package
`grammar.js` with Tree-sitter CLI `v0.25.10` reproduces the published
`src/parser.c`, except for its generator comment.
