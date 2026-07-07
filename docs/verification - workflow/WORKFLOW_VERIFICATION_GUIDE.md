# claude-personal-integrated-workflow 실데이터 검증 가이드 — `.codegraphignore` 가산 제외

이 가이드는 **코드+Markdown 하이브리드 프로젝트(claude-personal-integrated-workflow)** 에서
**`.codegraphignore` 가산 제외**(git이 추적하는 경로를 그래프에서 차감)를 검증하는 절차를 설명한다.
RX_1(포함/`--no-gitignore`)과 **상보적인 차감 방향** 케이스다.

## 📋 전제 조건
- Node 22+ (node:sqlite), CodeGraph 0.9.8.x 전역 설치
- 프로젝트 루트에 `.codegraphignore` 존재 (`/docs/` 등 단순 제외)
- 프로젝트는 git 저장소, `docs/`는 **추적(tracked)** 됨

## 🚀 검증 준비 (유저가 이미 실행 완료 — 재실행 불요)
```powershell
cd D:\Unity\claude-personal-integrated-workflow
codegraph index -f
# docs/ 가 git-tracked 이므로 --no-gitignore 불필요. .codegraphignore 의 /docs/ 가 가산 제외한다.
```

## 🔍 검증 절차 (읽기 전용 — 인덱스 변경 없음)

### 1. 인덱스 현황
```powershell
codegraph status "D:\Unity\claude-personal-integrated-workflow"
# 기대: Files 215(code) · Docs 30(markdown)
```

### 2. 인덱싱된 Markdown 전수 (가산 제외 + 앵커링 확인)
```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('D:/Unity/claude-personal-integrated-workflow/.codegraph/codegraph.db',{readOnly:true});console.log(db.prepare('SELECT file_path FROM mdast_metadata ORDER BY file_path').all().map(r=>r.file_path).join('\n'))"
# 기대: root md + manage/ + site/src/content/docs/** (18) 만. docs/ 경로 0건
```

### 3. 가산 제외 증명 (docs/ 는 git-tracked)
```powershell
git -C D:\Unity\claude-personal-integrated-workflow check-ignore -v docs/work.md
# 기대: 출력 없음 (= NOT ignored, docs/ 는 추적됨)
git -C D:\Unity\claude-personal-integrated-workflow ls-files docs/*.md
# 기대: docs/CHANGELOG.md 등 다수 → git 은 추적하지만 위 2번 인덱스엔 없음 = 가산 제외 성립
```

### 4. 코드 그래프 무회귀
```powershell
codegraph query "<코드 심볼>" -p "D:\Unity\claude-personal-integrated-workflow"
codegraph callers "<함수>" -p "D:\Unity\claude-personal-integrated-workflow"
# 기대: 215 files 규모 코드 그래프 정상 동작
```

### 5. 동명 파일 분리 / 누출 검사
```
# 2번 목록에서 루트 CHANGELOG.md 는 존재, docs/CHANGELOG.md 는 부재인지 확인
```

## ✅ 성공 기준
1. **가산 제외**: git-tracked `docs/**` 가 인덱스에 0건
2. **앵커링**: 루트 `/docs/` 제외, `site/.../docs/**` 포함
3. **동명 분리**: 루트 `CHANGELOG.md` 포함 / `docs/CHANGELOG.md` 제외
4. **dotdir 제외**: `.claude`/`.trae`/`.codex`/`.cursor`/`.obsidian` 0건
5. **무회귀**: 코드 215 files·호출 그래프 정상

## 📊 검증 결과 보고
결과를 다음 양식에 기록: [WORKFLOW_VERIFICATION_REPORT.md](./WORKFLOW_VERIFICATION_REPORT.md)

## 🛠️ 트러블슈팅
- **docs/ 가 인덱싱됨** → `.codegraphignore` 에 `/docs/`(루트 앵커) 규칙 존재·오타 확인. `index -f` 재실행.
- **site/.../docs/ 가 사라짐** → `/docs/` 앞 슬래시 누락 시 중첩 docs 까지 과대 제외. 루트 앵커(`/docs/`) 유지.
- **node:sqlite 오류** → Node 22+ 필요.
