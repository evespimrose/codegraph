# 플랜: 질의 속도 묶음 1 — R4 바이너리 확장자, R3 realpath 순서, R2 판별 재사용, K1 dominant 저장

## 목표
바뀐 것 없는 sync 가 프로젝트 파일을 열지 않게 하고 context 가 dominant 파일 집계를 매번 하지 않게 해서, 신선도 기준은 그대로 두고 CLI 한 번의 시간을 줄인다.

## 전제와 실행 규칙
- 근거 문서: `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-research.md`, `-innovate.md`(10절 묶음 1, 12절 사용자 결정), `-plan-notes.md`(묶음 1 설계 결정). 라벨(R2, R3, R4, K1)의 뜻은 innovate 문서 끝 `## 라벨` 에 있음.
- 고치는 소스는 KIT(`D:/Fork/KIT/tools/codegraph/source`)임. 이 저장소(`D:/Fork/codegraph`)는 10단계에서만 바뀜.
- 이 플랜은 리모트 세션이 썼음. 3~8단계는 이 저장소 `source/`(다이제스트가 KIT 빌드 `8e92ff564f22` 의 `sourceTreeSha256` 과 같음)의 스크래치 사본에 그대로 적용해 단계 검증, 새 시험, 회귀 시험까지 통과시켰음(Linux, Node 22.23.4). 1·2·9단계(측정)는 합성 프로젝트로만 돌려 봤고, 10단계(배포)는 돌려 보지 않았음.
- 한 단계에 변경이 여럿이면 `#### 3a` 처럼 나눔. 각 변경은 "변경 전" 원문을 찾아 "변경 후" 로 바꿈. 코드 블록은 0열에서 시작함. 블록 안 텍스트를 한 글자도 바꾸지 않고 씀. 바깥 펜스가 네 개(````)인 블록은 안에 세 개짜리 펜스를 품고 있음.
- 바꿀 부분이 한 줄의 일부이면 "변경 전" 은 그 줄 안에서 유일한 부분 문자열임.
- 단계 순서를 지킴. 2단계(기준선 측정)는 3단계보다 먼저 해야 함. 기준선은 바꾸기 전 소스로 재야 함.
- plan-notes 와 다른 점: R2 가 저장된 문서 판별을 다시 쓸 때 바이너리 확장자(R4)는 빼고 다시 판별함. 리허설에서 옛 코드로 색인한 프로젝트의 텍스트 내용 `.png` 가 새 코드의 sync 뒤에도 문서로 남는 것을 보고 고쳤음(4d, 8단계 시험 2).
- 측정 대상은 조사 문서에 이름이 있는 세 곳(`D:/Fork/Arcyn`, `D:/Fork/RX_1`, `D:/Fork/BLADE`)임. plan-notes 의 "다섯 곳" 중 나머지 두 곳은 문서에 이름이 없어 넣지 않았음.
- 모든 명령은 Git Bash 에서 돌림(10단계 제외). `node` 는 PATH 의 v24 임.
- 단계가 실패하면 고치려 하지 말고 멈춤. 상태 파일 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <한 줄 원인>` 으로 씀.

## 바뀔 파일
- `D:/Fork/.AI/context/search-eval/sync-speed.cjs`: 새 파일. 기준선과 뒤 측정, 비교
- `D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json`, `sync-speed-after.json`, `sync-speed.md`: 측정 결과(실행이 만듦)
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`: `BINARY_EXT`(R4), `OUTSIDE_ROOT`, `listTextDocumentFiles` 의 realpath 순서와 판별기 인자(R3, R2), `gitVisibleFiles` 의 무시 규칙 선거름(R3)
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.d.ts`: `OUTSIDE_ROOT`, `DocumentClassify`, `listTextDocumentFiles` 넷째 인자
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`: `createDocumentClassifier`(R2), `classifyFile` 여섯째 인자
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts`: 위 두 선언
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`, `indexer.d.ts`: `opts.classify` 를 `listTextDocumentFiles` 로 넘김
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`, `index.d.ts`: `opts.classify` 를 `classifyFile` 로 넘김
- `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js`, `queries.d.ts`: `getDominantFile` 을 저장값 읽기와 `computeDominantFile` 로 나눔, `refreshDominantFile`(K1)
- `D:/Fork/KIT/tools/codegraph/source/lib/index.js`: `sync` 가 판별기를 만들어 넘기고, `sync`·`indexAll` 끝에서 `refreshDominantFile`
- `D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs`: 새 시험 3개
- 10단계(사용자 승인 뒤): KIT 배포 zip, 전역 설치본, 이 저장소의 `source/`, `grammars/`, `artifacts/`, `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`

## 단계

### 단계 1: 측정 도구 만들기
- 파일: `D:/Fork/.AI/context/search-eval/sync-speed.cjs`
- 위치: 새 파일
- 동작: create
- 변경 전:
```
없음
```
- 변경 후:
```js
"use strict";
// 질의 속도 묶음 1 측정. 코드를 바꾸기 전(baseline)과 바꾼 뒤(after)를 같은 방법으로 잰다.
// 사용: node sync-speed.cjs baseline | node sync-speed.cjs after
// KIT 소스의 CLI 를 직접 부르므로 전역 설치본과 상관없다. 감시기는 끈다(CODEGRAPH_NO_WATCH=1).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const CLI = process.env.SYNC_SPEED_CLI || 'D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js';
const PROJECTS = (process.env.SYNC_SPEED_PROJECTS || 'D:/Fork/Arcyn;D:/Fork/RX_1;D:/Fork/BLADE').split(';').filter(Boolean);
const COMMANDS = {
    query: ['query', 'DamageHitJob', '--limit', '3'],
    context: ['context', 'inventory grid layout'],
};
const CONTEXT_PROJECT = PROJECTS[0];
const RUNS = 3;
const RESULTS = path.join(__dirname, 'results');

function run(args, root) {
    const started = process.hrtime.bigint();
    const child = spawnSync(process.execPath, [CLI, ...args, '-p', root], {
        encoding: 'utf8',
        env: { ...process.env, CODEGRAPH_NO_WATCH: '1' },
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
    });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (child.status !== 0)
        throw new Error(`${args.join(' ')} -p ${root}: exit ${child.status}\n${child.stderr}`);
    return Math.round(ms);
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function measure(name, root) {
    run(COMMANDS[name], root); // 워밍업 1번
    const runs = [];
    for (let index = 0; index < RUNS; index++)
        runs.push(run(COMMANDS[name], root));
    return { runs, median: median(runs) };
}

function inventory(root) {
    const db = new DatabaseSync(path.join(root, '.codegraph', 'codegraph.db'), { readOnly: true });
    try {
        const rows = db.prepare("SELECT status, COALESCE(adapter_id, '') AS adapter, COUNT(*) AS n FROM file_inventory GROUP BY status, adapter ORDER BY status, adapter").all();
        return Object.fromEntries(rows.map((row) => [`${row.status}/${row.adapter}`, row.n]));
    }
    finally {
        db.close();
    }
}

function collect() {
    const projects = {};
    for (const root of PROJECTS) {
        const entry = { query: measure('query', root) };
        if (root === CONTEXT_PROJECT)
            entry.context = measure('context', root);
        entry.inventory = inventory(root);
        projects[root] = entry;
    }
    return { measuredAt: new Date().toISOString(), cli: CLI, runs: RUNS, projects };
}

function compare(before, after) {
    const lines = ['| 프로젝트 | 명령 | 기준선 중앙값 ms | 뒤 중앙값 ms | 줄어든 비율 |', '|---|---|---|---|---|'];
    let passed = true;
    for (const root of PROJECTS) {
        for (const name of Object.keys(COMMANDS)) {
            const was = before.projects[root]?.[name];
            const now = after.projects[root]?.[name];
            if (!was && !now)
                continue;
            if (!was || !now) {
                passed = false;
                lines.push(`| ${root} | ${name} | ${was?.median ?? '-'} | ${now?.median ?? '-'} | 측정 없음 |`);
                continue;
            }
            if (now.median > was.median)
                passed = false;
            const ratio = was.median > 0 ? Math.round((1 - now.median / was.median) * 100) : 0;
            lines.push(`| ${root} | ${name} | ${was.median} | ${now.median} | ${ratio}% |`);
        }
    }
    const changes = [];
    for (const root of PROJECTS) {
        const was = before.projects[root]?.inventory ?? {};
        const now = after.projects[root]?.inventory ?? {};
        for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
            if ((was[key] ?? 0) !== (now[key] ?? 0))
                changes.push(`| ${root} | ${key} | ${was[key] ?? 0} | ${now[key] ?? 0} |`);
        }
    }
    if (changes.length > 0)
        passed = false;
    lines.push('', '파일 목록(file_inventory)의 status/adapter 별 개수 차이:', '');
    if (changes.length === 0)
        lines.push('없음');
    else
        lines.push('| 프로젝트 | status/adapter | 기준선 | 뒤 |', '|---|---|---|---|', ...changes);
    lines.push('', `passed: ${passed}`);
    return { passed, report: lines.join('\n') + '\n' };
}

const mode = process.argv[2];
if (mode !== 'baseline' && mode !== 'after') {
    console.error('usage: node sync-speed.cjs baseline|after');
    process.exit(2);
}
fs.mkdirSync(RESULTS, { recursive: true });
const result = collect();
if (mode === 'baseline') {
    fs.writeFileSync(path.join(RESULTS, 'sync-speed-baseline.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(result.projects)
        .map(([root, entry]) => [root, { query: entry.query.median, context: entry.context?.median }]))));
}
else {
    const before = JSON.parse(fs.readFileSync(path.join(RESULTS, 'sync-speed-baseline.json'), 'utf8'));
    const { passed, report } = compare(before, result);
    result.passed = passed;
    fs.writeFileSync(path.join(RESULTS, 'sync-speed-after.json'), JSON.stringify(result, null, 2) + '\n');
    fs.writeFileSync(path.join(RESULTS, 'sync-speed.md'), report);
    console.log(report);
    process.exit(passed ? 0 : 1);
}
```
- 검증: `node --check D:/Fork/.AI/context/search-eval/sync-speed.cjs && python3 -c "t=open(r'D:/Fork/.AI/context/search-eval/sync-speed.cjs', encoding='utf-8').read(); print(t.count('D:/Fork/Arcyn;D:/Fork/RX_1;D:/Fork/BLADE'), t.count(\"process.exit(passed ? 0 : 1)\"))"`
- 기대 출력: `1 1`

### 단계 2: 기준선 측정 (코드를 바꾸기 전)
- 파일: `D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json` (실행이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 실행: `node D:/Fork/.AI/context/search-eval/sync-speed.cjs baseline`
- 메모: 세 프로젝트 각각 워밍업 1번 + 3번이라 몇 분 걸린다. 3단계를 시작하기 전에 끝나야 한다.
- 검증: `python3 -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json', encoding='utf-8')); print(len(r['projects']), 'context' in r['projects']['D:/Fork/Arcyn'])"`
- 기대 출력: `3 True`

### 단계 3: R4 바이너리 확장자와 R3 realpath 순서 (scan-files)
#### 3a
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `DSL_EXT` 선언 줄 (61행)
- 동작: insert-after
- 변경 전:
```js
const DSL_EXT = /\.ptn$/i;
```
- 변경 후:
```js
// Extensions that are never text documents: classifyTextDocument returns null for
// them without opening the file (R4). obj, dae, svg, ma and bytes stay out because
// they can be text.
const BINARY_EXT = /\.(png|jpe?g|gif|bmp|tga|psd|exr|hdr|tiff?|ico|webp|dds|ktx2?|wav|mp3|ogg|flac|aiff?|m4a|mp4|mov|avi|webm|mkv|ttf|otf|woff2?|zip|7z|rar|gz|tgz|bz2|xz|unitypackage|dll|exe|pdb|so|dylib|wasm|pdf|docx|xlsx|pptx|fbx|blend1?)$/i;
/** Whether a path has an extension that is never a text document (R4). */
function hasBinaryExtension(filePath) {
    return BINARY_EXT.test(filePath);
}
exports.hasBinaryExtension = hasBinaryExtension;
/** Returned by a document classifier for a path whose real location is outside the project root. */
const OUTSIDE_ROOT = Object.freeze({ outside: true });
exports.OUTSIDE_ROOT = OUTSIDE_ROOT;
```
#### 3b
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `listTextDocumentFiles` 전체 (97-112행)
- 동작: replace
- 변경 전:
```js
function listTextDocumentFiles(root, opts, visibleFiles) {
    const files = [];
    for (const absolutePath of visibleFiles ?? listVisibleFiles(root, opts)) {
        if (!(0, utils_1.isPathWithinRootReal)(absolutePath, root))
            continue;
        const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
        if (SECRET_PATH.test(relativePath))
            continue;
        if ((0, grammars_1.isSourceFile)(relativePath) && !DSL_EXT.test(relativePath))
            continue;
        const document = classifyTextDocument(absolutePath);
        if (document)
            files.push(document);
    }
    return files;
}
```
- 변경 후:
```js
function listTextDocumentFiles(root, opts, visibleFiles, classify) {
    const files = [];
    for (const absolutePath of visibleFiles ?? listVisibleFiles(root, opts)) {
        const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
        if (SECRET_PATH.test(relativePath))
            continue;
        if ((0, grammars_1.isSourceFile)(relativePath) && !DSL_EXT.test(relativePath))
            continue;
        // realpath only for files that can still be documents (R3). A classifier from
        // sync reuses the stored result for unchanged files (R2).
        const document = classify
            ? classify(absolutePath, relativePath)
            : (0, utils_1.isPathWithinRootReal)(absolutePath, root) ? classifyTextDocument(absolutePath) : null;
        if (document && document !== OUTSIDE_ROOT)
            files.push(document);
    }
    return files;
}
```
#### 3c
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `classifyTextDocument` 첫 두 줄 (113-114행)
- 동작: replace
- 변경 전:
```js
function classifyTextDocument(absolutePath) {
    const format = detectDocumentFormat(absolutePath);
```
- 변경 후:
```js
function classifyTextDocument(absolutePath) {
    if (BINARY_EXT.test(absolutePath))
        return null;
    const format = detectDocumentFormat(absolutePath);
```
#### 3d
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `listVisibleFiles` 의 git 호출 줄 (91행)
- 동작: replace
- 변경 전:
```js
        : (gitVisibleFiles(root) ?? walkVisibleFiles(root, ig));
```
- 변경 후:
```js
        : (gitVisibleFiles(root, ig) ?? walkVisibleFiles(root, ig));
```
#### 3e
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `gitVisibleFiles` 선언 줄 (140행)
- 동작: replace
- 변경 전:
```js
function gitVisibleFiles(root) {
```
- 변경 후:
```js
function gitVisibleFiles(root, ig) {
```
#### 3f
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`
- 위치: `gitVisibleFiles` 반복문 첫 부분 (156-158행)
- 동작: replace
- 변경 전:
```js
        if (!rel)
            continue;
        const absolutePath = path.resolve(root, rel);
```
- 변경 후:
```js
        if (!rel)
            continue;
        // Drop ignored paths before statSync (R3); listVisibleFiles filters again.
        if (ig && ig.ignores(rel))
            continue;
        const absolutePath = path.resolve(root, rel);
```
#### 3g
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.d.ts`
- 위치: `listTextDocumentFiles` 선언 (18행)
- 동작: replace
- 변경 전:
```ts
export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[]): TextDocumentFile[];
```
- 변경 후:
```ts
/** Returned by a document classifier for a path whose real location is outside the project root. */
export declare const OUTSIDE_ROOT: Readonly<{
    outside: true;
}>;
/** Whether a path has an extension that is never a text document (R4). */
export declare function hasBinaryExtension(filePath: string): boolean;
/** Classifies one visible file: a text document, OUTSIDE_ROOT, or null for a non-document. */
export type DocumentClassify = (absolutePath: string, relativePath: string, stat?: import('fs').Stats) => TextDocumentFile | typeof OUTSIDE_ROOT | null;
export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[], classify?: DocumentClassify): TextDocumentFile[];
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --check lib/docs/scan-files.js && node -e "const s=require('./lib/docs/scan-files'); const t=require('fs').readFileSync('lib/docs/scan-files.js','utf8'); console.log(s.classifyTextDocument('x/fake.png'), s.OUTSIDE_ROOT.outside, s.hasBinaryExtension('A.PNG'), t.split('gitVisibleFiles(root, ig)').length - 1)"`
- 기대 출력: `null true true 2`

### 단계 4: R2 판별기 (classifier)
#### 4a
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`
- 위치: exports 두 줄 (36-37행)
- 동작: replace
- 변경 전:
```js
exports.classifyFile = classifyFile;
exports.hasSourceErrors = hasSourceErrors;
```
- 변경 후:
```js
exports.classifyFile = classifyFile;
exports.createDocumentClassifier = createDocumentClassifier;
exports.hasSourceErrors = hasSourceErrors;
```
#### 4b
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`
- 위치: `classifyFile` 선언 줄 (44행)
- 동작: replace
- 변경 전:
```js
function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot) {
```
- 변경 후:
```js
function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot, classify) {
```
#### 4c
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`
- 위치: `classifyFile` 의 realpath 블록과 판별 줄 (91-101행)
- 동작: replace
- 변경 전:
```js
    if (projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)) {
        return {
            path: relativePath,
            status: 'ignored',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            diagnostic: 'Document content is excluded because the resolved path is outside the project root.',
            updatedAt,
        };
    }
    const document = (0, scan_files_1.classifyTextDocument)(absolutePath);
```
- 변경 후:
```js
    const document = classify
        ? classify(absolutePath, relativePath, stat)
        : projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)
            ? scan_files_1.OUTSIDE_ROOT
            : (0, scan_files_1.classifyTextDocument)(absolutePath);
    if (document === scan_files_1.OUTSIDE_ROOT) {
        return {
            path: relativePath,
            status: 'ignored',
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            diagnostic: 'Document content is excluded because the resolved path is outside the project root.',
            updatedAt,
        };
    }
```
#### 4d
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`
- 위치: `hasSourceErrors` 선언 줄 (129행). 그 앞에 새 함수를 넣는다
- 동작: replace
- 변경 전:
```js
function hasSourceErrors(value) {
```
- 변경 후:
```js
/**
 * One document classification per path for a sync (R2). The document scan and the
 * inventory refresh share it, so a file is judged once per sync. A file whose size
 * and modification time match its stored inventory row reuses the stored result
 * without opening the file: a document row of adapter version 1 stays that
 * document unless its extension is binary (R4), and an application/octet-stream
 * row stays a non-document. Every other file goes through the realpath check and
 * classifyTextDocument as before.
 */
function createDocumentClassifier(db, projectRoot) {
    const stored = new Map();
    for (const row of db.prepare('SELECT path, size, modified_at, mime_type, adapter_id, adapter_version FROM file_inventory').all())
        stored.set(row.path, row);
    const decided = new Map();
    return function classify(absolutePath, relativePath, stat) {
        if (decided.has(relativePath))
            return decided.get(relativePath);
        const result = classifyOnce(absolutePath, relativePath, stat);
        decided.set(relativePath, result);
        return result;
    };
    function classifyOnce(absolutePath, relativePath, stat) {
        const row = stored.get(relativePath);
        if (row) {
            let current = stat;
            if (!current) {
                try {
                    current = fs.statSync(absolutePath);
                }
                catch {
                    current = undefined;
                }
            }
            if (current
                && row.size === current.size
                && Math.floor(row.modified_at ?? -1) === Math.floor(current.mtimeMs)) {
                if (typeof row.adapter_id === 'string' && row.adapter_id.startsWith('document.') && row.adapter_version === '1'
                    && !(0, scan_files_1.hasBinaryExtension)(absolutePath))
                    return { absolutePath, format: row.adapter_id.slice('document.'.length), mimeType: row.mime_type };
                if (row.mime_type === 'application/octet-stream')
                    return null;
            }
        }
        if (projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot))
            return scan_files_1.OUTSIDE_ROOT;
        return (0, scan_files_1.classifyTextDocument)(absolutePath);
    }
}
function hasSourceErrors(value) {
```
#### 4e
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts`
- 위치: 둘째 import 줄 (2행)
- 동작: replace
- 변경 전:
```ts
import type { FileInventoryRecord } from '../types';
```
- 변경 후:
```ts
import type { FileInventoryRecord } from '../types';
import type { DocumentClassify } from '../docs/scan-files';
```
#### 4f
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts`
- 위치: `classifyFile` 선언 (8행)
- 동작: replace
- 변경 전:
```ts
export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string): FileInventoryRecord;
```
- 변경 후:
```ts
export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string, classify?: DocumentClassify): FileInventoryRecord;
/** One document classification per path for a sync; unchanged files reuse their stored inventory result. */
export declare function createDocumentClassifier(db: SqliteDatabase, projectRoot: string): DocumentClassify;
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --check lib/inventory/classifier.js && node -e "const c=require('./lib/inventory/classifier'); console.log(typeof c.createDocumentClassifier, c.classifyFile.length)"`
- 기대 출력: `function 6`

### 단계 5: R2 판별기 연결 (문서 색인, 파일 목록)
#### 5a
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`
- 위치: `listTextDocumentFiles` 호출 (98행). 줄의 일부
- 동작: replace
- 변경 전:
```js
documents = (0, scan_files_1.listTextDocumentFiles)(projectRoot, { respectGitignore: opts.respectGitignore }, opts.visibleFiles);
```
- 변경 후:
```js
documents = (0, scan_files_1.listTextDocumentFiles)(projectRoot, { respectGitignore: opts.respectGitignore }, opts.visibleFiles, opts.classify);
```
#### 5b
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts`
- 위치: import 줄 (1행)
- 동작: replace
- 변경 전:
```ts
import type { SqliteDatabase } from '../db/sqlite-adapter';
```
- 변경 후:
```ts
import type { SqliteDatabase } from '../db/sqlite-adapter';
import type { DocumentClassify } from './scan-files';
```
#### 5c
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts`
- 위치: `indexMarkdown` 의 opts 끝 (20-22행)
- 동작: replace
- 변경 전:
```ts
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
}): Promise<MarkdownIndexResult>;
```
- 변경 후:
```ts
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
    classify?: DocumentClassify;
}): Promise<MarkdownIndexResult>;
```
#### 5d
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`
- 위치: `classifyFile` 호출 (100행). 줄의 일부
- 동작: replace
- 변경 전:
```js
const record = (0, classifier_1.classifyFile)(absolutePath, relativePath, documentsEnabled, { sourceHash, documentHash, documentErrors }, projectRoot);
```
- 변경 후:
```js
const record = (0, classifier_1.classifyFile)(absolutePath, relativePath, documentsEnabled, { sourceHash, documentHash, documentErrors }, projectRoot, opts.classify);
```
#### 5e
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts`
- 위치: 둘째 import 줄 (2행)
- 동작: replace
- 변경 전:
```ts
import type { FileInventoryStatus } from '../types';
```
- 변경 후:
```ts
import type { FileInventoryStatus } from '../types';
import type { DocumentClassify } from '../docs/scan-files';
```
#### 5f
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts`
- 위치: `refreshFileInventory` 의 opts 끝 (10-12행)
- 동작: replace
- 변경 전:
```ts
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
}): FileInventoryResult;
```
- 변경 후:
```ts
    respectGitignore?: boolean;
    visibleFiles?: readonly string[];
    classify?: DocumentClassify;
}): FileInventoryResult;
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --check lib/docs/indexer.js && node --check lib/inventory/index.js && python3 -c "print(open('lib/docs/indexer.js', encoding='utf-8').read().count('opts.visibleFiles, opts.classify)'), open('lib/inventory/index.js', encoding='utf-8').read().count('projectRoot, opts.classify)'))"`
- 기대 출력: `1 1`

### 단계 6: K1 dominant 파일 저장 (queries)
#### 6a
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js`
- 위치: `getDominantFile` 선언 줄 (449행). 원래 본문은 `computeDominantFile` 이 된다
- 동작: replace
- 변경 전:
```js
    getDominantFile() {
```
- 변경 후:
```js
    getDominantFile() {
        const stored = this.readStoredDominantFile();
        if (stored && stored.fingerprint === this.dominantFileFingerprint())
            return stored.dominant;
        return this.computeDominantFile();
    }
    /**
     * Recompute and store the dominant file when the edge fingerprint changed (K1).
     * sync and indexAll call this after their writes; the read path only compares.
     */
    refreshDominantFile() {
        const fingerprint = this.dominantFileFingerprint();
        const stored = this.readStoredDominantFile();
        if (stored && stored.fingerprint === fingerprint)
            return stored.dominant;
        const dominant = this.computeDominantFile();
        this.setMetadata('dominant_file', JSON.stringify({ fingerprint, dominant }));
        return dominant;
    }
    /** Edge count and highest edge id: changes whenever an edge is added or removed. */
    dominantFileFingerprint() {
        if (!this.stmts.dominantFileFingerprint) {
            this.stmts.dominantFileFingerprint = this.db.prepare('SELECT COUNT(*) AS c, MAX(rowid) AS m FROM edges');
        }
        const row = this.stmts.dominantFileFingerprint.get();
        return `${row.c}:${row.m ?? 0}`;
    }
    readStoredDominantFile() {
        const value = this.getMetadata('dominant_file');
        if (!value)
            return null;
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed.fingerprint === 'string' && 'dominant' in parsed ? parsed : null;
        }
        catch {
            return null;
        }
    }
    computeDominantFile() {
```
#### 6b
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.d.ts`
- 위치: `getDominantFile` 선언 (90-94행)
- 동작: replace
- 변경 전:
```ts
    getDominantFile(): {
        filePath: string;
        edgeCount: number;
        nextEdgeCount: number;
    } | null;
```
- 변경 후:
```ts
    getDominantFile(): {
        filePath: string;
        edgeCount: number;
        nextEdgeCount: number;
    } | null;
    /** Recompute and store the dominant file when the edge fingerprint changed. */
    refreshDominantFile(): {
        filePath: string;
        edgeCount: number;
        nextEdgeCount: number;
    } | null;
    /** The aggregate behind getDominantFile, without the stored value. */
    computeDominantFile(): {
        filePath: string;
        edgeCount: number;
        nextEdgeCount: number;
    } | null;
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --check lib/db/queries.js && python3 -c "t=open('lib/db/queries.js', encoding='utf-8').read(); print(t.count('computeDominantFile() {'), t.count('refreshDominantFile() {'), t.count(\"this.setMetadata('dominant_file'\"))"`
- 기대 출력: `1 1 1`

### 단계 7: sync 와 indexAll 연결 (lib/index.js)
#### 7a
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`
- 위치: `inventory_1` require 줄 (62행)
- 동작: replace
- 변경 전:
```js
const inventory_1 = require("./inventory");
```
- 변경 후:
```js
const inventory_1 = require("./inventory");
const classifier_1 = require("./inventory/classifier");
```
#### 7b
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`
- 위치: `sync` 의 `visibleFiles` 와 `indexMarkdown` 호출 (646-653행)
- 동작: replace
- 변경 전:
```js
                const visibleFiles = (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                    respectGitignore: options.respectGitignore,
                });
                try {
                    const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                    });
```
- 변경 후:
```js
                const visibleFiles = (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                    respectGitignore: options.respectGitignore,
                });
                // One document classification per path for this sync, shared by the document
                // scan and the inventory refresh; unchanged files reuse the stored result (R2).
                const classify = (0, classifier_1.createDocumentClassifier)(this.db.getDb(), this.projectRoot);
                try {
                    const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                        classify,
                    });
```
#### 7c
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`
- 위치: `sync` 의 `refreshFileInventory` 블록 (704-718행)
- 동작: replace
- 변경 전:
```js
                    result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                    });
                    if (result.inventory.byStatus.error > 0) {
                        result.warnings = [...(result.warnings ?? []),
                            `File inventory contains ${result.inventory.byStatus.error} error entries.`];
                    }
                }
                catch (error) {
                    result.errors = [...(result.errors ?? []), {
                        message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error', code: 'file_inventory',
                    }];
                }
```
- 변경 후:
```js
                    result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                        respectGitignore: options.respectGitignore,
                        visibleFiles,
                        classify,
                    });
                    if (result.inventory.byStatus.error > 0) {
                        result.warnings = [...(result.warnings ?? []),
                            `File inventory contains ${result.inventory.byStatus.error} error entries.`];
                    }
                }
                catch (error) {
                    result.errors = [...(result.errors ?? []), {
                        message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error', code: 'file_inventory',
                    }];
                }
                try {
                    this.queries.refreshDominantFile();
                }
                catch (error) {
                    result.warnings = [...(result.warnings ?? []),
                        `Dominant file refresh failed: ${error instanceof Error ? error.message : String(error)}`];
                }
```
#### 7d
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`
- 위치: `indexAll` 의 `refreshFileInventory` 블록 (452-470행)
- 동작: replace
- 변경 전:
```js
                        result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                            respectGitignore: options.respectGitignore,
                            visibleFiles,
                        });
                        if (result.inventory.byStatus.error > 0) {
                            result.errors.push({
                                message: `File inventory contains ${result.inventory.byStatus.error} error entries.`,
                                severity: 'warning',
                                code: 'file_inventory',
                            });
                        }
                    }
                    catch (error) {
                        result.errors.push({
                            message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error',
                            code: 'file_inventory',
                        });
                    }
```
- 변경 후:
```js
                        result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                            respectGitignore: options.respectGitignore,
                            visibleFiles,
                        });
                        if (result.inventory.byStatus.error > 0) {
                            result.errors.push({
                                message: `File inventory contains ${result.inventory.byStatus.error} error entries.`,
                                severity: 'warning',
                                code: 'file_inventory',
                            });
                        }
                    }
                    catch (error) {
                        result.errors.push({
                            message: `File inventory refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error',
                            code: 'file_inventory',
                        });
                    }
                    try {
                        this.queries.refreshDominantFile();
                    }
                    catch (error) {
                        result.errors.push({
                            message: `Dominant file refresh failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'warning',
                            code: 'dominant_file',
                        });
                    }
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --check lib/index.js && python3 -c "t=open('lib/index.js', encoding='utf-8').read(); print(t.count('createDocumentClassifier)(this.db.getDb()'), t.count('this.queries.refreshDominantFile();'), t.count('classify,'))"`
- 기대 출력: `1 2 2`

### 단계 8: 시험 만들기와 실행
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs`
- 위치: 새 파일
- 동작: create
- 변경 전:
```
없음
```
- 변경 후:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CodeGraph } = require('../lib/index');
const { classifyTextDocument } = require('../lib/docs/scan-files');

// 묶음 1(R2, R3, R4, K1): 바뀐 것 없는 sync 는 프로젝트 파일을 열지 않고,
// context 는 저장된 dominant 파일을 읽는다.
async function docsProject(context) {
    const env = { CODEGRAPH_DOCS: process.env.CODEGRAPH_DOCS, CODEGRAPH_DISABLE_EMBEDDINGS: process.env.CODEGRAPH_DISABLE_EMBEDDINGS };
    process.env.CODEGRAPH_DOCS = '1';
    process.env.CODEGRAPH_DISABLE_EMBEDDINGS = '1';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-sync-speed-'));
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { public void Run() { Step(); } void Step() {} }\n');
    fs.writeFileSync(path.join(root, 'README.md'), '# Guide\n\nRunner starts the loop.\n');
    fs.writeFileSync(path.join(root, 'notes.txt'), 'plain notes\n');
    fs.writeFileSync(path.join(root, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    fs.writeFileSync(path.join(root, 'blob.dat'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    const graph = CodeGraph.initSync(root);
    context.after(() => {
        graph.close();
        for (const [key, value] of Object.entries(env)) {
            if (value === undefined)
                delete process.env[key];
            else
                process.env[key] = value;
        }
        fs.rmSync(root, { recursive: true, force: true });
    });
    assert.equal((await graph.indexAll()).success, true);
    return { root, graph };
}

function projectOpens(context, root) {
    const top = path.resolve(root);
    const store = path.join(top, '.codegraph');
    const opened = [];
    const original = fs.openSync;
    context.mock.method(fs, 'openSync', function (file, ...rest) {
        const resolved = typeof file === 'string' ? path.resolve(file) : '';
        if (resolved.startsWith(top + path.sep) && resolved !== store && !resolved.startsWith(store + path.sep))
            opened.push(path.relative(top, resolved).split(path.sep).join('/'));
        return original.call(this, file, ...rest);
    });
    return opened;
}

function storedDominant(graph) {
    const row = graph.getDb().prepare("SELECT value FROM project_metadata WHERE key = 'dominant_file'").get();
    return row ? JSON.parse(row.value) : null;
}

test('an unchanged sync opens no project file, and an edited document is indexed again', async context => {
    const { root, graph } = await docsProject(context);
    const opened = projectOpens(context, root);
    const unchanged = await graph.sync();
    assert.equal(unchanged.status, 'current');
    assert.deepEqual(opened, []);
    context.mock.restoreAll();
    fs.appendFileSync(path.join(root, 'README.md'), '\nThe loop stops on request.\n');
    const edited = await graph.sync();
    assert.equal(edited.status, 'current');
    assert.ok((edited.docPaths ?? []).includes('README.md'), JSON.stringify(edited.docPaths));
});

test('a binary extension is not a document even when the content is text', async context => {
    const { root, graph } = await docsProject(context);
    const fake = path.join(root, 'fake.png');
    fs.writeFileSync(fake, 'just text, not an image\n');
    assert.equal(classifyTextDocument(fake), null);
    assert.equal((await graph.sync()).status, 'current');
    const row = graph.getDb().prepare('SELECT status, mime_type, adapter_id FROM file_inventory WHERE path = ?').get('fake.png');
    assert.equal(row.status, 'metadata-only');
    assert.equal(row.mime_type, 'application/octet-stream');
    assert.equal(row.adapter_id, null);
    // A row stored as a text document before R4 is judged again instead of reused.
    graph.getDb().prepare("UPDATE file_inventory SET status = 'indexed', mime_type = 'text/plain', adapter_id = 'document.text', adapter_version = '1' WHERE path = 'fake.png'").run();
    assert.equal((await graph.sync()).status, 'current');
    const again = graph.getDb().prepare('SELECT status, mime_type, adapter_id FROM file_inventory WHERE path = ?').get('fake.png');
    assert.equal(again.mime_type, 'application/octet-stream');
    assert.equal(again.adapter_id, null);
});

test('context reads the stored dominant file until a code change refreshes it', async context => {
    const { root, graph } = await docsProject(context);
    const stored = storedDominant(graph);
    assert.ok(stored, 'indexAll stores dominant_file');
    assert.match(stored.fingerprint, /^\d+:\d+$/);
    const marker = { filePath: 'Marker.cs', edgeCount: 99, nextEdgeCount: 0 };
    graph.getDb().prepare("UPDATE project_metadata SET value = ? WHERE key = 'dominant_file'")
        .run(JSON.stringify({ fingerprint: stored.fingerprint, dominant: marker }));
    assert.deepEqual(graph.queries.getDominantFile(), marker);
    graph.getDb().prepare("UPDATE project_metadata SET value = ? WHERE key = 'dominant_file'")
        .run(JSON.stringify({ fingerprint: 'stale', dominant: marker }));
    assert.deepEqual(graph.queries.getDominantFile(), graph.queries.computeDominantFile());
    assert.equal(storedDominant(graph).fingerprint, 'stale', 'the read path does not write');
    fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { public void Run() { Step(); Halt(); } void Step() {} void Halt() {} }\n');
    assert.equal((await graph.sync()).status, 'current');
    const refreshed = storedDominant(graph);
    assert.notEqual(refreshed.fingerprint, 'stale');
    assert.notEqual(refreshed.fingerprint, stored.fingerprint);
    assert.notDeepEqual(refreshed.dominant, marker);
});
```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node --test test/sync-speed.test.cjs 2>&1 | grep -E '^# (pass|fail) ' | paste -sd' '`
- 기대 출력: `# pass 3 # fail 0`

### 단계 9: 뒤 측정과 비교
- 파일: `D:/Fork/.AI/context/search-eval/results/sync-speed-after.json`, `D:/Fork/.AI/context/search-eval/results/sync-speed.md` (실행이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 실행: `node D:/Fork/.AI/context/search-eval/sync-speed.cjs after`
- 메모: 기준선과 같은 방법으로 다시 잰다. 결과 표는 `results/sync-speed.md` 에 쓰인다. 종료 코드 1 이어도 이 단계는 끝까지 기록하고 멈춘다(사람이 표를 본다).
- 검증: `python3 -c "import json; print(json.load(open(r'D:/Fork/.AI/context/search-eval/results/sync-speed-after.json', encoding='utf-8'))['passed'])"`
- 기대 출력: `True`

### 단계 10: 빌드, 전역 설치, 이 저장소 맞추기 (사용자 승인 필요)
- 파일: KIT `artifacts/codegraph-win32-x64.zip`, `manifest.json`, 전역 설치본, 이 저장소의 배포 사본
- 위치: 명령 실행
- 동작: 실행
- 실행 전: AskUserQuestion 으로 "빌드·전역 설치·이 저장소 동기화를 진행할까요?" 를 묻고, 승인이 없으면 상태 파일 `CURRENT=S10 승인 대기` 로 쓰고 멈춤(MODE 는 EXECUTE 유지).
- 실행 도구와 명령: 안 A 플랜(`.claude/memory-bank/main/plans/main-2026-11-03-codegraph-search-a.md`) 10단계의 "실행 도구", 10a, 10a 확인, 10b, 10c 를 그 플랜에 적힌 그대로 실행함. PowerShell 도구로 직접 실행하고 Bash 의 `pwsh -Command` 로 부르지 않음(그 플랜의 "수정 (2026-11-03)" 참고).
- 검증(Bash): `S=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}' ~/.local/bin/codegraph.cmd | sed 's/.*-//'); grep -c "\"sha256\": \"$S" D:/Fork/KIT/tools/codegraph/manifest.json; diff -rq D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source --exclude=node_modules | wc -l`
- 기대 출력: `1`, `0`. 첫 줄이 `0` 이면 옛 빌드가 설치된 것임

## 수락 기준
A4 는 2단계와 9단계의 측정이 끝난 뒤에만 통과함. V6 은 10단계를 승인한 경우에만 확인함.

```acceptance
{"id": "A1", "kind": "auto", "cmd": "node --test D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs", "expect": "exit0"}
{"id": "A2", "kind": "auto", "cmd": "node --test D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs D:/Fork/KIT/tools/codegraph/source/test/cli.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-resolution.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-lock.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-revision.test.cjs", "expect": "exit0"}
{"id": "A3", "kind": "auto", "cmd": "node --test D:/Fork/KIT/tools/codegraph/source/test/watcher.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-cli-edge.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-daemon.test.cjs", "expect": "exit0"}
{"id": "A4", "kind": "auto", "cmd": "node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sync-speed-after.json');process.exit(r.passed===true?0:1)\"", "expect": "exit0"}
{"id": "H1", "kind": "human", "how": "D:/Fork/.AI/context/search-eval/results/sync-speed.md 의 표를 봄", "expect": "세 프로젝트 모두 query 뒤 중앙값이 기준선보다 작고 Arcyn context 도 작음. 파일 목록 차이가 \"없음\"(차이가 있으면 바이너리 확장자 파일이 문서에서 빠진 것뿐인지 봄). 아니면 G2 에서 반려함"}
{"id": "H2", "kind": "human", "how": "10단계를 승인했다면 새 터미널에서 codegraph query DamageHitJob -p D:/Fork/Arcyn --limit 3 을 두 번 돌림", "expect": "두 번 모두 오류 없이 끝나고, 10단계 검증의 둘째 줄이 0(이 저장소 source 가 KIT source 와 같음)"}
```

## 하지 않는 것
- 묶음 2(W1, W2, W3, W5), W4, K2, R1, N1 은 하지 않음(innovate 12절).
- 코드 추출 walk 와 문서 walk 합치기는 하지 않음. 서브모듈(`--recurse-submodules`)과 심볼릭 링크 처리가 달라 색인 파일 집합이 바뀜(plan-notes R3).
- `indexAll` 의 문서 판별은 바꾸지 않음. `indexAll` 에는 K1 저장 호출만 더함.
- `watcher-hooks.test.cjs` 는 변경 전부터 3건 실패라 수락 기준에서 뺌(plan-notes 회귀 시험 기준선).
- 안 B·C 플랜의 변경 전 문구 확인은 안 B 를 다시 시작하기 전에 루트 세션이 함(innovate 12절).
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
