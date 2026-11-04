# 플랜: 안 B — 코드 심볼 임베딩(C3)과 코드 하이브리드 검색

## 목표
코드 심볼마다 "종류 + qualified name + 경로 + 시그니처 + docstring 앞부분" 벡터를 만들어 BM25 와 결합하고, 켠 경우가 끈 경우보다 Hit@1 이 높을 때만 기본값으로 켠다.

## 전제와 실행 규칙
- 선행 조건: 안 A(`main-2026-11-03-codegraph-search-a`)의 EXECUTE 가 끝나고 G2 를 통과했음. 이 플랜의 "변경 전" 원문 일부는 안 A 가 만든 코드임. 상태 파일 `main-2026-11-03-codegraph-search-a.state` 가 `STATUS=done` 이 아니면 시작하지 않고 `MODE=BLOCKED`, `CURRENT=멈춤 S0: 안 A 미완료` 로 씀.
- 근거: `main-2026-11-03-codegraph-structure-innovate.md` 3.4절 C3, 4절 안 B, 6절 사용자 결정. 라벨 뜻은 그 문서 `## 라벨`.
- 결합 방식: 키워드 `query` 는 BM25 순위와 벡터 순위를 RRF(상수 60)로 합침. 벡터 비중은 `codeVectorWeight`. 맥락 `context` 는 벡터 후보에 순위가 내려갈수록 줄어드는 점수 `codeVectorScore / (1 + 0.2 × 순위)` 를 더함.
- 기본값은 꺼짐(`codeVectors` 없음 = false). 8단계 측정이 이기면 `search-tuning.json` 에 `codeVectors: true` 를 씀.
- 벡터 표: `node_vectors`(vec0, float[384])와 `node_vector_map`(node_id, vec_rowid, text_hash, model). 노드 rowid 는 재색인마다 바뀌므로 노드 ID 로 잇고, 입력 텍스트 해시와 모델이 같으면 다시 계산하지 않음. 임베딩 캐시와 PC 전체 잠금은 문서 임베딩과 같은 것을 씀.
- 한 단계에 변경이 여럿이면 `a`, `b`, `c` 로 나눔. 실패하면 고치지 말고 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <원인>` 으로 씀.
- 코드 블록은 목록 안에 있어 모든 줄 앞에 2칸이 더 붙어 있음. 파일과 맞출 때와 파일에 쓸 때 각 줄 앞 2칸을 뺌. 그 뒤의 들여쓰기는 파일 원문 그대로임.
- 모든 명령은 Git Bash 에서 돌림.

## 바뀔 파일
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js`: `codeVectors`, `codeVectorWeight`, `codeVectorScore` 추가
- `D:/Fork/KIT/tools/codegraph/source/lib/search/code-vectors.js`: 새 파일. 벡터 동기화, 검색, 결합
- `D:/Fork/KIT/tools/codegraph/source/lib/index.js`: `searchNodesHybrid`, 색인·동기화 끝에서 벡터 갱신
- `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts`: `searchNodesHybrid` 선언
- `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js`: `query` 명령이 하이브리드 검색을 씀
- `D:/Fork/KIT/tools/codegraph/source/lib/context/index.js`: 맥락 검색에 벡터 채널
- `D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs`: 새 시험
- `D:/Fork/.AI/context/search-eval/run.cjs`: 도우미 내보내기, 키워드 측정이 하이브리드를 씀
- `D:/Fork/.AI/context/search-eval/run-b.cjs`: 새 파일. 안 B 측정
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`: 8단계 명령이 키를 더함
- 9단계(사용자 승인 뒤): 안 A 10단계와 같은 배포 파일

## 단계

### 단계 1: 조정값 키 추가
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js`
- 위치: `loadSearchTuning` 의 `cached` 객체 끝
- 동작: replace
- 변경 전:
  ```
          nameTokensWeight: number(process.env.CODEGRAPH_NAME_TOKENS_WEIGHT, base.nameTokensWeight, 10),
      };
  ```
- 변경 후:
  ```
          nameTokensWeight: number(process.env.CODEGRAPH_NAME_TOKENS_WEIGHT, base.nameTokensWeight, 10),
          codeVectors: flag(process.env.CODEGRAPH_CODE_VECTORS, base.codeVectors),
          codeVectorWeight: number(process.env.CODEGRAPH_CODE_VECTOR_WEIGHT, base.codeVectorWeight, 1),
          codeVectorScore: number(process.env.CODEGRAPH_CODE_VECTOR_SCORE, base.codeVectorScore, 20),
      };
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "const t=require('./lib/search-tuning').loadSearchTuning(); console.log(t.codeVectors, t.codeVectorWeight, t.codeVectorScore)"`
- 기대 출력: `false 1 20`

### 단계 2: 코드 벡터 모듈
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search/code-vectors.js`
- 위치: 새 파일
- 동작: create
- 변경 전:
  ```
  없음
  ```
- 변경 후:
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.CODE_VECTOR_KINDS = void 0;
  exports.symbolText = symbolText;
  exports.syncCodeVectors = syncCodeVectors;
  exports.searchCodeVectors = searchCodeVectors;
  exports.fuseNodeResults = fuseNodeResults;
  const os = require("os");
  const config_1 = require("../docs/config");
  const embed_1 = require("../docs/embed");
  const embed_cache_1 = require("../docs/embed-cache");
  const embed_lock_1 = require("../docs/embed-lock");
  const vec_1 = require("../docs/vec");
  const search_tuning_1 = require("../search-tuning");
  exports.CODE_VECTOR_KINDS = ['class', 'struct', 'interface', 'trait', 'protocol', 'enum', 'function', 'method', 'type_alias'];
  const BATCH_SIZE = 32;
  function symbolText(row) {
      const docstring = (row.docstring ?? '').replace(/\s+/g, ' ').slice(0, 300);
      return `${row.kind} ${row.qualified_name}\n${row.file_path}\n${row.signature ?? ''}\n${docstring}`.trim();
  }
  function tableExists(db, name) {
      try {
          return Boolean(db.prepare('SELECT 1 AS x FROM sqlite_master WHERE name = ? LIMIT 1').get(name));
      }
      catch {
          return false;
      }
  }
  function ensureTables(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS node_vector_map (
        node_id TEXT PRIMARY KEY,
        vec_rowid INTEGER NOT NULL UNIQUE,
        text_hash TEXT NOT NULL,
        model TEXT NOT NULL
      )`);
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS node_vectors USING vec0(embedding float[${config_1.EMBED_DIM}])`);
  }
  function inTransaction(db, work) {
      db.exec('BEGIN');
      try {
          work();
          db.exec('COMMIT');
      }
      catch (error) {
          db.exec('ROLLBACK');
          throw error;
      }
  }
  // 노드 rowid 는 재색인마다 바뀌어 노드 ID 로 벡터를 잇고, 입력 해시와 모델이 같으면 다시 계산하지 않음
  async function syncCodeVectors(db) {
      const summary = { enabled: false, total: 0, embedded: 0, removed: 0 };
      if (!(0, search_tuning_1.loadSearchTuning)().codeVectors)
          return summary;
      if (!(0, vec_1.loadVecExtension)(db) || !(await (0, embed_1.isEmbedAvailable)()))
          return summary;
      summary.enabled = true;
      ensureTables(db);
      const marks = exports.CODE_VECTOR_KINDS.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, kind, qualified_name, file_path, signature, docstring FROM nodes WHERE kind IN (${marks})`).all(...exports.CODE_VECTOR_KINDS);
      const wanted = new Map();
      for (const row of rows) {
          const text = embed_1.EMBED_PASSAGE_PREFIX + symbolText(row);
          wanted.set(row.id, { text, hash: (0, embed_cache_1.embedTextKey)(text) });
      }
      summary.total = wanted.size;
      const kept = new Set();
      const deleteVector = db.prepare('DELETE FROM node_vectors WHERE rowid = ?');
      const deleteMap = db.prepare('DELETE FROM node_vector_map WHERE node_id = ?');
      inTransaction(db, () => {
          for (const row of db.prepare('SELECT node_id, vec_rowid, text_hash, model FROM node_vector_map').all()) {
              const want = wanted.get(row.node_id);
              if (want && want.hash === row.text_hash && row.model === embed_1.EMBED_MODEL_ID) {
                  kept.add(row.node_id);
                  continue;
              }
              deleteVector.run(BigInt(row.vec_rowid));
              deleteMap.run(row.node_id);
              summary.removed++;
          }
      });
      const pending = [...wanted].filter(([id]) => !kept.has(id)).map(([id, value]) => ({ id, ...value }));
      if (pending.length === 0)
          return summary;
      let nextRowid = Number(db.prepare('SELECT COALESCE(MAX(vec_rowid), 0) AS n FROM node_vector_map').get().n) + 1;
      const insertVector = db.prepare('INSERT INTO node_vectors(rowid, embedding) VALUES (?, ?)');
      const insertMap = db.prepare('INSERT INTO node_vector_map(node_id, vec_rowid, text_hash, model) VALUES (?, ?, ?, ?)');
      const publish = (entries) => {
          inTransaction(db, () => {
              for (const entry of entries) {
                  insertVector.run(BigInt(nextRowid), (0, vec_1.floatBlob)(entry.vector));
                  insertMap.run(entry.id, nextRowid, entry.hash, embed_1.EMBED_MODEL_ID);
                  nextRowid++;
              }
          });
          summary.embedded += entries.length;
      };
      const cache = (0, embed_cache_1.openEmbedCache)();
      let lock = null;
      let previousPriority = null;
      try {
          let hits = new Map();
          try {
              hits = cache ? cache.get(embed_1.EMBED_MODEL_ID, pending.map((entry) => entry.hash)) : new Map();
          }
          catch {
              hits = new Map();
          }
          const cached = pending.filter((entry) => hits.has(entry.hash)).map((entry) => ({ ...entry, vector: hits.get(entry.hash) }));
          const misses = pending.filter((entry) => !hits.has(entry.hash));
          if (cached.length > 0)
              publish(cached);
          if (misses.length === 0)
              return summary;
          lock = await (0, embed_lock_1.acquireEmbedLock)({ dir: (0, embed_cache_1.cacheDirectory)() });
          try {
              previousPriority = os.getPriority();
              os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
          }
          catch {
              previousPriority = null;
          }
          const batches = [];
          for (let offset = 0; offset < misses.length; offset += BATCH_SIZE)
              batches.push(misses.slice(offset, offset + BATCH_SIZE));
          let index = 0;
          for await (const vectors of (0, embed_1.embedBatches)(batches.map((batch) => batch.map((entry) => entry.text)))) {
              const entries = batches[index++].map((entry, position) => ({ ...entry, vector: vectors[position] }));
              publish(entries);
              try {
                  cache?.put(embed_1.EMBED_MODEL_ID, entries.map((entry) => ({ key: entry.hash, vector: entry.vector })));
              }
              catch {
                  // 캐시 쓰기 실패는 색인을 막지 않음
              }
              lock.touch();
          }
          return summary;
      }
      finally {
          lock?.release();
          cache?.close();
          if (previousPriority !== null) {
              try {
                  os.setPriority(previousPriority);
              }
              catch {
                  // 우선순위 복원 실패는 무시함
              }
          }
      }
  }
  async function searchCodeVectors(db, query, k) {
      try {
          if (!(0, search_tuning_1.loadSearchTuning)().codeVectors || !query || !query.trim())
              return [];
          if (!tableExists(db, 'node_vector_map') || !(0, vec_1.loadVecExtension)(db))
              return [];
          if (!db.prepare('SELECT 1 AS x FROM node_vector_map WHERE model = ? LIMIT 1').get(embed_1.EMBED_MODEL_ID))
              return [];
          const vector = await (0, embed_1.embed)(embed_1.EMBED_QUERY_PREFIX + query.trim());
          const depth = Math.max(1, Math.floor(k));
          const rows = db.prepare(`
        WITH knn AS (SELECT rowid, distance FROM node_vectors WHERE embedding MATCH ? AND k = ${depth})
        SELECT m.node_id AS id FROM knn JOIN node_vector_map m ON m.vec_rowid = knn.rowid
        WHERE m.model = ? ORDER BY knn.distance
      `).all((0, vec_1.floatBlob)(vector), embed_1.EMBED_MODEL_ID);
          return rows.map((row) => row.id);
      }
      catch {
          return [];
      }
  }
  function fuseNodeResults(lexical, vectorIds, getNode, limit, kinds) {
      const weight = (0, search_tuning_1.loadSearchTuning)().codeVectorWeight;
      const ranked = new Map();
      lexical.forEach((result, index) => ranked.set(result.node.id, { node: result.node, score: 1 / (61 + index) }));
      vectorIds.forEach((id, index) => {
          const existing = ranked.get(id);
          if (existing) {
              existing.score += weight / (61 + index);
              return;
          }
          const node = getNode(id);
          if (!node || (kinds && kinds.length > 0 && !kinds.includes(node.kind)))
              return;
          ranked.set(id, { node, score: weight / (61 + index) });
      });
      return [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "const m=require('./lib/search/code-vectors'); console.log(m.CODE_VECTOR_KINDS.length, m.symbolText({kind:'class',qualified_name:'A::B',file_path:'a.cs',signature:null,docstring:null}).split('\n').length)"`
- 기대 출력: `9 2`

### 단계 3: 라이브러리 진입점과 색인·동기화 연결
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` (3a~3d), `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts` (3e)
- 위치: `require` 줄, `searchNodes`, `indexAll` 과 `sync` 의 파일 목록 갱신 직전
- 동작: replace
- 3a 변경 전:
  ```
  const governs_linker_1 = require("./docs/governs-linker");
  ```
  3a 변경 후:
  ```
  const governs_linker_1 = require("./docs/governs-linker");
  const code_vectors_1 = require("./search/code-vectors");
  ```
- 3b 변경 전:
  ```
      searchNodes(query, options) {
          return this.queries.searchNodes(query, options);
      }
  ```
  3b 변경 후:
  ```
      searchNodes(query, options) {
          return this.queries.searchNodes(query, options);
      }
      /**
       * Search nodes with BM25 and, when code vectors are enabled, fuse in vector neighbours.
       */
      async searchNodesHybrid(query, options = {}) {
          const limit = options.limit ?? 10;
          const depth = Math.max(limit * 2, 20);
          const vectorSearch = (0, code_vectors_1.searchCodeVectors)(this.db.getDb(), query, depth);
          const lexical = this.queries.searchNodes(query, { ...options, limit: depth });
          const vectorIds = await vectorSearch;
          if (vectorIds.length === 0)
              return lexical.slice(0, limit);
          return (0, code_vectors_1.fuseNodeResults)(lexical, vectorIds, (id) => this.queries.getNodeById(id), limit, options.kinds);
      }
  ```
- 3c 변경 전 (`indexAll` 안, 들여쓰기 20칸과 24칸):
  ```
                      try {
                          result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
  ```
  3c 변경 후:
  ```
                      try {
                          const codeVectors = await (0, code_vectors_1.syncCodeVectors)(this.db.getDb());
                          if (codeVectors.enabled)
                              result.codeVectors = codeVectors;
                      }
                      catch (error) {
                          result.errors.push({
                              message: `Code vector update failed: ${error instanceof Error ? error.message : String(error)}`,
                              severity: 'warning',
                              code: 'code_vectors',
                          });
                      }
                      try {
                          result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
  ```
- 3d 변경 전 (`sync` 안, 들여쓰기 16칸과 20칸):
  ```
                  try {
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
  ```
  3d 변경 후:
  ```
                  try {
                      const codeVectors = await (0, code_vectors_1.syncCodeVectors)(this.db.getDb());
                      if (codeVectors.enabled)
                          result.codeVectors = codeVectors;
                  }
                  catch (error) {
                      result.warnings = [...(result.warnings ?? []),
                          `Code vector update failed: ${error instanceof Error ? error.message : String(error)}`];
                  }
                  try {
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
  ```
- 3e (`index.d.ts`) 변경 전:
  ```
      searchNodes(query: string, options?: SearchOptions): SearchResult[];
  ```
  3e 변경 후:
  ```
      searchNodes(query: string, options?: SearchOptions): SearchResult[];
      /**
       * Search nodes with BM25 and, when code vectors are enabled, fuse in vector neighbours.
       */
      searchNodesHybrid(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/index.js', encoding='utf-8').read(); print(s.count('code_vectors_1.syncCodeVectors'), s.count('async searchNodesHybrid('), s.count('code_vectors_1 = require'))"`
- 기대 출력: `2 1 1`

### 단계 4: `query` 명령이 하이브리드 검색을 씀
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js`
- 위치: `query` 명령의 `rawResults`
- 동작: replace
- 변경 전:
  ```
                  const rawResults = cg.searchNodes(search, {
  ```
- 변경 후:
  ```
                  const rawResults = await cg.searchNodesHybrid(search, {
  ```
- 검증: `python -c "print(open(r'D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js', encoding='utf-8').read().count('await cg.searchNodesHybrid(search, {'))"`
- 기대 출력: `1`

### 단계 5: 맥락 검색의 벡터 채널
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/context/index.js`
- 위치: `require` 줄, `findRelevantContext` 의 1단계, 최종 정렬 직전
- 동작: replace
- 5a 변경 전:
  ```
  const query_utils_1 = require("../search/query-utils");
  ```
  5a 변경 후:
  ```
  const query_utils_1 = require("../search/query-utils");
  const code_vectors_1 = require("../search/code-vectors");
  const search_tuning_1 = require("../search-tuning");
  ```
- 5b 변경 전:
  ```
          const symbolsFromQuery = extractSymbolsFromQuery(query);
  ```
  5b 변경 후:
  ```
          const symbolsFromQuery = extractSymbolsFromQuery(query);
          // 모델 로딩과 질의 임베딩이 아래 어휘 단계와 겹치도록 먼저 시작함
          const vectorSearch = (0, code_vectors_1.searchCodeVectors)(this.queries.db, query, opts.searchLimit);
  ```
- 5c 변경 전:
  ```
          // Final sort and truncation — all search channels (exact, text, CamelCase,
  ```
  5c 변경 후:
  ```
          const vectorScore = (0, search_tuning_1.loadSearchTuning)().codeVectorScore;
          (await vectorSearch).forEach((nodeId, rank) => {
              const bonus = vectorScore / (1 + rank * 0.2);
              const existing = searchResults.find((r) => r.node.id === nodeId);
              if (existing) {
                  existing.score += bonus;
                  return;
              }
              const node = this.queries.getNodeById(nodeId);
              if (node && !((0, query_utils_1.isTestFile)(node.filePath) && !isTestQuery))
                  searchResults.push({ node, score: bonus });
          });
          // Final sort and truncation — all search channels (exact, text, CamelCase,
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/context/index.js', encoding='utf-8').read(); print(s.count('code_vectors_1.searchCodeVectors'), s.count('(await vectorSearch)'))"`
- 기대 출력: `1 1`

### 단계 6: 시험
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs`
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

  process.env.CODEGRAPH_NO_WATCH = '1';
  const { symbolText, fuseNodeResults, syncCodeVectors, searchCodeVectors } = require('../lib/search/code-vectors');
  const { resetSearchTuning } = require('../lib/search-tuning');
  const { CodeGraph } = require('../lib/index');

  function withEnv(context, values) {
      for (const [key, value] of Object.entries(values))
          process.env[key] = value;
      resetSearchTuning();
      context.after(() => {
          for (const key of Object.keys(values))
              delete process.env[key];
          resetSearchTuning();
      });
  }

  test('symbol text carries kind, qualified name, path and signature', () => {
      const text = symbolText({ kind: 'method', qualified_name: 'Loadout::Rebuild', file_path: 'a/Loadout.cs', signature: 'void Rebuild()', docstring: '  rebuilds\n slots ' });
      assert.equal(text, 'method Loadout::Rebuild\na/Loadout.cs\nvoid Rebuild()\nrebuilds slots');
  });

  test('vector neighbours join the lexical ranking', (context) => {
      withEnv(context, { CODEGRAPH_CODE_VECTOR_WEIGHT: '1' });
      const node = (id, kind = 'class') => ({ id, kind, name: id });
      const lexical = [{ node: node('a'), score: 9 }, { node: node('b'), score: 5 }];
      const nodes = { b: node('b'), c: node('c'), d: node('d', 'field') };
      const fused = fuseNodeResults(lexical, ['b', 'c', 'd'], (id) => nodes[id], 3, ['class']);
      assert.deepEqual(fused.map((r) => r.node.id), ['b', 'a', 'c']);
  });

  test('code vectors stay off unless enabled', async (context) => {
      withEnv(context, { CODEGRAPH_CODE_VECTORS: '0' });
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-vectors-'));
      fs.writeFileSync(path.join(root, 'Hit.cs'), 'public class DamageHitJob { public void Run() {} }\n');
      const graph = CodeGraph.initSync(root);
      context.after(() => {
          try { graph.close(); } catch { /* 이미 닫힘 */ }
          fs.rmSync(root, { recursive: true, force: true });
      });
      assert.equal((await graph.indexAll()).success, true);
      assert.equal((await syncCodeVectors(graph.getDb())).enabled, false);
      assert.deepEqual(await searchCodeVectors(graph.getDb(), 'damage', 5), []);
      const hybrid = await graph.searchNodesHybrid('DamageHitJob', { limit: 3 });
      assert.equal(hybrid[0].node.name, 'DamageHitJob');
  });
  ```
- 검증: `node --test D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/cli.test.cjs 2>&1 | tail -8`
- 기대 출력: `fail 0` 이 든 줄이 있음 (Node 24 spec 출력은 `ℹ fail 0`)

### 단계 7: 측정 도구 확장
- 파일: `D:/Fork/.AI/context/search-eval/run.cjs` (7a, 7b), `D:/Fork/.AI/context/search-eval/run-b.cjs` (7c)
- 위치: `codeOnce` 의 키워드 검색 줄, 파일 끝 실행 줄, 새 파일
- 동작: replace (7a, 7b), create (7c)
- 7a 변경 전:
  ```
              const found = cg.searchNodes(item.kw, { limit: 10 }).map((result) => result.node);
  ```
  7a 변경 후:
  ```
              const found = (cg.searchNodesHybrid ? await cg.searchNodesHybrid(item.kw, { limit: 10 }) : cg.searchNodes(item.kw, { limit: 10 })).map((result) => result.node);
  ```
- 7b 변경 전:
  ```
  main().catch((error) => {
      console.error(error.stack || String(error));
      process.exit(1);
  });
  ```
  7b 변경 후:
  ```
  if (require.main === module) {
      main().catch((error) => {
          console.error(error.stack || String(error));
          process.exit(1);
      });
  }
  module.exports = { KIT_SOURCE, CLI, ENV, TUNING_FILE, RESULTS, CODE_SETS, copyIndex, round, pick, codeScore, codeKeepsHit5 };
  ```
- 7c 변경 후 (`run-b.cjs`):
  ```js
  // 사용: node run-b.cjs
  // 안 B: 복사본에 코드 심볼 벡터를 만들고, 벡터를 켠 코드 검색을 끈 경우와 비교해 search-tuning.json 에 씀
  'use strict';
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const run = require('./run.cjs');

  const GRID = [];
  for (const weight of [0.5, 1, 2])
      for (const score of [10, 20, 40])
          GRID.push({ codeVectorWeight: weight, codeVectorScore: score });

  function configEnv(config) {
      if (!config)
          return { ...run.ENV, CODEGRAPH_CODE_VECTORS: '0' };
      return { ...run.ENV, CODEGRAPH_CODE_VECTORS: '1', CODEGRAPH_CODE_VECTOR_WEIGHT: String(config.codeVectorWeight), CODEGRAPH_CODE_VECTOR_SCORE: String(config.codeVectorScore) };
  }
  function spawnJson(args, env) {
      const out = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 1 << 26 });
      if (out.status !== 0)
          throw new Error(`${args.join(' ')} failed: ${out.stderr.slice(0, 400)}`);
      return JSON.parse(out.stdout.trim().split(/\r?\n/).pop());
  }
  function measure(copies, config) {
      const out = {};
      for (const set of run.CODE_SETS)
          out[set.name] = spawnJson([path.join(__dirname, 'run.cjs'), 'code-once', set.name, copies[set.root]], configEnv(config));
      return out;
  }
  function cliMs(root, args, env) {
      const times = [];
      for (let attempt = 0; attempt < 3; attempt++) {
          const started = Date.now();
          const out = spawnSync(process.execPath, [run.CLI, ...args, '-p', root, '--no-sync'], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
          if (out.status !== 0)
              throw new Error(`${args[0]} failed: ${out.stderr.slice(0, 400)}`);
          times.push(Date.now() - started);
      }
      return times.sort((a, b) => a - b)[1];
  }
  function timings(copies, config) {
      const out = {};
      for (const set of run.CODE_SETS) {
          const root = copies[set.root];
          out[set.name] = {
              queryMs: cliMs(root, ['query', 'damage', '-l', '10'], configEnv(config)),
              contextMs: cliMs(root, ['context', 'damage calculation on hit', '-f', 'json'], configEnv(config)),
          };
      }
      return out;
  }
  async function buildOnce(root) {
      const { CodeGraph } = require(path.join(run.KIT_SOURCE, 'lib/index.js'));
      const { syncCodeVectors } = require(path.join(run.KIT_SOURCE, 'lib/search/code-vectors.js'));
      const cg = await CodeGraph.open(root);
      try {
          const started = Date.now();
          const summary = await syncCodeVectors(cg.getDb());
          console.log(JSON.stringify({ ...summary, ms: Date.now() - started }));
      }
      finally {
          cg.destroy();
      }
  }
  function table(off, chosen, offTimes, chosenTimes, builds, picked) {
      const lines = ['# search-eval 안 B', '', `- 실행: ${new Date().toISOString()}`, `- 선택: ${JSON.stringify(picked.winner ? picked.winner.config : null)} (${picked.reason})`, '',
          '| 묶음 | 구분 | 끔 kw Hit@1 | 켬 kw Hit@1 | 끔 nl Hit@1 | 켬 nl Hit@1 | 끔 kw Hit@5 | 켬 kw Hit@5 | 끔 nl Hit@5 | 켬 nl Hit@5 |', '|---|---|---|---|---|---|---|---|---|---|'];
      for (const set of run.CODE_SETS) {
          const a = off[set.name];
          const b = chosen[set.name];
          for (const split of ['tune', 'report'])
              lines.push(`| ${set.name} | ${split} | ${a.kw[split].hit1} | ${b.kw[split].hit1} | ${a.nl[split].hit1} | ${b.nl[split].hit1} | ${a.kw[split].hit5} | ${b.kw[split].hit5} | ${a.nl[split].hit5} | ${b.nl[split].hit5} |`);
      }
      lines.push('', '| 묶음 | 벡터 수 | 첫 임베딩 ms | 끔 query ms | 켬 query ms | 끔 context ms | 켬 context ms |', '|---|---|---|---|---|---|---|');
      for (const set of run.CODE_SETS)
          lines.push(`| ${set.name} | ${builds[set.name].total} | ${builds[set.name].ms} | ${offTimes[set.name].queryMs} | ${chosenTimes[set.name].queryMs} | ${offTimes[set.name].contextMs} | ${chosenTimes[set.name].contextMs} |`);
      return lines.join('\n') + '\n';
  }
  async function main() {
      const [mode, root] = process.argv.slice(2);
      if (mode === 'build')
          return buildOnce(root);
      const copies = run.copyIndex('sweep-b');
      const off = measure(copies, null);
      const offTimes = timings(copies, null);
      const builds = {};
      for (const set of run.CODE_SETS)
          builds[set.name] = spawnJson([__filename, 'build', copies[set.root]], configEnv(GRID[4]));
      const candidates = GRID.map((config) => ({ config, result: measure(copies, config) }));
      const picked = run.pick(candidates, off, run.codeScore, run.codeKeepsHit5);
      const chosenConfig = picked.winner ? picked.winner.config : GRID[4];
      const chosen = picked.winner ? picked.winner.result : candidates[4].result;
      const chosenTimes = timings(copies, chosenConfig);
      fs.rmSync(path.join(__dirname, 'work', 'sweep-b'), { recursive: true, force: true });
      fs.writeFileSync(path.join(run.RESULTS, 'sweep-b.json'), JSON.stringify({ passed: picked.passed, off, offTimes, builds, candidates, chosenConfig, chosenTimes }, null, 2));
      fs.writeFileSync(path.join(run.RESULTS, 'sweep-b.md'), table(off, chosen, offTimes, chosenTimes, builds, picked));
      // 이기지 못하면 꺼 둔 채로 둠. 실패가 아니라 측정 결과임
      const tuning = JSON.parse(fs.readFileSync(run.TUNING_FILE, 'utf8'));
      tuning.codeVectors = picked.passed === true;
      if (picked.passed) {
          tuning.codeVectorWeight = chosenConfig.codeVectorWeight;
          tuning.codeVectorScore = chosenConfig.codeVectorScore;
      }
      fs.writeFileSync(run.TUNING_FILE, JSON.stringify(tuning, null, 2) + '\n');
      console.log(`codeVectors=${tuning.codeVectors}`);
  }
  main().catch((error) => {
      console.error(error.stack || String(error));
      process.exit(1);
  });
  ```
- 검증: `cd D:/Fork/.AI/context/search-eval && node -e "const r=require('./run.cjs'); console.log(typeof r.pick, typeof r.copyIndex, r.CODE_SETS.length)"`
- 기대 출력: `function function 2`

### 단계 8: 안 B 측정과 기본값 기록
- 파일: `D:/Fork/.AI/context/search-eval/results/sweep-b.json`, `sweep-b.md`, `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`(명령이 키를 더함)
- 위치: 명령 실행
- 동작: 실행
- 실행(Arcyn 심볼 첫 임베딩 때문에 수십 분 걸릴 수 있음. 백그라운드로 돌리고 끝나면 확인): `cd D:/Fork/.AI/context/search-eval && node run-b.cjs > results-sweep-b.log 2>&1; echo exit=$?`
- 판정: `exit=0` 이면 다음 단계로 감. 그 밖이면 `MODE=BLOCKED`, `CURRENT=멈춤 S8: results-sweep-b.log 확인` 으로 쓰고 멈춤. `codeVectors=false` 도 정상 종료임(벡터가 이기지 못한 측정 결과).
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sweep-b.json', encoding='utf-8')); t=json.load(open(r'D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json', encoding='utf-8')); print(t['codeVectors'] == (r['passed'] is True))"`
- 기대 출력: `True`

### 단계 9: 빌드, 전역 설치, 이 저장소 맞추기(사용자 승인 필요)
- 안 A 플랜 단계 10 과 같은 명령(10a, 10b, 10c)과 검증을 그대로 씀. 실행 전에 AskUserQuestion 으로 승인을 받고, 승인이 없으면 `CURRENT=S9 승인 대기` 로 쓰고 멈춤.

## 수락 기준
```acceptance
{"id":"V1","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/code-vectors.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs","expect":"exit0"}
{"id":"V2","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/cli.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs","expect":"exit0"}
{"id":"V3","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sweep-b.json');const t=require('D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json');process.exit(t.codeVectors===(r.passed===true)?0:1)\"","expect":"exit0"}
{"id":"V4","kind":"human","how":"D:/Fork/.AI/context/search-eval/results/sweep-b.md 를 봄","expect":"켠 경우를 고른 때는 report 행 Hit@1 이 끈 경우 이상이고, 켬 query/context ms 증가(모델 로딩 약 1초)를 받아들일 수 있음. 받아들일 수 없으면 G2 에서 codeVectors 를 false 로 되돌리게 반려함"}
{"id":"V5","kind":"human","how":"단계 9 를 승인했다면 실제 Arcyn 에서 codegraph sync 뒤 codegraph context 를 한 번 부름","expect":"감시 데몬 또는 sync 가 심볼 벡터를 만들고 context 가 오류 없이 끝남"}
```

## 하지 않는 것
- 코드 전용 임베딩 모델 도입, 벡터 양자화(int8), 파일 단위 벡터(C4)는 하지 않음.
- 문서 검색 경로는 바꾸지 않음.
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
