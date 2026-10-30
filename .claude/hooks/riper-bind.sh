#!/bin/bash
# riper-bind.sh: PostToolUse(Write|Edit) — RIPER 작업 상태 파일 쓰기를 현재 세션에 묶음
# 규칙: .claude/rules/riper-state.md 3절
# 상태 파일 경로 .claude/memory-bank/<branch>/riper/<slug>.state 를 쓰면
# .claude/state/riper-session/<sid8> 에 저장소 기준 상대 경로 한 줄을 쓴다.
# 그 밖의 경로, 세션 id 없음, 깨진 입력은 아무것도 하지 않는다. 항상 exit 0.

INPUT=$(cat 2>/dev/null || echo "")
printf '%s' "$INPUT" | python3 -c '
import json, os, re, sys
try:
    d = json.loads(sys.stdin.buffer.read().decode("utf-8"))
except Exception:
    sys.exit(0)
sid = ((d.get("session_id") or "") if isinstance(d, dict) else "")[:8]
tool_input = d.get("tool_input") if isinstance(d, dict) else None
path = ((tool_input or {}).get("file_path") or "").replace("\\", "/")
if not re.fullmatch(r"[A-Za-z0-9_-]{1,8}", sid):
    sys.exit(0)
m = re.search(r"(?:^|/)(\.claude/memory-bank/[^/]+/riper/[^/]+\.state)$", path)
if not m:
    sys.exit(0)
os.makedirs(".claude/state/riper-session", exist_ok=True)
with open(os.path.join(".claude/state/riper-session", sid), "w", encoding="utf-8", newline="\n") as f:
    f.write(m.group(1) + "\n")
' 2>/dev/null
exit 0
