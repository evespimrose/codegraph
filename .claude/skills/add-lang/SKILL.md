---
name: add-lang
description: Add tree-sitter language support to codegraph end-to-end (wire + test + benchmark). Use when the user runs /add-lang <language> or asks to add/support a new language (e.g. Lua, Elixir, Zig, OCaml) in codegraph. Do NOT use outside the codegraph repo, or for already-supported languages — to only benchmark, use /agent-eval.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# Add a language to CodeGraph

새 tree-sitter 언어를 codegraph 추출 파이프라인에 배선하고, 인기 repo에서 실제 심볼 추출 + no-codegraph 대비 우위를 증명한다. **완전 자율**(repo 선택·벤치·문서). **commit/push/publish/tag 금지**(house rule) — 변경은 사용자 리뷰로 남긴다. 인자 = `Language` union의 소문자 단일 토큰(`lua`·`elixir`·`zig`; `csharp` not `c#`); 없으면 어떤 언어인지 묻는다.

## Prerequisites
- codegraph repo 루트에서 실행. `node`·`git`·`gh`·로그인된 `claude` CLI(벤치가 실제 `claude -p` 실행). 벤치는 로컬 dev 빌드 사용 — Step 8이 빌드+PATH 링크.

## Workflow — 체크리스트 복사해 순서대로
```
- [ ] 1. 언어 확정; 이미 지원되면 early-out (벤치만)
- [ ] 2. grammar 확보 + health-check (ABI / heap corruption)
- [ ] 3. AST node type 발견 (dump-ast.mjs)
- [ ] 4. 언어 배선 (4 files; 가끔 5th core touch)
- [ ] 5. build + verify-extraction 루프 until PASS
- [ ] 6. extraction 테스트 추가; green
- [ ] 7. size tier별 인기 repo 3개 자동 선택; corpus.json
- [ ] 8. 3개 벤치: extraction + with/without A/B
- [ ] 9. README + CHANGELOG
- [ ] 10. 보고; commit 금지
```

### Step 1 — Resolve + short-circuit
`LANGUAGES` const(`src/types.ts`) + `EXTRACTORS` map(`src/extraction/languages/index.ts`)에서 토큰 확인. 이미 지원(예 `typescript`·`rust`)이면 **Steps 2–6 skip** → 벤치(7–8) 직행, 보고서에 "코드 무변경" 명시.

### Step 2 — grammar 확보 + health-check
```bash
ls node_modules/tree-sitter-wasms/out/ | grep -i <lang>   # csharp -> c_sharp
```
**있으면** off-the-shelf(`grammars.ts`가 `tree-sitter-wasms`에서 자동 resolve). **없으면** `.wasm`을 `src/extraction/wasm/`에 vendor(예 pascal/scala/lua) + Step 4 vendored 분기에 토큰 추가.

**추출기 작성 전 항상 health-check** — *있는* grammar도 못 쓸 수 있다(낡은 ABI가 shared WASM heap 손상 → 첫 파일 이후 nested call/import 조용히 누락; tree-sitter-wasms **Lua**=ABI 13 실패):
```bash
node scripts/add-lang/check-grammar.mjs <lang> path/to/valid-sample.<ext>
```
FAIL(valid 코드에 ERROR tree)이면 그 wasm 버리고 **newer ABI(14/15) vendor**:
```bash
npm pack @tree-sitter-grammars/tree-sitter-<lang>   # prebuilt *.wasm 동봉 흔함
cp <the>.wasm src/extraction/wasm/tree-sitter-<lang>.wasm
```
vendored 경로로 re-check until PASS. **healthy wasm 못 구하면 STOP + 사용자 보고.**

### Step 3 — AST node type 발견
대표 소스(함수·클래스·import·enum 포함 샘플 작성 또는 raw `curl`) 준비 후:
```bash
node scripts/add-lang/dump-ast.mjs <lang> path/to/sample.<ext>   # vendored: 토큰 대신 wasm 경로
```
빈도표 + field명(`name:`·`parameters:`·`body:`·`return_type:`)으로 매핑 결정. 패러다임 가까운 기존 추출기 모델: `rust.ts`/`scala.ts`(functional)·`java.ts`/`csharp.ts`(OO)·`python.ts`/`ruby.ts`(scripting)·`go.ts`(receiver).

### Step 4 — 언어 배선 (4 files; 정밀·취약, 기존 스타일 정확히 모방)
1. **`src/types.ts`** (2 edits): `LANGUAGES` const에 `'<lang>',`(before `'unknown'`); `DEFAULT_CONFIG.include`에 `'**/*.<ext>',`. **후자 누락 시 `codegraph init`이 0 files** 찾음.
2. **`src/extraction/grammars.ts`** (3 maps): `WASM_GRAMMAR_FILES`(`<lang>: 'tree-sitter-<lang>.wasm',`)·`EXTENSION_MAP`(각 ext→`'<lang>'`)·`getLanguageDisplayName`(`<lang>: '<Display>',`); **vendored면** wasm-path 분기(`lang === 'pascal' || …`)에 `<lang>` 추가.
3. **`src/extraction/languages/<lang>.ts`** (신규): `export const <lang>Extractor: LanguageExtractor = {…}`, Step 3 매핑. 필수 필드: `functionTypes`·`classTypes`·`methodTypes`·`interfaceTypes`·`structTypes`·`enumTypes`·`typeAliasTypes`·`importTypes`·`callTypes`·`variableTypes`·`nameField`·`bodyField`·`paramsField`. 필요 hook: `getSignature`/`getVisibility`/`isExported`/`extractImport`/`visitNode`/`getReceiverType`/… (`tree-sitter-types.ts` 참조).
4. **`src/extraction/languages/index.ts`**: `import { <lang>Extractor } from './<lang>';` + `EXTRACTORS`에 `<lang>: <lang>Extractor,`.

**가끔 5th core touch — `src/extraction/tree-sitter.ts`**: `extractVariable`의 언어별 분기(generic fallback은 직접 `identifier`/`variable_declarator`만 찾음). grammar가 선언명을 nest하면(예 Lua `variable_declaration → variable_list`) `} else if (this.language === '<lang>')` 분기 추가(ts/python/go 모방). 별도 노드 아닌 import(Lua/Ruby `require`=call)는 추출기 `visitNode` hook에서 처리.

### Step 5 — build + verify 루프
```bash
npm run build            # tsc + copy-assets (vendored *.wasm → dist/)
( cd <sample-repo> && codegraph init -i )
node scripts/add-lang/verify-extraction.mjs <sample-repo> <lang>
```
언어 미감지 또는 `file`/`import` 노드만이면 FAIL(exit 1; 잘못된 node-type명 증상). FAIL/thin WARN → richer 파일로 `dump-ast` 재실행 → `<lang>.ts` 수정 → rebuild → re-index → re-verify. **PASS까지 반복.**

### Step 6 — Tests
`__tests__/extraction.test.ts`에 `Rust Extraction` 블록 모델로: `describe('Language Detection')`에 `detectLanguage` assert + `describe('<Lang> Extraction')`(inline 소스에서 함수/클래스/import 추출 assert).
```bash
npx vitest run __tests__/extraction.test.ts   # green 후 진행
```

### Step 7 — repo 3개 자동 선택 + corpus
**묻지 말고** `<lang>`-dominant 3개를 size tier별 1개씩:
```bash
gh search repos --language=<lang> --sort=stars --limit 40 --json fullName,stargazerCount,description
```
Tier(`corpus.json` 기준): **Small** <~150 files · **Medium** ~150–1500 · **Large** >~1500. tag만 `<lang>`이고 실제 다른 언어면 skip. repo당 cross-file 아키텍처 **질문** 1개. `.claude/skills/agent-eval/corpus.json`에 `"<Language>"` 블록 추가(fields: `name`·`repo`·`size`·`files`·`question`).

### Step 8 — 3개 벤치 (extraction + A/B)
dev 빌드를 PATH codegraph로 **한 번** 만든 뒤 loop:
```bash
npm run build && ./scripts/local-install.sh
scripts/add-lang/bench.sh <lang> <name> <url> "<question>" headless   # ×3
```
`bench.sh`: clone(공유 `/tmp/codegraph-corpus`)→wipe+index→`verify-extraction.mjs`→with/without A/B(`scripts/agent-eval/run-all.sh`; extraction 깨지면 유료 A/B skip). 각 `parse-run.mjs` 요약 읽기 — tool calls·file Reads·Grep/Bash·codegraph-tool calls·duration·**cost**(with/without 양쪽). loop 후 필요 시 `./scripts/local-install.sh`로 dev 링크 복구.

### Step 9 — Docs + CHANGELOG
- **README.md**: "19+ Languages" bullet에 `<Lang>` + Supported Languages 표에 `| <Lang> | \`.ext\` | Full support… |` 행.
- **CHANGELOG.md**: 최상단(최신 버전 위) `## [Unreleased]` → `### Added` 사용자 관점 bullet(예 *"CodeGraph now indexes **<Lang>**…"*); 이미 있으면 append.

### Step 10 — 보고 (commit 금지)
리뷰 요약: **Files changed**(4 wiring + 신규 추출기 + tests + README + CHANGELOG + corpus.json + vendored `.wasm`) · **Extraction** per repo(files/nodes/edges/verify) · **A/B** per repo(with vs without: tool calls·Reads·cost + 1줄 verdict) · **Gaps/follow-ups**. 변경은 사용자에게 넘김. **`git commit`/`push`/publish 금지** — 릴리스는 GitHub Actions Release workflow.

## Notes
- A/B는 실제 **유료** `claude -p`(opus, `--max-budget-usd`), 2 arms × 3 repos. `/tmp/codegraph-corpus`는 `/agent-eval`과 공유(clone 재사용).
- 새 `*.wasm`은 `src/extraction/wasm/`에 — `copy-assets`(npm run build)가 `dist/`로 ship.
- index는 빌드한 **동일** 바이너리가 serve(Step 8이 dev 빌드 먼저 링크).
- grammar 못 구하거나 extraction PASS 불가 → **STOP + 보고**, 반쪽 언어 ship 금지.

## 사용하지 말아야 할 때 (Negative Constraints)

- codegraph repo 루트가 아닌 곳 — 추출 파이프라인 배선 전용.
- 이미 지원되는 언어를 *측정*만 하려는 경우 — `/agent-eval` 사용.
- 일반 앱/게임 코드 작업 — 본 스킬은 codegraph 내부 개발 전용.
- commit/push/publish — house rule, 사용자에게 위임.
