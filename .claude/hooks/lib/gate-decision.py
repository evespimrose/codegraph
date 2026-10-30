# -*- coding: utf-8 -*-
"""게이트 차단 결정 JSON 생성기 (sonar-guard · codegraph-gate 공용).

H6/H7/5.3 수정의 핵심. 이전에는 각 훅이 bash 안에서 큰따옴표 python3 -c 로
메시지를 조립했다. 두 가지가 깨졌다.

  5.3  큰따옴표 안의 백틱이 bash 명령치환으로 실행되어 안내 문구가 사라지고,
       매 차단마다 codegraph 를 실제로 2회 실행했다.
  H6   한국어 트레일이 bash 변수 -> argv 로 건너가며 cp949 로 깨졌다(¼º°ø).
  H7   같은 4택 템플릿이 두 훅에 복제되어 한쪽만 고쳐졌다.

해법: 한국어 문구는 전부 이 파일 안에 둔다. 프로세스 경계로는 ASCII 만 넘긴다.
가변 상세 문자열은 base64(UTF-8) 로 받아 인코딩 왕복을 없앤다.

사용:
  python3 lib/gate-decision.py <gate> <mode> <violation_b64> <detail_b64> <ctx_b64>
    gate      : sonar | caveman
    mode      : ask | hard
    violation : 위반 코드(예: "ls -R", "Read")
    detail    : 1줄 상세 설명
    ctx       : MAIN 또는 서브에이전트 타입

환경변수:
  CG_SESSION_ID  현재 세션 id. 있으면 트레일을 이 세션 행으로만 좁힌다(H4).
  CG_HISTORY     tool-history.log 경로. 기본 .claude/state/tool-history.log
  CG_TRAIL_N     트레일 표시 줄 수. 기본 5
"""
import base64
import json
import os
import sys

OUTCOME_LABEL = {"ok": "성공", "failed": "실패", "unknown": "불명"}

GATE_TITLE = {
    "sonar": "SONAR GUARD: bash 탐색/소스출력 감지",
    "caveman": "CAVE-MAN GUARD L1",
}

GATE_REASON = {
    "sonar": "Sonar Protocol",
    "caveman": "Cave-Man Protocol L1",
}

# 문서·설정 문자열은 codegraph 인덱스에 없어 Grep 도구가 유일한 대체재임. 검색 차단에만 붙임
LITERAL_SEARCH_HINT = "문서·설정 리터럴 검색이면 Grep 도구(type/glob 소스 필터 없이)를 쓰면 통과한다."
SEARCH_VIOLATIONS = ("Grep", "grep -r", "rg", "Select-String")

LOCATING_NOTE = """게이트를 여는 것은 "위치를 실제로 얻은" 탐색형 호출뿐이다:
  codegraph context / query / callers / callees / impact / files / backlinks
codegraph status 는 인덱스 헬스만 돌려주므로 게이트를 열지 못한다. 결과가 비어 있는(실패) 조회도 마찬가지다.
게이트 통과만을 목적으로 하는 형식적 호출을 하지 말 것 — 실제로 대상을 찾는 질의를 하라."""

FOUR_OPTIONS = """이 명령을 그대로 재시도하지 말고, 지금 AskUserQuestion 도구를 호출하여 사용자에게 정확히 다음 4개 선택지를 제시하라:

  1. 허용 — 원래 명령을 그대로 승인하고 진행. 승인 시 먼저
     printf '%s' "사용자 승인: <사유>" > .claude/state/sonar-override
     로 1회성 우회 토큰을 기록한 뒤 원래 명령을 재시도한다.
  2. codegraph 강제(회귀 및 재시도) — 이 시도를 취소하고
     codegraph query "<symbol>" -p . -j -l 5
     codegraph context "<intent>" -p . -f json
     (Bash 로 직접 호출. MCP 아님) 로 먼저 조사한 뒤 Glob/Grep/Read 로 원 목표를 재시도한다.
  3. 거부(manual stop) — 여기서 작업을 중단하고 사용자에게 보고한다.
  4. 커스텀 답변 — 자유 응답으로 사용자가 직접 방향을 재지정한다."""


def _b64(value):
    if not value:
        return ""
    try:
        return base64.b64decode(value).decode("utf-8", "replace")
    except Exception:
        return ""


def build_trail():
    path = os.environ.get("CG_HISTORY") or ".claude/state/tool-history.log"
    try:
        limit = int(os.environ.get("CG_TRAIL_N") or 5)
    except ValueError:
        limit = 5
    session = (os.environ.get("CG_SESSION_ID") or "").strip()
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            rows = handle.readlines()
    except Exception:
        return ""

    kept = []
    for line in rows:
        line = line.strip()
        # H1/H2: 주석 헤더와 빈 줄은 도구 호출이 아니다. 창을 잡아먹지 않게 먼저 버린다.
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        # H4: 5번째 필드가 세션 id. 있으면 현재 세션 행만 남긴다.
        if session and len(parts) >= 5 and parts[4] != session:
            continue
        kept.append(parts)

    out = []
    for parts in kept[-limit:]:
        out.append("  %s: %s" % (parts[1], OUTCOME_LABEL.get(parts[3], parts[3])))
    return "\n".join(out)


def main():
    argv = sys.argv[1:]
    gate = argv[0] if len(argv) > 0 else "sonar"
    mode = argv[1] if len(argv) > 1 else "ask"
    violation = _b64(argv[2] if len(argv) > 2 else "")
    detail = _b64(argv[3] if len(argv) > 3 else "")
    ctx = _b64(argv[4] if len(argv) > 4 else "") or "MAIN"

    title = GATE_TITLE.get(gate, GATE_TITLE["sonar"])
    reason_prefix = GATE_REASON.get(gate, GATE_REASON["sonar"])
    headline = detail or violation
    hint = LITERAL_SEARCH_HINT if violation.startswith(SEARCH_VIOLATIONS) else ""

    if mode == "hard":
        reason = "%s: %s (%s) [%s]" % (reason_prefix, headline, violation, ctx)
        context = "⛔ %s (%s) [%s]\n\n%s\n\n%s" % (
            title, violation, ctx, headline, LOCATING_NOTE)
    else:
        trail = build_trail()
        trail_block = ""
        if trail:
            n = os.environ.get("CG_TRAIL_N") or "5"
            trail_block = "\n최근 시도 경위 (직전 %s개 도구, 이 세션):\n%s\n" % (n, trail)
        reason = "%s: %s (%s) [%s] — AskUserQuestion 4택 필요" % (
            reason_prefix, headline, violation, ctx)
        context = "⛔ %s (%s) [%s]\n%s\n%s\n\n%s\n\n%s\n\n사용자 응답 전까지 이 명령을 재시도하지 말 것." % (
            title, violation, ctx, trail_block, headline, FOUR_OPTIONS, LOCATING_NOTE)

    if hint:
        reason = "%s\n%s" % (hint, reason)
        context = "%s\n%s" % (hint, context)

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
            "additionalContext": context,
        }
    }, ensure_ascii=True))


if __name__ == "__main__":
    main()
