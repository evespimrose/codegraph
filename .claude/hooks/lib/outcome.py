# -*- coding: utf-8 -*-
"""도구 호출의 성공·실패 판정. codegraph-gate 의 통행증 판정이 이 값을 쓴다.

왜 따로 뺐나 (2026-09-23):
  이전 판정기는 tool_response 를 통째로 문자열로 만든 뒤 "no results found" 류 패턴을
  아무 위치에서나 찾았다. 그래서 응답 안에 그 문구가 '인용'만 되어 있어도 실패로 찍혔다.

  실측 오판(이 저장소 한 세션, Bash 93건 중 3건):
    - 훅 소스를 출력한 Bash 호출. 그 소스의 주석에 "no results/matches/files/context found"
      와 'No results found' 가 설명으로 적혀 있었다.
    - 훅 파일을 고친 Edit 호출. 응답에 원본 파일 전문이 실려 오는데 그 안에 같은 문구가 있었다.

  실패 판정이 틀리면 게이트가 잘못 닫힌다(codegraph 조회는 성공했는데 실패로 기록 → Read 차단).
  그래서 판정 원칙을 바꾼다.

원칙:
  1. 명시 오류 신호(error·is_error)가 최우선. 이건 추측이 아니다.
  2. "결과 없음"이 의미를 갖는 도구에서만 결과 유무를 본다. 탐색·조회 도구가 그것이다.
     Edit·Write·Read·일반 Bash 는 결과 건수라는 개념이 없으므로 텍스트로 추측하지 않는다.
  3. codegraph 호출은 응답이 JSON 이라 정확히 셀 수 있다. 세지 못할 때(파이프로 투영한 경우)만
     출력이 비었는지를 본다. 문자열 부분일치는 쓰지 않는다.
  4. 입력을 되비추는 필드(oldString·newString·originalFile 등)는 판정 대상에서 뺀다.

사용: TOOL_NAME=<tool> python3 outcome.py   (stdin = 훅 페이로드 JSON)
출력: ok | failed | unknown
"""
import json
import os
import re
import sys

# 결과 건수가 의미를 갖는 도구만 "결과 없음"을 실패로 본다.
RESULT_BEARING = ("Grep", "Glob")
CODEGRAPH_PREFIX = "codegraph_"

# 응답 dict 에서 '출력'에 해당하는 키만 본다. 입력 반향 필드는 제외한다.
OUTPUT_KEYS = ("stdout", "output", "result", "results", "content", "text", "hits", "message")
ECHO_KEYS = ("oldString", "newString", "originalFile", "file", "filePath", "old_string",
             "new_string", "content_before", "input", "command", "prompt")

# 도구가 스스로 "없음"을 말한 응답만 잡는다. 앞뒤에 다른 내용이 붙으면 인용일 가능성이 높다.
EMPTY_RESULT = re.compile(
    r'^\s*(?:no\s+(?:results?|matches?|files?|sessions?|context)\s*(?:found)?'
    r'|(?<![0-9])0\s+(?:results?|matches?|files?)\s*(?:found)?'
    r'|\(no\s+content\)|\(empty\))\s*\.?\s*$',
    re.I)


def output_text(resp):
    """판정에 쓸 텍스트. 입력 반향 필드는 빼고 출력 필드만 모은다."""
    if resp is None:
        return None
    if isinstance(resp, str):
        return resp
    if isinstance(resp, list):
        return "\n".join(output_text(x) or "" for x in resp)
    if isinstance(resp, dict):
        picked = [str(resp[k]) for k in OUTPUT_KEYS if k in resp and resp[k] is not None]
        if picked:
            return "\n".join(picked)
        rest = {k: v for k, v in resp.items() if k not in ECHO_KEYS}
        try:
            return json.dumps(rest, ensure_ascii=False)
        except Exception:
            return str(rest)
    return str(resp)


# 하네스가 명령을 끝까지 못 돌렸다는 '사실' 통보. 추측이 아니라 신호다.
#   감사 실측(2026-09-23): codegraph 호출 29건 중 3건이 120초 타임아웃으로 백그라운드로 밀렸다.
#   그 호출은 좌표를 하나도 주지 못했으므로 게이트를 열면 안 된다.
NOT_COMPLETED = re.compile(
    r'did not complete within its .*timeout|was moved to the background|'
    r'manually backgrounded by user', re.I)


def codegraph_outcome(text):
    """codegraph 응답 판정. 셀 수 있으면 세고, 못 세면 비었는지만 본다."""
    stripped = (text or "").strip()
    if not stripped:
        return "failed"          # 투영 결과가 비었다 = 좌표를 못 얻었다
    if NOT_COMPLETED.search(stripped):
        return "failed"          # 완주하지 못한 호출 = 좌표 없음
    start = stripped.find("{")
    if start != -1:
        try:
            obj = json.loads(stripped[start:])
        except Exception:
            obj = None
        if isinstance(obj, dict):
            for key in ("results", "hits", "callers", "callees", "nodes", "files"):
                if isinstance(obj.get(key), list):
                    return "ok" if obj[key] else "failed"
            if obj.get("error"):
                return "failed"
    return "ok"


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print("unknown")
        return

    if "tool_response" not in payload:
        print("unknown")
        return
    resp = payload.get("tool_response")
    if resp is None:
        print("unknown")
        return

    # 1. 명시 오류 신호가 최우선
    if isinstance(resp, dict):
        if resp.get("error") or resp.get("is_error"):
            print("failed")
            return
        code = resp.get("exitCode", resp.get("exit_code"))
        if isinstance(code, int) and code != 0:
            print("failed")
            return
    if payload.get("is_error"):
        print("failed")
        return

    tool = os.environ.get("TOOL_NAME", "") or payload.get("tool_name", "") or ""
    text = output_text(resp)

    # 2. codegraph 호출은 결과를 직접 센다
    if tool.startswith(CODEGRAPH_PREFIX):
        print(codegraph_outcome(text))
        return

    # 3. 결과 건수가 의미를 갖는 도구만 "없음"을 실패로 본다
    if tool in RESULT_BEARING:
        body = (text or "").strip()
        if not body or EMPTY_RESULT.match(body):
            print("failed")
            return
        print("ok")
        return

    # 4. 나머지는 텍스트로 추측하지 않는다. 오류 신호가 없었으면 성공이다.
    print("ok")


if __name__ == "__main__":
    main()
