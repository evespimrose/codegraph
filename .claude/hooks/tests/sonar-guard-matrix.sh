#!/bin/bash
# sonar-guard 판정 매트릭스. 차단 훅은 반드시 매트릭스로 검증한다(오탐·미탐 양쪽).
# 사용: bash <이 파일>   — 임시 샌드박스에서 돌아 저장소를 더럽히지 않는다.
. "$(cd "$(dirname "$0")" && pwd)/lib/sandbox.sh"
HOOK=".claude/hooks/sonar-guard.sh"
SRC="$BIG"
PASS=0; FAIL=0

check() { # $1=기대(allow|deny)  $2=명령
  local want="$1" cmd="$2" got
  got=$(printf '%s' "$(CMD="$cmd" python3 -c "
import json, os
print(json.dumps({'tool_name':'Bash','session_id':'testsess','tool_input':{'command':os.environ['CMD']}}))
")" | bash "$HOOK" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['permissionDecision'])" 2>/dev/null)
  if [ "$got" = "$want" ]; then
    PASS=$((PASS+1)); printf '  ok   %-6s %s\n' "$got" "$cmd"
  else
    FAIL=$((FAIL+1)); printf '  FAIL want=%s got=%s  %s\n' "$want" "$got" "$cmd"
  fi
}

# 저장소마다 소스 구성이 다르다. 판정은 경로 문자열만 보므로 실재하지 않아도 되지만,
# 확장자는 이 저장소에 맞춰 잡는다(이 스크립트는 배포 대상이라 RX_1 밖에서도 돌아야 한다).
SRC=$(git ls-files '*.cs' '*.py' '*.ts' '*.js' 2>/dev/null | head -1)
[ -n "$SRC" ] || SRC="src/Example.cs"

echo "== 통과해야 하는 것 (오탐 회귀) =="
check allow 'ls'
check allow 'ls -l .claude/state'
check allow 'ls -lt docs/output'
check allow 'ls -la .codegraph'
check allow 'ls --color=auto'
check allow 'git status --porcelain'
check allow 'gh api repos/cli/cli/pulls --jq ".[]|.number"'
check allow 'head -20 '"$SRC"''
check allow 'tail -5 .codegraph/errors.log'
check allow "sed -n '10,50p' '"$SRC"'"
check allow 'grep -n "public" '"$SRC"''
check allow 'find . -maxdepth 1 -name "*.json"'
check allow 'codegraph query "CellRenderer" -p . -j -l 5'
check allow 'cat docs/output/SCHEMA.md'
check allow 'echo "cat foo.cs"'
# 히어독 본문은 데이터 — 본문에 명령처럼 보이는 문자열이 있어도 통과해야 한다
check allow "$(printf 'cat > note.md <<%s\n  ls -R 은 재귀 나열이다\n  grep -rn 도 마찬가지\nEOF\n' "'EOF'")"
check allow "$(printf 'python3 - <<%s\nprint("find . -name x")\nPYEOF\n' "'PYEOF'")"
# 히어독 '밖'의 위반은 본문이 있어도 여전히 잡아야 한다
check deny "$(printf 'grep -rn foo Assets; cat > note.md <<%s\nbody\nEOF\n' "'EOF'")"

echo "== 막아야 하는 것 (미탐 회귀) =="
check deny 'ls -R Assets'
check deny 'ls -laR .'
check deny 'find . -name "*.cs"'
check deny 'grep -rn "Initialize" Assets'
check deny 'grep -r foo .'
check deny 'rg Initialize'
check deny 'fd -e cs'
check deny 'cat '"$SRC"''
check deny "sed -n '1,9999p' '"$SRC"'"
check deny "sed '' '"$SRC"'"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
