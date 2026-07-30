#!/usr/bin/env python3
"""rule-candidates.log / relaxation-candidates.log 항목의 status 필드를 결정론적으로 갱신함.
사람 승인 이후에만 호출됨(자동 승격 없음) — /rule-review 스킬의 유일한 쓰기 경로.

사용법 (단건):
  mark_status.py <log_file> <pattern_prefix> approved --dest <목적지파일:라인>
  mark_status.py <log_file> <pattern_prefix> rejected --reason <사유>
  mark_status.py <log_file> <pattern_prefix> materialized --dest <목적지파일:라인>
  mark_status.py <log_file> <pattern_prefix> verified
  mark_status.py <log_file> <pattern_prefix> recurring

사용법 (배치 — pattern 문자열이 sonar-guard 트리거 어휘와 겹쳐 CLI 인자로 못 넘길 때):
  mark_status.py --batch <json_file>
  json_file 내용: [{"log": "...", "pattern": "...", "status": "...", "dest": "..." 또는 "reason": "..."}, ...]
"""
import sys
import json
import datetime


# 후보 로그의 패턴부·메타부 경계. violation-pattern-digest.sh 의 append 형식과 한 쌍이며
# 한쪽만 바꾸면 dedup 이 조용히 뚫린다 — 바꿀 때 반드시 같이 바꿀 것.
META_SEP = " | count="


def split_pattern(stripped):
    """패턴부와 메타부를 분리함. 패턴 자체가 '|' 를 포함할 수 있어 첫 '|' 로 자르면 안 됨."""
    pattern, separator, meta = stripped.partition(META_SEP)
    if not separator:
        return stripped.strip(), None
    return pattern.strip(), "count=" + meta


def build_updated_line(stripped, status, today, suffix):
    pattern, meta = split_pattern(stripped)
    if meta is None:
        return stripped
    drop = ("status=", "decided=", "dest=", "reason=") if suffix else ("status=", "decided=")
    fields = [segment.strip() for segment in meta.split(" | ")]
    fields = [field for field in fields if not field.startswith(drop)]
    fields.append(f"status={status}")
    fields.append(f"decided={today}")
    return pattern + " | " + " | ".join(fields) + suffix


def update_one(log_file, pattern_prefix, status, suffix):
    try:
        with open(log_file, encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"log not found: {log_file}", file=sys.stderr)
        return False

    today = datetime.date.today().isoformat()
    matched = False
    output = []
    for line in lines:
        stripped = line.rstrip("\n")
        if split_pattern(stripped)[0] == pattern_prefix:
            matched = True
            output.append(build_updated_line(stripped, status, today, suffix) + "\n")
        else:
            output.append(line)

    if not matched:
        print(f"pattern not found: {pattern_prefix}", file=sys.stderr)
        return False

    with open(log_file, "w", encoding="utf-8") as f:
        f.writelines(output)

    print(f"updated: {pattern_prefix} -> status={status}")
    return True


def suffix_for(item):
    if item.get("dest"):
        return f" | dest={item['dest']}"
    if item.get("reason"):
        return f" | reason={item['reason']}"
    return ""


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--batch":
        with open(sys.argv[2], encoding="utf-8") as f:
            items = json.load(f)
        all_succeeded = True
        for item in items:
            if not update_one(item["log"], item["pattern"], item["status"], suffix_for(item)):
                all_succeeded = False
        sys.exit(0 if all_succeeded else 1)

    if len(sys.argv) < 4:
        print("usage: mark_status.py <log_file> <pattern_prefix> <status> [--dest X | --reason X]", file=sys.stderr)
        sys.exit(1)

    log_file, pattern_prefix, status = sys.argv[1], sys.argv[2], sys.argv[3]
    suffix = ""
    if "--dest" in sys.argv:
        suffix = f" | dest={sys.argv[sys.argv.index('--dest') + 1]}"
    elif "--reason" in sys.argv:
        suffix = f" | reason={sys.argv[sys.argv.index('--reason') + 1]}"

    sys.exit(0 if update_one(log_file, pattern_prefix, status, suffix) else 1)


if __name__ == "__main__":
    main()
