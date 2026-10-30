#!/bin/bash
# codegraph-gate.sh: PreToolUse:Read|Glob|Grep — Cave-Man Protocol L1 Hard Gate
# HANDOVER-MANAGED
# 직전 N개 도구 호출에 codegraph_* 가 있는지 검증. 없으면 차단.
# D1: 서브에이전트(agent_id 존재) → 하드 deny(AskUserQuestion 유도 없음)
#     메인 → deny + AskUserQuestion 4택 유도(허용/codegraph 강제/거부/커스텀)
#     (CG_GATE_MAIN_STRICT=1 시 메인도 하드 deny — 유도 없음)
# D2: 비코드 Glob 통과, 서브에이전트 광역 **/* 소스 sweep → deny(변경 없음), Grep 식별자 패턴 검증
# 일회성 우회: .claude/state/sonar-override 에 비어있지 않은 내용이 있으면
#   1회 소모(삭제) 후 allow — 메인 + non-strict 경로에서만 적용.

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"
LOCATED_FILE=".claude/state/located-paths.log"
GATE_DECISION=".claude/hooks/lib/gate-decision.py"
WINDOW_SIZE=5  # 직전 N개 도구 호출 검사
VIOLATION_FILE=".claude/state/violation-count.log"
OVERRIDE_FILE=".claude/state/sonar-override"
# 6.1: 한 번에 읽을 수 있는 최대 줄 수. RULE-7/retrieval-discipline 의 "부분 로드"를 실제로 강제한다.
READ_LIMIT_MAX=${CG_READ_LIMIT_MAX:-300}
# 6.2: 좌표 일치를 인정하는 시간 창(초). 이보다 오래된 codegraph 결과는 통행증으로 치지 않는다.
LOCATED_TTL=${CG_LOCATED_TTL:-1800}

# tool_input 파싱
TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
PATTERN=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('pattern',''))" 2>/dev/null || echo "")
GREP_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('type',''))" 2>/dev/null || echo "")
GREP_GLOB=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('glob',''))" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('session_id') or '')[:8])" 2>/dev/null || echo "")
READ_LIMIT=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); v=(d.get('tool_input') or {}).get('limit'); print(v if isinstance(v,int) else '')" 2>/dev/null || echo "")

b64() { printf '%s' "${1:-}" | base64 -w0 2>/dev/null || printf '%s' "${1:-}" | base64 | tr -d '\n'; }

# 예외 케이스: 명시적 허용 (whitelist)
# - settings.json, CLAUDE.md 등 메타 파일은 codegraph 없이 허용
WHITELIST_PATTERN='\.(json|md|txt|sh|ps1|yml|yaml)$|CLAUDE\.md|AGENTS\.md|dictionary\.md|\.claude/|\.trae/|docs/|manage/|raw/'

# Read 도구는 Windows 역슬래시 경로를 넘겨서 슬래시 패턴(.claude/ 등)에 안 맞음
if printf '%s' "$FILE_PATH" | tr '\\' '/' | grep -qE "$WHITELIST_PATTERN"; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 소스 코드 파일 패턴 (.cs, .py, .ts 등)
SOURCE_PATTERN='\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)$'

# 게이트를 여는 "탐색형" codegraph 도구 화이트리스트.
#   codegraph_status 는 인덱스 헬스(파일·노드 수)만 돌려주고 심볼 위치를 주지 않음 → 의도적 제외.
#   과거 'codegraph_' 부분일치 판정이라 status 한 방으로 Read 게이트가 열리는 탈주로가 있었음.
#   이 서브커맨드 목록은 tool-history-recorder.sh 의 CODEGRAPH_SUBCOMMAND 정규식과 한 쌍 —
#   함께 바꿀 것(그쪽엔 status 도 포함 — note_evasion() 탈주 감지용).
LOCATING_TOOLS='codegraph_(context|query|callers|callees|impact|files|backlinks|docs)'

# codegraph 선행 여부 확인 헬퍼
#   인정 조건: 최근 창에 탐색형 도구가 있고 그 호출이 실패(outcome=failed)가 아닐 것.
#   실패 조회("No results found")도 위치를 못 얻은 것이라 게이트를 열면 안 됨 — 같은 탈주로임.
#   로그 형식: <epoch> <TOOL> <CTX> <outcome> (필드 4개 미만인 구버전 줄은 outcome 미상 → 통과 허용)
#   H4 보강: 5번째 필드(세션 id)가 있으면 현재 세션 행만 본다. 동시 세션이 한 로그에 append 하므로
#   이것이 없으면 다른 세션의 codegraph 호출이 내 게이트를 열어 준다(실측됨).
#   H2 보강: '#' 로 시작하는 세션 헤더는 도구 호출이 아니므로 창에서 제외한다.
check_codegraph_recent() {
  [ -f "$HISTORY_FILE" ] || return 1
  RECENT=$(grep -v '^#' "$HISTORY_FILE" 2>/dev/null | awk -v sid="$SESSION_ID" 'sid == "" || NF < 5 || $5 == sid' | tail -n "$WINDOW_SIZE")
  echo "$RECENT" | awk -v pat="$LOCATING_TOOLS" '$2 ~ pat && $4 != "failed" { found = 1 } END { exit !found }'
}

# 6.2: 좌표 일치 판정. "codegraph 를 몇 번 불렀나"가 아니라 "그 호출이 이 파일을 가리켰나"를 본다.
#   located-paths.log 는 tool-history-recorder 가 codegraph 응답에서 뽑아 적는다.
#   횟수 기반 통행증의 탈주로("아무 질의나 하나 던지고 5개 읽기")를 여기서 막는다.
check_located_path() {
  [ -f "$LOCATED_FILE" ] || return 1
  [ -n "$FILE_PATH" ] || return 1
  FP="$FILE_PATH" SID="$SESSION_ID" TTL="$LOCATED_TTL" LF="$LOCATED_FILE" python3 - <<'PYEOF'
import os, sys, time
target = os.environ.get('FP', '').replace('\\', '/').lstrip('./').lower()
sid = os.environ.get('SID', '')
try:
    ttl = int(os.environ.get('TTL') or 1800)
except ValueError:
    ttl = 1800
now = int(time.time())
try:
    rows = open(os.environ['LF'], encoding='utf-8', errors='replace').read().splitlines()
except Exception:
    sys.exit(1)
for line in reversed(rows):
    parts = line.split(None, 2)
    if len(parts) < 3:
        continue
    try:
        ts = int(parts[0])
    except ValueError:
        continue
    if now - ts > ttl:
        continue
    if sid and parts[1] != sid:
        continue
    known = parts[2].replace('\\', '/').lstrip('./').lower()
    if known and (target.endswith(known) or known.endswith(target)):
        sys.exit(0)
sys.exit(1)
PYEOF
}

# 게이트 회피 시도 기록 — 최근 창에 codegraph_status 만 있고 탐색형이 없을 때 고정 마커를 남김.
#   기존 Read:<경로> 로그는 경로마다 달라 패턴 집계(violation-pattern-digest)에 안 잡히므로 별도로 적음.
note_evasion() {
  local recent
  recent=$(tail -n "$WINDOW_SIZE" "$HISTORY_FILE" 2>/dev/null || echo "")
  if echo "$recent" | awk '$2 == "codegraph_status" { found = 1 } END { exit !found }'; then
    echo "$(date +%s) ${CTX_LABEL} gate-evasion:codegraph_status-is-not-locating" >> "$VIOLATION_FILE"
  fi
}

# 공통 결정 로직: 서브에이전트/strict -> 하드 deny, 우회토큰 -> allow, 그 외 -> deny + AskUserQuestion 4택
#   H7: 결정 JSON 과 4택 문구는 lib/gate-decision.py 한 곳에서만 만든다. 이전에는 sonar-guard 와
#   이 파일이 같은 템플릿을 각자 들고 있어 한쪽(sonar-guard)의 백틱 명령치환 버그가 오래 살아남았다.
#   $1=violation-code(로그용) $2=reason(짧은 한글 사유)
emit_decision() {
  local vcode="$1" reason="$2"

  note_evasion

  if [ -n "$AGENT_ID" ] || [ "${CG_GATE_MAIN_STRICT:-0}" = "1" ]; then
    CG_SESSION_ID="$SESSION_ID" CG_HISTORY="$HISTORY_FILE" CG_TRAIL_N="$WINDOW_SIZE"       python3 "$GATE_DECISION" caveman hard "$(b64 "$vcode")" "$(b64 "$reason")" "$(b64 "$CTX_LABEL")"
    return
  fi

  if [ -s "$OVERRIDE_FILE" ]; then
    local r; r=$(cat "$OVERRIDE_FILE")
    rm -f "$OVERRIDE_FILE"
    echo "$(date +%s) ${CTX_LABEL} override-used:${vcode}:${r}" >> "$VIOLATION_FILE"
    python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
    return
  fi

  CG_SESSION_ID="$SESSION_ID" CG_HISTORY="$HISTORY_FILE" CG_TRAIL_N="$WINDOW_SIZE"     python3 "$GATE_DECISION" caveman ask "$(b64 "$vcode")" "$(b64 "$reason")" "$(b64 "$CTX_LABEL")"
}

# Read 호출이고 소스 코드 파일이면 검증
if [ "$TOOL_NAME" = "Read" ] && echo "$FILE_PATH" | grep -qE "$SOURCE_PATTERN"; then
  # 1단계 — 통행증(6.2). 좌표 일치가 1순위, 창 안 codegraph 호출이 2순위.
  if check_located_path || check_codegraph_recent; then
    # 2단계 — 분량(6.1). 여기가 토큰을 실제로 태우는 변수인데 지금까지 아무도 안 봤다.
    #   limit 이 있으면 상한 이내인지 보고, 없으면 파일이 상한 이내인지 본다.
    DENY_VOL=""
    if [ -n "$READ_LIMIT" ]; then
      [ "$READ_LIMIT" -gt "$READ_LIMIT_MAX" ] 2>/dev/null && \
        DENY_VOL="Read limit=${READ_LIMIT} 이 상한 ${READ_LIMIT_MAX}줄을 넘음. 구간을 좁힐 것."
    else
      FILE_LINES=$(wc -l < "$FILE_PATH" 2>/dev/null | tr -d ' ' || echo 0)
      if [ "${FILE_LINES:-0}" -gt "$READ_LIMIT_MAX" ] 2>/dev/null; then
        DENY_VOL="전문 Read 차단 — ${FILE_PATH} 는 ${FILE_LINES}줄인데 limit 이 없음. codegraph 가 준 startLine 기준으로 Read(offset, limit<=${READ_LIMIT_MAX}) 로 구간만 읽을 것."
      fi
    fi
    if [ -z "$DENY_VOL" ]; then
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi
    echo "$(date +%s) ${CTX_LABEL} Read-unbounded:${FILE_PATH}" >> "$VIOLATION_FILE"
    CG_SESSION_ID="$SESSION_ID" CG_HISTORY="$HISTORY_FILE" CG_TRAIL_N="$WINDOW_SIZE" \
      python3 "$GATE_DECISION" caveman "$( [ -n "$AGENT_ID" ] && echo hard || echo ask )" \
        "$(b64 'Read (분량 초과)')" "$(b64 "$DENY_VOL")" "$(b64 "$CTX_LABEL")"
    exit 0
  fi

  echo "$(date +%s) ${CTX_LABEL} Read:${FILE_PATH}" >> "$VIOLATION_FILE"
  emit_decision "Read" "Cave-Man Protocol L1: 소스 코드 Read 전 codegraph_* 도구 사용 필수 (${FILE_PATH})"
  exit 0
fi

# Glob 호출 — D2 처리
if [ "$TOOL_NAME" = "Glob" ]; then
  IS_SOURCE_GLOB=""
  IS_BROAD_GLOB=""

  # 서브에이전트의 광역 와일드카드 sweep 감지 (D2) — 변경 없음, 항상 하드 deny
  if [ -n "$AGENT_ID" ] && echo "$PATTERN" | grep -qE '^\*\*/?\*$|^\*$'; then
    IS_BROAD_GLOB="1"
  fi

  # 소스 확장자 패턴인지 확인
  if echo "$PATTERN" | grep -qE '\*\*/.*\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)'; then
    IS_SOURCE_GLOB="1"
  fi

  if [ -n "$IS_BROAD_GLOB" ]; then
    echo "$(date +%s) ${CTX_LABEL} Glob:broad:${PATTERN}" >> "$VIOLATION_FILE"
    python3 -c "
import json, sys
pat = sys.argv[1]; ctx = sys.argv[2]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'deny',
    'permissionDecisionReason': f'Cave-Man Protocol L1: 서브에이전트 광역 Glob 차단 ({pat}) [{ctx}]',
    'additionalContext': f'⛔ CAVE-MAN GUARD L1: 서브에이전트 광역 Glob 차단\n\n패턴: {pat} [{ctx}]\n\ncodegraph files 또는 codegraph_query 사용:\n  codegraph files(path=\"src/\") — 디렉토리 파일 구조\n  codegraph_query(query=\"...\") — 심볼 위치'
  }
}))
" "$PATTERN" "$CTX_LABEL"
    exit 0
  fi

  if [ -n "$IS_SOURCE_GLOB" ]; then
    if check_codegraph_recent; then
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi

    echo "$(date +%s) ${CTX_LABEL} Glob:${PATTERN}" >> "$VIOLATION_FILE"
    emit_decision "Glob" "Cave-Man Protocol L1: 코드 Glob 전 codegraph files 사용 필요 (${PATTERN})"
    exit 0
  fi

  # 비코드 Glob (shader, prefab, unity, sh 등) → D2: 통과
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# Grep 호출 — 소스 타입 검색 및 식별자 패턴 검증 (D2)
if [ "$TOOL_NAME" = "Grep" ]; then
  IS_SOURCE_GREP=""

  # 명시적 소스 타입/글로브 지정
  if echo "$GREP_TYPE" | grep -qE '^(cs|py|ts|tsx|js|jsx|java|cpp|c|go|rust|rs|swift|kotlin|kt)$'; then
    IS_SOURCE_GREP="1"
  elif echo "$GREP_GLOB" | grep -qE '\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)'; then
    IS_SOURCE_GREP="1"
  fi

  if [ -n "$IS_SOURCE_GREP" ]; then
    if check_codegraph_recent; then
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi

    echo "$(date +%s) ${CTX_LABEL} Grep:type=${GREP_TYPE}:glob=${GREP_GLOB}:pat=${PATTERN}" >> "$VIOLATION_FILE"
    emit_decision "Grep" "Cave-Man Protocol L1: 소스 코드 Grep 전 codegraph_* 사용 필요 (type=${GREP_TYPE} pattern=${PATTERN})"
    exit 0
  fi

  # 리터럴 텍스트 검색 → 통과
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 정상 — 통과
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
