#!/bin/bash
# state-doctor.sh — 파생 상태(codegraph·riper-state·cxt 경로·md 링크) 무결성/신선도 정합 센서
#
# 원리: 지상 진실 = git working tree + filesystem. 시스템이 "신뢰하라"고 명령하는 모든
#       파생 표현(codegraph·dictionary·BLK·cxt 주입·riper-state)은 코드의 사본이며 부패한다.
#       이 센서가 그 충실도(fidelity)를 git/fs에 자동 대조한다. git만은 자기 자신의 stale
#       사본일 수 없으니 재귀는 거기서 멈춘다.
#
# 출력: stdout 1행 요약(STATE HEALTH: green|yellow|red|unknown ...)
#        .claude/state/health  →  1행=토큰, 이후=상세, 끝에 provenance(checked_at·git_sha)
# 계약: 게이트 아님 — 항상 exit 0(센서는 막지 않는다). 단 silent-pass 금지:
#       검사기 자신이 못 도는 경우 fail-loud 로 'unknown'을 크게 표시한다(검사기도 코드다).
# 사용: state-doctor.sh [--full]   (--full = 저빈도 repo 전역 md dead-link 스캔 포함)
# 정책: CLAUDE.md RULE-1 조건부 신뢰의 게이트. session-start.sh 가 매 세션 발화.

set -uo pipefail
FULL=0; [ "${1:-}" = "--full" ] && FULL=1

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
HEALTH=".claude/state/health"
NO_GIT=0

emit_unknown() { # 검사기 자신이 못 도는 경우 — 절대 silent pass 금지(가드 死 ≠ 보호받음)
  echo "STATE HEALTH: unknown ($1)"
  if [ -n "${ROOT:-}" ]; then
    mkdir -p "$ROOT/.claude/state" 2>/dev/null
    printf 'unknown\nself: %s\nchecked_at=%s\n' \
      "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" > "$ROOT/$HEALTH" 2>/dev/null
  fi
  exit 0
}

if [ -z "$ROOT" ]; then
  # fs 폴백: git 저장소가 아니거나 하위 디렉터리 전용 세션 — CLAUDE.md 상향 탐색으로 루트 추정
  NO_GIT=1
  d="$PWD"
  while [ "$d" != "/" ] && [ "$d" != "." ]; do
    [ -f "$d/CLAUDE.md" ] && ROOT="$d" && break
    nd=$(dirname "$d"); [ "$nd" = "$d" ] && break; d="$nd"
  done
fi
[ -n "$ROOT" ] || emit_unknown "git repo 미해결 — 지상 진실 없음"
cd "$ROOT" || emit_unknown "repo root 진입 실패"
# self-canary: 검사기의 세계관 점검 — 알려진 불변 파일이 안 보이면 검사기 자체를 못 믿는다
[ -f "CLAUDE.md" ] || emit_unknown "CLAUDE.md 부재 — 검사기 시야 손상"

ISSUES=()                 # 각 항목: "level|code|detail"
add() { ISSUES+=("$1|$2|$3"); }

# ── Check 1: cxt 주입 경로 정합 (session-start glob ↔ 실제 파일 위치) ──
shopt -s nullglob
inj=( docs/contextmd/cxt*.md cxt/*.md )
if [ ${#inj[@]} -eq 0 ]; then
  alt=( docs/cxtmd/cxt*.md )
  if [ ${#alt[@]} -gt 0 ]; then
    add yellow cxt-path-drift "session-start는 docs/contextmd/를 주입하나 실제 cxt는 docs/cxtmd/(${#alt[@]}개) — 경로 통일 필요"
  else
    add yellow cxt-empty "주입 대상 cxt가 docs/contextmd/·cxt/ 어디에도 없음"
  fi
fi
shopt -u nullglob

# ── Check 2: .riper-state 적법성 (MODE·PLAN_FILE·BRANCH·나이) ──
RS=".claude/memory-bank/.riper-state"
if [ -f "$RS" ]; then
  MODE=$(sed -n 's/^MODE=//p'      "$RS" | head -1 | tr -d '\r')
  PF=$(  sed -n 's/^PLAN_FILE=//p' "$RS" | head -1 | tr -d '\r')
  RB=$(  sed -n 's/^BRANCH=//p'    "$RS" | head -1 | tr -d '\r')
  ST=$(  sed -n 's/^STARTED=//p'   "$RS" | head -1 | tr -d '\r')
  case "${MODE:-NONE}" in
    NONE|RESEARCH|INNOVATE|PLAN|EXECUTE|REVIEW) ;;
    *) add red riper-mode "비적법 MODE='${MODE:-}'";;
  esac
  if [ "${MODE:-NONE}" != "NONE" ]; then
    if [ -z "$PF" ] || [ ! -f "$PF" ]; then
      add red riper-plan "MODE=$MODE 인데 PLAN_FILE 부재/없음: '${PF:-<empty>}'"
    fi
    if [ "$NO_GIT" != 1 ]; then
      cb=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
      if [ -n "$RB" ] && [ -n "$cb" ] && [ "$RB" != "$cb" ]; then
        add yellow riper-branch "state BRANCH=$RB ≠ git HEAD=$cb"
      fi
    fi
    if [ -n "$ST" ]; then
      se=$(date -d "$ST" +%s 2>/dev/null || echo "")
      if [ -n "$se" ]; then
        days=$(( ( $(date +%s) - se ) / 86400 ))
        [ "$days" -gt 3 ] && add yellow riper-stale "MODE=$MODE 가 ${days}일째 미종결 (STARTED=$ST)"
      fi
    fi
  fi
fi

# ── Check 3: codegraph 무결성/신선도 ──
DB=""
for c in .codegraph/codegraph.db .codegraph/index.db; do [ -f "$c" ] && DB="$c" && break; done
if [ -z "$DB" ]; then
  if [ -d ".codegraph" ]; then add yellow cg-missing "codegraph DB 파일 미발견(.codegraph 존재)"
  else add yellow cg-absent "codegraph 미초기화(.codegraph 없음)"; fi
else
  dbm=$(stat -c %Y "$DB" 2>/dev/null || echo 0)
  if [ "$NO_GIT" != 1 ]; then
    newest=0
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      m=$(stat -c %Y "$f" 2>/dev/null || echo 0)
      [ "$m" -gt "$newest" ] && newest=$m
    done < <(git ls-files '*.cs' '*.py' '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null)
    [ "$newest" -gt "$dbm" ] && add yellow cg-stale "소스가 codegraph DB보다 최신 (reindex 필요)"
  fi
  if command -v sqlite3 >/dev/null 2>&1; then
    ok=$(sqlite3 "$DB" 'PRAGMA integrity_check;' 2>/dev/null | head -1)
    [ "$ok" = "ok" ] || add red cg-corrupt "codegraph DB integrity_check 실패: ${ok:-<no result>}"
  fi
fi
[ "$NO_GIT" = 1 ] && add info nogit-degraded "비-git 환경: branch 비교·git ls-files 신선도 체크 생략"

# ── Check 4 (옵션·--full): repo 전역 md 상대링크 dead-link 스캔 ──
if [ "$FULL" -eq 1 ]; then
  while IFS= read -r md; do
    [ -f "$md" ] || continue
    d=$(dirname "$md")
    while IFS= read -r tgt; do
      [ -z "$tgt" ] && continue
      case "$tgt" in http*|"#"*|mailto:*|"<"*) continue;; esac
      t="${tgt%%#*}"; t="${t%%\?*}"
      [ -z "$t" ] && continue
      [ -e "$d/$t" ] || [ -e "$t" ] || add yellow dead-link "$md → $tgt"
    done < <(grep -oE ']\([^)]+\)' "$md" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//')
  done < <(git ls-files '*.md' 2>/dev/null)
fi

# ── 집계 (worst-of) + provenance 기록 ──
level=green
for it in "${ISSUES[@]:-}"; do
  [ -z "$it" ] && continue
  case "${it%%|*}" in
    red) level=red;;
    yellow) [ "$level" != red ] && level=yellow;;
  esac
done
sha=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
now=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
mkdir -p .claude/state 2>/dev/null
{
  echo "$level"
  for it in "${ISSUES[@]:-}"; do
    [ -z "$it" ] && continue
    lv="${it%%|*}"; rest="${it#*|}"; code="${rest%%|*}"; det="${rest#*|}"
    echo "$lv $code: $det"
  done
  echo "checked_at=$now"
  echo "git_sha=$sha"
} > "$HEALTH"

# ── stdout 1행 요약 ──
n=0; codes=""
for it in "${ISSUES[@]:-}"; do
  [ -z "$it" ] && continue
  n=$((n+1)); rest="${it#*|}"; codes="$codes,${rest%%|*}"
done
if [ "$level" = green ]; then
  echo "STATE HEALTH: green"
else
  echo "STATE HEALTH: $level ($n) ${codes#,}"
fi
exit 0
