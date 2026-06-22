# PLAN — Markdown Watch/Sync 자동 인덱싱 연결 (broken links 2곳)

> MODE: PLAN · BRANCH: codegraph-dlc · STARTED: 2026-06-22
> 출처: docs/contextmd/cxt1.md (BLK: 인프라)
> 탐색: codegraph_context/search/explore + 보완 Read(offset) — Cave-Man(codegraph-first) 준수

---

## 0. 사전 정찰 결과 (착수 전 반드시 읽을 것)

cxt가 지목한 2개 broken link를 codegraph로 실측 검증한 결과 + cxt 가정과의 차이:

| 항목 | cxt 가정 | 실측 결과 | 플랜 영향 |
|---|---|---|---|
| Watcher 게이트 | watcher.ts:224 `if (!isSourceFile(normalized)) return;` | **확인.** `on('all')` 핸들러 내부, `isSourceFile`(grammars.ts:112)는 `EXTENSION_MAP`(grammars.ts:46)에 `.md` 없음 → 즉시 폐기 | Layer A 유효 |
| `isMarkdownFile(p)` | 존재 가정 (Layer A에서 호출) | **부재.** codegraph_search 무결과. md 판정 정규식 `MD_EXT=/\.(md\|markdown\|mdx)$/i`은 scan-files.ts:15에 **비공개** | **신규 export 필요** (단일 진실원천 = MD_EXT 재사용) |
| sync 경로 indexMarkdown | index.ts:488 sync()에 미연결 | **확인.** sync()(index.ts:488-570)는 indexMarkdown 미호출. 템플릿 = indexAll의 docs 블록(index.ts:410-454) | Layer B 유효 |
| 증분 안전성 | content_hash 증분 | **확인.** indexer.ts:116-121 `existing.content_hash===hash → skip`. 변경분만 재임베드 | 비용 한정 OK |
| docsEnabled 게이트 위치 | watcher에서 게이트 | **FileWatcher에 DB 핸들 없음.** `resolveDocsEnabled(db)`(config.ts:82)는 SqliteDatabase 필요 | `WatchOptions.docsEnabled` 추가 + `watch()`가 해석해 주입 |
| SyncResult.docs | "indexAll 블록과 동일" | **SyncResult(extraction/index.ts:107-115)에 docs 필드 없음** | Layer B는 best-effort 호출+relink만, 타입 무변경 (스코프 최소화) |

핵심 설계 결정(검증 기반):
- **isMarkdownFile은 scan-files.ts에 신설**해 MD_EXT를 단일 진실원천으로 재사용. watcher가 import. (indexMarkdown이 실제 스캔하는 `listMarkdownFiles`와 동일 정규식 → 게이트/스캔 일관성 보장.)
- **watcher 게이트는 docs-OFF일 때 .md를 기존과 동일하게 폐기**(byte-무회귀). docs-ON일 때만 통과 → 불필요 sync 방지(cxt 결정 ①).
- **sync() 종료부 indexMarkdown은 항상 호출**(cxt 결정 ②, ~60파일 hash-compare는 저렴). 내부 `resolveDocsEnabled` 게이트로 docs-OFF면 즉시 no-op.

---

## 1. Success Criteria (전체)

- docs-ON 프로젝트에서 watcher 가동 중 `docs/**/*.md` 편집 → 디바운스 후 sync()가 indexMarkdown 실행 → mdast_metadata/concept 노드 갱신.
- docs-OFF 프로젝트: watcher가 .md 이벤트를 기존과 동일하게 폐기(불필요 sync 0), sync()의 indexMarkdown은 no-op. **`.ts` 자동 인덱싱 경로 byte-무회귀.**
- **노드 무폭증**: concept 노드는 indexMarkdown의 GOVERNED_DIRS(cxt/, docs/contextmd/, manage/) 로직 그대로 — 로직 미변경이므로 폭증 불가.
- `npm run build` + `npm test` green. 기존 watcher.test.ts:148(`src/readme.md` 폐기) 무회귀 + docs-ON 통과 신규 테스트 green.

## 2. Non-Goals (스코프 제외)

- SyncResult에 `docs` 필드 추가 안 함 (watcher 표시용 filesChanged가 .md를 세지 않는 cosmetic 미집계는 허용 — 정확성 무관).
- docs opt-in을 watch() 가동 *이후* 동적으로 재해석 안 함 — `respectGitignore`와 동일하게 watch() 시점 1회 고정(재활성화 시 re-watch). DB 핸들 무주입 단순성 우선.
- indexMarkdown 내부 로직(임베딩/게이트/GOVERNED_DIRS) 변경 안 함. 새 노드/엣지 종류 추가 안 함.
- transformers 미설치 e2e 실측은 보류(유닛은 chokidar mock으로 deps 불요).

---

## 3. 단계별 실행 (Plan Scope Lock · Max 10 steps)

### Step 1 — `isMarkdownFile` export (단일 진실원천)
- **Symbol**: `isMarkdownFile` (신규)
- **CodeGraph**: scan-files.ts:15 `MD_EXT`, listMarkdownFiles=scan-files.ts:21
- **File**: `src/docs/scan-files.ts`
- **Scope**: Lines [15-18] 직후 insert
- **BLK target**: [인프라]
- **Action**: insert — `export function isMarkdownFile(filePath: string): boolean { return MD_EXT.test(filePath); }` + JSDoc
- **Success criterion**: `isMarkdownFile('a/b.md')===true`, `isMarkdownFile('x.ts')===false`

### Step 2 — `WatchOptions.docsEnabled` 추가
- **Symbol**: `WatchOptions` (interface)
- **CodeGraph**: watcher.ts:29-54
- **File**: `src/sync/watcher.ts`
- **Scope**: Lines [53] 직후(respectGitignore 다음) insert
- **BLK target**: [인프라]
- **Action**: insert — `docsEnabled?: boolean;` + 주석(“docs opt-in; .md를 watch 대상에 포함, 기본 false=기존 동작”)
- **Success criterion**: tsc 컴파일 통과

### Step 3 — FileWatcher 필드 + 게이트 확장
- **Symbol**: `FileWatcher` (constructor + `on('all')` 핸들러)
- **CodeGraph**: 필드부 142-159, 게이트 watcher.ts:224
- **File**: `src/sync/watcher.ts`
- **Scope**: constructor 영역 [147-159]에 `private readonly docsEnabled: boolean` + `this.docsEnabled = options.docsEnabled ?? false;`; 게이트 Lines [224]
- **BLK target**: [인프라]
- **Action**: replace 게이트를 → `const markdownFile = this.docsEnabled && isMarkdownFile(normalized); if (!isSourceFile(normalized) && !markdownFile) return;` + `import { isMarkdownFile } from '../docs/scan-files';`
- **Success criterion**: docsEnabled=false → .md 폐기(기존), true → .md 통과

### Step 4 — `watch()`가 docsEnabled 해석·주입
- **Symbol**: `CodeGraph.watch`
- **CodeGraph**: watch=index.ts:592, import 영역 27-29, resolveDocsEnabled=config.ts:82
- **File**: `src/index.ts`
- **Scope**: import 1줄 추가(`import { resolveDocsEnabled } from './docs/config';`) + watch() 본문 [592-611]
- **BLK target**: [인프라]
- **Action**: insert — `const docsEnabled = resolveDocsEnabled(this.db.getDb());` → FileWatcher 3번째 인자를 `{ ...options, docsEnabled }`로 변경 + 주석(watch 시점 1회 해석 근거)
- **Success criterion**: docs-ON DB에서 watch() → 생성된 FileWatcher가 .md 통과

### Step 5 — sync() 종료부 indexMarkdown (Layer B)
- **Symbol**: `CodeGraph.sync`
- **CodeGraph**: sync=index.ts:488, runMaintenance 블록 561-563, return 565, 템플릿 indexAll docs블록 410-454
- **File**: `src/index.ts`
- **Scope**: Lines [563] 직후 ~ [565] `return result` 직전 insert (fileLock try 블록 내부)
- **BLK target**: [인프라]
- **Action**: insert — best-effort `indexMarkdown(this.db.getDb(), this.projectRoot, { respectGitignore: options.respectGitignore })`; `if (docs.enabled && docs.indexed > 0)`일 때만 `linkGovernsEdges`+`linkDocEdges` 재연결(각각 try/catch). 전체 try/catch로 감싸 sync 무실패
- **Success criterion**: docs-ON .md 편집 후 sync → indexMarkdown 실행 + 변경 시 relink; docs-OFF → no-op(내부 게이트)

### Step 6 — 테스트 (게이트 + isMarkdownFile)
- **Symbol**: watcher.test.ts ‘markdown gating’ describe, isMarkdownFile 유닛
- **CodeGraph**: 기존 패턴 watcher.test.ts:148-165(triggerFileEvent + syncFn 단언)
- **File**: `__tests__/watcher.test.ts` (+ isMarkdownFile 유닛은 동일 파일 또는 scan-files 단위)
- **Scope**: `describe('markdown gating')` 신규 블록
- **BLK target**: [인프라]
- **Action**: add — ① `{docsEnabled:true}` + `triggerFileEvent('add','docs/a.md')` → `syncFn` 호출됨 ② `{docsEnabled:false}` + 동일 → 미호출 ③ isMarkdownFile 진리표. 기존 :148 테스트 유지
- **Success criterion**: 신규 green + 기존 watcher 테스트 전부 green

### Step 7 — 빌드·테스트·회귀 검증 (Layer C)
- **File**: (실행) `npm run build` → `npm test`
- **BLK target**: [인프라]
- **Action**: build(copy-assets 포함) → 전체 test. `.ts` 경로 무회귀(게이트 source 분기 불변)·노드 무폭증(GOVERNED_DIRS 로직 불변) 논증. Windows 기존 known-fail(mcp-initialize/roots, security symlink)은 origin/main 대조로 분리
- **Success criterion**: build OK, 신규/기존 테스트 green, known-fail 외 회귀 0

### Step 8 — CHANGELOG [Unreleased]
- **File**: `CHANGELOG.md`
- **Scope**: `## [Unreleased]` → `### Fixes`
- **BLK target**: [인프라] (문서)
- **Action**: add — 사용자향 1줄(“With docs indexing enabled, Markdown files now re-index automatically while the file watcher is running / on sync, not only on a full re-index.”) — 내부 경로/심볼/수치 배제
- **Success criterion**: [Unreleased]에 친화적 1줄 존재

---

## 4. 게이트
- 규모: 중형(멀티파일 5 + 테스트 + 행동변경) → quality-sentinel **필수**, reporter **필수** (RULE-6).
- RULE-7: .ts 쓰기 전 사용자 승인 = 본 PLAN 승인으로 충족.
