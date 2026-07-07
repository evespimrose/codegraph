#!/bin/bash
# compress-output.sh: docs/output/*.md 결정론 compress (규칙 기반 — LLM lossy 압축 금지, RULE-9 Atom 7)
# 입력: 파일 경로 1개 | --latest(최신 1개) | --pending(미압축 전부, SessionStart용 무음 일괄)
# 동작: 30줄 초과 코드블록 → archive 참조 1행 치환, 연속 중복 문단 제거,
#       원문 전체는 docs/output/archive/YYYY-MM/<basename>으로 보존 복사, frontmatter compressed:true 마킹.
# 계약: 삭제 없음(복사+참조 치환만) — 유실률 0. 멱등: 이미 compressed:true면 재실행 무변화(exit 0).
# 배선: SessionStart 훅에서 --pending 실행(차기 세션 시작 전 압축). Stop 훅 배선은 폐기 —
#       Stop에서 파일을 바꾸면 하네스 file-modified 에코가 압축본 전문을 다음 턴에 재주입(실측)하기 때문.

set -euo pipefail

TARGET="${1:-}"

# --pending: 미압축 md 일괄 처리 (SessionStart용 — 완전 무음, best-effort, 항상 exit 0)
if [ "$TARGET" = "--pending" ]; then
  shopt -s nullglob
  for f in docs/output/*.md; do
    bash "$0" "$f" >/dev/null 2>&1 || true
  done
  exit 0
fi

if [ "$TARGET" = "--latest" ]; then
  # 글롭 매치 0건이면 ls가 비영으로 종료 -> set -e/pipefail 하에서 스크립트 전체가 조기 종료되어
  # Stop 훅 exit code 2("정지 차단")로 오인되는 무한루프를 유발한 바 있음. `|| true`로 무해화.
  TARGET=$(ls -t docs/output/*.md 2>/dev/null | head -1) || true
fi
[ -z "$TARGET" ] && exit 0
[ -f "$TARGET" ] || exit 0

python3 - "$TARGET" << 'PYEOF'
import sys, re, os, shutil
from datetime import date

path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    content = f.read()

m = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.S)
if not m:
    sys.exit(0)  # 프론트매터 없음 — 무음 스킵
fm, body = m.group(1), m.group(2)

if re.search(r'^compressed:\s*true\s*$', fm, re.M):
    sys.exit(0)  # 이미 압축됨 — 무음 스킵(멱등)

dm = re.search(r'^date:\s*(\d{4})-(\d{2})-\d{2}\s*$', fm, re.M)
ym = f"{dm.group(1)}-{dm.group(2)}" if dm else date.today().strftime('%Y-%m')

archive_dir = os.path.join('docs', 'output', 'archive', ym)
os.makedirs(archive_dir, exist_ok=True)
archive_path = os.path.join(archive_dir, os.path.basename(path))

# 원문 전체를 archive로 복사(보존) — 삭제 없음
shutil.copy2(path, archive_path)

# 코드블록(```...```) 탐지 — 30줄 초과만 참조 치환
lines = body.split('\n')
out = []
i = 0
block_idx = 0
while i < len(lines):
    line = lines[i]
    fence_match = re.match(r'^(```+)', line)
    if fence_match:
        fence = fence_match.group(1)
        block_start = i
        j = i + 1
        while j < len(lines) and not lines[j].startswith(fence):
            j += 1
        block_end = j
        block_len = block_end - block_start - 1
        if block_len > 30 and block_end < len(lines):
            block_idx += 1
            out.append(f"[archive/{ym}/{os.path.basename(path)} — 코드블록 {block_idx}, 원본 라인 {block_start+1}-{block_end+1} 참조]")
            i = block_end + 1
            continue
        else:
            out.extend(lines[block_start:block_end+1] if block_end < len(lines) else lines[block_start:])
            i = block_end + 1
            continue
    out.append(line)
    i += 1
body2 = '\n'.join(out)

# 연속 중복 문단 제거 (직전 문단과 완전 동일하면 제거 — archive에 원본 보존되므로 유실 아님)
paras = re.split(r'\n\s*\n', body2)
deduped = []
for p in paras:
    if deduped and deduped[-1].strip() == p.strip() and p.strip():
        continue
    deduped.append(p)
body3 = '\n\n'.join(deduped)

if re.search(r'^compressed:', fm, re.M):
    fm2 = re.sub(r'^compressed:.*$', 'compressed: true', fm, flags=re.M)
else:
    fm2 = fm + '\ncompressed: true'

new_content = f"---\n{fm2}\n---\n{body3}"
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"compressed: {path} (archive: {archive_path})")
PYEOF
