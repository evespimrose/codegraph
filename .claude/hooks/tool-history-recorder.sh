#!/bin/bash
# tool-history-recorder.sh: PostToolUse — 도구 사용 이력 기록 (L1 검증용)
# HANDOVER-MANAGED
# 모든 도구 호출을 .claude/state/tool-history.log 에 append.
# 형식: <epoch> <TOOL_NAME> <AGENT_TYPE|MAIN> <outcome> <session8>
#   outcome ∈ {ok, failed, unknown} — 판정은 lib/outcome.py 가 한다(2026-09-23 이관).
#     이전 방식은 응답 전문에서 "no results found" 류를 부분일치로 찾아, 그 문구가 인용만
#     되어 있어도 실패로 찍었다(실측 오판: 훅 소스를 출력한 Bash 3건, 훅 파일을 고친 Edit).
#     실패 오판은 codegraph-gate 의 통행증을 잘못 닫으므로 그냥 두면 안 된다.
#     원칙과 오판 이력은 lib/outcome.py 머리에 있다.

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"
# H5: 게이트가 보는 활성 로그는 짧게 유지하되(윈도 판정용), 장기 분석용 원장은 따로 계속 쌓는다.
#   이전에는 100줄만 남아 세션 간 사용 이력 분석이 불가능했다(codegraph 사용 감사 시 실제로
#   트랜스크립트 JSONL 을 직접 채굴해야 했다).
LEDGER_FILE=".claude/state/tool-history-ledger.log"
ACTIVE_KEEP=${TOOL_HISTORY_KEEP:-100}
LEDGER_KEEP=${TOOL_HISTORY_LEDGER_KEEP:-20000}

TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('session_id') or '')[:8])" 2>/dev/null || echo "")

# codegraph 는 MCP 서버가 아니라 CLI 바이너리라, 셸에서는 tool_name 이 전부 "Bash" 로만 찍힌다.
#   codegraph-gate.sh 의 LOCATING_TOOLS 판정은 tool_name 필드에 "codegraph_<subcommand>" 형태를
#   기대하므로(과거 MCP 툴명 규약), Bash 호출을 그 형태로 번역해 기록해야 게이트가 CLI 사용을 인식한다.
#   Windows Git Bash 는 PATH 에 codegraph 가 아니라 codegraph.cmd(.exe) 만 있는 경우가 있어
#   첫 토큰의 basename(확장자 무시)으로 판정 — 경로 접두사/확장자 유무와 무관하게 인식.
#   아래 서브커맨드 목록은 codegraph-gate.sh 의 LOCATING_TOOLS 와 한 쌍 — 함께 바꿀 것.
if [ "$TOOL_NAME" = "Bash" ]; then
  CODEGRAPH_SUBCOMMAND=$(HOOK_INPUT="$INPUT" python3 - <<'PYEOF' 2>/dev/null || echo ""
import os, json, re

SUBCOMMANDS = ('context', 'query', 'callers', 'callees', 'impact',
               'files', 'backlinks', 'docs', 'status')

try:
    payload = json.loads(os.environ.get('HOOK_INPUT', '') or '{}')
except Exception:
    print('')
    raise SystemExit(0)
command = (payload.get('tool_input') or {}).get('command', '') or ''

# 실전 명령은 맨몸 호출이 아니라 함수정의·`cd X && ...`·파이프·환경변수 접두를 달고 온다.
# 명령 전체를 통째로 정규식 검색하면 `echo "codegraph query"` 같은 문자열까지 오인식하므로,
# 셸 구분자로 세그먼트를 나눈 뒤 각 세그먼트의 "실제 실행 토큰"만 검사한다.
found = ''
for segment in re.split(r'[;\n|&]+', command):
    segment = segment.strip()
    # 선행 환경변수 할당(VAR=value)은 실행 토큰이 아니므로 벗겨낸다
    while True:
        assignment = re.match(r'[A-Za-z_][A-Za-z0-9_]*=\S*\s+', segment)
        if not assignment:
            break
        segment = segment[assignment.end():]
    tokens = segment.split()
    if len(tokens) < 2:
        continue
    # Windows 절대경로(백슬래시)도 basename 추출되도록 구분자 정규화 후 확장자 제거
    executable = os.path.splitext(os.path.basename(tokens[0].replace(chr(92), '/')))[0]
    if executable == 'codegraph' and tokens[1] in SUBCOMMANDS:
        found = tokens[1]
        break
print(found)
PYEOF
)
  [ -n "$CODEGRAPH_SUBCOMMAND" ] && TOOL_NAME="codegraph_${CODEGRAPH_SUBCOMMAND}"
fi

# 성공·실패 판정은 lib/outcome.py 가 한다. 판정 원칙과 오판 이력은 그 파일 머리에 있다.
OUTCOME=$(echo "$INPUT" | TOOL_NAME="$TOOL_NAME" python3 .claude/hooks/lib/outcome.py 2>/dev/null || echo "unknown")

if [ -n "$TOOL_NAME" ]; then
  # 형식: <epoch> <TOOL> <CTX> <outcome> <session8>
  #   5번째 필드가 H4 로 추가된 세션 id. 기존 소비자는 $1~$4 만 보므로 하위호환이다.
  ROW="$(date +%s) $TOOL_NAME ${CTX_LABEL} ${OUTCOME} ${SESSION_ID:-nosession}"
  echo "$ROW" >> "$HISTORY_FILE"
  echo "$ROW" >> "$LEDGER_FILE"

  # 활성 로그: 게이트 윈도 판정용이라 짧게. 헤더(#)는 보존해 세션 경계를 남긴다.
  if [ "$(wc -l < "$HISTORY_FILE" 2>/dev/null || echo 0)" -gt "$ACTIVE_KEEP" ]; then
    HEADER=$(head -1 "$HISTORY_FILE" 2>/dev/null)
    BODY=$(grep -v '^#' "$HISTORY_FILE" 2>/dev/null | tail -n "$ACTIVE_KEEP")
    { [ -n "$HEADER" ] && printf '%s\n' "$HEADER"; printf '%s\n' "$BODY"; } > "$HISTORY_FILE"
  fi

  # 장기 원장: 상한을 넉넉히 두고 넘으면 앞에서 자른다.
  if [ "$(wc -l < "$LEDGER_FILE" 2>/dev/null || echo 0)" -gt "$LEDGER_KEEP" ]; then
    tail -n "$LEDGER_KEEP" "$LEDGER_FILE" > "${LEDGER_FILE}.tmp" 2>/dev/null && mv "${LEDGER_FILE}.tmp" "$LEDGER_FILE"
  fi

  # 6.2: codegraph 탐색 호출이 "실제로 준" 파일 좌표를 따로 적어 둔다.
  #   codegraph-gate 가 Read 를 승인할 때 "직전 5개 안에 호출이 있었나"(횟수)가 아니라
  #   "그 호출이 이 파일을 가리켰나"(좌표 일치)로 판정하게 하려는 원장이다.
  case "$TOOL_NAME" in
    codegraph_query|codegraph_context|codegraph_callers|codegraph_callees|codegraph_impact|codegraph_files|codegraph_backlinks|codegraph_docs)
      if [ "$OUTCOME" != "failed" ]; then
        HOOK_INPUT="$INPUT" SID="${SESSION_ID:-nosession}" python3 - <<'PYEOF' >> .claude/state/located-paths.log 2>/dev/null
import json, os, re, time
try:
    payload = json.loads(os.environ.get('HOOK_INPUT', '') or '{}')
except Exception:
    raise SystemExit(0)
resp = payload.get('tool_response')
if resp is None:
    raise SystemExit(0)
text = resp if isinstance(resp, str) else json.dumps(resp, ensure_ascii=False)
# JSON 출력의 filePath/file 값과 markdown 출력의 경로 토큰을 함께 거둔다.
paths = set(re.findall(r'"(?:filePath|file|path)"\s*:\s*"([^"]+)"', text))
paths |= set(re.findall(r'(?<![\w/.])((?:Assets|docs|manage|tools|\.claude)/[^\s:"\',)]+\.[A-Za-z0-9]{1,8})', text))
now = int(time.time())
sid = os.environ.get('SID', 'nosession')
for p in list(paths)[:80]:
    print('%d %s %s' % (now, sid, p.replace('\\', '/')))
PYEOF
        if [ "$(wc -l < .claude/state/located-paths.log 2>/dev/null || echo 0)" -gt 800 ]; then
          tail -n 800 .claude/state/located-paths.log > .claude/state/located-paths.tmp 2>/dev/null \
            && mv .claude/state/located-paths.tmp .claude/state/located-paths.log
        fi
      fi
      ;;
  esac
fi

# PostToolUse는 응답 차단 안 함
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','permissionDecision':'allow'}}))"
