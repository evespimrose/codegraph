#!/bin/bash
# hot-cache-update.sh: Stop 훅 — 세션 핫캐시 .claude/state/hot.md 갱신 (세션 핫캐시 2층 L0)
# 매 응답 종료 시 덮어쓴다. 훅은 모델을 호출할 수 없으므로 LLM 요약이 아니라
# 상태(riper/<slug>.state) + 변경(git) + 최근 요청(transcript) 의 결정론적 발췌다.
# stdout 침묵 — Stop 훅 출력은 메인 컨텍스트로 역류하므로 아무것도 내보내지 않는다.

HOT_STDIN=$(cat)
export HOT_STDIN

python3 - << 'PYEOF' 2>/dev/null
import glob, json, os, re, subprocess, time

HOT = ".claude/state/hot.md"
MAX_CHARS = 3000  # 약 500단어 상한

def build():
    try:
        payload = json.loads(os.environ.get("HOT_STDIN") or "{}")
    except Exception:
        payload = {}
    transcript = payload.get("transcript_path") or ""

    blocks = [f"<!-- hot-cache-update.sh · {time.strftime('%Y-%m-%d %H:%M')} -->"]

    state_path = ""
    sid = (payload.get("session_id") or "")[:8]
    bind = os.path.join(".claude", "state", "riper-session", sid) if sid else ""
    if bind and os.path.isfile(bind):
        with open(bind, encoding="utf-8") as f:
            state_path = f.read().strip()
    if not (state_path and os.path.isfile(state_path)):
        cands = sorted(glob.glob(".claude/memory-bank/*/riper/*.state"),
                       key=os.path.getmtime, reverse=True)
        state_path = cands[0] if cands else ""
    if state_path:
        with open(state_path, encoding="utf-8") as f:
            keep = [l.rstrip() for l in f
                    if re.match(r"^(MODE|TASK|PLAN_FILE|BRANCH)=", l)]
        if keep:
            blocks.append("## RIPER\n" + "\n".join(keep))

    try:
        out = subprocess.run(["git", "status", "--porcelain"],
                             capture_output=True, text=True, timeout=3).stdout
        changed = [l.strip() for l in out.splitlines() if l.strip()][:12]
        if changed:
            blocks.append("## 변경 파일\n" + "\n".join("- " + c for c in changed))
    except Exception:
        pass

    reqs = []
    if transcript and os.path.isfile(transcript):
        try:
            # 트랜스크립트는 세션이 길어지면 수십 MB 까지 자란다. 매 턴 전문을 읽으면
            # Stop 훅 5s 예산을 잠식하므로 끝에서 512KB 만 되감아 읽는다(첫 줄은 잘렸을 수 있어 버림).
            TAIL_BYTES = 512 * 1024
            with open(transcript, "rb") as fb:
                size = os.fstat(fb.fileno()).st_size
                fb.seek(max(0, size - TAIL_BYTES))
                chunk = fb.read()
            tail = chunk.decode("utf-8", "replace").splitlines()
            if size > TAIL_BYTES and tail:
                tail = tail[1:]
            tail = tail[-400:]
            for line in tail:
                try:
                    ev = json.loads(line)
                except Exception:
                    continue
                if ev.get("type") != "user":
                    continue
                # 도구 결과·훅 주입은 사용자 발화가 아니다
                if ev.get("isMeta") or ev.get("toolUseResult") is not None:
                    continue
                content = (ev.get("message") or {}).get("content")
                if isinstance(content, list):
                    content = " ".join(b.get("text", "") for b in content
                                       if isinstance(b, dict) and b.get("type") == "text")
                if not isinstance(content, str):
                    continue
                content = " ".join(content.split())
                # 훅/시스템 주입과 도구 결과는 사용자 요청이 아니다
                if not content or content.startswith("<") or content.startswith("[SESSION-START]"):
                    continue
                reqs.append(content[:140])
        except Exception:
            pass
    if reqs:
        uniq = []
        for r in reqs[-5:]:
            if r not in uniq:
                uniq.append(r)
        blocks.append("## 최근 사용자 요청\n" + "\n".join("- " + r for r in uniq))

    body = "\n\n".join(blocks)
    if len(body) > MAX_CHARS:
        body = body[:MAX_CHARS] + "\n... (핫캐시 캡 절삭)"
    return body + "\n"

try:
    os.makedirs(os.path.dirname(HOT), exist_ok=True)
    with open(HOT, "w", encoding="utf-8") as f:
        f.write(build())
except Exception:
    pass
PYEOF

exit 0
