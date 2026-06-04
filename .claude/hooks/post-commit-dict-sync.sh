#!/bin/bash
# post-commit-dict-sync.sh
# git commit 후 변경된 .cs 파일을 감지하여 dictionary.md 갱신 필요 여부 출력.
# 설치: cp .claude/hooks/post-commit-dict-sync.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit

CHANGED=$(git diff --name-only HEAD~1 HEAD -- "*.cs" 2>/dev/null)

if [ -z "$CHANGED" ]; then
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  [dict-sync] .cs 파일 변경 감지                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "$CHANGED" | while read -r f; do
  echo "║  → $f"
done
echo "╠══════════════════════════════════════════════════════╣"
echo "║  manage/dictionary.md § 1~3 갱신 여부 확인하세요.   ║"
echo "║  신규 파일이면 § 1 파일 인덱스 행 추가 필수.        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

exit 0
