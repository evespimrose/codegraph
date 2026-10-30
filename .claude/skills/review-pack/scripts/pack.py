#!/usr/bin/env python3
"""Review Pack CLI: build, confirm, queue. Standard library only."""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BRIEF_MAX = 9
BATCH_LINE = "일괄 통과: python .claude/skills/review-pack/scripts/pack.py confirm --all pass"
EXEMPT_PREFIXES = (".claude/memory-bank/", ".claude/state/")
ACCEPTANCE_RE = re.compile(r"```acceptance\n(.*?)```", re.S)
RECORD_HEADER = "## 5. 확인 기록"
EMPTY_RECORD = "- 기록 없음"


class PackError(Exception):
    pass


def now_text():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def today_text():
    return datetime.now().strftime("%Y-%m-%d")


def rel(path):
    return Path(path).relative_to(Path.cwd()).as_posix()


def git(*args):
    return subprocess.run(
        ["git", "-c", "core.quotepath=off", *args],
        cwd=Path.cwd(), capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


def default_base():
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch == "main":
        return "HEAD"
    proc = git("merge-base", "HEAD", "main")
    return proc.stdout.strip() if proc.returncode == 0 else "HEAD"


def changed_files(base):
    tracked = git("diff", "--name-only", base)
    if tracked.returncode != 0:
        raise PackError(f"git diff 실패 (기준: {base}): {tracked.stderr.strip()}")
    untracked = git("ls-files", "--others", "--exclude-standard")
    names = tracked.stdout.splitlines() + untracked.stdout.splitlines()
    return sorted({n.replace("\\", "/") for n in names if n.strip()})


def find_state(slug):
    matches = sorted(Path.cwd().glob(f".claude/memory-bank/*/riper/{slug}.state"))
    return matches[0] if matches else None


def read_kv(path):
    kv = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            kv[key] = value
    return kv


def write_kv(path, updates):
    seen = set()
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        key = line.split("=", 1)[0]
        if "=" in line and key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    out.extend(f"{k}={v}" for k, v in updates.items() if k not in seen)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def parse_acceptance(plan_text):
    block = ACCEPTANCE_RE.search(plan_text)
    if not block:
        raise PackError("플랜에 ```acceptance 블록이 없음")
    items = []
    for number, line in enumerate(block.group(1).splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise PackError(f"acceptance {number}행 JSON 오류: {exc}")
        if "id" not in item or item.get("kind") not in ("auto", "human"):
            raise PackError(f"acceptance {number}행: id 또는 kind(auto|human) 없음")
        if item["kind"] == "auto" and "cmd" not in item:
            raise PackError(f"acceptance {item['id']}: auto 에는 cmd 필요")
        if item["kind"] == "human" and "how" not in item:
            raise PackError(f"acceptance {item['id']}: human 에는 how 필요")
        items.append(item)
    if not items:
        raise PackError("acceptance 블록이 비어 있음")
    return items


def plan_scope(plan_text):
    text = ACCEPTANCE_RE.sub("", plan_text)
    scope = []
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        for span in re.findall(r"`([^`]+)`", line):
            if " " in span:
                continue
            if "/" in span or "." in span:
                scope.append(span)
    return scope


def in_scope(path, scope):
    if path.startswith(EXEMPT_PREFIXES):
        return True
    for pattern in scope:
        if path == pattern or path.startswith(pattern.rstrip("/") + "/") or fnmatch.fnmatch(path, pattern):
            return True
    return False


def find_bash():
    override = os.environ.get("PACK_BASH")
    if override:
        return override
    if os.name == "nt":
        # System32 와 WindowsApps 의 bash.exe 는 WSL 런처라 Windows 경로를 실행하지 못함
        for folder in os.environ.get("PATH", "").split(os.pathsep):
            lowered = folder.lower()
            if "system32" in lowered or "windowsapps" in lowered:
                continue
            candidate = Path(folder) / "bash.exe"
            if candidate.is_file():
                return str(candidate)
    return "bash"


def expected_code(expect):
    match = re.fullmatch(r"exit(\d+)", expect)
    return int(match.group(1)) if match else None


def run_auto(item):
    want = expected_code(item.get("expect", "exit0"))
    if want is None:
        return {"status": "UNVERIFIED", "code": "-", "tail": f"알 수 없는 expect: {item.get('expect')}"}
    limit = int(os.environ.get("PACK_CMD_TIMEOUT", "300"))
    try:
        proc = subprocess.run(
            [find_bash(), "-c", item["cmd"]], cwd=Path.cwd(), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=limit,
        )
    except subprocess.TimeoutExpired:
        return {"status": "UNVERIFIED", "code": "-", "tail": f"시간 초과 ({limit}초)"}
    except OSError as exc:
        return {"status": "UNVERIFIED", "code": "-", "tail": f"실행 불가: {exc}"}
    if proc.returncode == 127:
        return {"status": "UNVERIFIED", "code": 127, "tail": "명령을 찾을 수 없음 (exit 127)"}
    lines = (proc.stdout + proc.stderr).strip().splitlines()
    tail = " / ".join(lines[-3:]) if lines else "(출력 없음)"
    status = "PASS" if proc.returncode == want else "FAIL"
    return {"status": status, "code": proc.returncode, "tail": tail.replace("|", "\\|")}


def extract_record(review_path):
    if not review_path.exists():
        return None
    text = review_path.read_text(encoding="utf-8")
    index = text.find(RECORD_HEADER)
    return text[index:].rstrip() if index >= 0 else None


def render_pack(slug, base, items, results, scope, changed, card_note, record):
    auto = [(item, result) for item, result in zip(items, results) if item["kind"] == "auto"]
    humans = [item for item in items if item["kind"] == "human"]
    out_of_scope = [p for p in changed if not in_scope(p, scope)]
    counts = {s: sum(1 for _, r in auto if r["status"] == s) for s in ("PASS", "FAIL", "UNVERIFIED")}

    lines = [
        "---",
        "verdict: pending",
        f"slug: {slug}",
        f"base: {base}",
        f"generated: {now_text()}",
        "---",
        "",
        f"# Review Pack: {slug}",
        "",
        "## 1. 자동 기준",
        "",
        "| id | 명령 | 기대 | 종료 코드 | 판정 | 출력 마지막 3줄 |",
        "|---|---|---|---|---|---|",
    ]
    for item, result in auto:
        cmd = item["cmd"].replace("|", "\\|")
        lines.append(f"| {item['id']} | `{cmd}` | {item.get('expect', 'exit0')} | {result['code']} | {result['status']} | {result['tail']} |")
    if not auto:
        lines.append("| - | (자동 기준 없음) | - | - | - | - |")

    lines += ["", "## 2. 사람 확인 목록", ""]
    for item in humans:
        lines.append(f"- [ ] **{item['id']}** · 절차: {item['how']} · 기대: {item.get('expect', '-')}")
    if not humans:
        lines.append("- (사람 확인 항목 없음)")

    lines += ["", "## 3. 변경 파일", "", f"기준: `{base}`. 변경 {len(changed)}건, 범위 이탈 {len(out_of_scope)}건.", "", "| 파일 | 판정 |", "|---|---|"]
    for path in changed:
        verdict = "범위 이탈" if path in out_of_scope else "플랜 범위"
        lines.append(f"| {path} | {verdict} |")
    if not changed:
        lines.append("| (변경 없음) | - |")

    lines += ["", "## 4. 카드 보고 요약", "", card_note or "(카드 보고 없음)", "", record or f"{RECORD_HEADER}\n\n{EMPTY_RECORD}"]
    text = "\n".join(lines).rstrip() + "\n"
    summary = (
        f"review-pack {slug}: auto PASS {counts['PASS']}/{len(auto)} · FAIL {counts['FAIL']} · "
        f"UNVERIFIED {counts['UNVERIFIED']} · human {len(humans)} · scope-out {len(out_of_scope)}"
    )
    return text, summary


def cmd_build(args):
    state_path = find_state(args.slug)
    if state_path is None:
        raise PackError(f"상태 파일 없음: .claude/memory-bank/*/riper/{args.slug}.state")
    state = read_kv(state_path)
    plan_path = Path.cwd() / state.get("PLAN_FILE", "")
    if not plan_path.is_file():
        raise PackError(f"플랜 파일 없음: {state.get('PLAN_FILE', '(PLAN_FILE 없음)')}")
    plan_text = plan_path.read_text(encoding="utf-8")
    items = parse_acceptance(plan_text)
    base = args.base or default_base()
    changed = changed_files(base)
    scope = plan_scope(plan_text)
    results = [run_auto(item) if item["kind"] == "auto" else None for item in items]

    review_path = plan_path.parent / f"{args.slug}-review.md"
    text, summary = render_pack(args.slug, base, items, results, scope, changed, args.card_note, extract_record(review_path))
    review_path.write_text(text, encoding="utf-8")
    print(summary)
    return 0


def pack_files():
    return sorted(Path.cwd().glob(".claude/memory-bank/*/plans/*-review.md"))


def verdict_of(text):
    match = re.search(r"^verdict:\s*(\S+)", text, re.M)
    return match.group(1) if match else ""


def fail_count(text):
    return sum(1 for line in text.splitlines() if line.startswith("|") and "| FAIL |" in line)


def set_verdict(text, verdict):
    return re.sub(r"^verdict:.*$", f"verdict: {verdict}", text, count=1, flags=re.M)


def append_record(text, decision, note):
    text = text.replace(EMPTY_RECORD, "").rstrip()
    if RECORD_HEADER not in text:
        text += f"\n\n{RECORD_HEADER}"
    entry = f"- {now_text()} {decision}" + (f" {note}" if note else "")
    return f"{text}\n{entry}\n"


def update_state(review_path, slug, decision, note):
    state_path = review_path.parent.parent / "riper" / f"{slug}.state"
    if not state_path.exists():
        return f"상태 파일 없음, 상태는 갱신하지 않음: {rel(state_path)}"
    stamp = f"G2 {'통과' if decision == 'pass' else '반려'} {today_text()}" + (f": {note}" if note else "")
    if decision == "pass":
        write_kv(state_path, {"STATUS": "done", "UPDATED": today_text(), "CURRENT": stamp})
    else:
        write_kv(state_path, {"STATUS": "active", "UPDATED": today_text(), "CURRENT": stamp})
    return None


def cmd_confirm(args):
    if args.all:
        if len(args.words) != 1:
            raise PackError("사용법: confirm --all pass|fail")
        decision = args.words[0]
    else:
        if len(args.words) != 2:
            raise PackError("사용법: confirm <slug> pass|fail")
        decision = args.words[1]
    if decision not in ("pass", "fail"):
        raise PackError(f"판정은 pass 또는 fail 이어야 함: {decision}")

    packs = pack_files()
    if args.all:
        targets = [p for p in packs if verdict_of(p.read_text(encoding="utf-8")) == "pending"]
    else:
        slug = args.words[0]
        targets = [p for p in packs if p.name == f"{slug}-review.md"]
        if not targets:
            raise PackError(f"Review Pack 없음: {slug}-review.md")

    done, skipped = [], []
    for path in targets:
        text = path.read_text(encoding="utf-8")
        slug = path.name[: -len("-review.md")]
        if decision == "pass" and fail_count(text) and not args.force:
            skipped.append(slug)
            continue
        text = set_verdict(text, decision)
        text = append_record(text, decision, args.note)
        path.write_text(text, encoding="utf-8")
        warning = update_state(path, slug, decision, args.note)
        if warning:
            print(warning, file=sys.stderr)
        done.append(slug)

    for slug in done:
        print(f"confirm {decision}: {slug}")
    for slug in skipped:
        print(f"건너뜀 (자동 기준 FAIL, --force 없이는 pass 불가): {slug}")
    if not args.all and skipped:
        return 1
    return 0


def cmd_queue(args):
    lines = []
    pending = sorted(
        (p for p in pack_files() if verdict_of(p.read_text(encoding="utf-8")) == "pending"),
        key=lambda p: p.stat().st_mtime, reverse=True,
    )
    for path in pending:
        text = path.read_text(encoding="utf-8")
        human = sum(1 for line in text.splitlines() if line.startswith("- [ ]"))
        slug = path.name[: -len("-review.md")]
        lines.append(f"{slug} · 사람 확인 {human} · 자동 실패 {fail_count(text)} · {rel(path)}")
    if not lines:
        return 0
    if args.brief and len(lines) > BRIEF_MAX:
        lines = lines[: BRIEF_MAX - 1] + [f"... 외 {len(lines) - BRIEF_MAX + 1}건 (queue 로 전체 확인)"]
    print("\n".join(lines))
    print(BATCH_LINE)
    return 0


def build_parser():
    parser = argparse.ArgumentParser(prog="pack.py", description="Review Pack build, confirm, queue")
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="Review Pack 생성")
    build.add_argument("slug")
    build.add_argument("--base")
    build.add_argument("--card-note", default="")
    build.set_defaults(func=cmd_build)

    confirm = sub.add_parser("confirm", help="사람 확인 기록. 사용법: confirm <slug> pass|fail 또는 confirm --all pass|fail")
    confirm.add_argument("--all", action="store_true", help="pending 인 Review Pack 전부에 적용")
    confirm.add_argument("words", nargs="*", metavar="slug|decision")
    confirm.add_argument("--note", default="")
    confirm.add_argument("--force", action="store_true")
    confirm.set_defaults(func=cmd_confirm)

    queue = sub.add_parser("queue", help="확인 대기 큐 출력")
    queue.add_argument("--brief", action="store_true")
    queue.set_defaults(func=cmd_queue)
    return parser


def main(argv=None):
    reconfigure = getattr(sys.stdout, "reconfigure", None)
    if reconfigure:
        reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except PackError as exc:
        print(f"pack.py: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
