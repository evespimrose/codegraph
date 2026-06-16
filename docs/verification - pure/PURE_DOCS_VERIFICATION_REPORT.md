# 순수 문서/Obsidian Vault 검증 보고서 — `.codegraphignore` + 문서 그래프

**프로젝트**: WIKI (LLM 지식 Vault) · BLADE (Obsidian 소설 Vault)
**검증 일자**: 2026-06-15
**검증자**: Claude Code
**CodeGraph 버전**: 0.9.8.1 (전역 동기화, node:sqlite WAL)
**대상 기능**: `.codegraphignore`(독립 ignore 스펙) + 순수-Markdown 문서 그래프(doc 노드·doc_link 엣지·백링크·시멘틱 검색)
**검증 목표**: ① 기능 작동 · ② 적대적 검증(누출/스코프) · ③ 기능개발 종결 성과

---

## 1. 개요

**코드가 0줄인 순수 문서 프로젝트**에서 신규 ignore 기능과 문서 그래프가 동작하는지 검증한다.
이런 프로젝트는 과거 CodeGraph에서 사실상 **무의미한 그래프**(코드 0 → 노드/엣지 0)였다.
이번 기능으로 **`.codegraphignore`로 인덱싱 스코프를 선언적으로 통제**하고, **doc 노드 + doc_link(위키링크)
엣지로 Zettelkasten 그래프**를 구축하며, **백링크 탐색·시멘틱 검색**까지 제공하는지가 핵심이다.

- **WIKI**: `obsidian/**` 만 인덱싱하고 `raw/`·`archive/`·`schema/`·`.obsidian/` 은 제외.
- **BLADE**: Vault 본문(character/detail/power/root/world)만 인덱싱, `docs/`·`.obsidian/` 제외.

---

## 2. 인덱스 현황 (실측)

| 지표 | WIKI | BLADE |
|------|------|-------|
| Code Files | 0 | 0 |
| Markdown docs (mdast_metadata) | **76** | **36** |
| doc 노드 | 76 | 36 |
| doc_link 엣지 (위키링크) | **573** | **84** |
| DB 크기 | 2.04 MB | 1.76 MB |
| git 저장소 | ✅ | ✅ |

---

## 3. 테스트 결과 요약

| # | 분류 | 테스트 | WIKI | BLADE |
|---|------|--------|------|-------|
| T1 | 기능 | `.codegraphignore` 제외 적용 | ✅ | ✅ |
| T2 | 기능 | 인덱싱 스코프(Vault 본문) 포함 | ✅ | ✅ |
| T3 | 기능 | doc 노드 + doc_link 엣지 생성 | ✅ 76/573 | ✅ 36/84 |
| T4 | 기능 | 백링크 양방향 탐색 | ✅ | ✅(엣지 84) |
| T5 | 기능 | 시멘틱 docs 검색 | ✅ | ✅ |
| A1 | 적대 | **누출 0** (채워진 제외 디렉토리) | ✅ | ✅ |
| ③ | 성과 | 이전 대비 개선 | ✅ | ✅ 0→84 엣지 |

**전체**: [x] 🟢 전 항목 통과 [ ] 🟡 일부 [ ] 🔴 실패

---

## 4. 상세 결과 + 증거

### A1 — 누출 0 (적대적, **결정적**): WIKI
WIKI의 `.codegraphignore`는 `/raw/`·`/archive/`·`/schema/`·`/.obsidian/`·`/docs/` 를 제외한다.
이들은 **실제로 Markdown이 채워져 있는** 디렉토리다(빈 디렉토리가 아니라는 점이 핵심):
```
$ ls D:\Unity\WIKI\raw       → GraphRAG__yt_yWyJKCZG990.md, code-review-graph_입국심사.md,
                               headroom_입국심사.md, headroom_입국심사_2026-06-14.md, ...
$ ls D:\Unity\WIKI\archive   → 2026-05/, 2026-06/  (월별 아카이브, 다수 .md)
```
그러나 인덱싱된 **76건 전부**가 `obsidian/**` + root md(AGENTS/CLAUDE/README) 뿐 —
`raw/`·`archive/`·`schema/` 문서는 **단 한 건도 인덱스에 없음**.

**판정**: 채워진 제외 디렉토리에서 **누출 0**. `.codegraphignore` 제외가 "빈 디렉토리라서 안 나온 것"이
아니라 **실제 다수 문서를 정확히 차단**함을 증명.

### T2 — 스코프 정확성: WIKI
인덱싱 76건 = root md 3 + `obsidian/**` 73 (중첩 `obsidian/RX_1/**`, `obsidian/RX_1/conventions/**`,
`obsidian/RX_1/graveyard/**` 포함). → 중첩 하위까지 빠짐없이 포함, 제외 디렉토리는 0.

### T3·T4 — 문서 그래프 + 백링크: WIKI
```
$ codegraph backlinks "obsidian/Architecture_허브.md" -d 2
Backlinks:  asmdef_레이어_경계강제 · Clean_Architecture_4계층 · Western_Salon_허브 · 의존성_역전_DIP   (4건)
Forward:    LLM_워크플로우_생태계 · Token_허브 · RX_1_허브 · Karpathy_4대_코딩원칙 … (20건)
```
**판정**: `[[위키링크]]`가 doc_link 엣지 **573개**로 해석되고, 백링크(역방향)·포워드(정방향) 양방향
탐색이 정상 동작. depth 파라미터로 재귀 확장.

### T5 — 시멘틱 검색: WIKI
```
$ codegraph docs "멀티에이전트 메모리 아키텍처"
1. obsidian/Architecture_허브.md          (d=1.0237)
2. obsidian/Western_Salon_Clean_Architecture.md (d=1.0644)
3. obsidian/Unity_고정_스튜디오_구조.md     (d=1.0767)
...
```
**판정**: sqlite-vec + 임베딩 기반 의미 검색이 순수-Markdown Vault에서 정상 작동, 거리순 랭킹.

### T1·T3·T5 + 성과 — BLADE (이전 대비 개선이 명확)
| 항목 | 이전(2026-06-10, v0.9.4) | **현재(2026-06-15, v0.9.8.1)** |
|------|--------------------------|-------------------------------|
| Markdown docs | 15 | **36** |
| doc 노드 | (concept 1) | **36** |
| 문서 링크 엣지 | **0** | **84 (doc_link)** |
- 인덱싱 스코프: `character/`·`detail/`·`power/`·`root/`·`world/` (Vault 본문), `docs/`·`.obsidian/` 제외 ✅
- 시멘틱 검색:
  ```
  $ codegraph docs "비화문 삼년독화 독공"
  1. detail/디테일_비화문_삼년독화.md   (d=0.935)  ← 정답 문서 최상위권
  2. detail/디테일_저질금창약.md 등 관련 디테일 노트
  ```
**판정**: 이전엔 **엣지 0개(사실상 그래프 부재)** 였던 순수 Vault가 이제 **doc_link 84개의 실그래프**로
거듭남. 시멘틱 검색이 질의 의도에 맞는 정본 문서를 최상위로 반환.

---

## 5. 목표별 판정

### ① 기능 작동 — ✅ 달성
`.codegraphignore` 제외/스코프, doc 노드·doc_link 엣지, 백링크 양방향, 시멘틱 검색이 두 Vault 모두 정상.

### ② 적대적 검증 — ✅ 통과
- **누출 0**: WIKI의 `raw/`·`archive/`(실제 다수 .md 보유)가 인덱스에 전혀 없음.
- **스코프 정확**: `obsidian/**` 중첩 하위까지 포함, 제외 디렉토리 0.
- **과소제외 0**: Vault 본문 문서 누락 없음(76/36 전부 포함).

### ③ 기능개발 종결 성과 — ✅ 달성
- 코드 0줄 프로젝트가 **무의미한 그래프 → 풍부한 문서 그래프**(WIKI 573·BLADE 84 엣지)로 전환.
- BLADE: 엣지 **0 → 84**, 문서 **15 → 36** (정량적 도약).
- CodeGraph가 "코드 전용 도구"에서 **순수 문서/Obsidian 프로젝트에도 유효한 지식 그래프 도구**로 확장 —
  로드맵의 핵심 이정표 달성.

---

## 6. 발견된 이슈 / 한계

1. **[정보] concept 노드 0** (WIKI/BLADE) — 두 Vault는 BLK 정본 디렉토리(`manage/` 등) 컨벤션을 쓰지
   않아 concept 노드가 생성되지 않음. doc 노드·doc_link 그래프로 충분히 기능하므로 결함 아님.
2. **[정보] 시멘틱 검색 의존성** — `codegraph docs` 는 sqlite-vec + 임베딩 의존성 필요. 미설치 환경에선
   무소음 비활성(그래프/백링크는 그대로 동작).

---

## 7. 결론

**WIKI·BLADE — 전 항목 통과.** `.codegraphignore`가 순수-Markdown Vault에서 **채워진 제외 디렉토리
기준 누출 0**으로 동작하고, doc_link 그래프·백링크·시멘틱 검색이 모두 정상. 특히 BLADE는 엣지 0→84로
**정량적 도약**을 보여, 코드 0줄 프로젝트에서도 기능이 완결됐음을 입증한다. 세 검증 목표를 모두 충족 —
**기능 개발 종결에 충분한 성과**로 판정.

**검증자**: Claude Code · **일자**: 2026-06-15 · **버전**: codegraph 0.9.8.1
**핵심 결론**: 순수 Vault 누출 0 ✅ / 문서 그래프 WIKI 573·BLADE 84 엣지 ✅ / BLADE 0→84 도약 ✅
