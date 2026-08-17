#!/bin/bash
# tool-history-recorder.sh: PostToolUse — 도구 사용 이력 기록 (L1 검증용)
# HANDOVER-MANAGED
# 모든 도구 호출을 .claude/state/tool-history.log 에 append.
# 형식: <epoch> <TOOL_NAME> <AGENT_TYPE|MAIN> <outcome>
#   outcome ∈ {ok, failed, unknown} — tool_response 휴리스틱 판정(최선노력, 보장 아님):
#     - dict에 error/is_error 키 → failed
#     - 텍스트에 "no results/matches/files/context found" 류 패턴 → failed
#     - tool_response 없음/판정 불가 → unknown
#     - 그 외 → ok

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"

TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"

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

OUTCOME=$(echo "$INPUT" | python3 -c "
import json, sys, re
try:
    d = json.load(sys.stdin)
except Exception:
    print('unknown'); sys.exit(0)
resp = d.get('tool_response', None)
if resp is None:
    print('unknown'); sys.exit(0)
if isinstance(resp, dict) and (resp.get('error') or resp.get('is_error')):
    print('failed'); sys.exit(0)
try:
    text = resp if isinstance(resp, str) else json.dumps(resp, ensure_ascii=False)
except Exception:
    text = str(resp)
# '0 found' 앞에 숫자가 오면 실제로는 10·20건 성공임 — 선행 숫자 배제로 오판 차단
if re.search(r'(?i)no (results?|matches?|files?|sessions?|context)\s*(found)?\b|not found\b|(?<![0-9])0 found\b', text):
    print('failed'); sys.exit(0)
print('ok')
" 2>/dev/null || echo "unknown")

if [ -n "$TOOL_NAME" ]; then
  echo "$(date +%s) $TOOL_NAME ${CTX_LABEL} ${OUTCOME}" >> "$HISTORY_FILE"

  # 히스토리 파일 크기 제한 (직전 100개만 유지)
  TAIL_LINES=$(tail -n 100 "$HISTORY_FILE" 2>/dev/null)
  echo "$TAIL_LINES" > "$HISTORY_FILE"
fi

# PostToolUse는 응답 차단 안 함
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','permissionDecision':'allow'}}))"
