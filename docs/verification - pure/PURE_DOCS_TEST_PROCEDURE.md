# 순수 문서/Obsidian Vault 테스트 절차 및 성공 기준 — `.codegraphignore` + 문서 그래프

## 📌 개요

이 문서는 **코드가 없는 순수 Markdown 프로젝트(WIKI·BLADE)** 에서 **`.codegraphignore`(독립 ignore 스펙)**
와 **문서 그래프(doc 노드·doc_link 엣지·백링크·시멘틱 검색)** 를 검증하는 절차·성공 기준을 정의한다.

검증 목표: ① 기능 작동 · ② 적대적 검증(누출/스코프) · ③ 기능개발 종결 성과.

---

## 🔬 테스트 환경

### 사전 준비
- [ ] CodeGraph 0.9.8.x 전역 설치
- [ ] 대상 Vault 루트에 `.codegraphignore` 존재
- [ ] `CODEGRAPH_DOCS=1` (또는 `index --with-docs`)로 문서 기능 활성화 + 인덱싱 완료
- [ ] (시멘틱 검색 시) sqlite-vec + 임베딩 의존성 사용 가능
- [ ] Node 22+ (node:sqlite 직접 조회용)

---

## 🧪 테스트 케이스

### T1. `.codegraphignore` 제외 적용 (기능)
**목표**: 제외 패턴(`/raw/`·`/archive/`·`/schema/`·`/.obsidian/`·`/docs/`)의 문서가 인덱스에서 빠지는가.

**절차**:
```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('D:/Unity/WIKI/.codegraph/codegraph.db',{readOnly:true});console.log(db.prepare('SELECT file_path FROM mdast_metadata ORDER BY file_path').all().map(r=>r.file_path).join('\n'))"
```
**성공 기준**:
- [ ] 인덱싱 목록에 `raw/`·`archive/`·`schema/` 경로가 **0건**
- [ ] 제외 디렉토리에 실제 .md가 존재함에도 인덱스에 없음 (빈 디렉토리 아님)

---

### T2. 인덱싱 스코프 포함 (기능)
**목표**: Vault 본문(`obsidian/**` / `character·detail·power·root·world/**`)이 중첩까지 포함되는가.

**성공 기준**:
- [ ] Vault 본문 디렉토리의 .md가 빠짐없이 인덱싱됨 (중첩 하위 포함)
- [ ] 과소제외(원하는 문서 누락) 0건

---

### T3. doc 노드 + doc_link 엣지 (기능)
**목표**: `[[위키링크]]`가 doc 노드와 doc_link 엣지로 그래프화되는가.

**절차**: `codegraph status "<vault>"` 의 Docs/Concepts + DB의 `edges WHERE kind='doc_link'` 카운트.

**성공 기준**:
- [ ] doc 노드 수 = 문서 수 수준
- [ ] doc_link 엣지가 1개 이상 생성됨 (위키링크 보유 Vault)

---

### T4. 백링크 양방향 탐색 (기능)
**목표**: depth 파라미터로 역방향(백링크)·정방향(포워드) 링크가 탐색되는가.

**절차**:
```bash
codegraph backlinks "obsidian/Architecture_허브.md" -p "D:\Unity\WIKI" -d 1
codegraph backlinks "obsidian/Architecture_허브.md" -p "D:\Unity\WIKI" -d 2
```
**성공 기준**:
- [ ] 백링크(역참조)와 포워드 링크가 모두 반환됨
- [ ] depth 증가 시 탐색 범위 확장
- [ ] 순환 참조가 무한 루프 없이 처리됨

---

### T5. 시멘틱 docs 검색 (기능)
**목표**: 자연어 질의로 의미 기반 문서 검색이 동작하는가.

**절차**:
```bash
codegraph docs "<자연어 질의>" -p "D:\Unity\WIKI" -l 5
```
**성공 기준**:
- [ ] 질의 의도에 맞는 정본 문서가 상위(작은 거리)로 반환됨
- [ ] 결과가 인덱싱 스코프 내 문서로 한정됨

---

### A1. 누출 0 — 적대적 (적대)
**목표**: 제외 디렉토리(채워진 상태)의 내용이 그래프/검색으로 새어나오지 않는가.

**절차**:
1. `ls`로 제외 디렉토리에 .md가 실제 존재함을 확인 (`D:\Unity\WIKI\raw`, `archive`)
2. T1 목록 및 `codegraph docs "<제외 문서 전용 키워드>"`에 등장하지 않음 확인

**성공 기준**:
- [ ] 채워진 제외 디렉토리의 문서가 인덱스·검색에 0건 등장

---

## 🎯 종합 성공 기준

### 필수 (All Must Pass)
- [ ] T1~T5 + A1 전부 통과
- [ ] 누출 0 · 과소제외 0
- [ ] 문서 그래프(doc 노드·doc_link)·백링크·시멘틱 검색 정상

### 선택 (Nice to Have)
- [ ] 이전 버전 대비 문서/엣지 수 개선 (예: BLADE 엣지 0→84)
- [ ] 시멘틱 검색 응답이 체감 즉시

---

## 📝 검증 완료 확인

검증자: _______________  검증 날짜: _______________
전체 결과: [ ] 성공 [ ] 실패   비고: _______________
