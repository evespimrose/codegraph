#!/bin/bash
# codegraph-gate.sh: PreToolUse:Read|Glob|Grep — Cave-Man Protocol L1 Hard Gate
# HANDOVER-MANAGED
# 직전 N개 도구 호출에 codegraph_* 가 있는지 검증. 없으면 차단.
# D1: 서브에이전트(agent_id 존재) → deny, 메인 → ask (CG_GATE_MAIN_STRICT=1 시 메인도 deny)
# D2: 비코드 Glob 통과, 서브에이전트 광역 **/* 소스 sweep → deny, Grep 식별자 패턴 검증

INPUT=$(cat)
HISTORY_FILE=".claude/state/tool-history.log"
WINDOW_SIZE=5  # 직전 N개 도구 호출 검사
VIOLATION_FILE=".claude/state/violation-count.log"

# tool_input 파싱
TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
PATTERN=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('pattern',''))" 2>/dev/null || echo "")
GREP_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('type',''))" 2>/dev/null || echo "")
GREP_GLOB=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('glob',''))" 2>/dev/null || echo "")
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"
if [ -n "$AGENT_ID" ]; then DECISION="deny"; else DECISION="ask"; fi
[ "${CG_GATE_MAIN_STRICT:-0}" = "1" ] && DECISION="deny"

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

# Read 호출이고 소스 코드 파일이면 검증
if [ "$TOOL_NAME" = "Read" ] && echo "$FILE_PATH" | grep -qE "$SOURCE_PATTERN"; then
  if check_codegraph_recent; then
    python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
    exit 0
  fi

  echo "$(date +%s) ${CTX_LABEL} Read:${FILE_PATH}" >> "$VIOLATION_FILE"
  python3 -c "
import json, sys
fp = sys.argv[1]; decision = sys.argv[2]; ctx = sys.argv[3]; ws = sys.argv[4]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': decision,
    'permissionDecisionReason': f'Cave-Man Protocol L1: 소스 코드 Read 전 codegraph_* 도구 사용 필수 ({fp}) [{ctx}]',
    'additionalContext': f'⛔ CAVE-MAN GUARD L1: 소스 코드 Read 차단\n\n파일: {fp} [{ctx}]\n직전 {ws}개 도구에 codegraph_* 호출 없음.\n\n올바른 순서:\n  1. codegraph_context (관련 심볼 파악)\n  2. codegraph_search (특정 심볼 위치)\n  3. codegraph_node 또는 codegraph_explore (상세 소스)\n  4. (필요시) Read — codegraph 결과 보완 목적만\n\n위반 누적 확인: tail .claude/state/violation-count.log'
  }
}))
" "$FILE_PATH" "$DECISION" "$CTX_LABEL" "$WINDOW_SIZE"
  exit 0
fi

# Glob 호출 — D2 처리
if [ "$TOOL_NAME" = "Glob" ]; then
  IS_SOURCE_GLOB=""
  IS_BROAD_GLOB=""

  # 서브에이전트의 광역 와일드카드 sweep 감지 (D2)
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
    python3 -c "
import json, sys
pat = sys.argv[1]; decision = sys.argv[2]; ctx = sys.argv[3]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': decision,
    'permissionDecisionReason': f'Cave-Man Protocol L1: 코드 Glob 전 codegraph_files 사용 권장 [{ctx}]',
    'additionalContext': f'⚠️ CAVE-MAN GUARD L1: 코드 Glob 패턴 감지 [{ctx}]\n\n패턴: {pat}\n권장: codegraph_files 또는 codegraph_search 사용\n\n허용된 경우: 새 파일 생성 위치 확인, 정확한 경로가 필요한 비-코드 작업'
  }
}))
" "$PATTERN" "$DECISION" "$CTX_LABEL"
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
    python3 -c "
import json, sys
gt = sys.argv[1]; gg = sys.argv[2]; pat = sys.argv[3]; decision = sys.argv[4]; ctx = sys.argv[5]; ws = sys.argv[6]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': decision,
    'permissionDecisionReason': f'Cave-Man Protocol L1: 소스 코드 Grep 전 codegraph_* 사용 필수 [{ctx}]',
    'additionalContext': f'⛔ CAVE-MAN GUARD L1: 소스 코드 Grep 차단 [{ctx}]\n\n소스 타입/식별자 검색 감지 (type={gt} glob={gg} pattern={pat})\n직전 {ws}개 도구에 codegraph_* 호출 없음.\n\ncodegraph_search / codegraph_context 우선.\n리터럴 텍스트(로그·주석·문자열) 검색이면 type/glob 소스 필터를 빼면 통과됩니다.'
  }
}))
" "$GREP_TYPE" "$GREP_GLOB" "$PATTERN" "$DECISION" "$CTX_LABEL" "$WINDOW_SIZE"
    exit 0
  fi

  # 리터럴 텍스트 검색 → 통과
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 정상 — 통과
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
