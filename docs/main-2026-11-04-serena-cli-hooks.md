# 플랜: serena-cli 훅 연동 (기록기, Read 게이트, outcome, RULE-1, CORE_RULES)

## 목표
Bash 로 부른 `serena-cli <도구>` 를 기록기가 `serena_<도구>` 로 번역하고 응답 좌표를 원장에 적어, Read 게이트가 serena 심볼 조회를 codegraph 와 같은 통행증으로 인정하게 한다.

## 결정
- 통행증으로 보는 serena 도구: `find_symbol`, `get_symbols_overview`, `find_referencing_symbols`, `find_implementations`, `find_declaration`. `tools`, `schema` 는 도구 설명만 주므로 제외한다.
- 좌표 원장은 Bash 응답의 `stdout` 을 그대로 읽고, JSON 이면 `filePath`·`file`·`path`·`relative_path` 키를 걸어 다닌다. 지금은 응답 dict 를 통째로 덤프해 stdout 속 따옴표가 이스케이프되므로 키 정규식이 맞지 않는다(조사 문서 7절).
- outcome 판정: `serena_` 도구는 빈 목록·빈 객체·빈 출력·`-j` 오류 응답·`-j` 빈 `data` 를 실패로 본다.
- 이 플랜의 파일은 KIT 플랜들과 겹치지 않는다. 실제 `serena-cli` 를 부르는 A5 는 KIT 배포(H1) 뒤에 돈다.
- 코드 블록은 0열에서 시작한다. 블록 안 텍스트를 그대로 쓴다. 바깥 펜스가 네 개(````)인 블록은 안에 세 개짜리 펜스를 품고 있다.

## 바뀔 파일
| 파일 | 변경 |
|---|---|
| `.claude/hooks/tool-history-recorder.sh` | serena-cli 번역, 좌표 원장 |
| `.claude/hooks/codegraph-gate.sh` | `LOCATING_TOOLS` 에 serena 도구 |
| `.claude/hooks/lib/outcome.py` | `serena_` 판정 |
| `.claude/hooks/tests/outcome-matrix.sh` | serena 판정 사례 |
| `.claude/hooks/tests/codegraph-gate-matrix.sh` | serena 통행증, 기록기 좌표 사례 |
| `CLAUDE.md` | RULE-1 올바른 순서와 등록 문단 |
| `.claude/hooks/session-start.sh` | `CORE_RULES` RULE-1 |
| `.claude/hooks/post-compact.sh` | `CORE_RULES` RULE-1 |

## 단계

### 단계 1: 기록기가 serena-cli 를 번역
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\tool-history-recorder.sh`
- 위치: 32-70행 (`if [ "$TOOL_NAME" = "Bash" ]; then` 블록)
- 동작: replace
- 변경 전:
```bash
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
```
- 변경 후:
```bash
if [ "$TOOL_NAME" = "Bash" ]; then
  TRANSLATED_TOOL=$(HOOK_INPUT="$INPUT" python3 - <<'PYEOF' 2>/dev/null || echo ""
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
        found = 'codegraph_' + tokens[1]
        break
    # serena-cli 도 같은 규칙으로 serena_<도구> 로 기록함. codegraph-gate.sh 의 LOCATING_TOOLS 와 한 쌍임
    if executable == 'serena-cli' and re.fullmatch(r'[a-z_]+', tokens[1]):
        found = 'serena_' + tokens[1]
        break
print(found)
PYEOF
)
  [ -n "$TRANSLATED_TOOL" ] && TOOL_NAME="$TRANSLATED_TOOL"
fi
```
- 검증: `python3 -c "t=open('.claude/hooks/tool-history-recorder.sh', encoding='utf-8').read(); print(t.count('CODEGRAPH_SUBCOMMAND'), t.count(\"found = 'serena_' + tokens[1]\"))"`
- 기대 출력: `0 1`

### 단계 2: 기록기 좌표 원장에 serena 도구와 stdout JSON 키 추가
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\tool-history-recorder.sh`
- 위치: 98-111행 (`case "$TOOL_NAME" in` 다음 줄부터 첫 `paths = set(...)` 줄까지)
- 동작: replace
- 변경 전:
```bash
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
```
- 변경 후:
```bash
    codegraph_query|codegraph_context|codegraph_callers|codegraph_callees|codegraph_impact|codegraph_files|codegraph_backlinks|codegraph_docs|serena_find_symbol|serena_get_symbols_overview|serena_find_referencing_symbols|serena_find_implementations|serena_find_declaration)
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
# Bash 응답 dict 를 통째로 덤프하면 stdout 속 JSON 따옴표가 이스케이프되어 키 매칭이 깨짐
if isinstance(resp, dict) and isinstance(resp.get('stdout'), str):
    text = resp['stdout']
else:
    text = resp if isinstance(resp, str) else json.dumps(resp, ensure_ascii=False)


def walk(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ('filePath', 'file', 'path', 'relative_path') and isinstance(value, str):
                yield value
            else:
                yield from walk(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk(item)


paths = set()
try:
    paths |= set(walk(json.loads(text)))
except Exception:
    pass
# JSON 출력의 filePath/file 값과 markdown 출력의 경로 토큰을 함께 거둔다.
paths |= set(re.findall(r'"(?:filePath|file|path|relative_path)"\s*:\s*"([^"]+)"', text))
```
- 검증: `python3 -c "t=open('.claude/hooks/tool-history-recorder.sh', encoding='utf-8').read(); print(t.count('serena_find_symbol|serena_get_symbols_overview'), t.count('def walk(node):'))"`
- 기대 출력: `1 1`

### 단계 3: Read 게이트가 serena 도구를 통행증으로 인정
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\codegraph-gate.sh`
- 위치: 51-56행
- 동작: replace
- 변경 전:
```bash
# 게이트를 여는 "탐색형" codegraph 도구 화이트리스트.
#   codegraph_status 는 인덱스 헬스(파일·노드 수)만 돌려주고 심볼 위치를 주지 않음 → 의도적 제외.
#   과거 'codegraph_' 부분일치 판정이라 status 한 방으로 Read 게이트가 열리는 탈주로가 있었음.
#   이 서브커맨드 목록은 tool-history-recorder.sh 의 CODEGRAPH_SUBCOMMAND 정규식과 한 쌍 —
#   함께 바꿀 것(그쪽엔 status 도 포함 — note_evasion() 탈주 감지용).
LOCATING_TOOLS='codegraph_(context|query|callers|callees|impact|files|backlinks|docs)'
```
- 변경 후:
```bash
# 게이트를 여는 "탐색형" 도구 화이트리스트. serena-cli 심볼 조회도 위치를 주므로 포함함.
#   codegraph_status 는 인덱스 헬스(파일·노드 수)만 돌려주고 심볼 위치를 주지 않음 → 의도적 제외.
#   과거 'codegraph_' 부분일치 판정이라 status 한 방으로 Read 게이트가 열리는 탈주로가 있었음.
#   이 목록은 tool-history-recorder.sh 의 TRANSLATED_TOOL 번역·located-paths case 와 한 쌍 —
#   함께 바꿀 것(그쪽엔 status 도 포함 — note_evasion() 탈주 감지용).
#   serena_tools·serena_schema 는 도구 설명만 주므로 제외함.
LOCATING_TOOLS='codegraph_(context|query|callers|callees|impact|files|backlinks|docs)|serena_(find_symbol|get_symbols_overview|find_referencing_symbols|find_implementations|find_declaration)'
```
- 검증: `python3 -c "t=open('.claude/hooks/codegraph-gate.sh', encoding='utf-8').read(); print(t.count('|serena_(find_symbol|get_symbols_overview|find_referencing_symbols|find_implementations|find_declaration)'))"`
- 기대 출력: `1`

### 단계 4: outcome 에 serena 판정 함수 추가
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\lib\outcome.py`
- 위치: `codegraph_outcome` 끝과 `def main():` 사이 (96-99행)
- 동작: replace
- 변경 전:
```python
    return "ok"


def main():
```
- 변경 후:
```python
    return "ok"


SERENA_PREFIX = "serena_"


def serena_outcome(text):
    stripped = (text or "").strip()
    if not stripped or NOT_COMPLETED.search(stripped):
        return "failed"
    try:
        obj = json.loads(stripped)
    except Exception:
        return "ok"
    # -j 응답은 JSON-RPC 봉투라 error 또는 result.data 로 판정함
    if isinstance(obj, dict) and obj.get("jsonrpc") == "2.0":
        if obj.get("error"):
            return "failed"
        obj = (obj.get("result") or {}).get("data")
    return "failed" if obj in ([], {}, "", None) else "ok"


def main():
```
- 검증: `python3 -c "t=open('.claude/hooks/lib/outcome.py', encoding='utf-8').read(); print(t.count('def serena_outcome(text):'))"`
- 기대 출력: `1`

### 단계 5: outcome 이 serena 도구를 판정
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\lib\outcome.py`
- 위치: `main` 의 "2. codegraph 호출은 결과를 직접 센다" 블록
- 동작: replace
- 변경 전:
```python
    # 2. codegraph 호출은 결과를 직접 센다
    if tool.startswith(CODEGRAPH_PREFIX):
        print(codegraph_outcome(text))
        return
```
- 변경 후:
```python
    # 2. codegraph 호출은 결과를 직접 센다
    if tool.startswith(CODEGRAPH_PREFIX):
        print(codegraph_outcome(text))
        return

    # 2-1. serena-cli 조회도 결과가 비면 좌표를 못 얻은 것임
    if tool.startswith(SERENA_PREFIX):
        print(serena_outcome(text))
        return
```
- 검증: `python3 -c "t=open('.claude/hooks/lib/outcome.py', encoding='utf-8').read(); print(t.count('print(serena_outcome(text))'))"`
- 기대 출력: `1`

### 단계 6: outcome 매트릭스에 serena 사례
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\tests\outcome-matrix.sh`
- 위치: `check ok     Grep '매치 내용에 not found 가 들어있음'` 줄 뒤
- 동작: insert-after
- 변경 전:
```bash
check ok     Grep '매치 내용에 not found 가 들어있음' '"a.cs:12: // not found 처리"'
```
- 변경 후:
```bash

echo "== serena-cli — 빈 결과와 오류 응답은 좌표 없음 =="
check ok     serena_find_symbol '심볼 1건' '{"stdout":"[{\"name_path\":\"A/b\",\"relative_path\":\"src/a.py\"}]"}'
check failed serena_find_symbol '빈 목록' '{"stdout":"[]"}'
check failed serena_find_symbol '-j 오류 응답' '{"stdout":"{\"jsonrpc\":\"2.0\",\"id\":\"find_symbol\",\"error\":{\"code\":-32000,\"message\":\"x\"}}"}'
check failed serena_find_symbol '-j 빈 data' '{"stdout":"{\"jsonrpc\":\"2.0\",\"id\":\"find_symbol\",\"result\":{\"status\":\"ok\",\"data\":[]}}"}'
check ok     serena_get_symbols_overview '-j data 있음' '{"stdout":"{\"jsonrpc\":\"2.0\",\"id\":\"get_symbols_overview\",\"result\":{\"status\":\"ok\",\"data\":{\"Function\":[\"f\"]}}}"}'
check ok     serena_tools '목록 텍스트' '{"stdout":"find_symbol   Finds symbols"}'
```
- 검증: `bash .claude/hooks/tests/outcome-matrix.sh | tail -1`
- 기대 출력: `PASS=27 FAIL=0`

### 단계 7: 게이트 매트릭스에 serena 통행증과 기록기 좌표 사례
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\tests\codegraph-gate-matrix.sh`
- 위치: `check deny  "역슬래시 소스 경로 · 통행증 없음"` 줄 뒤
- 동작: insert-after
- 변경 전:
```bash
check deny  "역슬래시 소스 경로 · 통행증 없음" 'D:\repo\src\app.py' ""
```
- 변경 후:
```bash

echo "== serena-cli 심볼 조회도 통행증 (serena_*) =="
set_history "$now serena_find_symbol MAIN ok $SID"
set_located ""
check allow "창 안 serena_find_symbol · limit 100" "$BIG" "100"
set_history "$now serena_tools MAIN ok $SID"
check deny  "serena_tools 는 위치를 주지 않음 · limit 100" "$BIG" "100"

echo "== 기록기: serena-cli 호출을 번역하고 응답 좌표를 원장에 적음 =="
set_history "$now Bash MAIN ok $SID"
set_located ""
CMD='serena-cli find_symbol Big --relative-path src/Big.cs' OUT='[{"name_path": "Big", "relative_path": "src/Big.cs"}]' SID="$SID" python3 -c "
import json, os
print(json.dumps({'tool_name': 'Bash', 'session_id': os.environ['SID'] + 'xxxx',
                  'tool_input': {'command': os.environ['CMD']},
                  'tool_response': {'stdout': os.environ['OUT'], 'stderr': ''}}))
" | bash .claude/hooks/tool-history-recorder.sh >/dev/null 2>&1
set_history "$now Bash MAIN ok $SID"
check allow "기록기가 적은 좌표로 Read · limit 100" "$BIG" "100"
check deny  "좌표 밖 파일은 통행증 없음 · limit 100" "$SMALL" "100"
```
- 검증: `bash .claude/hooks/tests/codegraph-gate-matrix.sh | tail -1`
- 기대 출력: `PASS=19 FAIL=0`

### 단계 8: CLAUDE.md RULE-1 순서와 등록 문단
- 파일: `D:\Fork\claude-personal-integrated-workflow\CLAUDE.md`
- 위치: RULE-1 의 "올바른 순서" 블록부터 `tool-history-recorder.sh` 문장까지 (29-39행)
- 동작: replace
- 변경 전:
````markdown
### ✅ 올바른 순서 (codegraph는 MCP가 아니라 CLI — Bash로 직접 호출)
```
1. codegraph context "<intent>" -p <root> / codegraph query "<symbol>" -p <root> → 심볼 위치
2. codegraph callers "<symbol>" -p <root> / codegraph impact "<symbol>" -p <root> → 영향 범위
3. Read(offset+limit) 로 좌표 구간만 읽음 → 소스 코드
4. (보완 시만) Glob / Grep
```

`mcp__codegraph__*` 툴은 더 이상 존재하지 않는다(CLI 바이너리 전환, 920cd03). codegraph MCP를 등록·기동하지 말 것.
차단 hook: `.claude/hooks/sonar-guard*.sh`, `codegraph-gate.sh` — 게이트는 Bash로 호출된 `codegraph <subcommand>`를
`tool-history-recorder.sh`가 `codegraph_<subcommand>`로 번역 기록해야 인식한다(둘 다 이미 반영됨).
````
- 변경 후:
````markdown
### ✅ 올바른 순서 (codegraph·serena 는 MCP가 아니라 CLI — Bash로 직접 호출)
```
1. codegraph context "<intent>" -p <root> / codegraph query "<symbol>" -p <root> → 심볼 위치
2. codegraph callers "<symbol>" -p <root> / codegraph impact "<symbol>" -p <root> → 영향 범위
3. serena-cli find_symbol "<name_path>" --relative-path <file> → 심볼 몸체 줄 범위(LSP, 0 기준)
4. Read(offset+limit) 로 좌표 구간만 읽음 → 소스 코드
5. (보완 시만) Glob / Grep
```

`mcp__codegraph__*` 툴은 더 이상 존재하지 않는다(CLI 바이너리 전환, 920cd03). codegraph MCP를 등록·기동하지 말 것.
Serena 도 MCP 로 등록하지 않는다. 도구 목록은 `serena-cli tools`, 한 도구의 인자는 `serena-cli schema <tool>` 로 필요할 때만 읽는다. `serena-cli` 는 읽기 전용 도구만 열고, 편집은 Edit 로 한다.
차단 hook: `.claude/hooks/sonar-guard*.sh`, `codegraph-gate.sh` — 게이트는 Bash로 호출된 `codegraph <subcommand>`·`serena-cli <tool>`를
`tool-history-recorder.sh`가 `codegraph_<subcommand>`·`serena_<tool>`로 번역 기록해야 인식한다(둘 다 이미 반영됨).
````
- 검증: `python3 -c "t=open('CLAUDE.md', encoding='utf-8').read(); print(t.count('serena-cli find_symbol'), t.count('Serena 도 MCP 로 등록하지 않는다'))"`
- 기대 출력: `1 1`

### 단계 9: session-start.sh CORE_RULES RULE-1
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\session-start.sh`
- 위치: 29행
- 동작: replace
- 변경 전:
```text
RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
```
- 변경 후:
```text
RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → serena-cli 심볼 범위 → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
```
- 검증: `python3 -c "t=open('.claude/hooks/session-start.sh', encoding='utf-8').read(); print(t.count('serena-cli 심볼 범위'))"`
- 기대 출력: `1`

### 단계 10: post-compact.sh CORE_RULES RULE-1
- 파일: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\post-compact.sh`
- 위치: 29행
- 동작: replace
- 변경 전:
```text
RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
```
- 변경 후:
```text
RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → serena-cli 심볼 범위 → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
```
- 검증: `python3 -c "t=open('.claude/hooks/post-compact.sh', encoding='utf-8').read(); print(t.count('serena-cli 심볼 범위'))"`
- 기대 출력: `1`

## 수락 기준
A5 는 KIT 배포(`main-2026-11-04-serena-cli-kit` 의 H1) 뒤에 실행된다.

```acceptance
{"id":"A1","kind":"auto","cmd":"bash .claude/hooks/tests/codegraph-gate-matrix.sh","expect":"exit0"}
{"id":"A2","kind":"auto","cmd":"bash .claude/hooks/tests/outcome-matrix.sh","expect":"exit0"}
{"id":"A3","kind":"auto","cmd":"bash .claude/hooks/tests/sonar-guard-matrix.sh","expect":"exit0"}
{"id":"A4","kind":"auto","cmd":"python3 -c \"a=[l for l in open('.claude/hooks/session-start.sh',encoding='utf-8') if l.startswith('RULE-1 [SONAR]')]; b=[l for l in open('.claude/hooks/post-compact.sh',encoding='utf-8') if l.startswith('RULE-1 [SONAR]')]; raise SystemExit(0 if len(a)==1 and a==b and 'serena-cli' in a[0] else 1)\"","expect":"exit0"}
{"id":"A5","kind":"auto","cmd":"serena-cli find_symbol check_codegraph_recent --relative-path .claude/hooks/codegraph-gate.sh","expect":"exit0"}
{"id":"H1","kind":"human","how":"새 세션에서 serena-cli find_symbol 로 심볼을 찾은 직후, codegraph 호출 없이 그 파일을 Read(offset, limit) 로 읽는다","expect":"Read 가 통과하고 .claude/state/tool-history.log 에 serena_find_symbol 행이 남음"}
```

## 범위 밖
- `sonar-guard.sh` (오탐 수정 플랜 `main-2026-10-30-harness-false-positives` 가 같은 파일을 고침).
- PowerShell 도구로 부른 `serena-cli`·`codegraph` 의 번역(지금도 Bash 만 번역함).
- `.serena/project.yml` 에 python 언어 서버 추가(데몬 재시작이 필요해 별도 작업).
- zvec-grep 단계(`docs/Try_ZgCodegraphSerenaPipeline.md` 5절 3~6단계).

## 미결 질문
- 없음

## 승인 기록
- G1: 2026-11-04 사용자 승인(플랜과 `acceptance` 블록). Haiku 5.5 실행 카드 한 장이 실행한다. KIT 런타임 플랜 카드와 동시에 돌 수 있다(파일이 겹치지 않음).
