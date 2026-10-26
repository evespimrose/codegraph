# Team CodeGraph maintained source

This directory is the authoritative CommonJS source for the private Team CodeGraph distribution. It preserves the implementation shipped in bundle `1.0.1-fbe7a298ad44`; that bundle's modified TypeScript sources were not retained in the upstream checkout. The imported JavaScript is maintained directly. Declaration files describe the public library API. Original licenses and notices are retained.

`lib/` contains code and required parser/schema assets. The bundle builder places it at `lib/dist/` in the self-contained distribution. Dependencies, the official Node executable and the pinned offline embedding model are provided by the verified runtime asset input. No installed runtime is edited during development.

The build records a digest of every maintained source file and includes the source snapshot in the release. A release can therefore be matched to exact code without an ambiguous modified-working-tree label.

Use the real Node test runner for release regression tests. Disable automatic daemon startup in in-process unit tests with `CODEGRAPH_NO_WATCH=1`; detached-watcher integration tests explicitly enable it and stop their own project watcher afterward.

## Automatic file tracking

Successful `init`, `index`, `sync`, and normal query commands start a detached native watcher for that exact repository. KIT also starts it when an indexed repository session opens. The watcher survives CLI exit, combines rapid saves for 300 ms, then runs an incremental sync. C# and registered PTN adapter files participate in the same add, edit, rename, and delete pipeline. Files excluded by the repository's ignore rules remain excluded.

`init`, `index`, and `sync` retain the active or saved watcher's scan scope when no ignore option is supplied, including while the watcher is stopped. New projects respect the root `.gitignore` by default. Use `--no-gitignore` to include those ignored files, or `--gitignore` to explicitly restore exclusion; automatic watching retains that choice. Built-in exclusions and `.codegraphignore` still apply in both modes.

Use `codegraph watch status <repository> --json` to inspect `active`, `ready`, `pendingFiles`, `lastSync`, and `lastError`. `active` means the daemon answered; `ready` means initial reconciliation completed. An empty pending list together with healthy index status indicates the currently observed changes were published. Processing time depends on repository size; this is event-driven indexing, not a zero-latency or compiler-complete semantic guarantee.

Normal queries read the watcher's publication directly when the watcher is ready, has no pending files, runs the same CLI release, and no full rebuild is required. Otherwise the query reconciles the repository inline. Concurrent readers therefore do not compete for the index writer while a ready watcher exists.

When the bundled C# grammar reports errors, CodeGraph parses each consistent conditional-compilation variant of the file and then, if needed, the same inputs with the upstream C# 11/12 grammar. A file reports parse errors only when neither path parses it; `../grammars/csharp/README.md` describes both grammars.

A file that cannot be parsed completely does not make the repository stale. The file keeps its partial symbols and diagnostics, and `status`, `doctor`, and query warnings report it. A sync fails only for repository-level errors, such as a lock, database, inventory, or document-indexing failure. A required full rebuild therefore completes once even when some files contain syntax errors. `init` and `index` still exit with code 1 and write `.codegraph/errors.log` when a file has diagnostics.

A watcher stops after 30 minutes without CLI requests. `CODEGRAPH_WATCH_IDLE_MS` overrides this limit. The next query or `codegraph watch start` starts it again. `watcher.log` is rotated to `watcher.log.1` when it exceeds 10 MB at watcher start. A temporary Windows sharing conflict on `watcher.json` is logged and retried on the next heartbeat; it does not stop the watcher.

Use `codegraph watch stop <repository>` to stop it explicitly or `CODEGRAPH_NO_WATCH=1` to disable automatic startup in CI. `codegraph watch start <repository>` resumes it and reconciles changes made while stopped. `--no-sync` query commands intentionally read the existing snapshot. Inline reconciliation retries a busy writer for up to 30 seconds and reports unknown freshness if it remains unavailable.

The installer validates every packaged runtime file against the release integrity manifest. Reinstalling repairs missing or modified code, models, and dependencies, promotes the bundled launcher on PATH, and migrates authenticated watchers to the installed release. It never signals a process solely because a saved PID matches.
