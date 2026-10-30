#!/bin/bash
# codegraph-gate 판정 매트릭스. 통행증(6.2)과 분량(6.1) 두 축을 모두 본다.
# 사용: bash <이 파일>   — 임시 샌드박스에서 돌아 저장소를 더럽히지 않는다.
. "$(cd "$(dirname "$0")" && pwd)/lib/sandbox.sh"
HOOK=".claude/hooks/codegraph-gate.sh"
HIST=".claude/state/tool-history.log"
LOC=".claude/state/located-paths.log"
SID="matrixss"
PASS=0; FAIL=0

now=$(date +%s)

set_history() { printf '# Session started test session=%s\n%s\n' "$SID" "$1" > "$HIST"; }
set_located() { printf '%s\n' "$1" > "$LOC"; }

check() { # $1=기대 $2=라벨 $3=file_path $4=limit(빈값 가능)
  local want="$1" label="$2" fp="$3" lim="$4" got
  got=$(FP="$fp" LIM="$lim" SID="$SID" python3 -c "
import json, os
ti = {'file_path': os.environ['FP']}
if os.environ.get('LIM'):
    ti['limit'] = int(os.environ['LIM'])
print(json.dumps({'tool_name':'Read','session_id':os.environ['SID']+'xxxx','tool_input':ti}))
" | bash "$HOOK" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['permissionDecision'])" 2>/dev/null)
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  ok   %-6s %s\n' "$got" "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL want=%s got=%s  %s\n' "$want" "$got" "$label"; fi
}

check_grep() { # $1=기대 $2=라벨 $3=pattern $4=type(빈값 가능)
  local want="$1" label="$2" pat="$3" ty="$4" got
  got=$(PAT="$pat" TY="$ty" SID="$SID" python3 -c "
import json, os
ti = {'pattern': os.environ['PAT']}
if os.environ.get('TY'):
    ti['type'] = os.environ['TY']
print(json.dumps({'tool_name':'Grep','session_id':os.environ['SID']+'xxxx','tool_input':ti}))
" | bash "$HOOK" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['permissionDecision'])" 2>/dev/null)
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  ok   %-6s %s\n' "$got" "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL want=%s got=%s  %s\n' "$want" "$got" "$label"; fi
}

echo "== 통행증 없음 (6.2) =="
set_history "$now Bash MAIN ok $SID"
set_located ""
check deny "codegraph 없음 · 전문 Read" "$BIG" ""
check deny "codegraph 없음 · limit 100" "$BIG" "100"

echo "== 창 안 codegraph 있음, 분량 판정 (6.1) =="
set_history "$now codegraph_query MAIN ok $SID"
set_located ""
check deny  "대형파일 · limit 없음(전문)" "$BIG" ""
check allow "대형파일 · limit 100" "$BIG" "100"
check deny  "대형파일 · limit 5000(상한 초과)" "$BIG" "5000"
[ -n "$SMALL" ] && check allow "소형파일 · limit 없음" "$SMALL" ""

echo "== 좌표 일치 (6.2) =="
set_history "$now Bash MAIN ok $SID"
set_located "$now $SID $BIG"
check allow "좌표 일치 · limit 100" "$BIG" "100"
check deny  "좌표 일치라도 전문 Read 는 분량에서 막힘" "$BIG" ""

echo "== 다른 세션의 호출은 내 게이트를 열지 못한다 (H4) =="
set_history "$now codegraph_query MAIN ok othersid"
set_located ""
check deny "타 세션 codegraph · limit 100" "$BIG" "100"

echo "== 세션 헤더는 창을 먹지 않는다 (H2) =="
set_history "$(printf '%s codegraph_query MAIN ok %s\n%s Bash MAIN ok %s\n%s Bash MAIN ok %s\n%s Bash MAIN ok %s\n%s Bash MAIN ok %s' "$now" "$SID" "$now" "$SID" "$now" "$SID" "$now" "$SID" "$now" "$SID")"
set_located ""
check allow "헤더 제외 후 창 5칸에 codegraph 잔존" "$BIG" "100"

echo "== 리터럴 Grep (type/glob 없음) 은 문서·설정 검색으로 통과 (B1) =="
set_history "$now Bash MAIN ok $SID"
set_located ""
check_grep allow "mcp__codegraph__ 리터럴 · 통행증 없음" "mcp__codegraph__" ""
check_grep allow "Task 식별자 모양 리터럴 · 통행증 없음" "Task" ""
check_grep deny  "type=py 소스 검색 · 통행증 없음" "def run" "py"

echo "== Windows 역슬래시 경로의 .claude/ 파일은 화이트리스트 =="
set_history "$now Bash MAIN ok $SID"
set_located ""
check allow "역슬래시 .claude/hooks/lib/*.py · 통행증 없음" 'D:\repo\.claude\hooks\lib\gate.py' ""
check deny  "역슬래시 소스 경로 · 통행증 없음" 'D:\repo\src\app.py' ""

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
