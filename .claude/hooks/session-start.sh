#!/bin/bash
# session-start.sh: 세션 시작 시 핵심 컨텍스트 자동 주입
# HANDOVER-MANAGED

# H4: 훅 페이로드의 session_id 를 잡아 두고 tool-history.log 5번째 필드로 흘린다.
#   이 로그는 동시 세션이 한 파일에 append 하므로, 세션 구분이 없으면 codegraph-gate 의
#   5칸 윈도가 다른 세션의 호출로 열리거나 닫힌다(실측: 내가 하지 않은 Edit 이 내 트레일에 나타남).
INPUT=$(cat 2>/dev/null || echo "")
SESSION_ID=$(printf '%s' "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('session_id') or '')[:8])" 2>/dev/null || echo "")
export SESSION_ID

HEALTH_LINE="$(bash .claude/hooks/state-doctor.sh 2>/dev/null | head -1)"
export HEALTH_LINE

python3 - << 'PYEOF'
import json, os, glob, re, subprocess, sys

# ── HR5 CacheAligner: 불변 PREFIX 우선, 가변 SUFFIX 후순위 ──
# KV 캐시 히트율을 위해 prefix 선두는 매 세션 byte-equal이어야 한다.
# [INVARIANT BLOCK] = 매 세션 동일(header → CORE_RULES → CLAUDE.md).
#   이 구역에 RIPER 작업 상태·cxt·위반이력 등 가변 내용을 끼워넣지 말 것(캐시 churn).
# [VARIABLE BLOCK]  = 세션마다 달라짐(RIPER 작업 블록 → plan → cxt → 위반이력). 항상 INVARIANT 뒤.
parts = ["[SESSION-START] 세션 시작 컨텍스트 자동 주입\n"]

# ===== [INVARIANT BLOCK] 시작 — 캐시 prefix (편집 시 모든 세션에 동일 적용될 것만) =====
CORE_RULES = """
=== CORE_RULES (컴팩션 후 자동 복원 · CLAUDE.md RULE 번호와 같음) ===

RULE-1 [SONAR]: 소스 접근 전 codegraph CLI 우선(context → callers/impact → Read(offset+limit)). find·grep -r·rg·소스 전체 Read 는 훅이 막음. state-doctor 가 green 아니면 파생 표현은 참고로만 쓰고 Read 로 확인.
RULE-2 [RIPER]: 상태는 .claude/memory-bank/<branch>/riper/<slug>.state 파일 하나. 여러 세션이 돌려 쓰며, 동시에 도는 카드는 CURRENT 의 자기 칸만 고침.
RULE-3 [GATE]: 플랜 파일이 있으면 중·대형 작업. 플랜과 수락 기준 승인(G1), Review Pack 확인(G2)은 사람 몫.
RULE-4 [WRITE]: 소스 코드를 고치기 전 사용자 승인. 승인된 플랜의 범위 파일만 고침.
RULE-5 [DOC-CONTEXT]: /doc-context 호출 때만 cxt 본문을 읽고 즉시 작업. 재확인 금지.
RULE-6 [MEMORY]: /compact 전 /memory:save. 컴팩션 후에는 /memory:recall.
"""
parts.append(CORE_RULES)

# CLAUDE.md 는 하네스가 프로젝트 instructions(claudeMd)로 매 컨텍스트 자동 주입한다
#   → 여기서 재주입하지 않음(중복 ~10K/세션 제거). 컴팩션 후에도 하네스가 재주입하며,
#     압축 생존 앵커는 위 CORE_RULES(요약본)가 담당. (워크플로 정신=CORE_RULES, 전문=하네스)
# ===== [INVARIANT BLOCK] 끝 — 이 위까지가 캐시 prefix. 아래부터 [VARIABLE BLOCK]. =====

# state-doctor: 파생 상태 정합 센서 결과(가변) — RULE-1 조건부 신뢰의 게이트.
#   green 아니면 codegraph·dict·BLK·cxt·riper-state 표현을 참고로 강등하라는 신호.
#   (bash 레벨에서 미리 계산한 HEALTH_LINE 환경변수를 읽는다 — 내부 subprocess.run(["bash", ...])는
#    WSL bash 오해석으로 stdout 소실 사례가 있어 제거함)
health_line = os.environ.get("HEALTH_LINE") or "STATE HEALTH: unknown (no output)"
parts.append(
    "\n=== 파생상태 건강도 (state-doctor) ===\n"
    f"{health_line}\n"
    "→ green 아니면 RULE-1 조건부 신뢰 발동: 해당 표현 참고로 강등·Read 폴백·재생성"
)

# 세션 핫캐시(2층 L0): 직전 세션 종료 시점의 결정론적 요약. Stop 훅 hot-cache-update.sh 가 갱신한다.
#   VARIABLE 블록 소속(세션마다 달라짐) → INVARIANT prefix 뒤에만 둔다(캐시 churn 방지).
#   "=== 파생상태 건강도" 앵커 뒤라 아래 _budget 캡 절삭 대상에 포함된다(무제한 증식 방지).
#   파일이 없으면 조용히 스킵 — 훅 미설치/첫 세션에서도 안전.
hot_path = ".claude/state/hot.md"
if os.path.isfile(hot_path):
    try:
        with open(hot_path, encoding="utf-8") as f:
            _hot = f.read().strip()
        if _hot:
            _HOT_MAX = 3000
            if len(_hot) > _HOT_MAX:
                _hot = _hot[:_HOT_MAX] + f"\n... (핫캐시 {len(_hot)}자 중 {_HOT_MAX}자만 — 전문: {hot_path})"
            parts.append(f"\n=== 세션 핫캐시 (직전 세션 요약 · {hot_path}) ===\n{_hot}")
    except Exception:
        pass

def _riper_fields(text):
    return {k: v.strip() for k, v in re.findall(r"^([A-Z0-9_]+)=(.*)$", text, re.MULTILINE)}

# 이 세션에 묶인 작업 (riper-bind.sh 가 쓴 묶음 파일, .claude/rules/riper-state.md 3절)
_sid = os.environ.get("SESSION_ID", "")
_bind_file = os.path.join(".claude", "state", "riper-session", _sid) if _sid else ""
bound_state = ""
if _bind_file and os.path.isfile(_bind_file):
    with open(_bind_file, encoding="utf-8") as f:
        bound_state = f.read().strip()

if bound_state and os.path.isfile(bound_state):
    with open(bound_state, encoding="utf-8") as f:
        state_content = f.read()
    parts.append(f"\n=== 이 세션의 RIPER 작업: {bound_state} ===\n{state_content}")
    _fields = _riper_fields(state_content)
    plan_file = _fields.get("PLAN_FILE", "")
    if plan_file and os.path.isfile(plan_file):
        with open(plan_file, encoding="utf-8") as f:
            _plan_lines = f.readlines()
        _PLAN_HEAD = 80
        _plan_head = "".join(_plan_lines[:_PLAN_HEAD])
        _plan_tail = ""
        if len(_plan_lines) > _PLAN_HEAD:
            _plan_tail = f"\n... (플랜 전문 {len(_plan_lines)}줄 중 {_PLAN_HEAD}줄만 — 필요 시 Read {plan_file} 로 로드)\n"
        parts.append(f"\n=== 현재 플랜: {plan_file} (HEAD {_PLAN_HEAD}) ===\n{_plan_head}{_plan_tail}")
else:
    _rows = []
    for _p in glob.glob(".claude/memory-bank/*/riper/*.state"):
        try:
            with open(_p, encoding="utf-8") as f:
                _f = _riper_fields(f.read())
        except Exception:
            continue
        _status = _f.get("STATUS", "active")
        if _status not in ("active", "paused"):
            continue
        _rows.append((_f.get("UPDATED", ""), os.path.basename(_p)[:-len(".state")],
                      _f.get("MODE", "?"), _status, _f.get("CURRENT", "")[:60]))
    _rows.sort(reverse=True)
    _lines = [f"{slug} | {mode} | {status} | {upd} | {cur}" for upd, slug, mode, status, cur in _rows[:10]]
    _body = "\n".join(_lines) if _lines else "(active·paused 작업 없음)"
    parts.append(f"\n=== RIPER 작업 목록 (active·paused, 최근 갱신순 최대 10) ===\n{_body}\n이어 갈 작업은 /riper:<모드> <slug> 로 이 세션에 묶음")

# 확인 대기 큐 (VARIABLE): verdict=pending 인 Review Pack 목록. pack.py 가 없거나 실패하면 침묵함.
_pack = ".claude/skills/review-pack/scripts/pack.py"
if os.path.isfile(_pack):
    try:
        _q = subprocess.run([sys.executable, _pack, "queue", "--brief"],
                            capture_output=True, text=True, encoding="utf-8", timeout=5)
        if _q.returncode == 0 and _q.stdout.strip():
            parts.append(f"\n=== 확인 대기 큐 ===\n{_q.stdout.strip()}")
    except Exception:
        pass

# 최근 cxt 경로 한 줄. 본문은 주입하지 않음. /doc-context 로 부를 때만 읽음.
# HR5 안정 정렬: mtime 정수 초 1차 + 파일명 2차로 결정론 고정(touch churn 완화).
cxt_candidates = glob.glob("docs/contextmd/cxt*.md") + glob.glob("docs/cxtmd/cxt*.md") + glob.glob("cxt/*.md")
if cxt_candidates:
    _latest_cxt = min(set(cxt_candidates), key=lambda p: (-int(os.path.getmtime(p)), p))
    parts.append(f"\n=== 최근 컨텍스트 경로 (본문 미주입) ===\n{_latest_cxt}\n/doc-context {_latest_cxt} 로 불러 실행")

violation_log = ".claude/state/violation-count.log"
if os.path.isfile(violation_log):
    try:
        with open(violation_log, encoding="utf-8") as f:
            _violation_count = sum(1 for _ in f)
        if _violation_count:
            parts.append(f"\n=== SONAR 위반 누계 {_violation_count}회 (상세: {violation_log}) ===")
    except Exception:
        pass

# 도구 사용 이력 초기화 (세션마다 새로 시작)
# 역참조: .claude/skills/output-arm/scripts/emit-output.sh는 이 파일을 조립 소스로 쓰지 않는다.
#   H1 수정(2026-09-23): 이전에는 os.popen('date')를 썼다. Windows 에서 이것은 cmd 의 대화형
#   date 를 부르므로 "현재 날짜: ... / 새로운 날짜를 입력하십시오:" 두 줄이 헤더에 박혔다.
#   그 두 줄이 codegraph-gate 5칸 윈도의 2칸을 먹고(H2), 둘째 줄은 '#' 로 시작하지 않아
#   turn-budget 턴 수에 섞이고(H3), output-arm-gate 의 세션 키가 날짜 단위로 뭉개졌다(6.4).
#   이제 파이썬 자체 시각 + session_id 로 정확히 한 줄만 쓴다.
import datetime
history_file = ".claude/state/tool-history.log"
try:
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    started = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    sid = os.environ.get("SESSION_ID", "") or "nosession"
    with open(history_file, "w", encoding="utf-8") as f:
        f.write(f"# Session started {started} session={sid}\n")
except Exception:
    pass

context = "\n".join(parts)

# A4: 세션 시작 주입 총량 캡 — env SESSION_START_MAX_CHARS 설정 시에만 발동, 미설정이면 기존 무제한 유지
#   CORE_RULES(선두 불변 블록)는 보존하고 초과분은 뒤쪽(state/plan/cxt/위반이력)부터 절삭함(tail 절삭)
_max_chars = os.environ.get("SESSION_START_MAX_CHARS", "").strip()
if _max_chars.isdigit() and int(_max_chars) > 0:
    _cap = int(_max_chars)
    if len(context) > _cap:
        _orig_len = len(context)
        # "=== 파생상태 건강도" 직전까지 = header + CORE_RULES → 항상 보존
        _anchor = context.find("=== 파생상태 건강도")
        if _anchor == -1:
            _anchor = 0
        _head = context[:_anchor]
        _rest = context[_anchor:]
        _marker = f"\n\n[SESSION-START-TRUNCATED] 주입 {_orig_len}자 → {_cap}자 캡(SESSION_START_MAX_CHARS). 절삭 구간 전문은 /doc-context 로 개별 로드."
        _budget = _cap - len(_head) - len(_marker)
        if _budget < 0:
            _budget = 0
        context = _head + _rest[:_budget] + _marker

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
PYEOF
