#!/bin/bash
# emit-output.sh — assembles a docs/output/*.md conclusion from A-grade (machine-derivable)
# sources so the main context window only passes a short command, not the document body.
# (M3 Phase 2, 2026-08-15 — see docs/output/2026-08-15-M3-execution.md for design rationale.)
#
# A-grade (assembled here, deterministic, no LLM call): date, project, git diff --stat,
# changed-file list -> links/keywords, compressed=false.
# B-grade (caller-supplied via CLI args, NOT guessed): --task, --note, --source-turns.
# C-grade (long narrative/analysis): explicitly out of scope — write those by hand.
#
# Source-format dependency (cross-reference — keep in sync):
#   Reads: git diff --stat / git diff --name-only (stable git plumbing, no external format).
#   Does NOT read .claude/state/tool-history.log — confirmed corrupted first line
#   (session-start.sh's `os.popen('date')` invokes Windows date.exe, which prompts
#   interactively without stdin and pollutes the log header). See M3 Phase 1 finding.
#   If tool-history.log's format is fixed, this script may be extended to use it.
#
# BLK value must match the M2-confirmed parseable pattern (BLK-\d+); anything else
# (e.g. the legacy "인프라" label) leaves codegraph's hits.blk null on retrieval.
set -uo pipefail

usage() {
  echo "Usage: emit-output.sh --task <str> --blk <BLK-NNN> [--note <str>] [--source-turns <int>] [--slug <str>] [--dry-run]" >&2
  exit 1
}

TASK=""; BLK=""; NOTE=""; SRC_TURNS=""; SLUG=""; DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --task) TASK="$2"; shift 2;;
    --blk) BLK="$2"; shift 2;;
    --note) NOTE="$2"; shift 2;;
    --source-turns) SRC_TURNS="$2"; shift 2;;
    --slug) SLUG="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) usage;;
    *) echo "emit-output: unknown arg '$1'" >&2; usage;;
  esac
done

# ── Fail loud, not silent (Phase 2 비목표: 에러를 경고로 삼키지 않는다) ──
[ -z "$TASK" ] && { echo "emit-output: --task is required" >&2; exit 1; }
[ -z "$BLK" ]  && { echo "emit-output: --blk is required" >&2; exit 1; }
if ! echo "$BLK" | grep -qE '^BLK-[0-9]+$'; then
  echo "emit-output: --blk '$BLK' does not match BLK-\\d+ — codegraph hits.blk would be null (M2 finding). Use BLK-000 for non-code work." >&2
  exit 1
fi
[ -z "$SRC_TURNS" ] && { echo "emit-output: --source-turns is required (not machine-derivable)" >&2; exit 1; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$ROOT" ] && { echo "emit-output: not inside a git repository" >&2; exit 1; }
cd "$ROOT" || exit 1

# ── A-grade assembly ──
DATE="$(date +%Y-%m-%d)"
PROJECT="$(basename "$ROOT")"
# docs/output/ excluded from diff scanning — it's this script's OWN output location;
# including it would make repeated runs non-idempotent (each run's file becomes the
# next run's "change") and pollute Changes/keywords with self-referential noise.
DIFFSTAT="$(git diff --stat HEAD -- . ':!docs/output/' 2>/dev/null)"
CHANGED_FILES="$(git diff --name-only HEAD -- . ':!docs/output/' 2>/dev/null; git status --porcelain -- . ':!docs/output/' 2>/dev/null | awk '{print $2}')"
CHANGED_FILES="$(printf '%s\n' "$CHANGED_FILES" | sort -u | grep -v '^$')"

if [ -z "$DIFFSTAT" ] && [ -z "$CHANGED_FILES" ]; then
  echo "emit-output: WARNING — no git diff detected; Changes section will be empty" >&2
fi

# keywords: basenames of changed files, deduped, capped at 7 (SCHEMA.md: 3~7개).
# Dotfiles (e.g. .riper-state) keep their full name — a naive "strip after last dot"
# would consume the entire basename and emit an empty keyword.
KEYWORDS=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  b="$(basename "$f")"
  case "$b" in
    .*) ;;
    *.*) b="${b%.*}";;
  esac
  KEYWORDS="$(printf '%s\n%s' "$KEYWORDS" "$b")"
done <<EOF
$CHANGED_FILES
EOF
KEYWORDS="$(printf '%s\n' "$KEYWORDS" | grep -v '^$' | sort -u | head -7 | paste -sd, -)"

# links: backtick-quoted relative paths of changed files (cap 10 to bound size)
LINKS=""
if [ -n "$CHANGED_FILES" ]; then
  LINKS="$(printf '%s\n' "$CHANGED_FILES" | head -10 | sed 's/^/`/;s/$/`/' | paste -sd' ' -)"
fi

SLUG="${SLUG:-$(echo "$TASK" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9가-힣]+/-/g; s/^-+|-+$//g' | cut -c1-50 | sed -E 's/-+$//')}"
[ -z "$SLUG" ] && SLUG="output"
OUT="docs/output/${DATE}-${SLUG}.md"

SONAR="자동 조립(emit-output.sh) — A등급 데이터만 사용. codegraph 미해당(인프라)."
if printf '%s\n' "$CHANGED_FILES" | grep -qE '\.(cs|ts|js|py|sh|ps1)$'; then
  SONAR="자동 조립(emit-output.sh) — 코드 파일 변경 포함, codegraph_context로 영향 범위 확인 권장."
fi

DECISIONS="N/A (emit-output.sh 자동 조립 — 판단 근거는 별도 기재 필요 시 --note)"
if [ -n "$NOTE" ]; then
  DECISIONS="$NOTE"
fi

BODY="$(cat <<EOF
# ${TASK}

<!-- BLK: ${BLK} -->
<!-- SONAR-REMINDER: ${SONAR} -->

task: ${TASK}
date: ${DATE}
project: ${PROJECT}
blk: ${BLK}
links: ${LINKS}
keywords: ${KEYWORDS}
compressed: false
source_turns: ${SRC_TURNS}

---

## Result
${TASK}

## Changes
\`\`\`
${DIFFSTAT:-(no diff detected)}
\`\`\`

## Decisions
${DECISIONS}
EOF
)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "--- DRY RUN: would write $OUT ---"
  printf '%s\n' "$BODY"
  exit 0
fi

mkdir -p "$(dirname "$OUT")"
printf '%s\n' "$BODY" > "$OUT"
echo "emit-output: wrote $OUT"
