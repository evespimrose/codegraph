#!/bin/bash
# sonar-guard.sh: PreToolUse:Bash — Sonar Protocol 강제 이행
# HANDOVER-MANAGED
# bash 탐색·소스출력 명령 감지 → 차단. 판정 기준은 '명령어 이름'이 아니라 '분량'이다(6.3).
#   재귀 탐색 차단: find(-maxdepth 없음) · 재귀 ls · 재귀 grep · rg · fd
#   무범위 소스 출력 차단: cat/less/more/od/strings/nl/xxd · sed(범위 없음 또는 폭 > SED_SPAN_MAX)
#   허용: 단일 디렉터리 나열 · head/tail · 범위를 준 sed · 대상 파일을 지정한 grep
# D1: 서브에이전트(agent_id 존재) → 하드 deny(AskUserQuestion 유도 없음)
#     메인 → deny + AskUserQuestion 4택 유도(허용/codegraph 강제/거부/커스텀)
#     (CG_GATE_MAIN_STRICT=1 시 메인도 하드 deny — 유도 없음)
# 일회성 우회: .claude/state/sonar-override 에 비어있지 않은 내용이 있으면
#   1회 소모(삭제) 후 allow — 메인 + non-strict 경로에서만 적용.

INPUT=$(cat)
# 히어독 본문은 데이터지 명령이 아니다. 스크립트를 파일로 쓰는 호출에서 본문에 든 예시 문자열이
# 명령으로 오인돼 차단되는 사고가 실측됐다(2026-09-23, 문서 작성 중 2회). 판정 전에 본문을 걷어낸다.
# eval 로 문자열을 실행하는 우회는 남지만, 그 경로는 이 훅의 대상이 아니다.
COMMAND=$(echo "$INPUT" | python3 -c "
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(''); sys.exit(0)
cmd = (d.get('tool_input') or {}).get('command', '') or ''
for m in re.finditer(r'<<-?\s*[\"\\']?([A-Za-z_][A-Za-z0-9_]*)[\"\\']?', cmd):
    tag = m.group(1)
    end = re.search(r'^\s*' + re.escape(tag) + r'\s*$', cmd[m.end():], re.M)
    if end:
        cmd = cmd[:m.end()] + cmd[m.end() + end.end():]
print(cmd)
" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('session_id') or '')[:8])" 2>/dev/null || echo "")
OVERRIDE_FILE=".claude/state/sonar-override"
HISTORY_FILE=".claude/state/tool-history.log"
GATE_DECISION=".claude/hooks/lib/gate-decision.py"
TRAIL_N=5
# 소스 확장자 한 곳 정의 — 아래 분량 판정 규칙들이 공유한다
SOURCE_EXT='cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt|shader|cginc|hlsl'
# sed 로 한 번에 뽑을 수 있는 최대 줄 수. retrieval-discipline 부분 로드 상한과 같은 취지
SED_SPAN_MAX=${SONAR_SED_SPAN_MAX:-200}

b64() { printf '%s' "${1:-}" | base64 -w0 2>/dev/null || printf '%s' "${1:-}" | base64 | tr -d '\n'; }

# 결정 JSON 은 전부 lib/gate-decision.py 가 만든다(H7). 한국어는 프로세스 경계를 안 넘는다(H6).
emit_deny() { # $1=mode(ask|hard)
  CG_SESSION_ID="$SESSION_ID" CG_HISTORY="$HISTORY_FILE" CG_TRAIL_N="$TRAIL_N" \
  python3 "$GATE_DECISION" sonar "$1" "$(b64 "$VIOLATION")" "$(b64 "$DETAIL")" "$(b64 "$CTX_LABEL")"
}

# 탐색·소스출력 패턴 감지
VIOLATION=""
DETAIL=""

# find: 재귀 폭발이 문제지 find 자체가 아니다(5.2). -maxdepth 로 깊이를 묶은 호출은 통과시킨다.
if echo "$COMMAND" | grep -qE '(^|[|;&[:space:]])find([[:space:]]|$)' && ! echo "$COMMAND" | grep -qE '\-maxdepth[[:space:]]+[0-9]'; then
  VIOLATION="find (무제한 깊이)"
  DETAIL="find 재귀 탐색 차단. 깊이를 묶으려면 -maxdepth N 을 붙이거나 codegraph files 를 쓸 것."
# 'ls' 도 grep 과 같은 종류의 버그가 있었다(2026-09-11 수정). 이전 패턴은 명령 위치를 보지 않아
# 'ls' 두 글자가 단어 안에 들어 있기만 해도 매칭됐다. 실제 차단 사례: `gh api repos/o/r/pulls --jq ...`
# ("pulls --jq" 의 ls + 공백 + 긴 플래그). GitHub 의 pulls 엔드포인트가 정확히 이 모양이라
# RULE-11 GitHub 표준의 권장형이 상시 차단됐다. controls·tools·models 등도 같은 함정.
# 명령 위치(행 시작 · 파이프 · 세미콜론 · 앰퍼샌드 · 공백 뒤)에 있는 ls 만 매칭한다.
#   2026-09-23 재수정(5.1): 직전 패턴은 플래그에 r R l L a A 중 하나만 있어도 막았다. 그래서
#   ls -l · ls -lt · ls -la · ls --color 처럼 재귀가 전혀 아닌 단일 디렉터리 나열이 전부 차단됐다
#   (누적 오탐 29건). 이 규칙이 막으려는 것은 재귀뿐이므로 -R 과 --recursive 만 남긴다.
#   대문자 R 만 본다. 소문자 r 은 ls 에서 역순 정렬이라 재귀와 무관하다.
elif echo "$COMMAND" | grep -qE '(^|[|;&[:space:]])ls[[:space:]]+(-[a-zA-Z]*R[a-zA-Z]*([[:space:]]|$)|--recursive)'; then
  VIOLATION="ls -R"
  DETAIL="ls 재귀 나열 차단. 단일 디렉터리 나열(ls -l 등)은 허용되며, 트리 탐색은 codegraph files 를 쓸 것."
# 재귀 grep 은 '플래그'로만 성립한다(-r/-R/-rn/--recursive). 이전 패턴은 grep 뒤 아무 데나 있는
# '-r' 를 잡아, 검색어나 파일명에 그 두 글자가 들어가기만 해도 정상 grep 을 차단했다
# (실제 차단 사례: "docs-retrieval" 검색, my-report.txt 대상). 우회 토큰 상시화의 원인.
# 공백 뒤 단일 대시로 시작하는 토큰에 r/R 이 든 경우만 매칭하고, 파이프·세미콜론은 넘지 않는다.
elif echo "$COMMAND" | grep -qE '(grep[^|;&]*[[:space:]]-[a-zA-Z]*[rR][a-zA-Z]*([[:space:]]|$)|grep[^|;&]*--recursive)'; then
  VIOLATION="grep -r"
  DETAIL="재귀 grep 차단. 대상 파일을 먼저 codegraph 로 좁힌 뒤 해당 파일만 grep 할 것."
elif echo "$COMMAND" | grep -qE '^\s*rg\s'; then
  VIOLATION="rg (ripgrep)"
  DETAIL="ripgrep 전역 검색 차단. codegraph query 로 심볼 위치를 먼저 확보할 것."
elif echo "$COMMAND" | grep -qE '^\s*fd\s'; then
  VIOLATION="fd"
  DETAIL="fd 전역 파일 탐색 차단. codegraph files 를 쓸 것."
# 소스 출력(6.3): 판정 기준을 "명령어 이름"에서 "분량"으로 옮긴다.
#   - cat/less/more/od/strings/nl/xxd 는 범위를 줄 수 없어 항상 전문 출력이다 → 차단
#   - head/tail 은 기본 10줄로 본질적으로 유계다 → 허용(이전에는 막혀 부분 로드를 방해했다)
#   - sed -n 'A,Bp' 는 회수 규율이 바라는 형태다 → 폭이 상한 이내면 허용, 초과·무범위면 차단
elif echo "$COMMAND" | grep -qE "(^|[|;&[:space:]])(cat|less|more|od|strings|nl|xxd)[[:space:]]+[^|;&]*\.($SOURCE_EXT)([[:space:]]|$|['\"])"; then
  VIOLATION="source dump (cat/less/...)"
  DETAIL="범위 없는 소스 전문 출력 차단. sed -n 'A,Bp' 또는 Read(offset+limit) 로 구간만 읽을 것."
elif echo "$COMMAND" | grep -qE "(^|[|;&[:space:]])sed[[:space:]]+[^|;&]*\.($SOURCE_EXT)([[:space:]]|$|['\"])"; then
  SED_SPAN=$(SED_CMD="$COMMAND" python3 -c "
import os, re, sys
cmd = os.environ.get('SED_CMD', '')
spans = [abs(int(b) - int(a)) + 1 for a, b in re.findall(r\"(\d+)\s*,\s*(\d+)\s*p\", cmd)]
print(max(spans) if spans else -1)
" 2>/dev/null || echo "-1")
  if [ "$SED_SPAN" = "-1" ]; then
    VIOLATION="sed (범위 없음)"
    DETAIL="범위 없는 sed 소스 출력 차단. sed -n 'A,Bp' 형태로 구간을 명시할 것."
  elif [ "$SED_SPAN" -gt "$SED_SPAN_MAX" ] 2>/dev/null; then
    VIOLATION="sed (범위 ${SED_SPAN}줄)"
    DETAIL="sed 출력 폭 ${SED_SPAN}줄이 상한 ${SED_SPAN_MAX}줄을 넘음. 구간을 좁히거나 codegraph 로 좌표를 다시 잡을 것."
  fi
fi

if [ -z "$VIOLATION" ]; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

echo "$(date +%s) ${CTX_LABEL} bash:${VIOLATION}" >> .claude/state/violation-count.log

# 서브에이전트: 하드 deny, 유도 없음
if [ -n "$AGENT_ID" ]; then
  emit_deny hard
  exit 0
fi

# 메인 + strict: 하드 deny, 유도 없음
if [ "${CG_GATE_MAIN_STRICT:-0}" = "1" ]; then
  emit_deny hard
  exit 0
fi

# 메인 + 일회성 우회 토큰 존재: 1회 소모 후 allow
if [ -s "$OVERRIDE_FILE" ]; then
  REASON=$(cat "$OVERRIDE_FILE")
  rm -f "$OVERRIDE_FILE"
  echo "$(date +%s) ${CTX_LABEL} override-used:${VIOLATION}:${REASON}" >> .claude/state/violation-count.log
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 메인 + 우회 토큰 없음: deny + AskUserQuestion 4택 유도
emit_deny ask
exit 0
