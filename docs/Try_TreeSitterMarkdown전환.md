# Try — 진짜 tree-sitter Markdown 전환 vs regex 하이브리드 마감

> 작성일: 2026-06-12
> 대상 작업: `.md` 파싱을 (A) tree-sitter-markdown 문법으로 전환할지, (B) 현재 regex 구현을 최종안으로 확정(마감)할지 판단
> 브랜치: Obsidian-Graph-Vector-DB
> 근거: codegraph(context/search/node) + `src/docs/parse.ts`·`src/docs/indexer.ts` 직접 실측 + `package.json`/wasm 디렉터리 검증 + `Workflow_End_To_End_LoadMap.md` 역할 매핑

---

## 0. 한 줄 결론 (먼저)

**전환 반대 — regex 하이브리드를 최종안으로 확정(마감)하고, 대기 중인 doc-graph-hybrid PLAN을 EXECUTE한다.**

tree-sitter Markdown 전환은 **로드맵의 핵심 가치(BLK 공간 맵핑)를 1mm도 개선하지 못하면서**, 문법 소싱·이중 파이프라인·재검증이라는 큰 비용을 부른다. 결정적으로 — **전환해도 regex는 사라지지 않는다.** BLK 태그가 사는 HTML 주석/표 셀이 tree-sitter에겐 불투명(opaque) 텍스트라서다.

---

## 1. 현황 (As-Is)

### 1.1 실제 구조 (실측)

```
[코드 .cs/.ts/...]  ── tree-sitter (web-tree-sitter + *.wasm) ──► nodes/edges
                                                                     │
[마크다운 .md]      ── parse.ts (100% 정규식, 무의존) ──► mdast_metadata + concept(BLK) 노드
                          parseDoc() / extractBlkTags()              │
                          ├ BLK 태그 (4개 선언 사이트)               ▼
                          ├ frontmatter title / code_refs       (대기) doc_link 승격
                          ├ [[wikilink]] · [text](url)
                          └ summary (프로즈 정제)
```

| 사실 | 좌표 | 의미 |
|---|---|---|
| `parse.ts`는 **순수 정규식, 무의존** | `src/docs/parse.ts:1-6` 헤더 "no heavy deps — ported from codegraph-mdast" | "mdast"는 **포팅 모듈/테이블 이름**일 뿐, 실제 AST 라이브러리 아님 |
| **mdast/remark/unified/micromark 의존성 0** | `package.json` (검증) | tree-sitter 의존은 `web-tree-sitter`/`tree-sitter-wasms` — 전부 **코드** 언어용 |
| BLK 추출 = 4개 선언 사이트 정규식 | `src/docs/parse.ts:34-69` | `<!-- BLK: -->`, `[BLK: ]`, `// [BLK-X]`, `\| BLK \|` 표 셀 |
| 링크 추출 = `[[ ]]`·`[ ]( )` 정규식 | `src/docs/parse.ts:109-131` | docLinks → `mdast_metadata.doc_links` (JSON) |
| 마크다운 파이프라인은 **임베딩 게이트 뒤** | `src/docs/indexer.ts:64-78` | docs-off / `@xenova/transformers` 부재 시 no-op |
| concept(BLK) 노드는 GOVERNED_DIRS만 | `src/docs/indexer.ts:159-166` | dictionary 등 정전(正典) 문서 한정 |
| "mdast fallback" 커밋 = 검색 헬퍼 47줄 | `3679c32` (`src/mcp/tools.ts` `searchMdastByName`) | AST 도입 아님 — 단순 이름 검색 폴백 |

### 1.2 현황의 핵심 문제 — **있는가?**

**없다.** regex 파서는 현재 109개 .md를 무리 없이 인덱싱 중이며(`codegraph_status`), 로드맵이 요구하는 **BLK 공간 맵핑 + 옵시디언 링크 추출**을 이미 충족한다. "전환"은 *문제 해결*이 아니라 *순수성 추구*다 — 그래서 Try의 대상이다.

---

## 2. 제안 구조 (To-Be) — 전환의 두 갈래

tree-sitter Markdown은 **단일 문법이 아니다.** 공식 `tree-sitter-md`(MDeiml)는 **block 문법 + inline 문법 2개**로 쪼개져 있고(마크다운은 context-free가 아니라서), 2-pass로 돌려 stitch해야 한다. tree-sitter 생태계에서 **가장 통합이 까다로운 문법**이다.

### Option A — `.md`를 코드 ExtractionOrchestrator의 1급 언어로 편입

```
[.md] ── tree-sitter-md (block.wasm + inline.wasm ×2) ── ExtractionOrchestrator ──► file/heading/section 노드
                                                                                          ⚠ 기존 src/docs/ 파이프라인과 충돌
```
→ **마크다운 파이프라인이 2개가 된다** (코드-extractor 경로 + 임베딩-docs 경로). concept/doc 노드 생성 주체가 이원화. 아키텍처 폭발.

### Option B — `parse.ts` 내부만 tree-sitter로 교체 (좁은 의미의 "전환")

```
[.md] ── tree-sitter-md ── parse.ts (링크·헤딩은 AST) ── BUT ── BLK는 여전히 정규식 (HTML주석/표셀은 AST에 불투명)
```
→ **regex가 사라지지 않는다.** tree-sitter로 링크/헤딩만 얻고 BLK는 그대로 regex → **지금보다 더 복잡한 하이브리드**가 되고 순이득은 미미.

---

## 3. 장단점 비교 (5축 — 필수)

### 3-A. 아키텍처 명확성
| | regex 마감 (B 유지) | tree-sitter 전환 |
|---|---|---|
| 파이프라인 경계 | 코드=tree-sitter / 문서=regex, **깔끔히 분리** | A안: **문서 경로 이원화**(extractor vs docs) / B안: AST+regex 혼재 |
| 의존성 방향 | `parse.ts` 무의존 leaf | wasm 로더·2문법 결합 → docs 레이어가 extraction 레이어에 의존 |
| **승자** | ✅ **regex** — 단일 책임, 무의존 leaf 유지 | A는 순환·이원화 위험, B는 혼재 |

### 3-B. 컴파일·빌드 영향
| | regex 마감 | tree-sitter 전환 |
|---|---|---|
| 번들 | 변화 없음 | `tree-sitter-markdown(block+inline).wasm` **2개를 소싱/빌드**(번들 미포함) → `copy-assets`에 추가(빠뜨리면 미출하) |
| 파싱 속도 | 정규식, 즉시 | 파일당 wasm 2-pass — vault 규모에서 더 느림 (단, 병목은 임베딩이라 실효 작음) |
| Node 호환 | 영향 없음 | wasm 로딩 경로 추가 = 플랫폼 검증 표면↑ |
| **승자** | ✅ **regex** — 출하 자산 0 증가 | 신규 wasm 2개 + copy-assets 회귀 위험 |

### 3-C. 현재 작업과의 연관성 ★ (가장 결정적)
| | regex 마감 | tree-sitter 전환 |
|---|---|---|
| doc-graph-hybrid PLAN | **즉시 EXECUTE 가능** — PLAN이 `mdast_metadata.doc_links`(regex 출력)를 그대로 승격 | **PLAN 전제 붕괴** — 입력 소스(parse.ts)를 갈아엎으면 9-STEP 재작성 |
| RIPER 상태 | PLAN 승인 대기 → 바로 진행 | 전환 = 새 RESEARCH/PLAN 사이클 (수일) |
| **승자** | ✅ **regex** — 다 차려진 밥상 | 전환은 진행 중 작업을 무효화 |

### 3-D. 단기 비용 (마이그레이션 리스크)
| 항목 | regex 마감 | tree-sitter 전환 |
|---|---|---|
| 신규 의존/자산 | 0 | wasm 2개 빌드(난이도 高)·web-tree-sitter 문서 로딩 배선 |
| 코드 변경 범위 | 0 (확정만) | `parse.ts` 전면 재작성 + indexer 배선 + (A안) orchestrator 분기 |
| 재인덱싱·재검증 | 불필요 | 109개 .md 전수 재인덱싱 + BLK/링크 정밀도 A/B 재측정(playbook 강제) |
| 노드 수 안정성 | 불변 | heading/section 노드 신설 시 **노드 폭증** 리스크 |
| **승자** | ✅ **regex** | 전환은 고비용·고위험 |

### 3-E. 장기 유지보수
| | regex 마감 | tree-sitter 전환 |
|---|---|---|
| 온보딩 | `parse.ts` 1파일·정규식 = 5분 | 2-grammar split·2-pass stitch = 학습 곡선 급 |
| 견고성(엣지케이스) | reference-style 링크·중첩 펜스 일부 취약 | ✅ AST가 견고 (**전환의 유일한 진짜 강점**) |
| 문법 유지보수 | 없음 | upstream `tree-sitter-md` 버전 추적·wasm 재빌드 부담 |
| **승자** | △ 견고성만 tree-sitter, 나머지 regex | 순이득 작음 — 아래 §4 |

---

## 4. 결정적 분석 — "전환해도 regex는 안 사라진다"

로드맵의 **핵심 검색 1차 자원은 BLK 공간 맵핑**이다(§2.1, §3.1, §7.1 "BLK 좌표 시스템"). 그런데 BLK가 사는 위치는:

| BLK 선언 사이트 | tree-sitter-md가 보는 것 | 결론 |
|---|---|---|
| `<!-- BLK: BLK-001 -->` | `html_block` 1개 (**내부 미파싱, 텍스트 통짜**) | 안에서 `BLK-001` 꺼내려면 **여전히 regex** |
| `\| BLK-001 \|` (dictionary 표) | `pipe_table_cell` (셀은 주지만 **"이게 BLK다"는 인식 못 함**) | 셀 텍스트 **regex 재확인 필수** |
| `// [BLK-001]` (코드 주석) | 마크다운 아님 — 이미 `tree-sitter.ts` 코드 경로 | 전환과 무관 |

→ **AST는 BLK regex를 제거하지 못하고, 실행 위치만 옮긴다.** 즉 프로젝트의 *실제 핵심 기능*에 대해 전환의 이득은 **0에 수렴**.

전환이 개선하는 건 오직 **링크 recall의 엣지케이스**(reference-style `[t][ref]`, 중첩 펜스 경계). 그러나:
- 옵시디언 vault는 `[[wikilink]]` 위주 → 현 regex가 **이미 95%+ 커버**.
- 헤딩 계층 노드가 정말 필요하면 `^#{1,6}\s` **정규식 한 줄**로 충분 — tree-sitter 불요.

> **모든 개별 이득이 (a) 로드맵이 안 쓰거나, (b) 정규식 증분으로 달성되거나, (c) BLK 불투명성에 막힌다.** 전환을 정당화하는 단일 이유가 없다.

---

## 5. 순환 의존성·방향 위험 분석

- **regex 마감**: `parse.ts`는 무의존 leaf(IO·heavy-dep 0). docs 레이어 → extraction 레이어 의존 **없음**. 방향 위험 0.
- **전환 A안**: docs 파이프라인이 `src/extraction/`(orchestrator·wasm 로더)에 **신규 역방향 의존** 발생 → 마크다운 노드 생성 주체 이원화. **아키텍처 경계 훼손**.
- **전환 B안**: 순환은 없으나 `parse.ts`가 무의존 leaf 지위를 잃고 wasm 런타임에 결합 → 단위 테스트가 transformers/vec 없이 도는 현재 장점(`parse.ts` 헤더 설계 의도) 상실.

---

## 6. Workflow 로드맵에서 이 개발의 역할 (사용자 요청)

`Workflow_End_To_End_LoadMap.md` 기준, **이 개발(마크다운 그래프화)이 맡는 칸**:

| 로드맵 항목 | 이 개발의 역할 | tree-sitter가 필요한가? |
|---|---|---|
| §2.2 LLM 위키 — "마크다운+주변노드를 옵시디언·codegraph 벡터DB로 연결" | ✅ **정확히 이 레이어** — doc_link 승격으로 노트 링크/백링크를 그래프 1급 시민화 | ❌ regex 출력(doc_links)으로 충족 |
| §3.2 "능동적 공유 신경망 / 온디맨드 시맨틱 질의" | ✅ callers=백링크·callees=정방향·impact 질의 가능케 함 | ❌ |
| §2.1·§3.1·§7.1 **BLK 공간 맵핑 = 핵심 검색 자원** | ✅ 이미 regex가 제공 (concept 노드) | ❌ **AST에 불투명 — §4** |
| §4·§8 **로드맵이 명시한 진짜 병목** = "Conclusion 파싱 표준화 + Compaction 무결성 + Hook" | ❌ 이 개발 범위 밖 | ❌ 마크다운 AST와 무관 |

**핵심**: 로드맵이 **스스로 지목한 시스템 생명선(§4, §8)**은 *서브에이전트 출력의 균일한 압축 파싱·인덱스 무결성 훅*이지, **마크다운 파서의 AST 순도가 아니다.** tree-sitter 전환은 로드맵의 병목과 **직교(orthogonal)**한다 — 즉, 해도 유토피아에 1mm도 안 가까워진다. 반면 doc-graph-hybrid(regex 기반)는 §2.2/§3.2 신경망 칸을 **실제로 채운다.**

---

## 7. 종합 평가 및 추천

### 결론: **regex 하이브리드 마감 (전환 반대)**

| 축 | 승자 |
|---|---|
| 아키텍처 명확성 | regex |
| 컴파일·빌드 | regex |
| 현재 작업 연관성 | **regex (결정적)** |
| 단기 비용 | regex |
| 장기 유지보수 | 무승부(견고성만 tree-sitter, 순이득 미미) |

5축 중 4축 regex 압승 + 1축 무승부. **전환을 지지하는 축이 단 하나도 없다.**

### 단계별 추천 순서 (진행 시)
1. **확정**: regex(`parse.ts`)를 마크다운 파싱 최종안으로 공식 채택. `.riper-state`/메모리에 "tree-sitter 전환 보류(무기한)" 기록.
2. **EXECUTE**: 대기 중 [doc-graph-hybrid PLAN](.claude/memory-bank/Obsidian-Graph-Vector-DB/plans/Obsidian-Graph-Vector-DB-2026-06-11-doc-graph-hybrid.md) STEP 1부터 — regex 출력(`doc_links`)을 `doc`/`doc_link`로 승격. (로드맵 §2.2 칸 채우기)
3. **증분 보강(선택)**: 견고성이 실제 문제로 드러나면 *그때* 헤딩 계층(`^#{1,6}`)·reference-link만 **정규식 증분**으로 추가. tree-sitter 없이.
4. **로드맵 전진**: 다음 화살은 §8(Conclusion 파싱 표준화·Compaction·Hook) — 마크다운 AST가 아니라 **출력 스키마/훅**이 진짜 병목.

### 전환을 재고할 유일한 조건 (트리거)
아래가 **구체적 요구로 등장하면** 그때만 재평가:
- 구조적 마크다운 질의 필요("H1 X 아래 표 포함한 H2 섹션 전부") — 현재 로드맵에 없음.
- 비-옵시디언 외부 문서 대량 유입(footnote·정의리스트·reference-link·임베디드 HTML 구조 파싱 필요).
→ 둘 다 현 시점 가설 없음 → **무기한 보류**가 정답.

---

## 8. 미결 사항 연계

- **연계**: 본 판단은 `20260611-doc-graph-plan.md` 미결 항목 *"진짜 tree-sitter Markdown 전환 vs regex 하이브리드 마감 결정"*에 대한 답이다 → **마감 채택**으로 종결.
- **영향 없음**: Non-Goal(`calls` 위장, findBacklinks 통일, 혼합 프로젝트 활성화)은 본 결정과 독립 — 그대로 Phase 4 유지.
- **다음 결재**: 본 Try는 분석 문서. 구현 착수("진행해/EXECUTE")는 사용자 결재 후 producer/`/riper:execute` 경유.
