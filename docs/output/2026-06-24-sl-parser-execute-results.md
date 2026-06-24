# SL tree-sitter 파서 구현 — EXECUTE 결과 (Option C)

> 2026-06-24 · branch `codegraph_sl_treesitter_parser` · [PLAN](../../.claude/memory-bank/codegraph_sl_treesitter_parser/plans/codegraph_sl_treesitter_parser-2026-06-24-sl-treesitter-parser.md)
> 상태: 구현 완료 + 결정적 검증 통과. 잔여 = 유료 A/B 에이전트 벤치(사용자 발의 대기).

## 무엇을 했나

Option C를 그대로 구현: **`.sl` 네이티브 tree-sitter 문법을 처음부터 저작** + **`.h` HELP_FUN 정규식 스텁 추출**.

- **문법(신규 저작)**: `grammars/tree-sitter-sl/grammar.js` — tree-sitter-c 노드명 호환(`function_definition`/`struct_specifier`/`call_expression`/`preproc_include`/`qualified_identifier`) + SL 확장(`ref`·`foreach_db`·컨테이너·`::`·`namespace`·함수 프로토타입·인접 문자열·숫자 접미사). ABI 15(web-tree-sitter 0.25.3 호환). wasm 49.8KB → `src/extraction/wasm/tree-sitter-sl.wasm` 벤더.
- **slExtractor**(`src/extraction/languages/sl.ts`): cppExtractor 미러 + `::` name/receiver 헬퍼.
- **코어 `::` 콜 분기**(`tree-sitter.ts` extractCall): `qualified_identifier` 콜리를 full `dbNode::First`로 보존 → resolver의 `getNodesByQualifiedName` 정확 매칭.
- **`.h` 스텁 추출기**(`src/extraction/sl-header-extractor.ts`): HELP_FUN `@decl`→함수노드(name `First`, qualifiedName `dbNode::First`, docstring `@brief`). `detectLanguage` 콘텐츠 게이트(`HELP_FUN|@decl`)로 FEGate 헤더만 `slheader` 분기.

## 결정적 검증 (D:\Fork\codegraph\SL — 773 파일)

| 지표 | 값 |
|---|---|
| 문법 코퍼스 파싱 | **97.4%** (528/542); 잔여 14건 전부 malformed(문서표·오타·하드랩 문자열) → 유효 SL ~100% |
| `.sl` 심볼 | function **1,264** · enum 26 · struct 15 |
| `.h` API 스텁 | **1,678 함수** (35 헤더) — readmap "1,664-fn 카탈로그" 재현 |
| 호출 엣지 | calls **12,746** 중 헤더스텁행 **8,135** (네이티브 `.sl`→API **6,355**) |
| `::` 해석 | namespace 스텁행 **2,544** (예: `xlTool::SetValue`×105, `dbElem::Type`×98, `dbNode::Label`×63) |
| 노드 폭발 | **없음** — 재인덱스 전후 4,591 = 4,591 |
| `.h` C 회귀 | **0** — 일반 C 헤더(`structs.h`/`defines.h`) 여전히 `c`(129노드) |
| trace 실증 | `dbNode::First` 콜러 = `FindNode`/`main` (DB_Query_Node_01.sl 등) |

## 테스트 (vitest)

- 신규 SL 테스트 4/4 통과: `.sl`→`sl` 감지, FEGate `.h`→`slheader`, 일반 `.h`→`c`, SL 추출(함수/구조체/`::` 콜), HELP_FUN 스텁.
- **회귀 0** (assertion 실패 0). 잔존 vitest 워커 OOM("Fatal OOM: Zone")은 **사전존재** — 내 변경 stash 후 원본 suite도 동일 크래시(입증). 환경적 이슈.

## 변경 파일

신규: `grammars/tree-sitter-sl/{grammar.js,package.json,tree-sitter.json,src/*,tree-sitter-sl.wasm}` · `src/extraction/wasm/tree-sitter-sl.wasm` · `src/extraction/languages/sl.ts` · `src/extraction/sl-header-extractor.ts`
편집: `src/types.ts`(LANGUAGES) · `src/extraction/grammars.ts`(8곳) · `src/extraction/languages/index.ts` · `src/extraction/tree-sitter.ts`(`::`콜 분기 + slheader 디스패치) · `__tests__/extraction.test.ts` · `README.md`(언어목록+표) · `CHANGELOG.md`([Unreleased]) · `.claude/skills/agent-eval/corpus.json`(SL 블록)

## 잔여 / 후속

- **유료 A/B 에이전트 벤치(STEP 10 일부)**: with/without codegraph로 네이티브 `.sl` flow 질문 측정. `claude -p` 유료 실행 + bash 하니스라 **사용자 발의 시 실행**. 결정적 지표는 이미 가치 입증.
- 게이트: quality-sentinel(중·대형 필수) · reporter(work.md). `/memory:save` 권장(RULE-8).
- 향후(비범위): `namespace` 노드화(현재 함수는 추출되나 네임스페이스 스코프 노드 미생성), FEGate 프레임워크 resolution, SL용 dynamic-dispatch.
