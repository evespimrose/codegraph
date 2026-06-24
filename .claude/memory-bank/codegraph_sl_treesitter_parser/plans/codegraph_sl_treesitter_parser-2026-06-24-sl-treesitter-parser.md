# PLAN — SL (FEGate FFS) tree-sitter 파서 구현 (Option C)

> Branch: `codegraph_sl_treesitter_parser` · Started: 2026-06-24 · Mode: PLAN
> 근거: [준비문서](../../../../docs/output/2026-06-23-sl-treesitter-parser-prep.md) · [툴체인 가이드](../../../../docs/output/2026-06-23-docker-emscripten-treesitter-setup.md)
> 문법근거(사용자 지정): `fegate-sl-grammar.md` · `FFS_API_Technical_Specifications.md` · `FFS_API_Guide.md`
> Option C = **`.sl` 네이티브 tree-sitter 문법 저작 + `.h` HELP_FUN 정규식 스텁 추출** (`.h` 풀 문법은 과잉 → 제외)

---

## Goal

코드그래프가 네이티브 `.sl` 코드에 대해 **call graph / impact / trace**를 제공하게 한다(현재 전무). `.h` API 헤더는 정규식 스텁으로 **함수 검색 가능**하게 한다. 둘 다 `add-lang` 파이프라인(4-파일 배선 + extractor)에 올린다.

## 핵심 설계 결정 (EXECUTE 전 확정)

- **D1 — 문법 베이스**: SL 문법은 **`tree-sitter-c`의 grammar.js를 베이스로** 저작한다. C 노드명(`function_definition`/`struct_specifier`/`enum_specifier`/`call_expression`/`preproc_include`/`declaration`/`qualified_identifier`)을 **유지** → `slExtractor`가 `cppExtractor`를 거의 그대로 재사용(특히 `::` 처리 `extractCppQualifiedMethodName`/`extractCppReceiverType`). C에서 **제거**: 포인터·캐스팅·`->`·`typedef/const/unsigned/auto/register/static/extern/sizeof/union`·전처리(=`#include`만 유지). **추가**: `ref` 파라미터·`foreach_db` 문·컨테이너 타입(`array/matrix/set/map/vec3`)·키워드(`bool string set map vec3`)·`::` 스코프 호출(C엔 없음, C++에서 차용).
- **D2 — 문법 깊이**: "call-graph 완전 최소문법". 함수정의·호출식(`a::b()` 포함)·struct/enum·`ref`/컨테이너 시그니처·`#include`·`foreach_db` 바디 진입은 **정확**. 식 우선순위·세밀 타입·로컬 data-flow는 관대/제외(노드 폭발 방지).
- **D3 — `.h` 처리**: 풀 문법 아님. `src/extraction/sl-header-extractor.ts`(정규식, mybatis/liquid 패턴)로 `HELP_FUN`→함수노드. `.h`는 `EXTENSION_MAP`에서 `'c'` 유지하되 `detectLanguage` 콘텐츠 게이트(`HELP_FUN|@decl`)로 **FEGate 헤더만** `'slheader'`로 분기 → 일반 C 헤더 불변.
- **D4 — ABI**: `tree-sitter generate` 기본 ABI 15(= web-tree-sitter 0.25.3 호환). 로드 실패 시 `--abi 14` 재생성.

## Non-Goals (스코프 제외)

- `.h` 풀 tree-sitter 문법 (스텁만).
- 식 충실도·로컬 변수 data-flow 추적 (노드 폭발).
- `.py` 미러 생성기 / Option B 스텁 (별건).
- readmap 폐기 (다운스트림 문서 결정).
- FEGate 프레임워크 resolution/route 엣지, SL용 dynamic-dispatch synthesizer (1차 제외).
- 버전 bump·릴리스 (House rule: Claude는 버전 안 올림).

## 영향 범위 (codegraph 확인필)

신규 파일 3 + 벤더 wasm 1 + 배선 편집 4파일 + 테스트/문서. **기존 언어 회귀 위험 지점 = `detectLanguage`의 `.h` 분기**(D3 게이트로 격리). `cppExtractor`는 **재사용만**(미수정). 노드 폭발 위험 = 문법 깊이(D2로 통제).

---

## 구현 단계 (numbered, ≤10, Scope-Lock)

> 참조 표기는 codegraph 표준 `file:line` (범용 배포물이므로 raonx BLK 스페이셜 매핑/RULE-4 미적용).

### STEP 1 — 문법 프로젝트 스캐폴드 + 최소 grammar.js 스파이크
- **Symbol**: `grammar` (tree-sitter DSL)
- **CodeGraph**: N/A (신규 외부 프로젝트)
- **File**: `grammars/tree-sitter-sl/grammar.js` (+ `package.json`) — 신규
- **Scope**: 신규
- **Action**: create — `tree-sitter init`; `tree-sitter-c` grammar.js 베이스로 D1 변형(포인터/typedef 등 제거, `ref`/`foreach_db`/컨테이너/`::`/키워드 추가). `tree-sitter generate`.
- **Success**: `tree-sitter generate` 무에러; `fegate_api_exam\base\string\*.sl`·`base\container\array\*.sl` 5~10개 `tree-sitter parse` 시 **ERROR 트리 0**.

### STEP 2 — corpus 테스트 + 문법 반복 수렴
- **File**: `grammars/tree-sitter-sl/test/corpus/*.txt` — 신규
- **Action**: create — function/struct/enum/`foreach_db`/`a::b()` 호출/`ref` 파라미터/`int x[]`(array)/`string t[][]`(matrix)/`#include` 각 케이스 작성. 소형(`fegate_api_exam`)→중·대형(`D:\Fork\ffs_utility\SL_Source`, `D:\Fork\raonx_ffs\m_WeldingLengthMeasurement`) 실파일로 반복 교정.
- **Success**: `tree-sitter test` green; 네이티브 `.sl` 표본에서 ERROR 트리율 < 2%.

### STEP 3 — wasm 빌드 + 벤더 + 런타임 로드 검증
- **File**: `src/extraction/wasm/tree-sitter-sl.wasm` — 신규(벤더)
- **CodeGraph**: `loadGrammarsForLanguages` (grammars.ts:159) 벤더 경로 소비
- **Action**: create — `tree-sitter build --wasm -o tree-sitter-sl.wasm` (Docker emscripten) → `src\extraction\wasm\`로 복사. web-tree-sitter 1줄 로더로 ABI 확인.
- **Success**: `Language.load('.../tree-sitter-sl.wasm')` 성공 + `l.version` 출력(14/15). 실패 시 D4(`--abi 14`) 재빌드.

### STEP 4 — AST 노드타입 덤프 + slExtractor 매핑 확정
- **Symbol**: `dump-ast` (scripts/add-lang/dump-ast.mjs)
- **File**: `D:\Fork\codegraph\scripts\add-lang\dump-ast.mjs` (실행, 미수정)
- **Action**: run — 벤더 wasm 경로로 풍부한 `.sl`(welding 등) 덤프 → `name:`/`body:`/`parameters:` 필드명, 호출/`::` 노드명 확정. STEP 6 매핑 표 산출.
- **Success**: function/struct/enum/call/scoped/declaration/preproc_include 노드명·필드명이 표로 확정(미스매핑 0).

### STEP 5 — 언어 토큰 배선 (4파일, fragile)
- **Symbol**: `LANGUAGES`, `WASM_GRAMMAR_FILES`, `EXTENSION_MAP`, `detectLanguage`, `getLanguageDisplayName`, `isLanguageSupported`, `isGrammarLoaded`
- **CodeGraph**: 확인필 (types.ts / grammars.ts)
- **File / Scope / Action** (`file:line` 기준):
  - `src/types.ts:114` — `'unknown'` 앞에 `'sl', 'slheader',` insert
  - `src/extraction/grammars.ts:13` — `GrammarLanguage` Exclude에 `'slheader'` 추가 (replace)
  - `src/extraction/grammars.ts:41` — `WASM_GRAMMAR_FILES`에 `sl: 'tree-sitter-sl.wasm',` insert
  - `src/extraction/grammars.ts:46` — `EXTENSION_MAP`에 `'.sl': 'sl',` insert (`.h`는 `'c'` 유지)
  - `src/extraction/grammars.ts:182` — 벤더 wasm 분기에 `|| lang === 'sl'` replace
  - `src/extraction/grammars.ts:242-245` — `detectLanguage` `.h` 콘텐츠 분기에 FEGate 게이트(`/HELP_FUN|@decl/`)→`return 'slheader'` insert
  - `src/extraction/grammars.ts:271-291` — `isLanguageSupported`/`isGrammarLoaded`에 `slheader → true` insert
  - `src/extraction/grammars.ts:386` — `getLanguageDisplayName`에 `sl: 'FEGate SL', slheader: 'FEGate SL Header',` insert
- **Success**: `npm run build` 무에러(타입 union 충족); `detectLanguage('x.sl')==='sl'`, FEGate `.h`→`'slheader'`, 일반 C `.h`→`'c'`.

### STEP 6 — slExtractor 작성 + 레지스트리 등록
- **Symbol**: `slExtractor` (신규), 모델 `cppExtractor`
- **CodeGraph**: `LanguageExtractor` (tree-sitter-types.ts:80), `cppExtractor` (c-cpp.ts:95)
- **File**: `src/extraction/languages/sl.ts` (신규); edit `src/extraction/languages/index.ts`
- **Action**: create `sl.ts` — `functionTypes:['function_definition']`, `structTypes:['struct_specifier']`, `enumTypes:['enum_specifier']`, `enumMemberTypes:['enumerator']`, `callTypes:['call_expression']`, `importTypes:['preproc_include']`, `variableTypes:['declaration']`, `nameField:'declarator'`, `bodyField:'body'`, `paramsField:'parameters'`, `methodsAreTopLevel:true`, `resolveName`/`getReceiverType`=c-cpp `::` 헬퍼 재사용, `extractImport`=#include 훅. STEP 4 결과로 보정. index.ts EXTRACTORS(`index.ts:51`)에 `sl: slExtractor,` insert + import.
- **Success**: 빌드 통과; `dbNode::First()` 호출이 `name=First`, receiver=`dbNode`로 추출.

### STEP 7 — `.h` HELP_FUN 정규식 스텁 추출기 + 디스패치
- **Symbol**: `SlHeaderExtractor` (신규), 모델 `MyBatisExtractor`/`LiquidExtractor`
- **CodeGraph**: dispatch in tree-sitter.ts (extractFromFile, ~3100-3117)
- **File**: `src/extraction/sl-header-extractor.ts` (신규); edit `src/extraction/tree-sitter.ts`
- **Action**: create — `HELP_FUN` 블록 정규식 파싱 → function 노드(name=`@decl` 함수명, signature=`@decl`, docstring=`@brief`), `ExtractionResult` 반환. tree-sitter.ts `~:26` import + `~:3112` `else if (detectedLanguage === 'slheader') { result = new SlHeaderExtractor(filePath, source).extract(); }` insert.
- **Success**: `api_db_node.h` 인덱싱 시 함수노드 다수 생성(`@decl`당 1); 비FEGate C 헤더는 스텁 미생성.

### STEP 8 — 빌드 + verify-extraction + 노드폭발/회귀 가드
- **Symbol**: `verify-extraction` (scripts/add-lang/verify-extraction.mjs)
- **Action**: run — `npm run build`(copy-assets가 wasm 동봉); 소형 `.sl` 표본 `codegraph init -i`; `verify-extraction.mjs <repo> sl` PASS. 인덱스 전후 `select count(*) from nodes` 안정. 일반 C 프로젝트 `.h` 회귀(노드수 동일) 스폿체크.
- **Success**: verify PASS(파일/임포트 외 function/struct/call 노드 생성); 노드폭발 없음; C 헤더 회귀 0.

### STEP 9 — 추출 테스트 (vitest)
- **Symbol**: `describe('SL Extraction')`, `detectLanguage` 어서션
- **File**: `D:\Fork\codegraph\__tests__\extraction.test.ts`
- **Action**: append — Language Detection에 `.sl→sl`·FEGate `.h`→`slheader`; `SL Extraction` 블록(인라인 `.sl` 소스로 function/struct/`::`call/`foreach_db`/`ref`); `.h` 스텁 블록(HELP_FUN→function).
- **Success**: `npx vitest run __tests__/extraction.test.ts` green.

### STEP 10 — 코퍼스 + A/B 벤치 + 문서
- **File**: `.claude\skills\agent-eval\corpus.json`, `README.md`, `CHANGELOG.md`
- **Action**: corpus.json에 `"SL"` 블록(소=`fegate_api_exam`, 중·대=`ffs_utility`/`raonx_ffs`, 각 크로스파일 flow 질문) append. A/B(`run-all.sh`) — 네이티브 `.sl` flow "X가 Y에 어떻게 도달하나" with/without ≥2런. README "Supported Languages" 행 + "19+ Languages"; CHANGELOG `## [Unreleased]` → New Features 1줄.
- **Success**: flow 질문이 explore-budget 내 **~0 Read/Grep**, without보다 빠름; 문서 반영.

---

## 전체 Success Criteria (DoD)

1. `tree-sitter test` green + 네이티브 `.sl` ERROR율 <2%.
2. wasm이 web-tree-sitter 0.25.3에 로드(ABI ok).
3. `verify-extraction.mjs` PASS — `.sl`에서 function/struct/call 노드 생성.
4. 노드 카운트 안정(폭발 없음), `::` 호출 receiver 정확.
5. FEGate `.h`→함수 스텁; 일반 C `.h` 회귀 0.
6. `npx vitest run` green.
7. A/B: 네이티브 `.sl` flow ~0 Read/Grep, faster than without.
8. README + CHANGELOG([Unreleased]) 갱신.

## 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 문법 저작 난도(본문 풀언어) | D2 최소문법 + D1 tree-sitter-c 베이스(검증된 C 노드 재사용) |
| ABI 비호환 | D4 `--abi 14` 폴백 + STEP 3 로드검증 게이트 |
| `.h` C 회귀 | D3 콘텐츠 게이트(`HELP_FUN`)로 FEGate만 분기, STEP 8 스폿체크 |
| 노드 폭발 → 에이전트 Read 회귀 | STEP 8 count 안정 게이트 |
| Docker 경로 빌드 접근 | 툴체인 가이드 Phase 4 트러블슈팅(WSL2 마운트/File Sharing) |

## RIPER 게이트

- EXECUTE 진입 = 본 PLAN 결재 후 `/riper:execute`. 각 STEP는 `file:line` 한정 로드(RULE-5 Scope Lock), 소스 작성 전 RULE-7 승인.
- REVIEW = DoD 8항목 + quality-sentinel(중·대형 필수) + reporter.
- 컴팩션 전 `/memory:save` (RULE-8).
