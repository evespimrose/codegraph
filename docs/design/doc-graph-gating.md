# Doc-graph gating — policy matrix (single source of truth)

Two **independent** gates decide how much of the Markdown layer participates in
the graph. This doc is the canonical statement of that policy (plan Step 9). It
documents existing behavior — it does **not** change any default.

## Gate 1 — docs feature (vector index + semantic search)

`resolveDocsEnabled(db)` — `src/docs/config.ts:82`. Resolution order, first match wins:

1. `CODEGRAPH_DOCS` env (`1/true/yes/on` → on, `0/false/no/off` → off).
2. persisted `project_metadata.docs_enabled` (set by `codegraph index --with-docs` / `init`).
3. default: **off**.

When off (or the optional `@xenova/transformers` / `sqlite-vec` deps are absent)
the whole Markdown pipeline is a silent no-op and the code graph is byte-for-byte
unchanged.

## Gate 2 — doc-graph promotion (`doc` nodes + `doc_link` edges)

`shouldPromoteDocGraph(db)` — `src/docs/doc-links-linker.ts:75`:

```
docGraphEnvOverride() ?? isPureMarkdownProject(db)
```

- `CODEGRAPH_DOC_GRAPH` env override (`src/docs/config.ts:51`): `1` → force on, `0` → force off.
- unset → **auto-detect** via `isPureMarkdownProject(db)` (`doc-links-linker.ts:61`):
  `(0 code nodes — kind ∉ {doc, concept}) AND (mdast_metadata > 0)`.

Gate 2 only ever runs **inside** the docs-enabled path (`linkDocEdges` is called
after a docs-enabled index/sync), so Gate 1 is a prerequisite.

## Matrix

| Project | code nodes | docs indexed | `CODEGRAPH_DOC_GRAPH` | doc-graph promoted? |
|---|---|---|---|---|
| **BLADE** (pure Markdown vault) | 0 | >0 | unset | **yes (auto)** |
| **RX_1** (code + some docs) | >0 | ≥0 | unset | **no** (default off) |
| RX_1 | >0 | >0 | `1` | yes (override on) |
| BLADE | 0 | >0 | `0` | no (override off) |
| any | — | — | docs feature off | no (Gate 1 fails first) |

## Why this split (and what stays a Non-Goal)

- **BLADE auto-on**: a notes/wiki/Obsidian vault has no code symbols; its value
  *is* the note-to-note link graph, so promotion is the sensible default.
- **RX_1 default-off**: a code project's graph is the code. Promoting every
  `[[wiki link]]` into `doc`/`doc_link` nodes would dilute it and risk regressing
  code-only behavior — so it stays off unless explicitly opted in via the env
  override. **RX_1's default behavior is unchanged by this work.**
- **Mixed-project auto-enable is a Non-Goal.** A repo with both code and docs
  does *not* auto-promote the doc graph; the maintainer opts in per-project with
  `CODEGRAPH_DOC_GRAPH=1`. Auto-detection deliberately keys on the *absence* of
  code nodes (pure-MD), never on a heuristic ratio.

## Relationship to `.codegraphignore`

`.codegraphignore` (additive exclude layer) filters **what gets indexed at all**
— both code and Markdown — before either gate is consulted. Excluding a doc with
`.codegraphignore` removes it from `mdast_metadata`, which in turn can flip
`isPureMarkdownProject` only if it removes the *last* doc. The gates above operate
on whatever survives ignore filtering.
