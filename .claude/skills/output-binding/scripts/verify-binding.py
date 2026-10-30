#!/usr/bin/env python3
"""output 산출물의 codegraph 바인딩을 정량 측정한다.

작성 규율(프론트매터 필드 유무)이 아니라 '회수에 실제로 도달하는가'를 잰다.
지표 미달 시 원인 문서를 지목한다.

사용:
  python3 verify-binding.py                     # docs/output 기본 검사
  python3 verify-binding.py --dir docs/output --topk 3 --json

종료코드: 0=전 지표 목표 충족, 1=미달, 2=측정 불가(CLI/인덱스 문제)
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# 실측(2026-08-13, 이 저장소): 정상 질의 distance 최대 1.1658 / 무관 질의 최소 1.2422.
# 두 분포가 겹치지 않으며 그 간극의 중앙이 1.20이다. 벡터 회수는 --limit 만큼 항상
# 반환하므로 "히트 0"이라는 실패 신호가 원리적으로 없다 — 임계값이 유일한 판정 수단이다.
SIGNAL_MAX_DISTANCE = 1.20

TARGETS = {
    "index_entry": 1.00,   # 산출물이 인덱스에 진입한 비율 — 다른 모든 지표의 전제
    "self_recall": 0.80,   # 자기 keywords 질의 시 top-K 진입
    "coord_bind": 0.90,    # 회수 hit 에 blk 좌표가 실려 오는 비율
    "coord_match": 0.95,   # 실린 좌표가 문서 선언 좌표와 일치
    "code_roundtrip": 0.00,  # 코드 왕복(codeRefs/symbols) — 현재 CLI 미지원, 관측만
}


def cli():
    """codegraph 실행 파일. Windows 는 .cmd 만 PATH 에 잡히는 경우가 있다."""
    for name in ("codegraph.cmd", "codegraph"):
        if shutil.which(name):
            return name
    return None


def run_docs(exe, query, path, limit):
    """codegraph docs 질의. 한국어 Windows 기본 코덱(cp949)이 UTF-8 출력을 깨뜨리므로 명시 지정."""
    try:
        proc = subprocess.run(
            [exe, "docs", query, "-p", path, "--json", "--limit", str(limit)],
            capture_output=True, text=True, timeout=90,
            encoding="utf-8", errors="replace",
        )
        return json.loads(proc.stdout).get("hits", [])
    except Exception:
        return []


def parse_front_matter(text):
    """--- 로 감싼 YAML 앞머리에서 blk / keywords 만 얕게 추출(외부 의존 없이)."""
    m = re.search(r"^---\s*\n(.*?)\n---\s*$", text, re.S | re.M)
    if not m:
        return {}, []
    body = m.group(1)

    def field(name):
        fm = re.search(rf"^{name}:\s*(.+)$", body, re.M)
        return fm.group(1).strip() if fm else ""

    blk_raw = field("blk")
    # BLK-\d+ 형식이 있으면 그것을, 없으면 원문 그대로(예: [인프라])를 좌표로 본다
    blks = re.findall(r"BLK-\d+", blk_raw) or ([blk_raw.strip("[]\"' ")] if blk_raw else [])
    kw_raw = field("keywords")
    keywords = [k.strip("[]\"' ") for k in kw_raw.split(",") if k.strip("[]\"' ")]
    return {"blk": [b for b in blks if b]}, keywords


def collect(directory):
    out = []
    if not os.path.isdir(directory):
        return out
    for name in sorted(os.listdir(directory)):
        if not name.endswith(".md"):
            continue
        p = os.path.join(directory, name).replace(os.sep, "/")
        try:
            text = open(p, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        meta, keywords = parse_front_matter(text)
        out.append({"path": p, "blk": meta.get("blk", []), "keywords": keywords})
    return out


def measure(exe, docs, root, topk, limit):
    known = set()
    probe = run_docs(exe, "output", root, 60)
    for h in probe:
        known.add((h.get("file") or "").replace("\\", "/"))

    result = {k: {"pass": 0, "total": 0, "fail": []} for k in TARGETS}

    for d in docs:
        rel = d["path"]
        base = os.path.basename(rel)

        # index_entry: 문서 고유 파일명으로 질의해 자기 자신이 인덱스에 있는지 확인
        hits = run_docs(exe, base.replace(".md", "").replace("-", " "), root, limit)
        files = [(h.get("file") or "").replace("\\", "/") for h in hits]
        entered = any(rel.endswith(f) or f.endswith(base) for f in files) or rel in known
        result["index_entry"]["total"] += 1
        if entered:
            result["index_entry"]["pass"] += 1
        else:
            result["index_entry"]["fail"].append(rel)
            continue  # 인덱스 밖이면 이후 지표는 측정 자체가 무의미

        # self_recall: 선언한 keywords 로 질의했을 때 top-K 진입
        result["self_recall"]["total"] += 1
        if d["keywords"]:
            kh = run_docs(exe, " ".join(d["keywords"][:6]), root, topk)
            kf = [(h.get("file") or "").replace("\\", "/") for h in kh]
            if any(f.endswith(base) for f in kf):
                result["self_recall"]["pass"] += 1
            else:
                result["self_recall"]["fail"].append(f"{rel} (keywords={d['keywords'][:3]})")
        else:
            result["self_recall"]["fail"].append(f"{rel} (keywords 없음)")

        # coord_bind / coord_match / code_roundtrip: 자기 자신 hit 의 좌표 필드 관찰
        own = next((h for h in hits if (h.get("file") or "").replace("\\", "/").endswith(base)), None)
        result["coord_bind"]["total"] += 1
        result["coord_match"]["total"] += 1
        result["code_roundtrip"]["total"] += 1
        if own:
            got = own.get("blk")
            if got:
                result["coord_bind"]["pass"] += 1
                if not d["blk"] or got in d["blk"]:
                    result["coord_match"]["pass"] += 1
                else:
                    result["coord_match"]["fail"].append(f"{rel} (선언={d['blk']} 회수={got})")
            else:
                result["coord_bind"]["fail"].append(f"{rel} (blk 미충전)")
                result["coord_match"]["fail"].append(f"{rel} (좌표 없음)")
            if (own.get("codeRefs") or own.get("symbols")):
                result["code_roundtrip"]["pass"] += 1
            else:
                result["code_roundtrip"]["fail"].append(rel)
        else:
            for k in ("coord_bind", "coord_match", "code_roundtrip"):
                result[k]["fail"].append(f"{rel} (자기 hit 미발견)")
    return result


def signal_threshold_check(exe, root):
    """무관 질의의 distance 최솟값이 임계 위에 있는지 확인 — 임계값이 여전히 유효한지 감시."""
    hits = run_docs(exe, "zxqw mnbv plok yhtr banana volcano", root, 8)
    ds = [h["distance"] for h in hits if isinstance(h.get("distance"), (int, float))]
    return (min(ds) if ds else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="docs/output")
    ap.add_argument("--root", default=".")
    ap.add_argument("--topk", type=int, default=3)
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    exe = cli()
    if not exe:
        print("[측정 불가] codegraph CLI 미발견", file=sys.stderr)
        return 2

    docs = collect(args.dir)
    if not docs:
        print(f"[측정 불가] {args.dir} 에 .md 산출물 없음", file=sys.stderr)
        return 2

    res = measure(exe, docs, args.root, args.topk, args.limit)
    noise_min = signal_threshold_check(exe, args.root)

    if args.json:
        print(json.dumps({"metrics": res, "noise_min_distance": noise_min,
                          "threshold": SIGNAL_MAX_DISTANCE}, ensure_ascii=False, indent=2))
        ok = all(res[k]["pass"] >= TARGETS[k] * max(res[k]["total"], 1) for k in TARGETS)
        return 0 if ok else 1

    print(f"산출물 {len(docs)}건 · 대상 {args.dir} · top-K={args.topk}")
    print()
    print(f"{'지표':<16}{'실측':>10}{'목표':>8}  판정")
    failed = False
    for key in ("index_entry", "self_recall", "coord_bind", "coord_match", "code_roundtrip"):
        r = res[key]
        total = r["total"]
        rate = (r["pass"] / total) if total else 0.0
        target = TARGETS[key]
        ok = rate >= target
        if not ok and target > 0:
            failed = True
        mark = "OK" if ok else ("관측" if target == 0 else "미달")
        print(f"{key:<16}{r['pass']:>4}/{total:<5}{rate:>7.0%}{target:>8.0%}  {mark}")

    print()
    for key in ("index_entry", "self_recall", "coord_bind", "coord_match", "code_roundtrip"):
        fails = res[key]["fail"]
        if fails and (TARGETS[key] > 0 or key == "code_roundtrip"):
            print(f"[{key}] 원인 문서 {len(fails)}건")
            for f in fails[:5]:
                print(f"    {f}")
            if len(fails) > 5:
                print(f"    ... 외 {len(fails)-5}건")

    print()
    if noise_min is not None:
        state = "유효" if noise_min > SIGNAL_MAX_DISTANCE else "재교정 필요"
        print(f"신호분리 임계 {SIGNAL_MAX_DISTANCE} · 무관질의 최소 distance {noise_min:.4f} → {state}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
