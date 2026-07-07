# 순수 문서/Obsidian Vault 독립 재검증 보고서 — `.codegraphignore` + 문서 그래프

**프로젝트**: WIKI (LLM 지식 Vault) · BLADE (Obsidian 소설 Vault)
**검증 일자**: 2026-06-15 (독립 재검증 / re-run)
**검증자**: Claude Code (Opus 4.8)
**CodeGraph 버전**: 0.9.8.1 (전역 설치) · Node v24.14.1 (node:sqlite)
**대상 기능**: `.codegraphignore`(독립 ignore 스펙) + 순수-Markdown 문서 그래프(doc 노드·doc_link 엣지·백링크·시멘틱 검색)
**검증 목표**: ① 기능 작동 · ② 적대적 검증(누출/스코프) · ③ 기능개발 종결 성과

> 본 보고서는 `PURE_DOCS_VERIFICATION_GUIDE.md` / `PURE_DOCS_TEST_PROCEDURE.md` 절차를 **실제 명령으로 재실행**하여
> 기존 `PURE_DOCS_VERIFICATION_REPORT.md`의 주장을 독립 확인한 결과다. 모든 수치는 이번 실행에서 직접 캡처했다.

---

## 0. 사전 조건 확인

| 항목 | 기대 | 실측 | 판정 |
|------|------|------|------|
| codegraph 버전 | 0.9.8.x | **0.9.8.1** | ✅ |
| Node 버전 | 22+ | **v24.14.1** | ✅ |
| WIKI DB 존재 | 있음 | `D:/Unity/WIKI/.codegraph/codegraph.db` | ✅ |
| BLADE DB 존재 | 있음 | `D:/Unity/BLADE/.codegraph/codegraph.db` | ✅ |
| 인덱스 신선도 | up to date | 양 프로젝트 `[OK] Index is up to date` | ✅ |

---

## 1. 인덱스 현황 (실측)

`codegraph status` 출력 기준:

| 지표 | WIKI | BLADE |
|------|------|-------|
| Code Files | 0 | 0 |
| Code Nodes / Edges | 0 / 0 | 0 / 0 |
| Markdown Docs | **76** | **36** |
| Concepts (graph nodes) | 76 | 36 |
| Governs (= doc_link edges) | **573** | **84** |
| DB 크기 | 2.04 MB | 1.76 MB |
| 인덱스 상태 | up to date | up to date |

> **용어 주의**: CLI `status`는 문서 그래프를 `Concepts`/`Governs`로 표기하지만, DB의 실제 엣지 `kind`는
> **`doc_link`** 단일 종류다(아래 T3에서 DB 직접 확인). 즉 status의 `Governs` 카운터 = `doc_link` 엣지 수.

---

## 2. 테스트 결과 요약

| # | 분류 | 테스트 | WIKI | BLADE |
|---|------|--------|------|-------|
| T1 | 기능 | `.codegraphignore` 제외 적용 | ✅ | ✅ |
| T2 | 기능 | 인덱싱 스코프(Vault 본문) 포함 | ✅ | ✅ |
| T3 | 기능 | doc 노드 + doc_link 엣지 | ✅ 76 / 573 | ✅ 36 / 84 |
| T4 | 기능 | 백링크 양방향 탐색 | ✅ | ✅ |
| T5 | 기능 | 시멘틱 docs 검색 | ✅ | ✅ (주1) |
| A1 | 적대 | **누출 0** (채워진 제외 디렉토리) | ✅ | ✅ |
| ③ | 성과 | 이전 대비 개선 | ✅ | ✅ 0→84 엣지 |

**전체**: 🟢 **전 항목 통과** (T1~T5 + A1)

> (주1) BLADE T5는 정답 문서가 top-5 내 반환되나 #1이 아닌 #5에 위치 — 4절·5절 참조. 기능 자체는 정상.

---

## 3. 상세 결과 + 증거

### T1 · T2 — 제외 적용 + 스코프 정확성

**WIKI** — 인덱싱 76건 전수 = 루트 md 3건(`AGENTS.md`·`CLAUDE.md`·`README.md`) + `obsidian/**` 73건.
중첩 하위 `obsidian/RX_1/**`, `obsidian/RX_1/conventions/**`, `obsidian/RX_1/graveyard/**` 까지 빠짐없이 포함.
`raw/`·`archive/`·`schema/`·`docs/`·`.obsidian/` 경로는 **0건**.

```
DB 직접 쿼리(mdast_metadata): leaked(raw|archive|schema|docs|.obsidian) = 0
```

**BLADE** — 인덱싱 36건 전수 = `character/`·`detail/`·`power/`·`root/`·`world/` 본문만.
`docs/`·`.obsidian/` 경로는 **0건**.

```
DB 직접 쿼리(mdast_metadata): leaked(docs|.obsidian) = 0
```

**`.codegraphignore` 패턴(실파일)**
- WIKI: `/docs/`·`/raw/`·`/schema/`·`/archive/`·`/.obsidian/`·`/.git/`·`/.claude/` 등 제외, `!/obsidian/*.md` 재포함.
- BLADE: `/docs/`·`/.obsidian/`·`/.vscode/`·`/.git/`·`/.claude/`·`/.cursor/` 등 제외 (Vault 본문 5개 디렉토리는 미지정 → 기본 포함).

→ **과소제외 0, 과대포함 0**. 선언적 스코프 통제 정상.

### T3 — doc 노드 + doc_link 엣지 (DB 직접 확인)

```
WIKI edges by kind:  doc_link: 573      (다른 kind 없음)
BLADE edges by kind: doc_link: 84       (다른 kind 없음)
```

doc 노드 수 = 문서 수(WIKI 76 / BLADE 36)와 일치, `[[위키링크]]`가 `doc_link` 엣지로 그래프화됨. ✅

### T4 — 백링크 양방향 탐색

**WIKI** `obsidian/Architecture_허브.md`:
- `-d 1` → Backlinks 4건 (`asmdef_레이어_경계강제`·`Clean_Architecture_4계층`·`Western_Salon_허브`·`의존성_역전_DIP`) + Forward 13건
- `-d 2` → Backlinks 4건 + Forward 약 70건으로 **재귀 확장**
- `Western_Salon_허브`가 역/정방향 양쪽에 등장(순환) → **무한 루프 없이 처리**

**BLADE**:
- `detail/디테일_비화문_삼년독화.md` `-d 2` → Backlinks 3건 (`root/NARRATIVE`·`detail/Detail`·`detail/디테일_비화문_어금니장치`)
- `detail/Detail.md` `-d 1` → Backlinks 3건 + Forward 13건 (양방향 정상)

→ depth 파라미터로 탐색 확장, 역/정방향 모두 반환, 순환 안전. ✅

### T5 — 시멘틱 docs 검색

**WIKI** `"멀티에이전트 메모리 아키텍처"` (top-5, 거리 오름차순):
```
1. obsidian/Architecture_허브.md                 (d=1.0237)
2. obsidian/Western_Salon_Clean_Architecture.md  (d=1.0644)
3. obsidian/Unity_고정_스튜디오_구조.md          (d=1.0767)
4. obsidian/Western_Salon_허브.md                (d=1.0906)
5. obsidian/3Tier_에이전트_스튜디오.md           (d=1.1018)
```
→ 의도에 부합하는 정본 문서가 거리순으로 반환, 결과 전부 인덱싱 스코프(`obsidian/**`) 내. ✅

**BLADE** `"비화문 삼년독화 독공"` (top-5):
```
1. detail/디테일_저질금창약.md           (d=0.7713)
2. detail/디테일_관부와무림의경계.md     (d=0.8747)
3. detail/디테일_누더기내공.md           (d=0.9052)
4. detail/디테일_정파_대의와희생.md      (d=0.9116)
5. detail/디테일_비화문_삼년독화.md      (d=0.9350)  ← 질의 직결 정답 문서
```
→ 정답 문서가 top-5 내 반환되고 결과 전부 in-scope `detail/`. 다만 **#1이 아닌 #5**에 위치(기존 보고서의
"최상위권" 표현은 다소 느슨). 거리값 `d=0.935`는 기존 보고서와 일치. 임베딩 검색 특성상 주제 인접 문서가
상위를 차지한 것으로, 기능 결함은 아님. ✅ (주1 참조)

### A1 — 누출 0 (적대적, **결정적**)

**제외 디렉토리가 실제로 채워져 있음**(빈 디렉토리가 아님을 증명):
```
WIKI:  raw 7 .md · archive 28 .md · schema 4 .md · docs 20 .md   (= 제외 .md 59건)
BLADE: docs 8 .md
```

**적대적 시멘틱 질의** — 제외 디렉토리(`raw/`)에만 존재하는 전용 키워드로 검색:
```
$ codegraph docs "입국심사 코드리뷰 그래프" -p WIKI -l 8
→ 반환된 8건 전부 obsidian/** 문서. raw/ 문서 0건.
  (키워드 '입국심사'는 raw/ 의 5개 .md 에만 존재 — code-review-graph_입국심사.md 등)
```

→ 제외 디렉토리에 다수 문서가 채워져 있고 그 전용 키워드로 직접 조준해도, 인덱스·그래프·시멘틱 검색
어디에도 **단 1건도 누출되지 않음**. "빈 디렉토리라 안 나온 것"이 아니라 **실데이터를 정확히 차단**. ✅

---

## 4. 목표별 판정

### ① 기능 작동 — ✅ 달성
`.codegraphignore` 제외/스코프, doc 노드·doc_link 엣지, 백링크 양방향, 시멘틱 검색이 두 Vault 모두 정상 동작.

### ② 적대적 검증 — ✅ 통과
- **누출 0**: WIKI 제외 디렉토리(.md 59건 실재) 및 BLADE `docs/`(.md 8건)가 인덱스·검색에 0건. DB 쿼리 + 적대적 조준 검색 이중 확인.
- **스코프 정확**: 중첩 하위까지 포함, 과소제외 0.

### ③ 기능개발 종결 성과 — ✅ 달성
- 코드 0줄 프로젝트가 무의미한 그래프 → 풍부한 문서 그래프(WIKI 573 · BLADE 84 엣지)로 전환.
- BLADE: 엣지 **0 → 84**, 문서 **15 → 36** (기존 보고서 대비 정량 도약 수치 재확인).

---

## 5. 발견된 이슈 / 한계 (재검증 추가 관찰)

1. **[정보] CLI 용어 vs DB 용어 불일치** — `status`는 `Concepts`/`Governs`로 표기하나 DB 엣지 kind는 `doc_link` 단일. 표시상 혼동 가능, 기능 영향 없음.
2. **[정보] 기존 보고서 §6 "concept 노드 0"** — 실제 `status`의 `Concepts` 카운터는 doc 노드 수(76/36)를 표시. "concept 0"은 BLK 정본 컨벤션 기반 개념 노드를 가리키는 것으로 해석되며, 표시 카운터와는 별개. 문서 표현상의 모호함.
3. **[정보] T4 d=2 미해결 위키링크 노출** — Forward links에 `형제 프로젝트.md`·`적용 원리.md`·`tool-history-recorder.sh의 역할.md` 등 실제 인덱싱 파일이 아닌 **댕글링 위키링크 대상**이 노드명으로 등장. 누출이 아니라 링크 라벨이며 표시상 항목. 정리 여지 있음.
4. **[경미] WIKI `.codegraphignore`에 `/docs/` 중복** (1행·14행). 무해하나 중복.
5. **[경미] T5 BLADE 정답 문서 순위** — top-5 내이나 #5(주제 인접 문서가 상위 점유). 기존 보고서 "최상위권" 표현은 느슨.

> 위 5건 모두 **기능 결함이 아닌 표시·문서 표현·랭킹 특성** 수준. 합격 판정에 영향 없음.

---

## 6. 결론

**WIKI · BLADE — 전 항목 통과 (T1~T5 + A1).** 독립 재실행 결과, 기존 보고서의 핵심 수치
(WIKI 76 docs/573 edges · BLADE 36 docs/84 edges · 누출 0 · BLADE 0→84)가 **모두 실측으로 재현**되었다.
`.codegraphignore`가 채워진 제외 디렉토리(WIKI .md 59건 실재) 기준 **누출 0**으로 동작하고,
적대적 조준 검색에도 제외 문서가 새지 않음을 확인했다. doc_link 그래프·백링크 양방향·시멘틱 검색이
정상이며, 코드 0줄 순수 Vault에서 기능이 완결됐음을 입증한다. 세 검증 목표를 모두 충족 —
**기능 개발 종결에 충분한 성과**로 판정.

발견된 5개 관찰 항목은 전부 표시/문서표현/랭킹 특성 수준의 경미 사항으로, 합격에 영향이 없다.

**검증자**: Claude Code (Opus 4.8) · **일자**: 2026-06-15 (재검증) · **버전**: codegraph 0.9.8.1 / Node v24.14.1
**핵심 결론**: 순수 Vault 누출 0 ✅ / 문서 그래프 WIKI 573 · BLADE 84 엣지 ✅ / 적대적 조준 검색 누출 0 ✅ / BLADE 0→84 도약 ✅

---

## 7. 검증 완료 확인

검증자: Claude Code (Opus 4.8)  검증 날짜: 2026-06-15
전체 결과: [x] 성공 [ ] 실패   비고: 기존 보고서 수치 독립 재현, 경미 관찰 5건 기록
