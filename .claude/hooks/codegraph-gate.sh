#!/bin/bash
# codegraph-gate.sh: PreToolUse:Read|Glob — Cave-Man Protocol L1 Hard Gate
# HANDOVER-MANAGED
# 직전 N개 도구 호출에 codegraph_* 가 있는지 검증. 없으면 차단.

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

# 예외 케이스: 명시적 허용 (whitelist)
# - settings.json, CLAUDE.md 등 메타 파일은 codegraph 없이 허용
WHITELIST_PATTERN='\.(json|md|txt|sh|ps1|yml|yaml)$|CLAUDE\.md|AGENTS\.md|dictionary\.md|\.claude/|\.trae/|docs/|manage/|raw/'

if echo "$FILE_PATH" | grep -qE "$WHITELIST_PATTERN"; then
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 소스 코드 파일 패턴 (.cs, .py, .ts 등)
SOURCE_PATTERN='\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)$'

# Read 호출이고 소스 코드 파일이면 검증
if [ "$TOOL_NAME" = "Read" ] && echo "$FILE_PATH" | grep -qE "$SOURCE_PATTERN"; then
  # 직전 N개 도구 호출에 codegraph_* 가 있는지 확인
  if [ -f "$HISTORY_FILE" ]; then
    RECENT=$(tail -n "$WINDOW_SIZE" "$HISTORY_FILE" 2>/dev/null || echo "")
    if echo "$RECENT" | grep -q 'codegraph_'; then
      # 정상 — codegraph 사용 후 Read
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi
  fi

  # 위반 — codegraph 미사용 후 소스 코드 Read
  echo "$(date +%s) Read $FILE_PATH" >> "$VIOLATION_FILE"

  python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'Cave-Man Protocol L1: 소스 코드 Read 전 codegraph_* 도구 사용 필수 ($FILE_PATH)',
    'additionalContext': '⛔ CAVE-MAN GUARD L1: 소스 코드 Read 차단\n\n파일: $FILE_PATH\n직전 ${WINDOW_SIZE}개 도구에 codegraph_* 호출 없음.\n\n올바른 순서:\n  1. codegraph_context (관련 심볼 파악)\n  2. codegraph_search (특정 심볼 위치)\n  3. codegraph_node 또는 codegraph_explore (상세 소스)\n  4. (필요시) Read — codegraph 결과 보완 목적만\n\n위반 누적 확인: tail .claude/state/violation-count.log'
  }
}))
"
  exit 0
fi

# Glob 호출이고 코드 검색 패턴이면 검증
if [ "$TOOL_NAME" = "Glob" ] && echo "$PATTERN" | grep -qE '\*\*/.*\.(cs|py|ts|tsx|js)'; then
  if [ -f "$HISTORY_FILE" ]; then
    RECENT=$(tail -n "$WINDOW_SIZE" "$HISTORY_FILE" 2>/dev/null || echo "")
    if echo "$RECENT" | grep -q 'codegraph_'; then
      python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
      exit 0
    fi
  fi

  echo "$(date +%s) Glob $PATTERN" >> "$VIOLATION_FILE"

  python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'Cave-Man Protocol L1: 코드 Glob 전 codegraph_files 사용 권장',
    'additionalContext': '⚠️ CAVE-MAN GUARD L1: 코드 Glob 패턴 감지\n\n패턴: $PATTERN\n권장: codegraph_files 또는 codegraph_search 사용\n\n허용된 경우: 새 파일 생성 위치 확인, 정확한 경로가 필요한 비-코드 작업'
  }
}))
"
  exit 0
fi

# Grep 호출 — 소스 타입 검색만 검증 (try 탈옥 차단, 리터럴 검색은 통과)
if [ "$TOOL_NAME" = "Grep" ]; then
  IS_SOURCE_GREP=""
  if echo "$GREP_TYPE" | grep -qE '^(cs|py|ts|tsx|js|jsx|java|cpp|c|go|rust|rs|swift|kotlin|kt)$'; then
    IS_SOURCE_GREP="1"
  elif echo "$GREP_GLOB" | grep -qE '\.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)'; then
    IS_SOURCE_GREP="1"
  fi

  if [ -n "$IS_SOURCE_GREP" ]; then
    if [ -f "$HISTORY_FILE" ]; then
      RECENT=$(tail -n "$WINDOW_SIZE" "$HISTORY_FILE" 2>/dev/null || echo "")
      if echo "$RECENT" | grep -q 'codegraph_'; then
        python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
        exit 0
      fi
    fi

    echo "$(date +%s) Grep type=$GREP_TYPE glob=$GREP_GLOB" >> "$VIOLATION_FILE"

    python3 -c "
import json
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'ask',
    'permissionDecisionReason': 'Cave-Man Protocol L1: 소스 코드 Grep 전 codegraph_* 사용 필수 (try 포함)',
    'additionalContext': '⛔ CAVE-MAN GUARD L1: 소스 코드 Grep 차단\n\n소스 타입 검색 감지 (type=$GREP_TYPE glob=$GREP_GLOB)\n직전 ${WINDOW_SIZE}개 도구에 codegraph_* 호출 없음.\n\ntry 스킬도 예외 아님 — 구조 검색은 codegraph_search / codegraph_context 우선.\n리터럴 텍스트(로그·주석·문자열) 검색이면 type/glob 소스 필터를 빼면 통과됩니다.'
  }
}))
"
    exit 0
  fi

  # 리터럴 텍스트 검색 (소스 필터 없음) → 통과
  python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
  exit 0
fi

# 정상 — 통과
python3 -c "import json; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'allow'}}))"
