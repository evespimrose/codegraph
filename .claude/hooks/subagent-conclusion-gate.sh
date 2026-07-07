#!/bin/bash
# subagent-conclusion-gate.sh: SubagentStop 훅 — 서브에이전트도 메인과 동일 output 컨베이어 강제
# (탈옥 방지: 디스패치가 승인돼 서브에이전트가 돌았어도 output-arm SCHEMA 준수를 결정론적으로 강제)
# 계약: 차단 안 함(exit 0 always). 미준수 산출물은 삭제 대신 quarantine 이동 — 유실 없음.

set -uo pipefail

STATE_FILE=".claude/state/output-arm"
STATE="on"
[ -f "$STATE_FILE" ] && STATE=$(tr -d '[:space:]' < "$STATE_FILE")
[ "$STATE" != "on" ] && exit 0

# 변경 파일 감지: git 우선, 비git이면 mtime 폴백 (output-arm-gate.sh와 동일 패턴)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CHANGED=$(git status --porcelain 2>/dev/null | grep -vE '\.claude/state/output-arm' || true)
else
  CHANGED=$(find . -type f -mmin -10 2>/dev/null | grep -vE '/\.git/|\.claude/state/output-arm' || true)
fi
[ -z "$CHANGED" ] && exit 0

if ! echo "$CHANGED" | grep -q 'docs/output/'; then
  echo '{"systemMessage": "[subagent-conclusion-gate] 서브에이전트 작업 완료 - 변경 감지 but docs/output/ 적재 없음. 서브에이전트도 output 컨베이어 준수 필요(SCHEMA.md)."}'
  exit 0
fi

LATEST=$(ls -t docs/output/*.md 2>/dev/null | head -1)
[ -z "$LATEST" ] && exit 0

MISSING=""
for f in task date project blk links keywords compressed source_turns; do
  grep -q "^${f}:" "$LATEST" 2>/dev/null || MISSING="$MISSING $f"
done

if [ -n "$MISSING" ]; then
  mkdir -p docs/output/quarantine
  base=$(basename "$LATEST")
  dest="docs/output/quarantine/$base"
  mv "$LATEST" "$dest"
  echo "{\"systemMessage\": \"[subagent-conclusion-gate] 서브에이전트 산출물 스키마 미준수(누락:$MISSING) -> docs/output/quarantine/$base 로 이동. 원본 유지(삭제 아님) - 검토 후 SCHEMA.md 맞춰 재적재.\"}"
fi

exit 0
