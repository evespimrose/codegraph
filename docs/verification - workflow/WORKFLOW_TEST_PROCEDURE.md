# claude-personal-integrated-workflow 테스트 절차 및 성공 기준 — `.codegraphignore` 가산 제외

## 📌 개요

이 문서는 **코드+Markdown 하이브리드 프로젝트(claude-personal-integrated-workflow)** 에서
**`.codegraphignore` 가산(additive) 제외** — git이 **추적**하는 경로를 그래프에서 차감 — 를 검증하는
상세 절차·성공 기준을 정의한다. RX_1(포함/`--no-gitignore`)과 **상보적인 차감 방향** 케이스다.

검증 목표: ① 기능 작동 · ② 적대적 검증(누출/앵커링/회귀) · ③ 기능개발 종결 성과.

---

## 🔬 테스트 환경

### 사전 준비
- [ ] CodeGraph 0.9.8.x 전역 설치 (`codegraph --version`)
- [ ] 프로젝트 루트에 `.codegraphignore` 존재 (`/docs/` 등 단순 제외)
- [ ] 프로젝트는 git 저장소이며 `docs/`가 **추적(tracked)** 됨 (git-ignored 아님)
- [ ] `codegraph index` 1회 완료 (유저 기실행) — 본 케이스는 `--no-gitignore` 불요
- [ ] Node 22+ (node:sqlite 직접 조회용)

---

## 🧪 테스트 케이스

### T1. 가산 제외 — git-tracked `docs/` 차감 (기능, **핵심**)
**목표**: git이 추적하는 `docs/**`가 그래프에서 제외되는가.

**절차**:
1. `git -C <proj> check-ignore -v docs/work.md` → 출력 없음(= NOT ignored) 확인
2. `git -C <proj> ls-files docs/*.md` → `docs/`가 git에 추적됨 확인
3. DB 직접 조회로 인덱싱된 Markdown 전수 확인
   ```bash
   node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('D:/Unity/claude-personal-integrated-workflow/.codegraph/codegraph.db',{readOnly:true});console.log(db.prepare('SELECT file_path FROM mdast_metadata ORDER BY file_path').all().map(r=>r.file_path).join('\n'))"
   ```

**성공 기준**:
- [ ] `docs/`가 git에 **추적**됨(ignored 아님)
- [ ] 그럼에도 인덱싱 목록에 `docs/` 경로가 **0건** → 가산 제외 성립

---

### T2. 앵커링 정확성 — 루트 `/docs/` vs 중첩 `docs/` (기능)
**목표**: 루트 앵커 `/docs/` 제외가 중첩 `site/src/content/docs/`를 오제외하지 않는가.

**성공 기준**:
- [ ] 루트 `docs/` 하위 문서 0건
- [ ] `site/src/content/docs/**` 문서는 정상 포함 (18건 수준)

---

### T3. dotdir 제외 (기능)
**목표**: `.claude/`·`.trae/`·`.codex/`·`.cursor/`·`.obsidian/`·`.vscode/` 가 제외되는가.

**성공 기준**:
- [ ] 위 dotdir 하위 파일이 인덱스에 0건

---

### T4. 코드 인덱싱 무회귀 (적대)
**목표**: Markdown 제외 규칙이 코드(.ts) 그래프에 영향을 주지 않는가.

**절차**: `codegraph status "<proj>"` 의 Files/Nodes/Edges(code) + edge kind 분포 확인.

**성공 기준**:
- [ ] 코드 file/node/edge 수가 정상 (215 files 수준)
- [ ] `calls`/`references`/`imports`/`contains` 등 코드 엣지 정상
- [ ] 코드 심볼 검색 회귀 없음 (`codegraph query "<심볼>" -p <proj>`)

---

### A1. 누출 0 + 동명 파일 분리 (적대)
**목표**: git-tracked 제외 문서가 그래프/검색에 새지 않고, 동명(루트 vs docs/) 파일이 정확히 분기되는가.

**절차**:
1. `git ls-files docs/*.md` 와 인덱싱 목록 비교 → 교집합 0 확인
2. 동명 파일(예: `CHANGELOG.md`)의 루트본/`docs/`본 인덱싱 여부 비교

**성공 기준**:
- [ ] git-tracked `docs/**` 문서가 인덱스·검색에 0건
- [ ] 루트 `CHANGELOG.md` 포함 / `docs/CHANGELOG.md` 제외 (경로 앵커 분기)

---

## 🎯 종합 성공 기준

### 필수 (All Must Pass)
- [ ] T1~T4 + A1 전부 통과
- [ ] 가산 제외(git-tracked docs 차감) 성립 · 누출 0 · 과대제외 0
- [ ] 코드 그래프 회귀 0

### 선택 (Nice to Have)
- [ ] `site/.../docs/**` 등 의도된 포함 경로 누락 0
- [ ] 인덱싱 성능이 이전과 유사 또는 개선

---

## 📝 검증 완료 확인

검증자: _______________  검증 날짜: _______________
전체 결과: [ ] 성공 [ ] 실패   비고: _______________
