#!/bin/bash
# outcome.py 판정 매트릭스. 실측 오판 사례를 회귀 케이스로 고정한다.
. "$(cd "$(dirname "$0")" && pwd)/lib/sandbox.sh"
MOD=".claude/hooks/lib/outcome.py"
PASS=0; FAIL=0

check() { # $1=기대 $2=도구 $3=라벨 $4=tool_response(JSON 조각)
  local want="$1" tool="$2" label="$3" body="$4" got
  got=$(printf '{"tool_name":"%s","tool_response":%s}' "$tool" "$body" \
        | TOOL_NAME="$tool" python3 "$MOD" 2>/dev/null)
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  ok   %-8s %s\n' "$got" "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL want=%-8s got=%-8s %s\n' "$want" "$got" "$label"; fi
}

echo "== 실측 오판 회귀 (인용된 문구를 실패로 읽던 사례) =="
check ok Bash '훅 소스 출력 — 주석에 "no results found" 인용' \
  '"# 텍스트에 \"no results/matches/files/context found\" 류 패턴 → failed"'
check ok Bash '훅 소스 출력 — 주석에 No results found 인용' \
  '"#   실패 조회(\"No results found\")도 위치를 못 얻은 것이라 게이트를 열면 안 됨"'
check ok Edit '훅 파일 Edit — 원본 전문에 트리거 문구 포함' \
  '{"filePath":"x.sh","originalFile":"No results found 를 설명하는 주석","newString":"y"}'
check ok Write '문서 Write — 본문에 not found 포함' \
  '{"filePath":"doc.md","content":"이 경우 not found 가 뜬다"}'

echo "== 명시 오류 신호는 그대로 실패 =="
check failed Bash 'is_error' '{"is_error":true,"stdout":""}'
check failed Bash 'error 필드' '{"error":"boom"}'
check failed Bash '비정상 종료코드' '{"exitCode":2,"stdout":"x"}'

echo "== codegraph — 결과를 직접 센다 =="
check ok     codegraph_query  'results 1건' '"{\"results\":[{\"node\":{\"filePath\":\"a.cs\"}}]}"'
check failed codegraph_query  'results 0건' '"{\"results\":[]}"'
check failed codegraph_docs   'hits 0건'    '"{\"hits\":[],\"warnings\":[]}"'
check ok     codegraph_docs   'hits 2건'    '"{\"hits\":[{\"file\":\"a.md\"},{\"file\":\"b.md\"}]}"'
check failed codegraph_callers '투영 결과가 빈 출력' '"   "'
check ok     codegraph_callers '투영 결과가 있음' '"      \"qualifiedName\": \"A::B\","'
check ok     codegraph_query  'JSON 안에 not found 문자열이 값으로 들어있어도 결과가 있으면 성공' \
  '"{\"results\":[{\"node\":{\"name\":\"HandleNotFound\",\"filePath\":\"a.cs\"}}]}"'

echo "== 완주하지 못한 codegraph 호출 (감사 실측 29건 중 3건) =="
check failed codegraph_query '120초 타임아웃으로 백그라운드 이동' \
  '"Command did not complete within its 120s timeout and was moved to the background (ID: bn66ezr8d)."'
check failed codegraph_files '사용자가 수동 백그라운드' \
  '"Command was manually backgrounded by user with ID: b7oiuacva."'

echo "== Grep/Glob — 결과 없음이 의미를 갖는 도구 =="
check failed Grep 'No matches found (응답 전체)' '"No matches found"'
check failed Glob '빈 응답' '""'
check ok     Grep '실제 매치' '"a.cs:12: public void Foo()"'
check ok     Grep '매치 내용에 not found 가 들어있음' '"a.cs:12: // not found 처리"'

echo "== 판정 불가 =="
check unknown Bash 'tool_response 없음' 'null'

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
