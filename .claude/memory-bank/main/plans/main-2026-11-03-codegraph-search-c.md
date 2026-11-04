# 플랜: 안 C — 한국어 2-gram 열(D3b), 임베딩 입력 정리(D4), 긴 문서 섹션 벡터(D5)

## 목표
한국어 어휘 일치와 긴 문서의 뒷부분 검색을 보강해 문서 검색 Hit@1 을 올리고, 다시 임베딩한 결과가 안 B 직후 기준선보다 나쁘지 않을 때만 남긴다.

## 전제와 실행 규칙
- 선행 조건: 안 B(`main-2026-11-03-codegraph-search-b`)의 EXECUTE 가 끝나고 G2 를 통과했음. "변경 전" 원문 일부는 안 A, 안 B 가 만든 코드임. `main-2026-11-03-codegraph-search-b.state` 가 `STATUS=done` 이 아니면 시작하지 않고 `MODE=BLOCKED`, `CURRENT=멈춤 S0: 안 B 미완료` 로 씀.
- 근거: `main-2026-11-03-codegraph-structure-innovate.md` 3.3절 D3b, D4, D5, 4절 안 C. 라벨 뜻은 그 문서 `## 라벨`.
- 설계 요지:
  - D3b: `document_fts` 에 `grams` 열을 더해 한글 음절 2-gram 을 넣음. 질의의 한글 2-gram 은 `grams : "검술"` 꼴로 OR 에 더함. 열 비중은 `docsGramsWeight`.
  - D4: 섹션이 있으면 요약(본문 앞 600자)을 임베딩 입력에서 빼고, frontmatter 의 `embedding_text`, `search_aliases` 를 제목 다음에 넣음.
  - D5: 섹션 본문이 900자를 넘는 문서는 900자 단위 조각 벡터(최대 24개)를 `mdast_chunk_vectors` 에 더 만듦. 검색은 문서 벡터와 조각 벡터 중 가까운 거리를 문서 거리로 씀. 켜고 끄는 값은 `docsChunkVectors`.
  - 다시 임베딩: 임베딩 입력 형식 버전(`project_metadata.docs_embedding_text_version`)이 바뀌면 같은 모델이라도 문서 벡터를 다시 만듦. `embedding_model` 열의 뜻은 바꾸지 않음(문서 유사도 엣지가 이 값으로 고름).
- 배포 뒤 모든 문서 그래프는 한 번 다시 임베딩됨. 캐시가 없으면 Zyxel 약 1,930초 이상, BLADE 약 119초 이상이 듦. 10단계 측정이 같은 텍스트를 캐시에 넣으므로 실제 그래프 동기화는 그만큼 빨라짐.
- 한 단계에 변경이 여럿이면 `a`, `b`, `c` 로 나눔. 실패하면 고치지 말고 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <원인>` 으로 씀.
- 코드 블록은 목록 안에 있어 모든 줄 앞에 2칸이 더 붙어 있음. 파일과 맞출 때와 파일에 쓸 때 각 줄 앞 2칸을 뺌. 그 뒤의 들여쓰기는 파일 원문 그대로임.
- 모든 명령은 Git Bash 에서 돌림.

## 바뀔 파일
- `D:/Fork/.AI/context/search-eval/run.cjs`: 내보내는 도우미 추가
- `D:/Fork/.AI/context/search-eval/run-c.cjs`: 새 파일. 안 C 기준선과 측정
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js`: `docsGramsWeight`, `docsChunkVectors`
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/hangul-grams.js`: 새 파일
- `D:/Fork/KIT/tools/codegraph/source/lib/db/migration-v13.js`: 새 파일
- `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.js`, `migrations.d.ts`: v13
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js`: 2-gram 질의, 열 비중
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/parse.js`: frontmatter 검색 힌트
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/document-parsers/shared.js`: 임베딩 입력, 조각
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`: FTS 열, 조각 표, 입력 형식 버전, 조각 임베딩
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/document-store.js`: 2-gram 쓰기, 조각 벡터 쓰기·지우기
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js`: 조각 거리 합치기
- `D:/Fork/KIT/tools/codegraph/source/test/docs-grams.test.cjs`: 새 시험
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`: 10단계 명령이 키를 더함
- 10b(사용자 승인 뒤): 안 A 단계 10 과 같은 배포 파일

## 단계

### 단계 1: 측정 도구와 기준선(바꾸기 전)
- 파일: `D:/Fork/.AI/context/search-eval/run.cjs` (1a), `D:/Fork/.AI/context/search-eval/run-c.cjs` (1b)
- 위치: `module.exports` 줄, 새 파일
- 동작: replace (1a), create (1b), 실행 (1c)
- 1a 변경 전:
  ```
  module.exports = { KIT_SOURCE, CLI, ENV, TUNING_FILE, RESULTS, CODE_SETS, copyIndex, round, pick, codeScore, codeKeepsHit5 };
  ```
  1a 변경 후:
  ```
  module.exports = { KIT_SOURCE, CLI, ENV, TUNING_FILE, RESULTS, CODE_SETS, copyIndex, round, pick, codeScore, codeKeepsHit5, ROOTS, DOC_SETS, runDocs, singleMs, docsScore, docsKeepsHit5 };
  ```
- 1b 변경 후 (`run-c.cjs`):
  ```js
  // 사용: node run-c.cjs baseline | node run-c.cjs sweep
  // 안 C: baseline 은 바꾸기 전 소스로 문서 검색을 재고, sweep 은 문서 복사본을 새 소스로 다시 임베딩해 비교함
  'use strict';
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const { DatabaseSync } = require('node:sqlite');
  const run = require('./run.cjs');

  const GRID = [];
  for (const grams of [0, 1, 2])
      for (const chunks of [false, true])
          GRID.push({ docsGramsWeight: grams, docsChunkVectors: chunks });
  const DOC_ROOTS = ['blade', 'zyxel', 'atom', 'arcyn'];

  function configEnv(config) {
      return { ...run.ENV, CODEGRAPH_DOCS_GRAMS_WEIGHT: String(config.docsGramsWeight), CODEGRAPH_DOCS_CHUNK_VECTORS: config.docsChunkVectors ? '1' : '0' };
  }
  // 다시 임베딩하려면 원문이 필요해 색인된 문서 파일만 복사함. 코드 파일은 복사하지 않음
  function copyDocuments(copies) {
      for (const key of DOC_ROOTS) {
          const db = new DatabaseSync(path.join(run.ROOTS[key], '.codegraph', 'codegraph.db'), { readOnly: true });
          const files = db.prepare('SELECT file_path FROM mdast_metadata').all().map((row) => row.file_path);
          db.close();
          for (const file of [...files, '.codegraphignore']) {
              const from = path.join(run.ROOTS[key], file);
              if (!fs.existsSync(from))
                  continue;
              const to = path.join(copies[key], file);
              fs.mkdirSync(path.dirname(to), { recursive: true });
              fs.copyFileSync(from, to);
          }
      }
  }
  function syncCopy(root) {
      const started = Date.now();
      const out = spawnSync(process.execPath, [run.CLI, 'sync', root], { env: configEnv({ docsGramsWeight: 1, docsChunkVectors: true }), encoding: 'utf8', maxBuffer: 1 << 26 });
      if (out.status !== 0 && out.status !== 1)
          throw new Error(`sync ${root} failed: ${out.stderr.slice(0, 400)}`);
      const db = new DatabaseSync(path.join(root, '.codegraph', 'codegraph.db'), { readOnly: true });
      const version = db.prepare(`SELECT value FROM project_metadata WHERE key = 'docs_embedding_text_version'`).get()?.value;
      const chunks = Number(db.prepare('SELECT COUNT(*) AS n FROM mdast_chunks').get().n);
      db.close();
      if (version !== '2+chunks')
          throw new Error(`sync ${root} did not finish re-embedding (version ${version})`);
      return { ms: Date.now() - started, chunks };
  }
  function measure(copies, config) {
      const out = {};
      for (const set of run.DOC_SETS)
          out[set.name] = run.runDocs(set, copies[set.root], config ? configEnv(config) : run.ENV);
      return out;
  }
  function table(baseline, chosen, embeds, picked) {
      const lines = ['# search-eval 안 C', '', `- 실행: ${new Date().toISOString()}`, `- 선택: ${JSON.stringify(picked.winner ? picked.winner.config : null)} (${picked.reason})`, '',
          '| 묶음 | 구분 | 기준 Hit@1 | 선택 Hit@1 | 기준 Hit@5 | 선택 Hit@5 | 기준 ms/질의 | 선택 ms/질의 | 기준 단발 ms | 선택 단발 ms |', '|---|---|---|---|---|---|---|---|---|---|'];
      for (const set of run.DOC_SETS) {
          const b = baseline[set.name];
          const w = chosen[set.name];
          for (const split of ['tune', 'report'])
              lines.push(`| ${set.name} | ${split} | ${b.metrics[split].hit1} | ${w.metrics[split].hit1} | ${b.metrics[split].hit5} | ${w.metrics[split].hit5} | ${b.msPerQuery} | ${w.msPerQuery} | ${b.singleMs} | ${w.singleMs} |`);
      }
      lines.push('', '| 색인 | 다시 임베딩 ms | 조각 벡터 수 |', '|---|---|---|');
      for (const key of DOC_ROOTS)
          lines.push(`| ${key} | ${embeds[key].ms} | ${embeds[key].chunks} |`);
      return lines.join('\n') + '\n';
  }
  async function main() {
      const mode = process.argv[2];
      if (mode !== 'baseline' && mode !== 'sweep') {
          console.error('usage: node run-c.cjs baseline|sweep');
          process.exit(64);
      }
      if (mode === 'baseline') {
          const copies = run.copyIndex('baseline-c');
          const docs = measure(copies, null);
          for (const set of run.DOC_SETS)
              docs[set.name].singleMs = run.singleMs(set, copies[set.root], run.ENV);
          fs.rmSync(path.join(__dirname, 'work', 'baseline-c'), { recursive: true, force: true });
          fs.writeFileSync(path.join(run.RESULTS, 'baseline-c.json'), JSON.stringify({ docs }, null, 2));
          console.log(JSON.stringify({ docs }));
          return;
      }
      const baseline = JSON.parse(fs.readFileSync(path.join(run.RESULTS, 'baseline-c.json'), 'utf8')).docs;
      const copies = run.copyIndex('sweep-c');
      copyDocuments(copies);
      const embeds = {};
      for (const key of DOC_ROOTS)
          embeds[key] = syncCopy(copies[key]);
      const candidates = GRID.map((config) => ({ config, result: measure(copies, config) }));
      const picked = run.pick(candidates, baseline, run.docsScore, run.docsKeepsHit5);
      const chosenConfig = picked.winner ? picked.winner.config : GRID[2];
      const chosen = picked.winner ? picked.winner.result : candidates[2].result;
      for (const set of run.DOC_SETS)
          chosen[set.name].singleMs = run.singleMs(set, copies[set.root], configEnv(chosenConfig));
      fs.rmSync(path.join(__dirname, 'work', 'sweep-c'), { recursive: true, force: true });
      fs.writeFileSync(path.join(run.RESULTS, 'sweep-c.json'), JSON.stringify({ passed: picked.passed, embeds, candidates, chosenConfig }, null, 2));
      fs.writeFileSync(path.join(run.RESULTS, 'sweep-c.md'), table(baseline, chosen, embeds, picked));
      if (!picked.passed) {
          console.error(`plan C did not beat the baseline: ${picked.reason}`);
          process.exit(2);
      }
      const tuning = JSON.parse(fs.readFileSync(run.TUNING_FILE, 'utf8'));
      tuning.docsGramsWeight = chosenConfig.docsGramsWeight;
      tuning.docsChunkVectors = chosenConfig.docsChunkVectors;
      fs.writeFileSync(run.TUNING_FILE, JSON.stringify(tuning, null, 2) + '\n');
      console.log(`tuning written: ${JSON.stringify(chosenConfig)}`);
  }
  main().catch((error) => {
      console.error(error.stack || String(error));
      process.exit(1);
  });
  ```
- 1c 실행(2단계 전에 돌림): `cd D:/Fork/.AI/context/search-eval && node run-c.cjs baseline > results-baseline-c.log 2>&1; echo exit=$?`
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/baseline-c.json', encoding='utf-8')); print(sorted(r['docs']))"`
- 기대 출력: `['arcyn-docs', 'atom', 'blade', 'zyxel']`

### 단계 2: 조정값 키와 2-gram 함수
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js` (2a), `D:/Fork/KIT/tools/codegraph/source/lib/docs/hangul-grams.js` (2b)
- 위치: `cached` 객체 끝, 새 파일
- 동작: replace (2a), create (2b)
- 2a 변경 전:
  ```
          codeVectorScore: number(process.env.CODEGRAPH_CODE_VECTOR_SCORE, base.codeVectorScore, 20),
      };
  ```
  2a 변경 후:
  ```
          codeVectorScore: number(process.env.CODEGRAPH_CODE_VECTOR_SCORE, base.codeVectorScore, 20),
          docsGramsWeight: number(process.env.CODEGRAPH_DOCS_GRAMS_WEIGHT, base.docsGramsWeight, 1),
          docsChunkVectors: flag(process.env.CODEGRAPH_DOCS_CHUNK_VECTORS, base.docsChunkVectors),
      };
  ```
- 2b 변경 후 (`hangul-grams.js`):
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.hangulBigrams = hangulBigrams;
  function hangulBigrams(text, cap = 4000) {
      const grams = new Set();
      for (const run of String(text ?? '').match(/[\uAC00-\uD7A3]{2,}/g) ?? []) {
          for (let index = 0; index + 1 < run.length; index++) {
              grams.add(run.slice(index, index + 2));
              if (grams.size >= cap)
                  return [...grams].join(' ');
          }
      }
      return [...grams].join(' ');
  }
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "console.log(require('./lib/docs/hangul-grams').hangulBigrams('검술을 배운다 sword'), '|', require('./lib/search-tuning').loadSearchTuning().docsGramsWeight)"`
- 기대 출력: `검술 술을 배운 운다 | 1`

### 단계 3: v13 이주(기존 문서 색인에 grams 열)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/db/migration-v13.js` (3a), `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.js` (3b~3d), `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.d.ts` (3e)
- 동작: create (3a), replace (3b~3e)
- 3a 변경 후 (`migration-v13.js`):
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.applyDocumentGramsMigration = applyDocumentGramsMigration;
  const hangul_grams_1 = require("../docs/hangul-grams");
  // FTS5 표에는 열을 더할 수 없어 새 표에 옮겨 담고 이름을 바꿈
  function applyDocumentGramsMigration(db) {
      if (!db.prepare(`SELECT 1 AS x FROM sqlite_master WHERE name = 'document_fts'`).get())
          return;
      const columns = db.prepare('PRAGMA table_info(document_fts)').all().map((row) => row.name);
      if (columns.includes('grams'))
          return;
      db.exec('CREATE VIRTUAL TABLE document_fts_v13 USING fts5(file_path, title, summary, structure, grams)');
      const insert = db.prepare('INSERT INTO document_fts_v13(rowid, file_path, title, summary, structure, grams) VALUES (?, ?, ?, ?, ?, ?)');
      for (const row of db.prepare('SELECT rowid AS rid, file_path, title, summary, structure FROM document_fts').all())
          insert.run(BigInt(row.rid), row.file_path, row.title, row.summary, row.structure, (0, hangul_grams_1.hangulBigrams)(`${row.title ?? ''} ${row.summary ?? ''} ${row.structure ?? ''}`));
      db.exec('DROP TABLE document_fts');
      db.exec('ALTER TABLE document_fts_v13 RENAME TO document_fts');
  }
  ```
- 3b 변경 전:
  ```
  const migration_v12_1 = require("./migration-v12");
  ```
  3b 변경 후:
  ```
  const migration_v12_1 = require("./migration-v12");
  const migration_v13_1 = require("./migration-v13");
  ```
- 3c 변경 전:
  ```
  exports.CURRENT_SCHEMA_VERSION = 12;
  ```
  3c 변경 후:
  ```
  exports.CURRENT_SCHEMA_VERSION = 13;
  ```
- 3d 변경 전:
  ```
          up: migration_v12_1.applyNameTokensMigration,
      },
  ];
  ```
  3d 변경 후:
  ```
          up: migration_v12_1.applyNameTokensMigration,
      },
      {
          version: 13,
          description: 'Add Hangul syllable bigrams to document full-text search',
          up: migration_v13_1.applyDocumentGramsMigration,
      },
  ];
  ```
- 3e 변경 전:
  ```
  export declare const CURRENT_SCHEMA_VERSION = 12;
  ```
  3e 변경 후:
  ```
  export declare const CURRENT_SCHEMA_VERSION = 13;
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "console.log(require('./lib/db/migrations').CURRENT_SCHEMA_VERSION, typeof require('./lib/db/migration-v13').applyDocumentGramsMigration)"`
- 기대 출력: `13 function`

### 단계 4: 2-gram 질의와 열 비중
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js`
- 위치: `require` 줄, `bm25` 호출, `toFtsQuery`
- 동작: replace
- 4a 변경 전:
  ```
  const search_tuning_1 = require("../search-tuning");
  ```
  4a 변경 후:
  ```
  const search_tuning_1 = require("../search-tuning");
  const hangul_grams_1 = require("./hangul-grams");
  ```
- 4b 변경 전:
  ```
  bm25(document_fts, ${(0, search_tuning_1.loadSearchTuning)().docsFtsWeights.join(', ')}) AS rank
  ```
  4b 변경 후:
  ```
  bm25(document_fts, ${[...(0, search_tuning_1.loadSearchTuning)().docsFtsWeights, (0, search_tuning_1.loadSearchTuning)().docsGramsWeight].join(', ')}) AS rank
  ```
- 4c 변경 전:
  ```
  function toFtsQuery(query) {
      const tokens = query.match(/[\p{L}\p{N}_./-]+/gu) ?? [];
      return [...new Set(tokens.map((token) => token.toLowerCase()))]
          .slice(0, 12)
          .map((token) => `"${token.replace(/"/g, '""')}"*`)
          .join(' OR ');
  }
  ```
  4c 변경 후:
  ```
  function toFtsQuery(query) {
      const tokens = query.match(/[\p{L}\p{N}_./-]+/gu) ?? [];
      const words = [...new Set(tokens.map((token) => token.toLowerCase()))]
          .slice(0, 12)
          .map((token) => `"${token.replace(/"/g, '""')}"*`);
      // 조사가 붙은 어절도 앞 두 음절이 겹치면 맞도록 음절 2-gram 열을 함께 찾음
      const grams = (0, hangul_grams_1.hangulBigrams)(query, 16).split(' ').filter(Boolean).map((gram) => `grams : "${gram}"`);
      return [...words, ...grams].join(' OR ');
  }
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js', encoding='utf-8').read(); print(s.count('hangul_grams_1'), s.count('docsGramsWeight'), s.count('grams : '))"`
- 기대 출력: `2 1 1`

### 단계 5: 임베딩 입력 정리와 조각 텍스트(D4, D5)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/parse.js` (5a~5d), `D:/Fork/KIT/tools/codegraph/source/lib/docs/document-parsers/shared.js` (5e)
- 위치: `parseDoc`, `splitCodeRefs` 앞, `finishDocument`
- 동작: replace
- 5a 변경 전:
  ```
      let title = null;
  ```
  5a 변경 후:
  ```
      let title = null;
      let embeddingHint = null;
  ```
- 5b 변경 전:
  ```
              if (tBody !== undefined)
                  title = tBody.trim().replace(/['"]/g, '');
  ```
  5b 변경 후:
  ```
              if (tBody !== undefined)
                  title = tBody.trim().replace(/['"]/g, '');
              embeddingHint = frontmatterHint(fm);
  ```
- 5c 변경 전:
  ```
      return { blk, title, summary, codeRefs: fmCodeRefs, docLinks: docLinks && docLinks.length > 0 ? docLinks : null };
  ```
  5c 변경 후:
  ```
      return { blk, title, summary, codeRefs: fmCodeRefs, docLinks: docLinks && docLinks.length > 0 ? docLinks : null, embeddingHint };
  ```
- 5d 변경 전:
  ```
  function splitCodeRefs(value) {
  ```
  5d 변경 후:
  ```
  // 볼트가 frontmatter 에 검색용 설명과 별칭을 따로 적어 두면 임베딩 입력 앞에 넣음
  function frontmatterHint(fm) {
      const parts = [];
      const text = fm.match(/^embedding_text:[ \t]*(\S.*)$/m)?.[1];
      if (text)
          parts.push(text.trim().replace(/^['"]|['"]$/g, ''));
      const inline = fm.match(/^search_aliases:[ \t]*\[(.*)\]/m)?.[1];
      const block = fm.match(/^search_aliases:[ \t]*\r?\n((?:[ \t]*-[ \t]*[^\r\n]+\r?\n?)*)/m)?.[1];
      const aliases = inline !== undefined
          ? inline.split(',')
          : (block ?? '').split(/\r?\n/).map((line) => line.replace(/^\s*-\s*/, ''));
      const cleaned = aliases.map((alias) => alias.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      if (cleaned.length > 0)
          parts.push(cleaned.join(', '));
      return parts.length > 0 ? parts.join('\n') : null;
  }
  function splitCodeRefs(value) {
  ```
- 5e 변경 전 (`shared.js`):
  ```
  function finishDocument(metadata, format, sections) {
      const highSignal = sections
          .filter((section) => section.text)
          .slice(0, 32)
          .map((section) => `${section.breadcrumb.join(' > ')}\n${section.title}\n${section.text}`.trim())
          .join('\n\n')
          .slice(0, 12_000);
      return {
          ...metadata,
          format,
          sections,
          embeddingText: `${metadata.title ?? ''}\n${metadata.summary}\n${highSignal}`.trim(),
      };
  }
  ```
  5e 변경 후:
  ```
  const CHUNK_CHARS = 900;
  const MAX_CHUNKS = 24;
  function finishDocument(metadata, format, sections) {
      const blocks = sections
          .filter((section) => section.text)
          .slice(0, 32)
          .map((section) => `${section.breadcrumb.join(' > ')}\n${section.title}\n${section.text}`.trim());
      const highSignal = blocks.join('\n\n').slice(0, 12_000);
      // 요약은 본문 앞부분이라 섹션이 있으면 같은 내용이 512토큰 안에 두 번 들어감
      const lead = highSignal || metadata.summary;
      return {
          ...metadata,
          format,
          sections,
          embeddingText: [metadata.title ?? '', metadata.embeddingHint ?? '', lead].filter(Boolean).join('\n').trim(),
          chunkTexts: chunkBlocks(metadata.title, blocks),
      };
  }
  // 모델은 앞 512토큰만 읽어서 긴 문서는 뒷부분을 조각으로 따로 임베딩함
  function chunkBlocks(title, blocks) {
      if (blocks.join('\n\n').length <= CHUNK_CHARS)
          return [];
      const chunks = [];
      let current = '';
      for (const block of blocks) {
          for (let offset = 0; offset < block.length; offset += CHUNK_CHARS) {
              const piece = block.slice(offset, offset + CHUNK_CHARS);
              if (current && current.length + piece.length > CHUNK_CHARS) {
                  chunks.push(current);
                  current = '';
              }
              current = current ? `${current}\n\n${piece}` : piece;
          }
      }
      if (current)
          chunks.push(current);
      const prefix = title ? `${title}\n` : '';
      return chunks.slice(0, MAX_CHUNKS).map((chunk) => prefix + chunk);
  }
  ```
- 검증: `python -c "p=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/parse.js', encoding='utf-8').read(); s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/document-parsers/shared.js', encoding='utf-8').read(); print(p.count('embeddingHint'), p.count('function frontmatterHint('), s.count('chunkBlocks('))"`
- 기대 출력: `3 1 2`

### 단계 6: 색인기(조각 표, 입력 형식 버전, 조각 임베딩)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`
- 위치: `exports`, `require`, FTS·벡터 표 함수, `indexMarkdown`, `publishPendingEmbeddings`, `recordDocumentFailure` 앞
- 동작: replace
- 6a 변경 전:
  ```
  exports.ensureDocumentFtsTable = ensureDocumentFtsTable;
  ```
  6a 변경 후:
  ```
  exports.ensureDocumentFtsTable = ensureDocumentFtsTable;
  exports.ensureChunkTables = ensureChunkTables;
  ```
- 6b 변경 전:
  ```
  const config_1 = require("./config");
  ```
  6b 변경 후:
  ```
  const config_1 = require("./config");
  const search_tuning_1 = require("../search-tuning");
  ```
- 6c 변경 전:
  ```
  function ensureDocumentFtsTable(db) {
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(file_path, title, summary, structure);`);
  }
  ```
  6c 변경 후:
  ```
  function ensureDocumentFtsTable(db) {
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(file_path, title, summary, structure, grams);`);
  }
  function ensureChunkTables(db) {
      db.exec(`
      CREATE TABLE IF NOT EXISTS mdast_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        ordinal INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mdast_chunks_document ON mdast_chunks(document_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS mdast_chunk_vectors USING vec0(embedding float[${config_1.EMBED_DIM}]);
    `);
  }
  ```
- 6d 변경 전:
  ```
      if (vectorAvailable)
          ensureVectorTable(db);
      const store = new document_store_1.DocumentStore(db, vectorAvailable);
  ```
  6d 변경 후:
  ```
      if (vectorAvailable) {
          ensureVectorTable(db);
          ensureChunkTables(db);
      }
      const store = new document_store_1.DocumentStore(db, vectorAvailable);
      const chunkVectors = (0, search_tuning_1.loadSearchTuning)().docsChunkVectors;
      const textVersion = `${EMBED_TEXT_VERSION}${chunkVectors ? '+chunks' : ''}`;
      // 임베딩 입력 형식이 바뀌면 같은 모델이라도 문서 벡터를 다시 만듦
      const textVersionCurrent = readTextVersion(db) === textVersion;
  ```
- 6e 변경 전:
  ```
          const vectorIsCurrent = !semanticAvailable || existing?.embedding_model === embed_1.EMBED_MODEL_ID;
  ```
  6e 변경 후:
  ```
          const vectorIsCurrent = !semanticAvailable || (existing?.embedding_model === embed_1.EMBED_MODEL_ID && textVersionCurrent);
  ```
- 6f 변경 전:
  ```
              && (!semanticAvailable || existing.embedding_model === embed_1.EMBED_MODEL_ID)) {
  ```
  6f 변경 후:
  ```
              && (!semanticAvailable || (existing.embedding_model === embed_1.EMBED_MODEL_ID && textVersionCurrent))) {
  ```
- 6g 변경 전:
  ```
                  pendingEmbeddings.push({ rowId: publishedRowId, text: parsed.embeddingText, filePath: relativePath });
  ```
  6g 변경 후:
  ```
                  pendingEmbeddings.push({ rowId: publishedRowId, text: parsed.embeddingText, filePath: relativePath });
                  if (chunkVectors)
                      parsed.chunkTexts.forEach((text, ordinal) => pendingEmbeddings.push({ rowId: publishedRowId, chunkOrdinal: ordinal, text, filePath: relativePath }));
  ```
- 6h 변경 전:
  ```
              pushWarn(result, opts, `${failure.filePath}: embedding batch unavailable: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
          }
      }
      persistDocumentFailures(db, result.errors);
  ```
  6h 변경 후:
  ```
              pushWarn(result, opts, `${failure.filePath}: embedding batch unavailable: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
          }
          else {
              writeTextVersion(db, textVersion);
          }
      }
      persistDocumentFailures(db, result.errors);
  ```
- 6i 변경 전 / 후 (두 줄을 각각 바꿈):
  ```
                  cached.push({ rowId: entry.item.rowId, vector });
  ```
  ```
                  cached.push({ rowId: entry.item.rowId, chunkOrdinal: entry.item.chunkOrdinal, vector });
  ```
  ```
              store.publishEmbeddings(batch.map((entry, index) => ({ rowId: entry.item.rowId, vector: vectors[index] })));
  ```
  ```
              store.publishEmbeddings(batch.map((entry, index) => ({ rowId: entry.item.rowId, chunkOrdinal: entry.item.chunkOrdinal, vector: vectors[index] })));
  ```
- 6j 변경 전:
  ```
  function recordDocumentFailure(result, opts, filePath, error) {
  ```
  6j 변경 후:
  ```
  const EMBED_TEXT_VERSION = '2';
  const TEXT_VERSION_KEY = 'docs_embedding_text_version';
  function readTextVersion(db) {
      try {
          return db.prepare('SELECT value FROM project_metadata WHERE key = ?').get(TEXT_VERSION_KEY)?.value ?? null;
      }
      catch {
          return null;
      }
  }
  function writeTextVersion(db, version) {
      db.prepare(`INSERT INTO project_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(TEXT_VERSION_KEY, version, Date.now());
  }
  function recordDocumentFailure(result, opts, filePath, error) {
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js', encoding='utf-8').read(); print(s.count('textVersionCurrent'), s.count('chunkOrdinal'), s.count('ensureChunkTables'), s.count('writeTextVersion('))"`
- 기대 출력: `3 5 4 2`

### 단계 7: 문서 저장소(2-gram 쓰기, 조각 벡터)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/document-store.js`
- 위치: `require`, 생성자, `removeDocuments`, `publish`, `publishEmbeddings`, `removeDocumentNodes` 앞
- 동작: replace
- 7a 변경 전:
  ```
  const vec_1 = require("./vec");
  ```
  7a 변경 후:
  ```
  const vec_1 = require("./vec");
  const hangul_grams_1 = require("./hangul-grams");
  ```
- 7b 변경 전:
  ```
          this.insertFts = db.prepare('INSERT INTO document_fts(rowid, file_path, title, summary, structure) VALUES (?, ?, ?, ?, ?)');
  ```
  7b 변경 후:
  ```
          this.insertFts = db.prepare('INSERT INTO document_fts(rowid, file_path, title, summary, structure, grams) VALUES (?, ?, ?, ?, ?, ?)');
  ```
- 7c 변경 전:
  ```
          this.markEmbedded = vectorAvailable ? db.prepare('UPDATE mdast_metadata SET embedding_model = ? WHERE id = ?') : null;
      }
  ```
  7c 변경 후:
  ```
          this.markEmbedded = vectorAvailable ? db.prepare('UPDATE mdast_metadata SET embedding_model = ? WHERE id = ?') : null;
          this.selectChunks = vectorAvailable ? db.prepare('SELECT id FROM mdast_chunks WHERE document_id = ?') : null;
          this.deleteChunkVector = vectorAvailable ? db.prepare('DELETE FROM mdast_chunk_vectors WHERE rowid = ?') : null;
          this.deleteChunks = vectorAvailable ? db.prepare('DELETE FROM mdast_chunks WHERE document_id = ?') : null;
          this.insertChunk = vectorAvailable ? db.prepare('INSERT INTO mdast_chunks(document_id, ordinal) VALUES (?, ?)') : null;
          this.insertChunkVector = vectorAvailable ? db.prepare('INSERT INTO mdast_chunk_vectors(rowid, embedding) VALUES (?, ?)') : null;
      }
  ```
- 7d 변경 전:
  ```
                  this.deleteVector?.run(rowId);
                  this.deleteFts.run(rowId);
  ```
  7d 변경 후:
  ```
                  this.deleteVector?.run(rowId);
                  this.removeChunks(rowId);
                  this.deleteFts.run(rowId);
  ```
- 7e 변경 전:
  ```
              this.insertFts.run(publishedRowId, input.filePath, input.parsed.title ?? '', input.parsed.summary, input.parsed.embeddingText.slice(0, 20_000));
              this.deleteVector?.run(publishedRowId);
  ```
  7e 변경 후:
  ```
              this.insertFts.run(publishedRowId, input.filePath, input.parsed.title ?? '', input.parsed.summary, input.parsed.embeddingText.slice(0, 20_000), (0, hangul_grams_1.hangulBigrams)(`${input.parsed.title ?? ''} ${input.parsed.summary} ${input.parsed.embeddingText}`));
              this.deleteVector?.run(publishedRowId);
              this.removeChunks(publishedRowId);
  ```
- 7f 변경 전:
  ```
              for (const item of items) {
                  this.insertVector.run(item.rowId, (0, vec_1.floatBlob)(item.vector));
  ```
  7f 변경 후:
  ```
              for (const item of items) {
                  if (item.chunkOrdinal !== undefined) {
                      const chunk = this.insertChunk.run(item.rowId, item.chunkOrdinal);
                      this.insertChunkVector.run(BigInt(chunk.lastInsertRowid), (0, vec_1.floatBlob)(item.vector));
                      continue;
                  }
                  this.insertVector.run(item.rowId, (0, vec_1.floatBlob)(item.vector));
  ```
- 7g 변경 전:
  ```
      removeDocumentNodes(filePath) {
  ```
  7g 변경 후:
  ```
      removeChunks(documentId) {
          if (!this.selectChunks)
              return;
          for (const chunk of this.selectChunks.all(documentId))
              this.deleteChunkVector.run(BigInt(chunk.id));
          this.deleteChunks.run(documentId);
      }
      removeDocumentNodes(filePath) {
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/document-store.js', encoding='utf-8').read(); print(s.count('this.removeChunks('), s.count('hangul_grams_1'), s.count('item.chunkOrdinal'))"`
- 기대 출력: `2 2 2`

### 단계 8: 검색이 조각 거리를 합침
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js`
- 위치: 벡터 결과 처리, `lexicalWeightFor` 앞
- 동작: replace
- 8a 변경 전:
  ```
      const ids = nearest.map((row) => Number(row.rowid));
      const distanceById = new Map(nearest.map((row) => [Number(row.rowid), Number(row.distance)]));
  ```
  8a 변경 후:
  ```
      const distanceById = new Map(nearest.map((row) => [Number(row.rowid), Number(row.distance)]));
      // 긴 문서는 뒷부분 조각 벡터가 더 가까울 수 있어 문서별 최소 거리로 합침
      for (const row of nearestChunks(db, queryVector, depth)) {
          const current = distanceById.get(row.id);
          if (current === undefined || row.distance < current)
              distanceById.set(row.id, row.distance);
      }
      const ids = [...distanceById.keys()].sort((left, right) => distanceById.get(left) - distanceById.get(right)).slice(0, depth);
  ```
- 8b 변경 전:
  ```
  function lexicalWeightFor(query, tuning) {
  ```
  8b 변경 후:
  ```
  function nearestChunks(db, queryVector, depth) {
      if (!(0, search_tuning_1.loadSearchTuning)().docsChunkVectors || !tableExists(db, 'mdast_chunk_vectors'))
          return [];
      try {
          return db.prepare(`
        WITH knn AS (SELECT rowid, distance FROM mdast_chunk_vectors WHERE embedding MATCH ? AND k = ${depth * 3})
        SELECT c.document_id AS id, MIN(knn.distance) AS distance FROM knn JOIN mdast_chunks c ON c.id = knn.rowid GROUP BY c.document_id
      `).all((0, vec_1.floatBlob)(queryVector)).map((row) => ({ id: Number(row.id), distance: Number(row.distance) }));
      }
      catch {
          return [];
      }
  }
  function lexicalWeightFor(query, tuning) {
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js', encoding='utf-8').read(); print(s.count('nearestChunks('), s.count('mdast_chunk_vectors'))"`
- 기대 출력: `2 2`

### 단계 9: 시험
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/docs-grams.test.cjs`
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
  const { DatabaseSync } = require('node:sqlite');

  process.env.CODEGRAPH_NO_WATCH = '1';
  const { hangulBigrams } = require('../lib/docs/hangul-grams');
  const { applyDocumentGramsMigration } = require('../lib/db/migration-v13');
  const { finishDocument } = require('../lib/docs/document-parsers/shared');
  const { parseDoc } = require('../lib/docs/parse');
  const { resetSearchTuning } = require('../lib/search-tuning');
  const { CodeGraph } = require('../lib/index');
  const { searchDocs } = require('../lib/docs/search');

  test('hangul runs become syllable bigrams', () => {
      assert.equal(hangulBigrams('검술을 배운다 sword'), '검술 술을 배운 운다');
      assert.equal(hangulBigrams('검술 검술'), '검술');
  });

  test('migration v13 adds a grams column to an existing document index', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE VIRTUAL TABLE document_fts USING fts5(file_path, title, summary, structure);
        INSERT INTO document_fts(rowid, file_path, title, summary, structure) VALUES (7, 'a.md', '검술', '검술을 익힘', '검술을 익힘');
      `);
      applyDocumentGramsMigration(db);
      const rows = db.prepare(`SELECT rowid AS rid FROM document_fts WHERE document_fts MATCH 'grams : "술을"'`).all();
      assert.deepEqual(rows.map((row) => Number(row.rid)), [7]);
      db.close();
  });

  test('embedding text drops the duplicated summary and carries frontmatter hints', () => {
      const parsed = parseDoc('---\ntitle: 검성\nembedding_text: 검의 성인을 부르는 칭호\nsearch_aliases: [검신, 劍聖]\n---\n# 검성\n\n본문 내용\n');
      assert.equal(parsed.embeddingHint, '검의 성인을 부르는 칭호\n검신, 劍聖');
      const document = finishDocument({ ...parsed }, 'markdown', [{ breadcrumb: [], title: '검성', text: '본문 내용' }]);
      assert.equal(document.embeddingText, '검성\n검의 성인을 부르는 칭호\n검신, 劍聖\n검성\n본문 내용');
      assert.deepEqual(document.chunkTexts, []);
  });

  test('long documents get title-prefixed chunks', () => {
      const document = finishDocument({ title: 'T', summary: 's' }, 'markdown', [{ breadcrumb: ['H'], title: 'S', text: 'a'.repeat(1500) }]);
      assert.equal(document.chunkTexts.length, 2);
      assert.ok(document.chunkTexts.every((chunk) => chunk.startsWith('T\n')));
  });

  test('a korean query with a particle finds the bare word through grams', async (context) => {
      const env = { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_DOCS_GRAMS_WEIGHT: '1' };
      for (const [key, value] of Object.entries(env))
          process.env[key] = value;
      resetSearchTuning();
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-grams-'));
      fs.writeFileSync(path.join(root, 'sword.md'), '# 검술\n\n검술 수련 기록\n');
      fs.writeFileSync(path.join(root, 'market.md'), '# 시장\n\n약재 거래\n');
      const graph = CodeGraph.initSync(root);
      context.after(() => {
          try { graph.close(); } catch { /* 이미 닫힘 */ }
          fs.rmSync(root, { recursive: true, force: true });
          for (const key of Object.keys(env))
              delete process.env[key];
          resetSearchTuning();
      });
      await graph.indexAll();
      const result = await searchDocs(graph.getDb(), '검술을', { topk: 3 });
      assert.equal(result.hits[0]?.file, 'sword.md');
  });
  ```
- 검증: `node --test D:/Fork/KIT/tools/codegraph/source/test/docs-grams.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs 2>&1 | tail -8`
- 기대 출력: `fail 0` 이 든 줄이 있음 (Node 24 spec 출력은 `ℹ fail 0`)

### 단계 10: 다시 임베딩한 측정, 그리고 배포(배포는 사용자 승인 필요)
- 10a 실행(문서 복사본 네 곳을 다시 임베딩함. 1시간 이상 걸릴 수 있어 백그라운드로 돌리고 끝나면 확인): `cd D:/Fork/.AI/context/search-eval && node run-c.cjs sweep > results-sweep-c.log 2>&1; echo exit=$?`
- 10a 판정:
  - `exit=0`: `search-tuning.json` 에 `docsGramsWeight`, `docsChunkVectors` 가 써짐. 10b 로 감.
  - `exit=2`: 안 C 가 기준선을 넘지 못함. `MODE=BLOCKED`, `CURRENT=멈춤 S10: plan C below baseline` 으로 쓰고 멈춤. 되돌릴지는 G2 에서 사람이 정함.
  - 그 밖: `MODE=BLOCKED`, `CURRENT=멈춤 S10: results-sweep-c.log 확인` 으로 쓰고 멈춤.
- 10a 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sweep-c.json', encoding='utf-8')); t=json.load(open(r'D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json', encoding='utf-8')); print(r['passed'], t['docsGramsWeight'] == r['chosenConfig']['docsGramsWeight'])"`
- 10a 기대 출력: `True True`
- 10b: 안 A 플랜 단계 10 과 같은 명령(10a, 10b, 10c)과 검증을 씀. 실행 전에 AskUserQuestion 으로 승인을 받고, 승인이 없으면 `CURRENT=S10b 승인 대기` 로 쓰고 멈춤.

## 수락 기준
```acceptance
{"id":"V1","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/docs-grams.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs","expect":"exit0"}
{"id":"V2","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs","expect":"exit0"}
{"id":"V3","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sweep-c.json');process.exit(r.passed===true?0:1)\"","expect":"exit0"}
{"id":"V4","kind":"human","how":"D:/Fork/.AI/context/search-eval/results/sweep-c.md 를 봄","expect":"모든 묶음의 report 행에서 선택 Hit@1 이 기준 Hit@1 이상이고 단발 ms 가 기준의 1.1배 이하임. 다시 임베딩 시간과 조각 수를 받아들일 수 있음"}
{"id":"V5","kind":"human","how":"10b 를 승인했다면 BLADE 에서 CODEGRAPH_NO_WATCH=1 codegraph sync D:/Fork/BLADE 를 한 번 돌린 뒤 codegraph docs 로 한국어 질의 하나를 부름","expect":"동기화가 끝나고 semanticState 가 ready 이며 결과가 나옴"}
```

## 하지 않는 것
- 임베딩 모델 교체(D7), 리랭커 변경(D8), 형태소 분석기 도입은 하지 않음.
- FTS5 trigram 토크나이저(D3c)와 질의 쪽 조사 떼기(D3a)는 하지 않음.
- 실제 그래프 다섯 곳의 재동기화는 이 플랜에서 하지 않음. 10b 배포 뒤 사용자가 시점을 정함(`references/DOC_GRAPH_POLICY.md` 6절).
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
