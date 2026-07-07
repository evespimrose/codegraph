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
WINDOW_SIZE=5  # 직전 N개 도구 호출 검사
VIOLATION_FILE=".claude/state/violation-count.log"
OVERRIDE_FILE=".claude/state/sonar-override"

# tool_input 파싱
TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
PATTERN=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('pattern',''))" 2>/dev/null || echo "")
GREP_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('type',''))" 2>/dev/null || echo "")
GREP_GLOB=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('glob',''))" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"

# 예외 케이스: 명시적 허용 (whitelist)
# - settings.json, CLAUDE.md 등 메타 파일은 codegraph 없이 허용
WHITELIST_PATTERN='\.(json|md|txt|sh|ps1|yml|yaml)$|CLAUDE\.md|AGENTS\.md|dictionary\.md|\.claude/|\.trae/|docs/|manage/|raw/'

if echo "$FILE_PATH" | grep -qE "$WHITELIST_PATTERN"; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 소스 코드 파일 패턴 (.cs, .py, .ts 등)
SOURCE_PATTERN='\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)$'

# codegraph 선행 여부 확인 헬퍼
check_codegraph_recent() {
  if [ -f "$HISTORY_FILE" ]; then
    RECENT=$(tail -n "$WINDOW_SIZE" "$HISTORY_FILE" 2>/dev/null || echo "")
    if echo "$RECENT" | grep -q 'codegraph_'; then
      return 0  # codegraph 선행 있음
    fi
  fi
  return 1  # codegraph 선행 없음
}

# 공통 결정 로직: 서브에이전트/strict → 하드 deny, 우회토큰 → allow, 그 외 → deny+AskUserQuestion 4택
# $1=violation-code(로그용) $2=reason(짧은 한글 사유) $3=ask_msg(4택 유도 전문)
emit_decision() {
  local vcode="$1" reason="$2" ask_msg="$3"

  if [ -n "$AGENT_ID" ]; then
    python3 -c "
import json, sys
reason, ctx = sys.argv[1], sys.argv[2]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'{reason} [{ctx}]',
  'additionalContext': '⛔ 서브에이전트는 codegraph_* 선행 없이 탐색 불가.'}}))
" "$reason" "$CTX_LABEL"
    return
  fi

  if [ "${CG_GATE_MAIN_STRICT:-0}" = "1" ]; then
    python3 -c "
import json, sys
reason = sys.argv[1]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'{reason} (strict)',
  'additionalContext': 'STRICT 모드 — codegraph_* 선행 필요.'}}))
" "$reason"
    return
  fi

  if [ -s "$OVERRIDE_FILE" ]; then
    local r; r=$(cat "$OVERRIDE_FILE")
    rm -f "$OVERRIDE_FILE"
    echo "$(date +%s) ${CTX_LABEL} override-used:${vcode}:${r}" >> "$VIOLATION_FILE"
    python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
    return
  fi

  python3 -c "
import json, sys
reason, ctx, msg = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
  'permissionDecisionReason': f'{reason} [{ctx}] — AskUserQuestion 4택 필요',
  'additionalContext': msg}}))
" "$reason" "$CTX_LABEL" "$ask_msg"
}

# 최근 도구 이력에서 "경위"(성공/실패) 트레일 구성 — 최선노력, tool-history.log outcome 필드 기반
build_trail() {
  local hf="$1" n="${2:-5}"
  [ -f "$hf" ] || return
  python3 -c "
import sys
n = int(sys.argv[2])
try:
    with open(sys.argv[1], encoding='utf-8') as f:
        lines = f.readlines()[-n:]
except Exception:
    lines = []
label = {'ok':'성공', 'failed':'실패', 'unknown':'불명'}
out = []
for ln in lines:
    parts = ln.strip().split()
    if len(parts) >= 4:
        tool, outcome = parts[1], parts[3]
        out.append(f'  {tool}: {label.get(outcome, outcome)}')
    elif len(parts) == 3:
        out.append(f'  {parts[1]}: 불명(구버전 로그)')
print('\n'.join(out))
" "$hf" "$n"
}

ASK4_TEMPLATE() {
  # $1 = 위반 상세 설명 1줄
  local trail; trail=$(build_trail "$HISTORY_FILE" "$WINDOW_SIZE")
  local trail_block=""
  if [ -n "$trail" ]; then
    trail_block=$'\n'"최근 시도 경위 (직전 ${WINDOW_SIZE}개 도구):"$'\n'"$trail"$'\n'
  fi
  cat <<EOF
⛔ CAVE-MAN GUARD L1: $1
${trail_block}
이 명령을 그대로 재시도하지 말고, 지금 AskUserQuestion 도구를 호출하여 사용자에게 정확히 다음 4개 선택지를 제시하라:

  1. 허용 — 원래 명령을 그대로 승인하고 진행. 승인 시 먼저
     printf '%s' "사용자 승인: <사유>" > .claude/state/sonar-override
     로 1회성 우회 토큰을 기록한 뒤 원래 명령을 재시도한다.
  2. codegraph 강제(회귀 및 재시도) — 이 시도를 취소하고 codegraph_context/codegraph_search로
     먼저 조사한 뒤 Glob/Grep/Read로 원 목표를 재시도한다.
  3. 거부(manual stop) — 여기서 작업을 중단하고 사용자에게 보고한다.
  4. 커스텀 답변 — 자유 응답으로 사용자가 직접 방향을 재지정한다.

사용자 응답 전까지 이 명령을 재시도하지 말 것.
EOF
}

# Read 호출이고 소스 코드 파일이면 검증
if [ "$TOOL_NAME" = "Read" ] && echo "$FILE_PATH" | grep -qE "$SOURCE_PATTERN"; then
  if check_codegraph_recent; then
    python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
    exit 0
  fi

  echo "$(date +%s) ${CTX_LABEL} Read:${FILE_PATH}" >> "$VIOLATION_FILE"
  ASK_MSG=$(ASK4_TEMPLATE "소스 코드 Read 차단 — 파일: ${FILE_PATH}, 직전 ${WINDOW_SIZE}개 도구에 codegraph_* 호출 없음.")
  emit_decision "Read" "Cave-Man Protocol L1: 소스 코드 Read 전 codegraph_* 도구 사용 필수 (${FILE_PATH})" "$ASK_MSG"
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
    'additionalContext': f'⛔ CAVE-MAN GUARD L1: 서브에이전트 광역 Glob 차단\n\n패턴: {pat} [{ctx}]\n\ncodegraph_files 또는 codegraph_search 사용:\n  codegraph_files(path=\"src/\") — 디렉토리 파일 구조\n  codegraph_search(query=\"...\") — 심볼 위치'
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
    ASK_MSG=$(ASK4_TEMPLATE "코드 Glob 패턴 차단 — 패턴: ${PATTERN}, 직전 ${WINDOW_SIZE}개 도구에 codegraph_* 호출 없음.")
    emit_decision "Glob" "Cave-Man Protocol L1: 코드 Glob 전 codegraph_files 사용 필요 (${PATTERN})" "$ASK_MSG"
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
  # 식별자 패턴 — type/glob 없음 + 순수 식별자(구조 검색) → D2 봉합
  elif [ -z "$GREP_TYPE" ] && [ -z "$GREP_GLOB" ] && echo "$PATTERN" | grep -qE '^[A-Za-z_][A-Za-z0-9_.:]*$'; then
    IS_SOURCE_GREP="1"
  fi

  if [ -n "$IS_SOURCE_GREP" ]; then
    if check_codegraph_recent; then
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi

    echo "$(date +%s) ${CTX_LABEL} Grep:type=${GREP_TYPE}:glob=${GREP_GLOB}:pat=${PATTERN}" >> "$VIOLATION_FILE"
    ASK_MSG=$(ASK4_TEMPLATE "소스 코드 Grep 차단 — 소스 타입/식별자 검색 감지 (type=${GREP_TYPE} glob=${GREP_GLOB} pattern=${PATTERN}), 직전 ${WINDOW_SIZE}개 도구에 codegraph_* 호출 없음.")
    emit_decision "Grep" "Cave-Man Protocol L1: 소스 코드 Grep 전 codegraph_* 사용 필요 (type=${GREP_TYPE} pattern=${PATTERN})" "$ASK_MSG"
    exit 0
  fi

  # 리터럴 텍스트 검색 → 통과
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 정상 — 통과
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
