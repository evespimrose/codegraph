# 세부 플랜 01: 신뢰도(provenance) 태깅 표준화

**마스터 플랜**: [00-master.md](2026-07-24-graphify-features-00-master.md)
**의존성**: 없음 (02, 03과 병행 가능)
**후행 의존**: 04(자동 리포트), 05(HTML 뷰어)가 이 계획의 결과(표준 어휘 + MCP 노출)를 소비한다.
**최종 개정**: 2026-07-27 — EXECUTE 1단계 전수 감사 결과가 초안의 전제를 뒤집어 전면 재작성.

## 0. 전수 감사 결과 (2026-07-27, 초안 폐기 근거)

초안은 "`provenance`가 느슨한 `string` 필드이고 어휘가 중앙화되지 않았다"고 가정했다. 실측 결과 **세 가지 모두 틀렸다.**

**(1) 타입은 이미 엄격한 union이다** — `src/types.ts:211`

```typescript
provenance?: 'tree-sitter' | 'scip' | 'heuristic';
```

`string`이 아니다. 오타 혼입 여지가 없고, `src/` 전체 `provenance:` 리터럴 대입 17곳이 **전부 정확히 `'heuristic'`** 이다. 어휘 정합 문제는 존재하지 않는다.

**(2) 필드가 사실상 비어 있다** — 이 repo 자신의 인덱스 실측

```
SELECT provenance, COUNT(*) FROM edges GROUP BY provenance
  null       10032
  heuristic      6
```

`'tree-sitter'`와 `'scip'`은 **union에 선언만 되어 있고 코드 어디에서도 대입되지 않는다**(`src/` 전체에서 해당 문자열의 유일한 출현이 타입 선언부 그 자체). 즉 이 필드는 99.94% NULL인 사실상 미사용 필드다. 초안 4단계가 "누락 지점 보강"이라고 표현한 것은 실제로는 **작업 전량**이었다.

**(3) 신뢰도 데이터는 이미 수집되고 있다** — `src/resolution/types.ts:42`

```typescript
resolvedBy: 'exact-match' | 'import' | 'qualified-name' | 'framework' | 'fuzzy' | 'instance-method' | 'file-path';
```

`createEdges`(`src/resolution/index.ts:643`)가 모든 해석 엣지의 `metadata`에 `confidence`(0.65~0.95 이산값)와 `resolvedBy`를 이미 저장한다. 초안이 "codegraph는 정적 해석기라 graphify의 0.55~0.95 이산 confidence에 대응 개념이 없다"고 쓴 것도 틀렸다. **대응물이 이미 존재하고 이미 채워지고 있으며, 다만 노출되지 않을 뿐이다.**

## 1. 재정의된 목표

새 어휘를 만드는 작업이 아니다. **이미 있는 필드를 실제로 채우고, 이미 수집 중인 신뢰도 신호를 노출하는 작업**이다.

1. 기존 union에 `'resolver'` 1개만 **추가**한다(기존 3값은 그대로 둔다. 이미 배포된 public 타입이라 제거·개명은 파괴적 변경).
2. 엣지 생성 choke point **3곳**에 provenance를 스탬프해 NULL을 없앤다.
3. MCP 도구 응답에 provenance를 노출한다.
4. 04번 리포트용 집계 함수를 export한다.

**스키마 변경·마이그레이션 없음** — `edges.provenance` 컬럼은 migration v2에 이미 존재한다. union 값 추가는 TypeScript 전용 변경이다.

## 2. 어휘 정의

| 값 | 생성 경로 | graphify 대응 | 신규 여부 |
|---|---|---|---|
| `tree-sitter` | 추출 파이프라인 직접 산출(AST 또는 포맷 전용 소스 파서) | EXTRACTED | 기존(미사용 → 사용 시작) |
| `resolver` | 참조 해석 성공 — `import`/`exact-match`/`qualified-name`/`file-path`/`framework` | INFERRED (고신뢰) | **신규 추가** |
| `heuristic` | 퍼지·추정 — `fuzzy`/`instance-method`, 콜백 합성, basename 폴백, governs `pickCanonical` | INFERRED (저신뢰) ≈ AMBIGUOUS | 기존(계속 사용) |
| `scip` | 외부 SCIP 인덱스 인입 | EXTRACTED | 기존(여전히 미사용, 선언만 유지) |

**`tree-sitter` 명칭에 대한 의식적 결정**: DFM·Liquid·MyBatis·Svelte·Vue 커스텀 추출기도 같은 경로(`storeExtractionResult`)를 지나므로 이 값을 받는다. 이들은 tree-sitter가 아니라 정규식/전용 파서다. 그럼에도 값을 쪼개지 않는 이유는 (a) `'tree-sitter'`가 이미 공개 타입에 있어 개명이 파괴적이고 (b) 소비자(04 리포트·05 뷰어)가 구분하는 축은 "직접 추출 vs 합성"뿐이기 때문이다. 따라서 이 값의 의미를 **"소스에서 직접 파싱된 엣지"** 로 문서화한다.

## 3. 엣지 생성 choke point (감사로 확정)

`insertEdges` 호출 지점은 5곳이며, 생성 지점 기준으로는 3개 그룹이다.

| 그룹 | 생성 지점 | 현재 provenance | 목표 |
|---|---|---|---|
| 추출 | `storeExtractionResult` (`src/extraction/index.ts:1363`) | 없음(NULL) | `tree-sitter` |
| 해석 | `createEdges` (`src/resolution/index.ts:643`) — `insertEdges` 호출부 698·746 양쪽이 이 함수 출력을 소비 | 없음(NULL) | `resolvedBy`에 따라 `resolver` 또는 `heuristic` |
| 합성 | `callback-synthesizer.ts`(17곳 중 15곳) · `doc-links-linker.ts:140` · `governs-linker.ts:89` | `heuristic` | 유지. 단 `doc-links-linker`만 분기 추가 |

수백 개의 `edges.push({...})` 사이트를 건드릴 필요가 없다. **3개 함수만 수정하면 전체 엣지가 커버된다.**

## 4. 단계

**1. 전수 감사** — 완료(0절). 코드 변경 없음.

**2. union에 `resolver` 추가 + 의미 문서화**
- Symbol: `Edge.provenance`
- CodeGraph: `codegraph_node Edge` → `src/types.ts:191` 확인 완료
- File: `src/types.ts`
- Scope: Line 210-211
- BLK target: [인프라]
- Action: replace (union에 `'resolver'` 추가, 각 값의 의미를 doc 주석으로 명시)
- Success criterion: `npx tsc --noEmit` 통과. 기존 3값은 그대로 남아 있어 기존 대입 17곳이 전부 무변경으로 컴파일된다.

**3. 추출 경로 스탬프**
- Symbol: `storeExtractionResult`
- CodeGraph: `codegraph_node storeExtractionResult` → `src/extraction/index.ts:1326` 확인 완료
- File: `src/extraction/index.ts`
- Scope: Line 1356-1365 (`validEdges` 필터 직후, `insertEdges` 호출 직전)
- BLK target: [인프라]
- Action: insert — `provenance`가 이미 있는 엣지는 보존하고, 없는 엣지에만 `'tree-sitter'`를 채운다(`e.provenance ?? 'tree-sitter'`). 커스텀 추출기가 자체 provenance를 지정하는 미래 확장을 막지 않기 위함.
- Success criterion: 재인덱싱 후 `contains` 엣지의 provenance가 `tree-sitter`

**4. 해석 경로 스탬프 (resolvedBy → provenance 매핑)**
- Symbol: `createEdges`
- CodeGraph: `codegraph_node createEdges` → `src/resolution/index.ts:643` 확인 완료
- File: `src/resolution/index.ts`
- Scope: Line 670-681 (반환 객체 리터럴)
- BLK target: [인프라]
- Action: insert — `ref.resolvedBy`가 `fuzzy` 또는 `instance-method`면 `'heuristic'`, 그 외(`import`/`exact-match`/`qualified-name`/`file-path`/`framework`)는 `'resolver'`. 매핑은 모듈 상단의 명시적 `Set`으로 둬서 전략이 추가될 때 누락이 드러나게 한다.
- Success criterion: 재인덱싱 후 `calls`/`references` 엣지에 `resolver`와 `heuristic`이 **둘 다** 관측됨(한쪽만 나오면 매핑 오류)

**5. 문서 링크 경로 분기 (docs 모드 대조군 확보)**
- Symbol: `linkDocEdges`
- CodeGraph: `codegraph_node linkDocEdges` → `src/docs/doc-links-linker.ts:84` 확인 완료
- File: `src/docs/doc-links-linker.ts`
- Scope: Line 129-146 (`basenameIndex.get(link) ?? basenameIndex.get(baseName(link))` 해석부와 엣지 생성부)
- BLK target: [인프라]
- Action: replace — 두 조회를 분리해, 1차 조회(전체 경로 정확 일치) 성공 시 `'resolver'`, 2차 basename 폴백 성공 시 `'heuristic'`.
- **근거**: 현재는 `doc_link` 엣지 전량이 `'heuristic'`이라, 순수 마크다운 프로젝트(BLADE급, `doc_link`만 존재)에서 05번 플랜의 신뢰도 엣지 스타일이 **모든 엣지를 점선으로** 그려 대조군이 사라진다.
- Success criterion: 순수 마크다운 fixture(경로 정확 일치 링크 1개 + basename만 일치하는 모호 링크 1개)에서 `resolver`/`heuristic`이 각각 관측됨

**6. MCP 도구 응답에 provenance 노출**
- Symbol: `codegraph_callers` / `codegraph_callees` / `codegraph_impact` 응답 포맷터
- CodeGraph: `codegraph_explore "mcp/tools.ts callers callees impact response format"`로 정확한 포맷 함수 확정
- File: `src/mcp/tools.ts`
- Scope: 각 도구의 엣지 렌더링 지점 (탐색 후 확정)
- BLK target: [인프라]
- Action: insert — 엣지 항목에 provenance 표기 추가. **NULL 안전**: 값이 없으면(구버전 인덱스) 표기를 생략하고 절대 `undefined`를 출력하지 않는다.
- Success criterion: 실제 MCP 호출 응답에 provenance가 보이고, 재인덱싱 전 구인덱스에서도 깨지지 않음

**7. 집계 함수 export (04번 재사용 지점)**
- Symbol: `summarizeProvenance(edges): Record<EdgeProvenance | 'unknown', number>`
- File: `src/types.ts` 하단 또는 신규 `src/provenance.ts`
- Scope: 신규 함수
- BLK target: [인프라]
- Action: insert — NULL/undefined는 `unknown`으로 집계(구인덱스 호환)
- Success criterion: 혼합 배열에 대해 정확한 카운트, `unknown` 버킷 동작 확인

**8. 테스트**
- File: `__tests__/provenance.test.ts` (신규)
- Scope: 신규 파일
- BLK target: [인프라]
- Action: insert
- Success criterion: (a) `resolvedBy` 7값 전부에 대한 매핑 테이블 테스트 (b) doc 링크 exact/fallback 분기 (c) `summarizeProvenance`의 `unknown` 버킷. `npm run test` 그린.

**9. 재인덱싱 후 실측 검증**
- Action: (검증)
- Success criterion: 이 repo 재인덱싱 후 `SELECT provenance, COUNT(*) FROM edges GROUP BY provenance`에서 **`tree-sitter`·`resolver`·`heuristic` 3값이 모두 0건이 아니고, NULL이 0건**. 감사 시점의 `null 10032 / heuristic 6`과 대조.

## 5. 알려진 제약

- **구버전 인덱스는 NULL로 남는다.** 백필 마이그레이션을 넣지 않는 이유는 NULL 엣지의 원 생성 경로를 사후에 확정할 수 없기 때문이다(추출 경로와 해석 경로가 섞여 있다). 재인덱싱이 정공법이며, 6·7단계가 NULL을 안전하게 처리하도록 설계했다.
- **`scip`은 여전히 미사용이다.** 이번 범위에서 제거하지 않는다(Surgical Scope: 기존 dead code는 요청 없이 삭제하지 않음).

## 6. 완료 조건

- `npx tsc --noEmit` 무오류
- `npm run test` 전체 그린
- 9단계 실측 검증 통과(NULL 0건, 3값 관측)
- `/code-review` 0 Critical
