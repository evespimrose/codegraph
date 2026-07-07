# 순수 문서/Obsidian Vault 검증 가이드 — `.codegraphignore` + 문서 그래프

이 가이드는 **코드 없는 순수 Markdown 프로젝트(WIKI·BLADE)** 에서 신규 ignore 기능과
문서 그래프(doc 노드·doc_link·백링크·시멘틱 검색)를 검증하는 절차를 설명한다.

## 📋 전제 조건
- Node 22+ (node:sqlite 직접 조회용), CodeGraph 0.9.8.x 전역 설치
- 대상 Vault 루트에 `.codegraphignore` 존재
- 문서 기능 활성화(`CODEGRAPH_DOCS=1` 또는 `index --with-docs`), 인덱싱 완료

## 🚀 검증 준비 (유저가 이미 실행 완료 — 재실행 불요)
```powershell
cd D:\Unity\WIKI        # 또는 D:\Unity\BLADE
$env:CODEGRAPH_DOCS=1
codegraph index -f      # git-ignored 콘텐츠가 있으면 --no-gitignore 추가
```

## 🔍 검증 절차 (읽기 전용)

### 1. 인덱스 현황
```powershell
codegraph status "D:\Unity\WIKI"   # 기대: Docs 76 · doc_link 573
codegraph status "D:\Unity\BLADE"  # 기대: Docs 36 · doc_link 84
```

### 2. 인덱싱 스코프 + 누출 검사 (전수)
```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('D:/Unity/WIKI/.codegraph/codegraph.db',{readOnly:true});console.log(db.prepare('SELECT file_path FROM mdast_metadata ORDER BY file_path').all().map(r=>r.file_path).join('\n'))"
# 기대: obsidian/** + root md 만. raw/ · archive/ · schema/ 는 0건
```
```powershell
ls D:\Unity\WIKI\raw       # 제외 디렉토리에 실제 .md 가 있음을 확인 (누출 0 증명의 전제)
ls D:\Unity\WIKI\archive
```

### 3. 백링크 양방향 탐색
```powershell
codegraph backlinks "obsidian/Architecture_허브.md" -p "D:\Unity\WIKI" -d 2
# 기대: Backlinks(역참조) + Forward links(정참조) 양방향 반환
```

### 4. 시멘틱 docs 검색
```powershell
codegraph docs "멀티에이전트 메모리 아키텍처" -p "D:\Unity\WIKI" -l 5
codegraph docs "비화문 삼년독화 독공" -p "D:\Unity\BLADE" -l 5
# 기대: 질의 의도에 맞는 정본 문서가 상위(작은 distance)로 반환
```

## ✅ 성공 기준
1. **누출 0**: 채워진 제외 디렉토리(raw/archive/schema)의 문서가 인덱스·검색에 0건
2. **스코프 정확**: Vault 본문(obsidian/** 등) 중첩 하위까지 포함, 과소제외 0
3. **문서 그래프**: doc 노드 + doc_link 엣지 생성 (WIKI 573 · BLADE 84)
4. **백링크**: depth 파라미터로 역/정방향 탐색 정상
5. **시멘틱 검색**: 자연어 질의가 정본 문서를 상위 반환

## 📊 검증 결과 보고
결과를 다음 양식에 기록: [PURE_DOCS_VERIFICATION_REPORT.md](./PURE_DOCS_VERIFICATION_REPORT.md)

## 🛠️ 트러블슈팅
- **제외 디렉토리가 인덱싱됨** → `.codegraphignore` 패턴/앵커 확인. `index -f` 로 재인덱싱.
- **doc_link 엣지 0** → 위키링크 `[[...]]` 형식 확인, 문서 기능 활성화(`CODEGRAPH_DOCS=1`) 여부 확인.
- **`codegraph docs` 빈 결과** → sqlite-vec/임베딩 의존성 미설치. 그래프·백링크는 의존성 없이 동작.
- **node:sqlite 오류** → Node 22+ 필요.
