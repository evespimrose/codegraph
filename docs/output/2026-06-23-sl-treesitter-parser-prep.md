# SL tree-sitter parser — 구현 준비 (Option C)

> 작성일: 2026-06-23 · 브랜치: `codegraph_sl_treesitter_parser`
> 근거: [Try_SLGrammarParser_Readmap.md](../../../raonx-ai-workflow/docs/Try_SLGrammarParser_Readmap.md) **C방안** =
> **`.sl` 네이티브 tree-sitter 문법 + `.h`는 스텁(정규식) 추출** (풀 `.h` 문법은 과잉 → 제외)
> 문법 근거 3종(사용자 지정): `fegate-sl-grammar.md` · `FFS_API_Technical_Specifications.md` · `FFS_API_Guide.md`
> **상태: 준비/설계만. 소스 미수정 (RULE-7 승인 게이트 · readmap §6 producer 결재 대기).**

---

## 0. 핵심 결론 (먼저)

- **Option C의 정합적 최적 형태 = `.sl` 문법(call graph 원천) + `.h` 정규식 스텁**. 코드그래프 배선은 기존 `add-lang` 4-파일 패턴 그대로. **단 하나의 비자명 신규 작업 = tree-sitter SL 문법을 *처음부터 저작*** (npm·`tree-sitter-wasms`에 SL 문법 없음 — 확인됨).
- **하드 블로커 1개**: SL 문법 wasm을 빌드할 **외부 툴체인**(`tree-sitter-cli` + emscripten/Docker)이 이 저장소에 없음. `web-tree-sitter`(런타임)만 있고 저작 CLI는 없음. → 빌드 환경 결정 필요(아래 §6 Q).
- **샘플 코퍼스 로컬 확보 완료**: 헤더 38개 + `.sl` 예제 수백 개 + 네이티브 `.sl` 프로젝트 3곳(아래 §5).
- **파일 스캔 배선 1곳 단순화**: 구버전 `add-lang` 문서의 "`DEFAULT_CONFIG.include` 글롭 추가" 스텝은 **이 코드베이스엔 불필요** — 스캔 대상은 `EXTENSION_MAP`에서 파생(`isSourceFile`, [grammars.ts:112](../../src/extraction/grammars.ts)). `EXTENSION_MAP`에 `.sl`만 넣으면 됨.

---

## 1. As-Is — 코드그래프 추출 파이프라인 배선 지점 (확인됨)

| 배선 | 위치 | SL 추가 내용 |
|---|---|---|
| 언어 union | [src/types.ts:85-115](../../src/types.ts) `LANGUAGES` | `'sl'`, `'slheader'`를 `'unknown'` 앞에 추가 |
| wasm 파일맵 | [grammars.ts:19-41](../../src/extraction/grammars.ts) `WASM_GRAMMAR_FILES` | `sl: 'tree-sitter-sl.wasm'` |
| 확장자맵 | [grammars.ts:46](../../src/extraction/grammars.ts) `EXTENSION_MAP` | `'.sl': 'sl'` (`.h`는 §3 콘텐츠 판별로 분기) |
| 벤더 wasm 경로분기 | [grammars.ts:182](../../src/extraction/grammars.ts) | `\|\| lang === 'sl'` (lua/luau/pascal/scala처럼 `src/extraction/wasm/`에서 로드) |
| GrammarLanguage 제외셋 | [grammars.ts:13](../../src/extraction/grammars.ts) | `'slheader'`를 Exclude에 추가(문법 없는 커스텀 추출기 — liquid/xml과 동일 취급). `'sl'`은 문법언어라 제외 안 함 |
| 표시명 | [grammars.ts:355-387](../../src/extraction/grammars.ts) `getLanguageDisplayName` | `sl: 'FEGate SL'`, `slheader: 'FEGate SL Header'` |
| 커스텀언어 지원판정 | [grammars.ts:271-304](../../src/extraction/grammars.ts) `isLanguageSupported`/`isGrammarLoaded` | `slheader`를 xml처럼 `return true` 등록 |
| 추출기 레지스트리 | [src/extraction/languages/index.ts:30-52](../../src/extraction/languages/index.ts) `EXTRACTORS` | `sl: slExtractor` |
| 스탠드얼론 추출기 디스패치 | [tree-sitter.ts:3100-3117](../../src/extraction/tree-sitter.ts) | `else if (detectedLanguage === 'slheader')` 분기 → `SlHeaderExtractor` (svelte/vue/liquid/xml과 같은 패턴) |
| 에셋 복사 | [package.json:18](../../package.json) `copy-assets` | **수정 불필요** — `src/extraction/wasm/*.wasm` 자동 복사. 벤더 wasm 자동 동봉 |

**모델 추출기**: SL은 C-like이므로 [c-cpp.ts](../../src/extraction/languages/c-cpp.ts) `cppExtractor`가 1차 모델. 특히 `::` 처리(`extractCppQualifiedMethodName`/`extractCppReceiverType`, `qualified_identifier` 분해)는 `dbNode::First()` 형태에 **그대로 재사용 가능**.
**스텁 추출기 모델**: [mybatis-extractor.ts](../../src/extraction/mybatis-extractor.ts) / [liquid-extractor.ts](../../src/extraction/liquid-extractor.ts) (정규식 기반, `ExtractionResult` 반환, tree-sitter 미사용).

---

## 2. To-Be(가) — `.sl` 네이티브 tree-sitter 문법 (신규 저작 · 본 과제의 핵심 난도)

### 2-1. 문법 범위 — 3종 문서에서 도출한 SL 언어 표면

C와 거의 동일(식별자/스코프/재귀/주석 `//`·`/* */`/리터럴/연산자 전체/제어문 `for while do-while if else switch case continue break return`). C와의 차이 = **문법에 반드시 반영할 SL 고유 토큰**:

| SL 고유 | 문법 처리 |
|---|---|
| 포인터/캐스팅/`->` **없음** | 해당 규칙 **미포함** (파스 에러로 떨굴 필요 없음 — 애초에 안 만듦) |
| 추가 키워드 `bool string set map vec3 ref foreach_db` | 키워드 + 타입/스토리지 규칙 |
| 미지원 키워드 `goto typedef const unsigned auto register static extern sizeof union` | 미포함 |
| `ref` 파라미터 | `parameter`에 `ref` 수식자 |
| 컨테이너 `array(1D) matrix(2D) set map` + `vec3` | 타입 규칙; `int x[]`=array, `string t[][]`=matrix (서로 다른 타입) |
| `::` 네임스페이스 멤버 접근 (`dbNode::First()`) | `scoped_identifier`/`qualified_identifier` (C++ 차용) |
| `foreach_db` 반복문 | 전용 statement 규칙 |
| 전처리기 **`#include`만** | `preproc_include`만; 그 외 전처리 미포함 |
| `struct` / 익명 `enum` | `struct_specifier` / `enum_specifier` |
| GC (수동 메모리 없음) | 영향 없음 |

### 2-2. 1차 문법 깊이 — **권장: "call-graph 완전" 최소 문법** (풀 식 충실도 아님)

Option C의 **유일 고유가치 = 네이티브 `.sl` call graph/impact/trace** ([readmap §5-1](../../../raonx-ai-workflow/docs/Try_SLGrammarParser_Readmap.md)). 이를 위해 **반드시 정확해야** 하는 것: 함수 정의, 호출식(특히 `a::b()` 한정 호출), struct/enum, `ref`/컨테이너 파라미터 시그니처, `#include`, `foreach_db` 바디 진입. **불완전해도 되는 것**: 식 우선순위·모든 리터럴 형태·세밀한 타입 문법(노드 폭발만 유발, call graph엔 무가치).
→ **1차는 선언+호출 골격 우선, 식·문은 `_expression`/`_statement`를 관대하게**. (add-lang playbook의 "node 폭발 금지"와 정합.)

### 2-3. slExtractor 필드 매핑 초안 (cppExtractor 기반)

```
functionTypes: ['function_definition']
methodTypes:   ['function_definition']     // Name::Func 정의는 receiver 부여(아래)
structTypes:   ['struct_specifier']
enumTypes:     ['enum_specifier']  enumMemberTypes: ['enumerator']
callTypes:     ['call_expression']
importTypes:   ['preproc_include']
variableTypes: ['declaration']
nameField:'declarator'  bodyField:'body'  paramsField:'parameters'
resolveName / getReceiverType: c-cpp.ts의 qualified_identifier 분해 재사용 → dbNode::First ⇒ name=First, receiver=dbNode
extractImport: c-cpp.ts #include 훅 재사용
methodsAreTopLevel: true   // SL 함수는 최상위; foreach_db/네임스페이스는 클래스 아님
```
(`LanguageExtractor` 전체 훅 표면: [tree-sitter-types.ts:80-227](../../src/extraction/tree-sitter-types.ts).)

### 2-4. 문법 프로젝트 산출물 / 툴체인

- 신규 디렉터리(권장) `grammars/tree-sitter-sl/` : `grammar.js`, `package.json`, `test/corpus/`, `queries/`.
- 빌드: `tree-sitter generate` → C 파서 → `tree-sitter build --wasm` (**emscripten/Docker 필요**) → `tree-sitter-sl.wasm`.
- 벤더: 산출 wasm을 [src/extraction/wasm/](../../src/extraction/wasm/)에 복사(=lua/scala 패턴) → `copy-assets`가 자동 동봉.
- 헬스체크: `node scripts/add-lang/check-grammar.mjs` (ABI 14/15 확인 — 13이면 힙 오염), `dump-ast.mjs`로 노드타입 확정 후 §2-3 매핑 교정.

---

## 3. To-Be(나) — `.h` 헤더 스텁 추출기 (정규식 · 풀 문법 아님)

readmap §2-A/§5-1: `.h`의 `HELP_FUN`은 `@decl/@brief/@in/@return`로 **이미 구조화**, `ref type ary[][]`의 `type`은 **문서용 제네릭 placeholder**(실 SL 아님). → 풀 문법은 무가치. **정규식 추출기**가 정합.

- 신규 `src/extraction/sl-header-extractor.ts` — `HELP_FUN` 블록을 파싱해 함수 노드(name=`@decl`의 함수명, signature=`@decl`, docstring=`@brief`) 생성. mybatis/liquid 패턴.
- **`.h` 충돌 회피**: `.h`는 이미 `EXTENSION_MAP`에서 `'c'`. → [detectLanguage grammars.ts:234-248](../../src/extraction/grammars.ts)의 `.h` 콘텐츠 판별(현재 cpp/objc 휴리스틱 자리)에 **FEGate 헤더 판별**(`/HELP_FUN|@decl/` 존재) 추가 → `'slheader'` 반환. 일반 C/C++ `.h`는 영향 없음.
- 디스패치: [tree-sitter.ts:3112](../../src/extraction/tree-sitter.ts) 부근 `else if (detectedLanguage === 'slheader') { ... new SlHeaderExtractor(...).extract() }`.

---

## 4. 영향 / 회귀 가드

- **노드 폭발 금지**: 재인덱스 전후 `select count(*) from nodes` 안정. 1차 문법이 과도하게 세밀하면 위험 → §2-2 최소문법 원칙.
- **`.h` 회귀**: FEGate 헤더 판별은 콘텐츠 게이트(`HELP_FUN|@decl`)라 일반 C 헤더 불변. 가드 테스트 필요.
- **벤더 wasm ABI**: 13이면 멀티문법 런타임 힙 오염(lua 전례). 빌드시 ABI 14/15 강제.
- **크로스플랫폼**: wasm은 OS 불문 동작(web-tree-sitter). 빌드만 1회 어디서든.

---

## 5. 샘플 코퍼스 (로컬 확보 — 문법개발·테스트·벤치)

| 티어 | 경로 | 용도 |
|---|---|---|
| 헤더(38) | `D:\Fork\raonx-ai-workflow\fegate_api\*.h` (`structs.h`, `api_db_*`, `api_ui_*`, `defines.h`) | 스텁 추출기 + 구조체 |
| 소형 `.sl`(수백) | `D:\Fork\raonx-ai-workflow\fegate_api_exam\**\*.sl` (base/bit·container·convert·file·string, trans/office) | 단일함수 — 문법 단위 검증 |
| 네이티브 `.sl`(중·대) | `D:\Fork\ffs_utility\SL_Source\`, `D:\Fork\raonx_ffs\` (예: `m_WeldingLengthMeasurement`), `D:\Fork\FEGate-for-ship-study\` | 실 프로젝트 로직(`foreach_db`·`::`·struct·선급룰) — call graph 실증 |

→ `add-lang` Step 7 코퍼스(`.claude/skills/agent-eval/corpus.json`)에 SL 블록(소/중/대 3개 + 크로스파일 flow 질문) 추가.

---

## 6. 단계 계획 (RIPER-정합) + 결재 필요 지점

| # | 단계 | 산출 | 게이트 |
|---|---|---|---|
| 0 | **(현재)** 준비/설계 | 본 문서 | — |
| 1 | **문법 스파이크** | `grammar.js` 최소판 + 소형 `.sl` 다수 파스 + ABI 확인 | 난도 실측(readmap §6 미결) |
| 2 | 문법 완성 + wasm 빌드/벤더 | `tree-sitter-sl.wasm` → `src/extraction/wasm/` | check-grammar PASS |
| 3 | 코드그래프 배선(§1) + `slExtractor`(§2-3) | 4-파일 + 신규 extractor | `verify-extraction` PASS, 노드수 안정 |
| 4 | `.h` 스텁 추출기(§3) + `.h` 회귀 가드 | `sl-header-extractor.ts` + 디스패치 | 일반 C헤더 불변 |
| 5 | 테스트(`__tests__/extraction.test.ts`) | detectLanguage + SL 추출 블록 | `vitest` green |
| 6 | 코퍼스 + A/B 벤치(§5) | corpus.json + with/without | flow ~0 Read, faster |
| 7 | 문서(README/CHANGELOG) | Supported Languages 행 추가 | — |

**RULE-7/readmap §6 승인 게이트**: 1단계(소스 신규 작성) 착수 전 사용자 결재. 본 과제는 중·대형 → RIPER(`/riper:research|plan`) 적용 대상.

### 결재 필요 결정 (코드 착수 전)
1. **wasm 빌드 툴체인**: 이 환경에 Docker/WSL/emscripten 가용? (tree-sitter-cli 빌드 경로 확정 필요 — 유일 하드 블로커)
2. **1차 문법 깊이**: §2-2 "call-graph 완전 최소문법"으로 시작 권장(vs 풀 식 충실도).
3. **진행 범위**: 본 준비문서까지(중단) / RIPER PLAN 파일 생성 / 1단계 문법 스파이크 착수 — 어디까지?
