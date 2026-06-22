# Fix Markdown Watch and Sync Broken Links
<!-- BLK: 인프라 -->
<!-- CAVE-MAN-REMINDER: codegraph 우선 (codegraph_context → search → node). find/grep -r/ls -r/rg/fd/cat .cs 자동 차단됨 -->

## Problem Summary
There are two broken links preventing Markdown files from being automatically indexed:

### ① Watcher Event Gate (src/sync/watcher.ts:224)
- `if (!isSourceFile(normalized)) return;` - Markdown files are immediately discarded here
- `isSourceFile` (grammars.ts:112) only passes extensions registered in `EXTENSION_MAP` (grammars.ts:46)
- `.md` is not in this map, so even though chokidar is watching docs/, events are discarded and `scheduleSync()` is never called

### ② No Markdown Indexing in Sync Path (src/index.ts:488)
- `indexMarkdown` (docs/indexer.ts:55) is only called by `indexAll` (index.ts:348)
- The debounced callback from watcher (`watch()` → `this.sync()`) doesn't call `indexMarkdown`
- Markdown updates currently only happen with full `codegraph index` re-runs

## Good News
- `indexMarkdown` already uses `content_hash` based incremental indexing (indexer.ts:116-121), so only changed Markdown files are re-embedded
- Just need to connect the links, cost is limited to changed files

## Follow-up Plan

### Layer A: Watcher Pass
- Extend gate at watcher.ts:224 to `isSourceFile(p) || isMarkdownFile(p)`
- Only pass Markdown files if docs indexing opt-in (`resolveDocsEnabled`) is on - prevents unnecessary sync

### Layer B: Sync Re-indexing
- At end of `sync()` in index.ts, add `indexMarkdown` call same as indexAll:410-417 block (best-effort, gated)
- Or only call when there are `.md` files in changed paths

### Layer C: Verification
- Windows VM test: edit docs/*.md → confirm mdast_metadata/concept nodes are updated after debounce
- Confirm no node explosion (concept only from GOVERNED_DIRS)
- Confirm .ts auto-update regression doesn't happen

## Implementation Decisions (Recommended)
- **Markdown watch activation**: Only when docs indexing opt-in is on (recommended)
- **MD scan vs changed files**: For ~60 files, listMarkdownFiles + hash comparison is cheap, so always call at end of sync (simple and safe)

## Next Steps
This is a multi-file change with behavior changes, so should use RIPER (plan→execute→review) + quality-sentinel gate. Need decision on whether to proceed and the two implementation decisions to start PLAN phase.

All work must deadly and strictly follow the rules defined in SKILL.md and CLAUDE.md.
