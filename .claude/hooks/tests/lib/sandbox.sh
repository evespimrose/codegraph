#!/bin/bash
# 판정 매트릭스 공용 샌드박스.
#
# 훅은 cwd 기준 상대경로(.claude/hooks/lib/..., .claude/state/...)로 동작한다. 그래서 테스트를
# 저장소 루트에서 그냥 돌리면 두 가지가 깨진다.
#   1. 훅이 hooks/ 에 있는 배포 저장소(KIT)에서는 경로가 안 맞아 전량 실패한다.
#   2. 통과하더라도 저장소에 .claude/state/ 를 만들어 놓는다.
# 그래서 임시 디렉터리에 최소 레이아웃을 세우고 그 안에서 돌린다. 어느 저장소에서 돌리든 같다.
#
# 사용:  . "$(dirname "$0")/lib/sandbox.sh"   → 이후 cwd 는 샌드박스, 훅은 .claude/hooks/<name>
# 제공 변수: SANDBOX(경로) · BIG(400줄 초과 소스) · SMALL(300줄 미만 소스)

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" && pwd)"
HOOKS_DIR="$(dirname "$TESTS_DIR")"

SANDBOX="$(mktemp -d 2>/dev/null || mktemp -d -t gatetest)"
mkdir -p "$SANDBOX/.claude/hooks/lib" "$SANDBOX/.claude/state" "$SANDBOX/src"

for f in sonar-guard.sh codegraph-gate.sh tool-history-recorder.sh; do
  [ -f "$HOOKS_DIR/$f" ] && cp "$HOOKS_DIR/$f" "$SANDBOX/.claude/hooks/$f"
done
for f in gate-decision.py outcome.py; do
  [ -f "$HOOKS_DIR/lib/$f" ] && cp "$HOOKS_DIR/lib/$f" "$SANDBOX/.claude/hooks/lib/$f"
done

# 분량 게이트 검증용 소스는 실제 저장소에서 찾지 않고 만들어 쓴다. 저장소 구성에 안 흔들린다.
BIG="src/Big.cs"
SMALL="src/Small.cs"
awk 'BEGIN { for (i = 1; i <= 500; i++) print "        // line " i }' > "$SANDBOX/$BIG"
awk 'BEGIN { for (i = 1; i <= 100; i++) print "        // line " i }' > "$SANDBOX/$SMALL"

cleanup_sandbox() { [ -n "$SANDBOX" ] && rm -rf "$SANDBOX"; }
trap cleanup_sandbox EXIT

cd "$SANDBOX" || exit 1
