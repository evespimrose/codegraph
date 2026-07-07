<!-- PLAN -->
<!-- BLK: BLK-DOC-GRAPH -->
<!-- CAVE-MAN-REMINDER: codegraph_context → search → node → (보완)Read. 소스 직독 금지. -->

# PLAN — 하이브리드 doc-graph: `mdast_metadata.doc_links` → `doc` 노드 + `doc_link` 엣지 승격 (순수-MD 게이트)

**브랜치**: Obsidian-Graph-Vector-DB
**작성일**: 2026-06-11
**근거 문서**: `try_002.md`(하이브리드 결론 §5) + 본 세션 `src/` 직접 실측
**선례**: `src/docs/governs-linker.ts`(`linkGovernsEdges`) — 동형 후처리 패스
**RIPER**: PLAN (구현 금지 — 본 문서는 명세만)

---

## 1. 문제 정의 (As-Is)

순수-문서 프로젝트(코드 0, .md 다수)에서 옵시디언 링크/백링크가 **그래프 1등시민이 아니다.** `indexMarkdown`은 `mdast_metadata.doc_links`(JSON)까지 추출·저장하지만, 이를 **노드·엣지로 승격하는 패스가 없어** `codegraph_callers`/`callees`/`impact`/`node`가 문서 링크를 따라가지 못한다. 백링크는 `findBacklinks`(`src/docs/search.ts:261`)가 JSON을 직접 읽어 동작하나, 4대 그래프 질의와 분리돼 있다.

### 1.1 실측 (As-Is 좌표 — 본 세션 확인)

| 사실 | 좌표 | 의미 |
|---|---|---|
| `doc_links` 이미 저장됨 | `src/docs/indexer.ts:87-94,146` | `mdast_metadata.doc_links = JSON.stringify(parsed.docLinks)` — 승격 소스 존재 |
| 일반 문서는 노드 없음 | `src/docs/indexer.ts:159-166` | `concept` 노드는 GOVERNED_DIRS의 BLK 태그에만 생성 |
| callers/callees 화이트리스트 | `src/graph/traversal.ts:251,296` | `['calls','references','imports']` — 새 kind는 **여기 추가해야** 켜짐 |
| impact는 kind 무필터 | `src/graph/traversal.ts:525` | `getIncomingEdges(nodeId)` 인자 없음 → **모든 kind 자동 포함** |
| 마크다운 그래프 파티션 존재 | `src/types.ts:70,76` · `src/db/queries.ts:1668-1676` | 노드=`language='markdown'`, 엣지=`MARKDOWN_EDGE_KINDS` 집계 |
| CLI가 마크다운 엣지 분리 | `src/bin/codegraph.ts:844` | 코드-엣지 브레이크다운에서 `MARKDOWN_EDGE_KINDS` 제외 |
| 게이트(opt-in) 재사용 가능 | `src/docs/config.ts:38,43,69` | `resolveDocsEnabled` / `docsEnvOverride` / `setDocsEnabled` |
| 후처리 linker 선례 | `src/docs/governs-linker.ts:53` · 배선 `src/index.ts:340,467` | indexMarkdown 직후 `linkGovernsEdges` 호출 — 그 옆에 배선 |
| 헬퍼 재사용 대상 | `src/docs/search.ts:280-294,329` | `basenameIndex`/`parseRefs`/`baseName`/`normPath` |

---

## 2. 목표 / 성공 기준

### 2.1 Goal
순수-MD 프로젝트(또는 override ON)에서 `index --with-docs` 1회로 `doc_links`를 **`doc` 노드 + `doc_link` 엣지**로 승격하여, `codegraph_callers`(=백링크)·`callees`(=정방향 링크)·`impact`·`node`가 문서 링크를 따라간다. 코드 프로젝트는 **무손상**(게이트 OFF 시 byte-identical).

### 2.2 Success Criteria (관찰 가능)
1. 순수-MD 프로젝트 index 후 `SELECT count(*) FROM nodes WHERE kind='doc'` ≈ .md 파일 수, `… edges WHERE kind='doc_link'` > 0.
2. `codegraph_callers <doc>` = 그 문서를 인용한 문서들(백링크), `codegraph_callees <doc>` = 그 문서가 인용한 문서들, `codegraph_impact <doc>`에 백링크 문서 포함.
3. **게이트 OFF**(코드 노드 존재 + override 없음): doc 노드/엣지 0, 코드 그래프 노드/엣지 수 **불변**.
4. override: `CODEGRAPH_DOC_GRAPH=1` 강제 ON / `=0` 강제 OFF 동작.
5. **idempotent**: 재인덱싱 시 `doc_link` 엣지 수 불변(`INSERT OR IGNORE`).
6. `getMarkdownGraphCounts`가 `doc` 노드·`doc_link` 엣지를 마크다운 레이어로 집계; CLI 코드-엣지 브레이크다운에서 `doc_link` 제외.
7. `npm test` 그린 + 신규 테스트 통과.

### 2.3 Non-Goals (이번 범위 제외 — try_002 Phase 4)
- ❌ `calls` 위장 옵트인(trace/explore/metrics 표면) — 별도 옵트인으로 추후.
- ❌ `findBacklinks`를 edges 기반으로 통일 — JSON 경로 유지(이중경로 저위험).
- ❌ 혼합 프로젝트 기본 활성화 — 순수-MD 게이트로 OFF, override로만 ON.
- ❌ docs-off/임베딩 부재 시 자동 활성화 — `mdast_metadata`가 비어 no-op(소스 없음).

---

## 3. 설계 결정 (채택안)

- **메커니즘 = Approach 2 승격**: `mdast_metadata.doc_links` → `doc` 노드 + `doc_link` 엣지. `governs-linker`와 동형의 **indexMarkdown 후 결정적 후처리 패스**(`linkDocEdges`).
- **엣지 kind = 전용 `doc_link`** (사용자 채택). `EdgeKind` 유니온 + `MARKDOWN_EDGE_KINDS`에 등록 → callers/callees(화이트리스트 2줄)·impact(무필터 자동)·`getMarkdownGraphCounts`(깔끔 집계)·CLI 분리 전부 충족. 코드 `references`/`calls`와 **의미 오염 0**.
- **노드 kind = `doc`**, `language='markdown'`, **1 doc 노드/파일**. id=`sha1('doc::'+rel)`, name=basename(`.md` 제외), qualified_name=rel. (`language='markdown'`이라 `getMarkdownGraphCounts` 노드 집계에 자동 포함.)
- **게이트 = 하이브리드(자동감지 + override)**: `shouldPromoteDocGraph(db)` = `docGraphEnvOverride() ?? isPureMarkdownProject(db)`. `isPureMarkdownProject` = `COUNT(nodes WHERE kind NOT IN ('doc','concept'))==0 AND COUNT(mdast_metadata)>0` (§6 Q5: `concept`은 코드로 안 침). **`linkDocEdges` 내부에서 indexMarkdown 후 평가** → 최종 코드노드 수 기준(try_002 §4 타이밍 트랩 회피).
- **엣지 방향 = citing → cited**(정방향 링크). `callees`(outgoing)=정방향 링크, `callers`(incoming)=백링크, `impact`(incoming, 무필터)=백링크+심층.
- **provenance** = `'heuristic'`, `metadata.synthesizedBy:'doc-links-linker'`, `registeredAt:'src/index.ts:linkDocEdges'` (CLAUDE.md synthesized-edge 규약).
- **헬퍼 공유 = `links-util.ts` 추출**: `baseName`/`parseRefs`/`normPath`를 `search.ts`에서 분리, linker와 공유(DRY).
- **idempotency** = `insertEdge`의 `INSERT OR IGNORE`(`src/db/queries.ts:1224`) + 안정 노드 id로 자연 보장.

---

## 4. 구현 단계 (Numbered Steps — Scope Lock)

> 각 스텝 EXECUTE 시 `Read(offset+limit)` 또는 codegraph_node로 **해당 좌표만** 로드. 파일 전체 Read 금지.

**STEP 1 — 종류(kind) 분류 등록**
- **Symbol**: `NODE_KINDS`, `EdgeKind`, `MARKDOWN_NODE_KINDS`, `MARKDOWN_EDGE_KINDS`, `kindBonus`
- **CodeGraph**: `src/types.ts:18-42,49-62,70,76`; `src/search/query-utils.ts:316`
- **File**: `src/types.ts`, `src/search/query-utils.ts`
- **Scope**: types.ts `:42`(NODE_KINDS), `:62`(EdgeKind), `:70`,`:76`; query-utils `:340` 인근
- **BLK target**: [인프라]
- **Action**: insert — `NODE_KINDS`에 `'doc'`; `EdgeKind` 유니온에 `| 'doc_link'`; `MARKDOWN_NODE_KINDS`에 `'doc'`; `MARKDOWN_EDGE_KINDS`에 `'doc_link'`; `kindBonus`에 `doc: 7`.
- **Success criterion**: `tsc` 통과(타입 충돌 0); `MARKDOWN_EDGE_KINDS`에 `doc_link` 포함.

**STEP 2 — doc-graph override 플래그**
- **Symbol**: (신규) `DOC_GRAPH_ENV_VAR`, `docGraphEnvOverride`
- **CodeGraph**: 선례 `docsEnvOverride`/`parseBool` `src/docs/config.ts:29,38`
- **File**: `src/docs/config.ts`
- **Scope**: `:40` 직후(docsEnvOverride 옆)
- **BLK target**: [인프라]
- **Action**: append — `export const DOC_GRAPH_ENV_VAR='CODEGRAPH_DOC_GRAPH';` + `export function docGraphEnvOverride(): boolean|undefined { return parseBool(process.env[DOC_GRAPH_ENV_VAR]); }`.
- **Success criterion**: env 1/0/unset → true/false/undefined 반환(단위테스트).

**STEP 3 — 링크 헬퍼 공유 모듈 추출**
- **Symbol**: `baseName`, `parseRefs`, `normPath`
- **CodeGraph**: `src/docs/search.ts:329`(baseName) + `:333` 이하 internals(parseRefs/normPath)
- **File**: 신규 `src/docs/links-util.ts`; 수정 `src/docs/search.ts`
- **Scope**: search.ts 해당 헬퍼 3개 이동 + import 추가
- **BLK target**: [NEW-BLK] `src/docs/links-util.ts`
- **Action**: create/replace — 3 헬퍼를 `links-util.ts`로 이동(export), `search.ts`는 `import { baseName, parseRefs, normPath } from './links-util'`로 전환. `findBacklinks` 동작 불변.
- **Success criterion**: `findBacklinks` 기존 테스트 그린(회귀 0).

**STEP 4 — `linkDocEdges` linker + 게이트 구현**
- **Symbol**: (신규) `linkDocEdges(db, queries)`, `DocLinkResult`, `isPureMarkdownProject`, `shouldPromoteDocGraph`
- **CodeGraph**: 선례 전체 `src/docs/governs-linker.ts:53-108`; `insertNode` `src/db/queries.ts:228`; `insertEdge` `:1221`; 게이트 `resolveDocsEnabled` `src/docs/config.ts:69`
- **File**: 신규 `src/docs/doc-links-linker.ts`
- **Scope**: 신규 ~90줄
- **BLK target**: [NEW-BLK] `src/docs/doc-links-linker.ts`
- **Action**: create — ①Gate1 `resolveDocsEnabled(db)` false→{0,0,0} ②Gate2 `shouldPromoteDocGraph(db)` false→{0,0,0} ③`SELECT file_path, doc_links FROM mdast_metadata` ④`basenameIndex`(baseName→file_path) ⑤파일별 `doc` 노드 upsert(`insertNode`, kind='doc', language='markdown', id=sha1('doc::'+rel)) ⑥각 `parseRefs(doc_links)` 링크를 basename으로 target 해소→`insertEdge({source:docId(src), target:docId(tgt), kind:'doc_link', provenance:'heuristic', metadata:{synthesizedBy:'doc-links-linker', registeredAt:'src/index.ts:linkDocEdges'}})`. self/미해소는 skip. `isPureMarkdownProject`/`shouldPromoteDocGraph`/`docGraphEnvOverride`(STEP2) 사용.
- **Success criterion**: 단위테스트 — pure-MD seed → doc 노드 N·doc_link 엣지 M; 코드노드 seed(override 없음) → {0,0,0}.

**STEP 5 — traversal 화이트리스트 확장**
- **Symbol**: `getCallersRecursive`, `getCalleesRecursive`
- **CodeGraph**: `src/graph/traversal.ts:251,296`
- **File**: `src/graph/traversal.ts`
- **Scope**: `:251`, `:296` 배열 리터럴
- **BLK target**: [인프라]
- **Action**: replace — 두 곳 `['calls','references','imports']` → `['calls','references','imports','doc_link']`. (impact는 무필터라 미수정.)
- **Success criterion**: `codegraph_callers <doc>`가 백링크 문서 반환(통합테스트).

**STEP 6 — 파이프라인 배선(indexMarkdown 후)**
- **Symbol**: `CodeGraph.indexAll`, `CodeGraph.sync`
- **CodeGraph**: `linkGovernsEdges` 호출처 `src/index.ts:340`(indexAll), `:467`(sync)
- **File**: `src/index.ts`
- **Scope**: 두 호출처에서 `linkGovernsEdges(...)` **직후**
- **BLK target**: [인프라]
- **Action**: insert — `linkDocEdges(this.db.getDb(), this.queries)` 호출(best-effort try/catch, 코드인덱스 실패 비유발). 결과 카운트를 `result.docs.docLinkNodes`/`docLinkEdges`로 선택 노출(IndexResult 타입은 `src/extraction/index.ts:64` docs 블록 — 선택적 필드 추가).
- **Success criterion**: `index --with-docs`(순수-MD 또는 override) 후 `edges.kind='doc_link' > 0`(성공기준 2.2-①).

**STEP 7 — 테스트(단위+게이트+회귀)**
- **Symbol**: 신규 테스트
- **CodeGraph**: 선례 `__tests__/governs-linking.test.ts`
- **File**: 신규 `__tests__/doc-links-linking.test.ts`
- **Scope**: 신규 ~160줄, `fs.mkdtempSync` + `mdast_metadata` 직접 seed(임베딩 의존 회피), `setDocsEnabled(db,true)`
- **BLK target**: [NEW-BLK] `__tests__/doc-links-linking.test.ts`
- **Action**: create — (a)pure-MD: md 3행 seed→doc 노드 3·doc_link 엣지·callers=백링크/callees=정방향 (b)게이트 OFF: 코드노드 seed→{0,0,0}·노드/엣지 불변 (c)override `=1` 강제 ON / `=0` 강제 OFF (d)idempotent: 2회 실행 엣지 수 불변 (e)basename 관용: `인물_강은휘.md`→`character/인물_강은휘.md` 해소.
- **Success criterion**: `npx vitest run __tests__/doc-links-linking.test.ts` 그린.

**STEP 8 — CHANGELOG**
- **File**: `CHANGELOG.md`(`[Unreleased]`)
- **BLK target**: [인프라]
- **Action**: append — `### New Features`에 사용자 친화 1문장(내부 경로·수치·심볼명 금지; 취지: "마크다운 전용 프로젝트에서 노트 간 링크/백링크가 callers·callees·impact 질의에 1등시민으로 등장; `CODEGRAPH_DOC_GRAPH`로 강제 토글"). server-instructions는 도구 **사용법 불변**이라 미수정(기존 `codegraph_backlinks`와 별개로 4대 질의가 doc에서 동작).
- **Success criterion**: CHANGELOG 항목 1건, prepare-release 규약 준수.

**STEP 9 — 빌드·검증·회귀**
- **Action**: `npm run build`(tsc+asset 복사) → `npx vitest run __tests__/doc-links-linking.test.ts` → `npm test`(전체 회귀). 선택: 이 저장소를 `CODEGRAPH_DOCS=1 CODEGRAPH_DOC_GRAPH=1`로 재인덱싱해 코드 프로젝트에서의 override 동작 스모크.
- **Success criterion**: 빌드 그린 + 신규 테스트 통과 + 기존 스위트 회귀 0.

---

## 5. 영향 범위 / 리스크

| 변경 | 영향 | 리스크 | 완화 |
|---|---|---|---|
| 화이트리스트 +doc_link (S5) | callers/callees | 코드 프로젝트 callers에 doc_link 혼입 | 게이트 OFF 시 doc_link 엣지 0(애초 미생성) → 코드 질의 불변 |
| 승격 패스 (S4) | 노드/엣지 수 | god-볼트 링크 폭증 | 1 노드/파일 + `INSERT OR IGNORE` 중복차단; self-link skip |
| kind 등록 (S1) | 타입·검색랭킹 | 기존 kind 충돌 | `doc`/`doc_link`는 신규 문자열, 마이그레이션 불요(자유텍스트) |
| 헬퍼 추출 (S3) | findBacklinks | 백링크 회귀 | 동작 불변 이동, 기존 테스트로 검증 |
| 게이트 오판 (S4) | 모드 토글 | 코드 추가 후 캐시로 순수-MD 유지 | indexMarkdown 후 매회 재평가(중간상태 판단 금지) + override |

**롤백**: 스텝 독립. S1·S5만 되돌리면 doc_link 질의 표면 제거, 데이터는 무해 잔존.

---

## 6. 게이트 (RULE-6: 중·대형) + 미결

- 멀티파일·신규시스템 → **quality-sentinel 필수**, **reporter 필수**.
- 코드 쓰기 전 사용자 승인(RULE-7).
- 채택 확정(try_002 §6): Q1 게이트=둘 다 ✓, Q2 kind=전용 `doc_link` ✓(사용자), Q5 concept=코드 아님 ✓. 보류: Q3 `calls` 위장·Q4 혼합분리·Q6 publish — Non-Goal/추후.
- 엣지 kind 명칭 `doc_link`는 조정 가능(EXECUTE 중 합의 가능, 단 STEP1에서 확정).

## 7. 다음 액션
1. 본 PLAN 사용자 검토·승인.
2. 승인 시 `.riper-state` → EXECUTE, STEP 1부터.
3. quality-sentinel → reporter 게이트.
