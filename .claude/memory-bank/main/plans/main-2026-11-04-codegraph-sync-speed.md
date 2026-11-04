# 플랜: 묶음 1 — 바뀐 것 없는 sync 줄이기(R2 R3 R4 R5)와 getDominantFile 저장(K1)

## 목표
바뀐 것 없는 sync 가 소스 아닌 파일을 열거나 실제 경로를 풀지 않게 하고 context 가 부를 때마다 그래프 전체를 집계하지 않게 해서, 신선도 기준(크기·수정 시각)은 코드 쪽과 같게 둔 채 query·context 의 sync 포함 시간을 줄인다.

## 전제와 실행 규칙
- 근거 문서: `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-research.md`, `...-innovate.md` 5, 9, 10, 12절. 라벨(R2~R5, K1, W1~W6)의 뜻은 innovate 끝 `## 라벨` 에 있음. 이 플랜은 묶음 1 만 다룸. 묶음 2 는 `main-2026-11-04-codegraph-sync-speed-2.md` 이고 이 플랜의 G2 뒤에 시작함.
- 고치는 소스는 KIT(`D:/Fork/KIT/tools/codegraph/source`)임. 이 저장소(`D:/Fork/codegraph`)는 10단계에서만 바뀜.
- 변경 전 원문은 이 저장소의 `source/` 에서 그대로 베꼈음. 그 소스의 지문(`manifest.json` 의 `sourceTreeSha256` = `122d32cc…`)은 설치본 `1.1.2-8e92ff564f22` 와 같음. 2단계 `check` 가 KIT source 가 이 소스와 바이트까지 같은지 확인함.
- PLAN 세션이 3~8단계를 리눅스 사본에 그대로 적용해 Node 22.23 과 24.16 에서 시험 파일 19개가 모두 통과함을 확인했음. 새 시험 6건은 바꾸기 전 소스에서 6건 모두 실패함. 8단계 `verify` 가 바꾼 KIT source 가 그 사본과 바이트까지 같은지 확인함(지문 `6a94b298…`).
- 측정 도구는 `D:/Fork/.AI/context/search-eval/` 에 둠(안 A 와 같은 곳).
- 한 단계에 변경이 여럿이면 a, b, c 로 나눔. 모든 변경은 replace 임. "변경 전" 원문을 찾아 "변경 후" 로 바꿈. 원문은 그 파일 안에서 한 번만 나옴. 같은 파일의 변경은 적힌 순서대로 함. 위치의 줄 번호는 그 변경 직전 파일 기준의 참고값임.
- 코드 블록은 목록 안에 있어 모든 줄 앞에 2칸이 더 붙어 있음. 파일과 맞출 때와 파일에 쓸 때 각 줄 앞 2칸을 뺌. 그 뒤의 들여쓰기는 파일 원문 그대로임. 줄 끝은 LF 임.
- 단계 순서를 지킴. 2단계(기준선 측정)는 3~8단계보다 먼저 해야 함. 기준선은 바꾸기 전 소스로 재야 함.
- 모든 명령은 Git Bash 에서 돌림(10a~10c 만 PowerShell 도구). `node` 는 PATH 의 v24, `python` 은 PATH 의 Python 3 임.
- 측정은 실제 프로젝트 다섯 곳(Arcyn, RX_1, BLADE, Zyxel, 원자그래프)의 색인에 sync 를 함. 프로젝트 파일은 바뀌지 않음. 바꾼 뒤 측정은 색인에 `dominant_file` 저장값을 만들고, 파일 목록 표와 문서 색인에서 `.codegraph/` 아래 항목을 지움(R5). 측정하는 동안 그 폴더들의 파일을 고치지 않음.
- 단계가 실패하면 고치려 하지 말고 멈춤. 상태 파일 `.claude/memory-bank/main/riper/main-2026-11-04-codegraph-sync-speed.state` 에 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <한 줄 원인>` 으로 씀.

## 설계 메모 (G1 검토용)
- R2 판별기 `createDocumentClassifier(db, projectRoot)`: sync 시작 때 `file_inventory` 의 경로, 크기, 수정 시각, MIME, 어댑터를 읽음. 지금 크기·수정 시각이 저장값과 같으면 파일을 열지도 실제 경로를 풀지도 않고 저장된 판별을 씀. 다시 쓰는 판별은 (가) 문서(`document.<형식>`, 판 `1`)이면서 형식이 지금 확장자와 맞는 것, (나) 바이너리(`application/octet-stream`)이면서 확장자가 문서 형식(.md, .json 등)이 아닌 것. 문서 확장자의 바이너리 판별은 읽기 실패(잠금 등)로 생겼을 수 있어 매번 다시 판별함(메모의 설계에서 좁힌 부분). 그 밖에는 지금처럼 실제 경로 확인 뒤 내용으로 판별함. 경로별 결과는 판별기 안에서 한 번만 정해, 문서 스캔과 파일 목록 갱신이 같은 결과를 씀. `sync` 만 판별기를 씀. `indexAll` 은 지금처럼 모두 판별함.
- R3: `listTextDocumentFiles` 는 실제 경로 확인을 비밀 경로, 소스 파일 거르기 뒤로 옮김(소스 파일은 실제 경로를 풀지 않음). `gitVisibleFiles` 는 무시 규칙에 걸리는 경로를 `statSync` 전에 거름. 결과 목록은 지금과 같음. 코드 추출 walk 와 문서 walk 는 합치지 않음(서브모듈, 심볼릭 링크 처리가 달라 색인 파일 집합이 바뀜).
- R4: `classifyTextDocument` 첫 줄에서 바이너리 확장자(이미지, 소리, 영상, 글꼴, 압축, 실행 파일, 오피스, fbx, blend)는 열지 않고 문서 아님으로 판별함. obj, dae, svg, ma, bytes 는 텍스트일 수 있어 뺌.
- R5: `gitVisibleFiles` 가 `.git`, `.codegraph` 아래 경로를 뺌. `walkVisibleFiles`, 코드 추출 walk, 감시기는 이미 빼고 있음. 지금은 루트 `.gitignore` 가 `.codegraph/` 를 무시하지 않는 프로젝트에서 sync 중의 `.codegraph/codegraph.lock` 이 문서로 색인되고, CLI 는 PID 가 매번 달라 sync 마다 다시 색인함(임베딩이 켜져 있으면 모델도 읽음).
- K1: `getDominantFile` 을 계산부 `computeDominantFile` 과 읽기부로 나눔. 간선 지문 `COUNT(*):MAX(rowid)` 가 저장값(`project_metadata` 의 `dominant_file`)과 같으면 저장값을 쓰고, 다르면 계산만 하고 저장하지 않음(읽기 경로는 쓰지 않음). `edges.id` 가 AUTOINCREMENT 라 간선을 지우거나 더하면 지문이 바뀜. 저장은 `refreshDominantFile` 이 함. 부르는 곳은 `indexAll` 끝(성공 때), 그리고 `refreshDominant` 를 받은 `sync`(context 명령의 sync, 감시기의 sync)임. query 등 다른 명령의 sync 는 계산하지 않음(사용자 결정, innovate 12절).
- 바뀌는 동작:
  1. 텍스트 내용인데 확장자가 바이너리 목록에 있는 파일은 문서가 아니게 됨. 메모의 다섯 프로젝트 확인으로는 해당 파일이 없음. 9단계 측정 표의 "바이너리 확장자로 빠진 문서" 열이 이를 셈.
  2. `.codegraph/`, `.git/` 아래 파일이 파일 목록 표와 문서 색인에서 빠짐(R5).
  3. 크기와 수정 시각을 그대로 둔 채 내용만 바뀐 소스 아닌 파일은 다음 전체 색인(`index`)까지 판별이 그대로임. 코드 쪽과 같은 기준임.
  4. 코드가 바뀐 뒤 `--no-sync` 로 부른 context 는 지금처럼 계산만 함. context 명령이 sync 하거나 감시기가 맞춘 뒤에는 저장값을 씀.

## 바뀔 파일
- `D:/Fork/.AI/context/search-eval/sync-speed.cjs`: 새 파일. 원본 확인, 기준선, 바꾼 뒤 측정과 판별 대조
- `D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json`, `sync-speed-after.json`, `sync-speed.json`, `sync-speed.md`: 측정 결과(실행이 만듦)
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`, `scan-files.d.ts`: R3, R4, R5, 판별기 인자
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`, `classifier.d.ts`: R2 판별기
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`, `index.d.ts`: 판별기 전달
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`, `indexer.d.ts`: 판별기 전달
- `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js`, `queries.d.ts`: K1
- `D:/Fork/KIT/tools/codegraph/source/lib/index.js`, `index.d.ts`: sync 연결, `refreshDominant`
- `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js`: `syncForRead` 셋째 인자
- `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js`: context 명령의 sync 가 `refreshDominant`
- `D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs`: 새 시험
- 10단계(사용자 승인 뒤): KIT 배포 zip, `manifest.json`, 전역 설치본, 이 저장소의 `source/`, `grammars/`, `artifacts/`, `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`

## 단계

### 단계 1: 측정 도구
- 파일: `D:/Fork/.AI/context/search-eval/sync-speed.cjs`
- 위치: 새 파일
- 동작: create
- 변경 전:
  ```
  없음
  ```
- 변경 후:
  ```js
  // 사용: node sync-speed.cjs check | baseline | verify | after
  // check    : KIT source 가 플랜이 변경 전 원문을 베낀 소스(sourceTreeSha256)와 같은지 확인함. 다르면 종료 코드 5
  // verify   : 바꾼 KIT source 가 플랜을 시험한 사본과 바이트까지 같은지 확인함. 다르면 종료 코드 5
  // baseline : 바꾸기 전 KIT 소스 CLI 로 프로젝트마다 query(sync 포함)와 Arcyn context 를 재고 파일 목록 표를 떠 둠
  // after    : 바꾼 뒤 같은 측정을 하고, 저장된 판별을 지금 소스로 새로 판별한 값과 기준선에 견줌
  //            results/sync-speed.json 의 passed 가 true 면 종료 코드 0, 판별이 다르면 3, 명령이 새로 실패하면 4
  'use strict';
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const { spawnSync } = require('node:child_process');
  const { DatabaseSync } = require('node:sqlite');

  const HERE = __dirname;
  const KIT_SOURCE = process.env.SYNC_SPEED_KIT_SOURCE || 'D:/Fork/KIT/tools/codegraph/source';
  const CLI = path.join(KIT_SOURCE, 'lib/bin/codegraph.js');
  const RESULTS = process.env.SYNC_SPEED_RESULTS || path.join(HERE, 'results');
  const EXPECTED_SOURCE_DIGEST = '122d32cc87b51958633f78052c982b3f989a2bdcae2aa97559f96b4e7738b72c';
  const EXPECTED_AFTER_DIGEST = '6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3';
  const PROJECTS = process.env.SYNC_SPEED_PROJECTS ? JSON.parse(process.env.SYNC_SPEED_PROJECTS) : [
      { key: 'arcyn', root: 'D:/Fork/Arcyn', query: 'DamageHitJob', context: 'inventory grid layout' },
      { key: 'rx1', root: 'D:/Fork/RX_1', query: 'CostMapBuilder' },
      { key: 'blade', root: 'D:/Fork/BLADE', query: 'BLADE' },
      { key: 'zyxel', root: 'D:/Fork/.AI/guide/Zyxel-official/graph', query: 'Zyxel' },
      { key: 'atom', root: 'D:/Fork/.AI/위탁과제_원자그래프', query: 'atom' },
  ];
  const RUNS = 3;

  function sourceDigest(root) {
      const skip = new Set(['node_modules', '.git', '.cache', '.codegraph', '.serena']);
      const records = [];
      const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                  if (!skip.has(entry.name))
                      walk(full);
              }
              else if (entry.isFile()) {
                  const bytes = fs.readFileSync(full);
                  records.push([path.relative(root, full).split(path.sep).join('/'), crypto.createHash('sha256').update(bytes).digest('hex'), bytes.length]);
              }
          }
      };
      walk(root);
      records.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return crypto.createHash('sha256').update(records.map((record) => `${JSON.stringify(record)}\n`).join(''), 'utf8').digest('hex');
  }

  // 설치본과 같은 모델로 재려고 전역 shim 이 가리키는 설치 폴더의 모델을 씀. 못 찾으면 소스 기본값을 씀
  function modelRoot() {
      if (process.env.CODEGRAPH_MODEL_ROOT)
          return process.env.CODEGRAPH_MODEL_ROOT;
      try {
          const shim = fs.readFileSync(path.join(os.homedir(), '.local/bin/codegraph.cmd'), 'utf8');
          const version = shim.match(/[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}/)?.[0];
          const root = version && path.join(os.homedir(), '.local/share/team-tech-support-harness/codegraph', version, 'win32-x64/lib/models');
          return root && fs.existsSync(root) ? root.split(path.sep).join('/') : null;
      }
      catch {
          return null;
      }
  }

  function median(values) {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
  }

  function timeCommand(args, env) {
      const started = process.hrtime.bigint();
      const run = spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      return { ms: Math.round(ms), exit: run.status ?? -1 };
  }

  function measure(args, env) {
      timeCommand(args, env); // 워밍업(저장값 갱신, 디스크 캐시)은 재지 않음
      const runs = [];
      for (let index = 0; index < RUNS; index++)
          runs.push(timeCommand(args, env));
      return { runs: runs.map((run) => run.ms), median: median(runs.map((run) => run.ms)), exits: runs.map((run) => run.exit) };
  }

  function readInventory(root) {
      const db = new DatabaseSync(path.join(root, '.codegraph', 'codegraph.db'), { readOnly: true });
      try {
          return db.prepare('SELECT path, status, size, modified_at, mime_type, adapter_id FROM file_inventory ORDER BY path').all()
              .map((row) => ({ path: row.path, status: row.status, size: row.size, modifiedAt: Math.floor(row.modified_at), mimeType: row.mime_type, adapterId: row.adapter_id }));
      }
      finally {
          db.close();
      }
  }

  function watcherActive(root) {
      try {
          return JSON.parse(fs.readFileSync(path.join(root, '.codegraph', 'watcher.json'), 'utf8')).active === true;
      }
      catch {
          return false;
      }
  }

  function runPhase(phase) {
      const models = modelRoot();
      const env = { ...process.env, CODEGRAPH_NO_WATCH: '1', GIT_OPTIONAL_LOCKS: '0' };
      if (models)
          env.CODEGRAPH_MODEL_ROOT = models;
      const out = { phase, node: process.version, cli: CLI, modelRoot: models, startedAt: new Date().toISOString(), projects: [] };
      for (const project of PROJECTS) {
          const item = { key: project.key, root: project.root, watcherActive: watcherActive(project.root) };
          item.query = measure(['query', project.query, '-p', project.root, '--limit', '3'], env);
          if (project.context)
              item.context = measure(['context', project.context, '-p', project.root], env);
          item.inventory = readInventory(project.root);
          out.projects.push(item);
          console.log(`${phase} ${project.key}: query ${item.query.median} ms${item.context ? `, context ${item.context.median} ms` : ''}${item.watcherActive ? ' (watcher active)' : ''}`);
      }
      fs.mkdirSync(RESULTS, { recursive: true });
      fs.writeFileSync(path.join(RESULTS, `sync-speed-${phase}.json`), JSON.stringify(out, null, 2));
      return out;
  }

  // 저장된 판별(문서 형식, MIME)이 지금 소스로 새로 판별한 값과 같은지 봄. 소스, 비밀, 루트 밖 항목과
  // sync 뒤에 사라지거나 크기·수정 시각이 바뀐 파일(잠금 파일 등)은 보지 않음
  function freshMismatches(root, inventory) {
      const scan = require(path.join(KIT_SOURCE, 'lib/docs/scan-files'));
      const mismatches = [];
      for (const row of inventory) {
          if (row.mimeType === 'text/x-source' || !['indexed', 'metadata-only', 'error'].includes(row.status))
              continue;
          let stat;
          try {
              stat = fs.statSync(path.join(root, row.path));
          }
          catch {
              continue;
          }
          if (stat.size !== row.size || Math.floor(stat.mtimeMs) !== row.modifiedAt)
              continue;
          const document = scan.classifyTextDocument(path.join(root, row.path));
          const expected = document ? { adapterId: `document.${document.format}`, mimeType: document.mimeType } : { adapterId: null, mimeType: 'application/octet-stream' };
          if (row.adapterId !== expected.adapterId || row.mimeType !== expected.mimeType)
              mismatches.push({ path: row.path, stored: { adapterId: row.adapterId, mimeType: row.mimeType }, fresh: expected });
      }
      return mismatches;
  }

  // 두 측정 사이에 크기와 수정 시각이 그대로인 파일만 견줌. 그사이 바뀐 파일, 바이너리 확장자라서 문서에서 빠진
  // 파일(R4 가 의도한 변경), 목록에서 빠진 .git·.codegraph 아래 파일(잠금 파일 결함 수정)은 따로 셈
  function baselineMismatches(before, after) {
      const scan = require(path.join(KIT_SOURCE, 'lib/docs/scan-files'));
      const old = new Map(before.map((row) => [row.path, row]));
      const current = new Set(after.map((row) => row.path));
      const mismatches = [];
      const binaryExtension = [];
      const removed = before.filter((row) => !current.has(row.path));
      const ownDataRemoved = removed.filter((row) => /(?:^|\/)\.(?:git|codegraph)\//.test(row.path)).length;
      let changedByUser = removed.length - ownDataRemoved;
      for (const row of after) {
          const previous = old.get(row.path);
          if (!previous || previous.size !== row.size || previous.modifiedAt !== row.modifiedAt) {
              changedByUser++;
              continue;
          }
          if (previous.status === row.status && previous.adapterId === row.adapterId && previous.mimeType === row.mimeType)
              continue;
          const entry = { path: row.path, baseline: { status: previous.status, adapterId: previous.adapterId, mimeType: previous.mimeType }, after: { status: row.status, adapterId: row.adapterId, mimeType: row.mimeType } };
          if (scan.isBinaryPath(row.path) && row.adapterId === null && row.mimeType === 'application/octet-stream')
              binaryExtension.push(entry);
          else
              mismatches.push(entry);
      }
      return { mismatches, binaryExtension, ownDataRemoved, changedByUser };
  }

  function compare(baseline, after) {
      const rows = [];
      let classificationOk = true;
      let commandsOk = true;
      for (const project of after.projects) {
          const base = baseline.projects.find((item) => item.key === project.key);
          const fresh = freshMismatches(project.root, project.inventory);
          const versus = baselineMismatches(base.inventory, project.inventory);
          const newFailures = ['query', 'context'].filter((name) => project[name] && project[name].exits.some((exit, index) => exit !== 0 && base[name].exits[index] === 0));
          classificationOk = classificationOk && fresh.length === 0 && versus.mismatches.length === 0;
          commandsOk = commandsOk && newFailures.length === 0;
          rows.push({
              key: project.key,
              queryBaselineMs: base.query.median,
              queryAfterMs: project.query.median,
              contextBaselineMs: base.context?.median ?? null,
              contextAfterMs: project.context?.median ?? null,
              watcherActive: base.watcherActive || project.watcherActive,
              freshMismatches: fresh.slice(0, 20),
              freshMismatchCount: fresh.length,
              baselineMismatches: versus.mismatches.slice(0, 20),
              baselineMismatchCount: versus.mismatches.length,
              binaryExtension: versus.binaryExtension.slice(0, 20),
              binaryExtensionCount: versus.binaryExtension.length,
              ownDataRemoved: versus.ownDataRemoved,
              changedByUser: versus.changedByUser,
              newFailures,
          });
      }
      const passed = classificationOk && commandsOk;
      const result = { passed, classificationOk, commandsOk, baselineAt: baseline.startedAt, afterAt: after.startedAt, projects: rows };
      fs.writeFileSync(path.join(RESULTS, 'sync-speed.json'), JSON.stringify(result, null, 2));
      const lines = [
          '# sync 속도 묶음 1 측정',
          '',
          `- 기준선 ${baseline.startedAt}, 바꾼 뒤 ${after.startedAt}, 각 명령 워밍업 1번 뒤 ${RUNS}번의 중앙값(ms), CODEGRAPH_NO_WATCH=1`,
          `- 판별 일치: ${classificationOk}, 새 명령 실패 없음: ${commandsOk}`,
          '',
          '| 프로젝트 | query 기준 | query 뒤 | context 기준 | context 뒤 | 새 판별 불일치 | 기준선 불일치 | 바이너리 확장자로 빠진 문서 | 빠진 .codegraph 항목 | 그사이 바뀐 파일 | 감시기 |',
          '|---|---|---|---|---|---|---|---|---|---|---|',
          ...rows.map((row) => `| ${row.key} | ${row.queryBaselineMs} | ${row.queryAfterMs} | ${row.contextBaselineMs ?? '-'} | ${row.contextAfterMs ?? '-'} | ${row.freshMismatchCount} | ${row.baselineMismatchCount} | ${row.binaryExtensionCount} | ${row.ownDataRemoved} | ${row.changedByUser} | ${row.watcherActive ? '켜짐' : '꺼짐'} |`),
          '',
      ];
      fs.writeFileSync(path.join(RESULTS, 'sync-speed.md'), lines.join('\n'));
      console.log(lines.join('\n'));
      return result;
  }

  const command = process.argv[2];
  if (command === 'check' || command === 'verify') {
      const digest = sourceDigest(KIT_SOURCE);
      console.log(digest);
      process.exit(digest === (command === 'check' ? EXPECTED_SOURCE_DIGEST : EXPECTED_AFTER_DIGEST) ? 0 : 5);
  }
  else if (command === 'baseline') {
      runPhase('baseline');
  }
  else if (command === 'after') {
      const baseline = JSON.parse(fs.readFileSync(path.join(RESULTS, 'sync-speed-baseline.json'), 'utf8'));
      const result = compare(baseline, runPhase('after'));
      process.exit(result.passed ? 0 : result.classificationOk ? 4 : 3);
  }
  else {
      console.error('usage: node sync-speed.cjs check | baseline | verify | after');
      process.exit(2);
  }
  ```
- 검증: `node --check D:/Fork/.AI/context/search-eval/sync-speed.cjs; echo exit=$?`
- 기대 출력: `exit=0`

### 단계 2: 원본 확인과 기준선 측정
- 파일: `D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json` (명령이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 2a 원본 확인: `cd D:/Fork/.AI/context/search-eval/ && node sync-speed.cjs check; echo exit=$?`
- 2a 기대 출력: 첫 줄 `122d32cc87b51958633f78052c982b3f989a2bdcae2aa97559f96b4e7738b72c`, 둘째 줄 `exit=0`. `exit=5` 면 상태 파일 `MODE=BLOCKED`, `CURRENT=멈춤 S2: KIT source 가 플랜의 원문과 다름` 으로 쓰고 멈춤.
- 2b 기준선(수 분 걸림): `cd D:/Fork/.AI/context/search-eval/ && node sync-speed.cjs baseline > results-sync-baseline.log 2>&1; echo exit=$?`
- 2b 기대 출력: `exit=0`. 아니면 `MODE=BLOCKED`, `CURRENT=멈춤 S2: results-sync-baseline.log 확인` 으로 쓰고 멈춤.
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sync-speed-baseline.json', encoding='utf-8')); print(len(r['projects']), all(len(p['inventory']) > 0 for p in r['projects']), r['projects'][0]['context'] is not None)"`
- 기대 출력: `5 True True`

### 단계 3: 문서 스캔의 판별 순서, 바이너리 확장자, 자기 자료 제외(R3, R4, R5)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js`, `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.d.ts`
- 동작: replace (3a~3g)
- 3a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 42~42줄, `exports` 목록
- 3a 변경 전:
  ```js
  exports.isSecretPath = isSecretPath;
  ```
- 3a 변경 후:
  ```js
  exports.isSecretPath = isSecretPath;
  exports.isBinaryPath = isBinaryPath;
  ```
- 3b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 62~63줄, 정규식 상수
- 3b 변경 전:
  ```js
  const DSL_EXT = /\.ptn$/i;
  const MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024;
  ```
- 3b 변경 후:
  ```js
  const DSL_EXT = /\.ptn$/i;
  // 확장자만으로 바이너리임을 아는 파일은 열지 않는다. 텍스트일 수 있는 obj, dae, svg, ma, bytes 는 넣지 않는다
  const BINARY_EXT = /\.(png|jpe?g|gif|bmp|tga|psd|exr|hdr|tiff?|ico|webp|dds|ktx2?|wav|mp3|ogg|flac|aiff?|m4a|mp4|mov|avi|webm|mkv|ttf|otf|woff2?|zip|7z|rar|gz|tgz|bz2|xz|unitypackage|dll|exe|pdb|so|dylib|wasm|pdf|docx|xlsx|pptx|fbx|blend1?)$/i;
  // .git 과 .codegraph 아래(sync 중의 잠금 파일 포함)는 목록에 넣지 않는다. walkVisibleFiles, 코드 추출 walk, 감시기와 같은 범위다
  const OWN_DATA_PATH = /(?:^|\/)\.(?:git|codegraph)(?:\/|$)/;
  const MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024;
  ```
- 3c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 96~96줄, `listVisibleFiles` 의 git 경로 호출
- 3c 변경 전:
  ```js
          : (gitVisibleFiles(root) ?? walkVisibleFiles(root, ig));
  ```
- 3c 변경 후:
  ```js
          : (gitVisibleFiles(root, ig) ?? walkVisibleFiles(root, ig));
  ```
- 3d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 102~119줄, `listTextDocumentFiles`, `classifyTextDocument` 첫 줄
- 3d 변경 전:
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
  function classifyTextDocument(absolutePath) {
      const format = detectDocumentFormat(absolutePath);
  ```
- 3d 변경 후:
  ```js
  // classify 를 주면 그 판별기(inventory/classifier 의 createDocumentClassifier)가 실제 경로 확인과 판별을 맡는다.
  // 실제 경로 확인은 비밀 경로와 소스 파일을 거른 뒤에 한다. 소스 파일은 여기서 내용을 보지 않기 때문이다
  function listTextDocumentFiles(root, opts, visibleFiles, classify) {
      const files = [];
      for (const absolutePath of visibleFiles ?? listVisibleFiles(root, opts)) {
          const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
          if (SECRET_PATH.test(relativePath))
              continue;
          if ((0, grammars_1.isSourceFile)(relativePath) && !DSL_EXT.test(relativePath))
              continue;
          const document = classify
              ? classify(absolutePath, relativePath).document
              : ((0, utils_1.isPathWithinRootReal)(absolutePath, root) ? classifyTextDocument(absolutePath) : null);
          if (document)
              files.push(document);
      }
      return files;
  }
  function classifyTextDocument(absolutePath) {
      if (BINARY_EXT.test(absolutePath))
          return null;
      const format = detectDocumentFormat(absolutePath);
  ```
- 3e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 146~149줄, `isSecretPath` 뒤, `gitVisibleFiles` 선언
- 3e 변경 전:
  ```js
  function isSecretPath(filePath) {
      return SECRET_PATH.test(filePath.replace(/\\/g, '/'));
  }
  function gitVisibleFiles(root) {
  ```
- 3e 변경 후:
  ```js
  function isSecretPath(filePath) {
      return SECRET_PATH.test(filePath.replace(/\\/g, '/'));
  }
  /** 확장자만으로 바이너리임을 아는 경로인지. 이런 파일은 열지 않는다 */
  function isBinaryPath(filePath) {
      return BINARY_EXT.test(filePath);
  }
  function gitVisibleFiles(root, ig) {
  ```
- 3f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js` 168~171줄, `gitVisibleFiles` 의 경로 반복문
- 3f 변경 전:
  ```js
      for (const rel of out.split('\0')) {
          if (!rel)
              continue;
          const absolutePath = path.resolve(root, rel);
  ```
- 3f 변경 후:
  ```js
      for (const rel of out.split('\0')) {
          if (!rel)
              continue;
          // .git, .codegraph 아래와 무시 규칙에 걸리는 경로는 stat 하지 않는다. 무시 규칙 결과는 listVisibleFiles 의 뒤 거르기와 같다
          if (OWN_DATA_PATH.test(rel) || (ig && ig.ignores(rel)))
              continue;
          const absolutePath = path.resolve(root, rel);
  ```
- 3g 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.d.ts` 18~21줄, 선언 파일의 함수 선언
- 3g 변경 전:
  ```ts
  export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[]): TextDocumentFile[];
  export declare function classifyTextDocument(absolutePath: string): TextDocumentFile | null;
  export declare function detectDocumentFormat(filePath: string): DocumentFormat | null;
  export declare function isSecretPath(filePath: string): boolean;
  ```
- 3g 변경 후:
  ```ts
  /** 문서 판별기의 결과. outside 는 실제 경로가 프로젝트 루트 밖이라는 뜻이고, document 가 null 이면 문서가 아니다 */
  export interface DocumentVerdict {
      document?: TextDocumentFile | null;
      outside?: boolean;
  }
  export type DocumentClassifier = (absolutePath: string, relativePath: string, stat?: import('fs').Stats) => DocumentVerdict;
  export declare function listTextDocumentFiles(root: string, opts?: ScanOptions, visibleFiles?: readonly string[], classify?: DocumentClassifier): TextDocumentFile[];
  export declare function classifyTextDocument(absolutePath: string): TextDocumentFile | null;
  export declare function detectDocumentFormat(filePath: string): DocumentFormat | null;
  export declare function isSecretPath(filePath: string): boolean;
  /** 확장자만으로 바이너리임을 아는 경로인지 */
  export declare function isBinaryPath(filePath: string): boolean;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['exports.isBinaryPath = isBinaryPath;','const BINARY_EXT = ','const OWN_DATA_PATH = ','gitVisibleFiles(root, ig)','function listTextDocumentFiles(root, opts, visibleFiles, classify)','if (BINARY_EXT.test(absolutePath))','function isBinaryPath(filePath)','OWN_DATA_PATH.test(rel)']])"`
- 기대 출력 1: `1 1 1 2 1 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['export type DocumentClassifier','export declare function isBinaryPath','classify?: DocumentClassifier']])"`
- 기대 출력 2: `1 1 1`
- 검증 3: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/docs/scan-files'); console.log('load ok')"`
- 기대 출력 3: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 4: 문서 판별기(R2)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js`, `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts`
- 동작: replace (4a~4f)
- 4a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js` 36~37줄, `exports` 목록
- 4a 변경 전:
  ```js
  exports.classifyFile = classifyFile;
  exports.hasSourceErrors = hasSourceErrors;
  ```
- 4a 변경 후:
  ```js
  exports.classifyFile = classifyFile;
  exports.hasSourceErrors = hasSourceErrors;
  exports.createDocumentClassifier = createDocumentClassifier;
  ```
- 4b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js` 45~45줄, `classifyFile` 선언
- 4b 변경 전:
  ```js
  function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot) {
  ```
- 4b 변경 후:
  ```js
  function classifyFile(absolutePath, relativePath, documentsEnabled, sources, projectRoot, classify) {
  ```
- 4c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js` 92~102줄, `classifyFile` 의 실제 경로 확인과 문서 판별
- 4c 변경 전:
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
- 4c 변경 후:
  ```js
      const verdict = classify
          ? classify(absolutePath, relativePath, stat)
          : (projectRoot && !(0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)
              ? { outside: true }
              : { document: (0, scan_files_1.classifyTextDocument)(absolutePath) });
      if (verdict.outside) {
          return {
              path: relativePath,
              status: 'ignored',
              size: stat.size,
              modifiedAt: stat.mtimeMs,
              diagnostic: 'Document content is excluded because the resolved path is outside the project root.',
              updatedAt,
          };
      }
      const document = verdict.document;
  ```
- 4d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js` 135~135줄, `hasSourceErrors` 앞
- 4d 변경 전:
  ```js
  function hasSourceErrors(value) {
  ```
- 4d 변경 후:
  ```js
  /**
   * 한 번의 sync 안에서 문서 스캔(listTextDocumentFiles)과 파일 목록 갱신(classifyFile)이 같이 쓰는 문서 판별기.
   * file_inventory 에 저장된 크기와 수정 시각이 지금과 같으면 파일을 열지도, 실제 경로를 풀지도 않고 저장된 판별을 쓴다.
   * 다시 쓰는 판별은 두 가지다. 문서(adapter_id 'document.<형식>', adapter_version '1')이고 형식이 지금 확장자와 맞는 것,
   * 그리고 바이너리(application/octet-stream)이면서 확장자가 문서 형식이 아닌 것이다. 문서 확장자(.md 등)의 바이너리
   * 판별은 읽기 실패로 생겼을 수 있어 매번 다시 판별한다. 그 밖에는 지금처럼 실제 경로를 확인하고 내용으로 판별한다.
   * 경로별 결과는 판별기 안에서 한 번만 정한다. 신선도 기준은 코드 쪽(extraction 의 크기·수정 시각 비교)과 같다.
   */
  function createDocumentClassifier(db, projectRoot) {
      const stored = new Map();
      try {
          for (const row of db.prepare('SELECT path, size, modified_at, mime_type, adapter_id, adapter_version FROM file_inventory').all())
              stored.set(row.path, row);
      }
      catch {
          // 파일 목록 표를 읽지 못하면 저장된 판별 없이 모두 새로 판별한다
      }
      const decided = new Map();
      return (absolutePath, relativePath, stat) => {
          let verdict = decided.get(relativePath);
          if (!verdict) {
              verdict = reuseStoredVerdict(stored.get(relativePath), absolutePath, stat)
                  ?? ((0, utils_1.isPathWithinRootReal)(absolutePath, projectRoot)
                      ? { document: (0, scan_files_1.classifyTextDocument)(absolutePath) }
                      : { outside: true });
              decided.set(relativePath, verdict);
          }
          return verdict;
      };
  }
  function reuseStoredVerdict(row, absolutePath, stat) {
      if (!row)
          return null;
      let current = stat;
      if (!current) {
          try {
              current = fs.statSync(absolutePath);
          }
          catch {
              return null;
          }
      }
      if (row.size !== current.size || Math.floor(row.modified_at) !== Math.floor(current.mtimeMs))
          return null;
      const format = (0, scan_files_1.detectDocumentFormat)(absolutePath);
      if (row.mime_type === 'application/octet-stream')
          return format ? null : { document: null };
      if ((0, scan_files_1.isBinaryPath)(absolutePath) || row.adapter_version !== '1' || !row.mime_type
          || row.adapter_id !== `document.${format ?? 'text'}`)
          return null;
      return { document: { absolutePath, format: format ?? 'text', mimeType: row.mime_type } };
  }
  function hasSourceErrors(value) {
  ```
- 4e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts` 2~2줄, 선언 파일 import
- 4e 변경 전:
  ```ts
  import type { FileInventoryRecord } from '../types';
  ```
- 4e 변경 후:
  ```ts
  import type { FileInventoryRecord } from '../types';
  import type { DocumentClassifier } from '../docs/scan-files';
  ```
- 4f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts` 9~10줄, 선언 파일 함수 선언
- 4f 변경 전:
  ```ts
  export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string): FileInventoryRecord;
  export declare function hasSourceErrors(value: unknown): boolean;
  ```
- 4f 변경 후:
  ```ts
  export declare function classifyFile(absolutePath: string, relativePath: string, documentsEnabled: boolean, sources: InventorySources, projectRoot?: string, classify?: DocumentClassifier): FileInventoryRecord;
  export declare function hasSourceErrors(value: unknown): boolean;
  /** 한 번의 sync 안에서 문서 스캔과 파일 목록 갱신이 같이 쓰는 문서 판별기를 만든다 */
  export declare function createDocumentClassifier(db: SqliteDatabase, projectRoot: string): DocumentClassifier;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['exports.createDocumentClassifier = createDocumentClassifier;','projectRoot, classify) {','const verdict = classify','function createDocumentClassifier(db, projectRoot)','function reuseStoredVerdict(row, absolutePath, stat)']])"`
- 기대 출력 1: `1 1 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['import type { DocumentClassifier }','classify?: DocumentClassifier','export declare function createDocumentClassifier']])"`
- 기대 출력 2: `1 1 1`
- 검증 3: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/inventory/classifier'); console.log('load ok')"`
- 기대 출력 3: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 5: 판별기 전달
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`, `index.d.ts`, `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`, `indexer.d.ts`
- 동작: replace (5a~5d)
- 5a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js` 100~100줄, `refreshFileInventory` 의 `classifyFile` 호출
- 5a 변경 전:
  ```js
          const record = (0, classifier_1.classifyFile)(absolutePath, relativePath, documentsEnabled, { sourceHash, documentHash, documentErrors }, projectRoot);
  ```
- 5a 변경 후:
  ```js
          const record = (0, classifier_1.classifyFile)(absolutePath, relativePath, documentsEnabled, { sourceHash, documentHash, documentErrors }, projectRoot, opts.classify);
  ```
- 5b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts` 10~12줄, `refreshFileInventory` 선언의 opts
- 5b 변경 전:
  ```ts
      respectGitignore?: boolean;
      visibleFiles?: readonly string[];
  }): FileInventoryResult;
  ```
- 5b 변경 후:
  ```ts
      respectGitignore?: boolean;
      visibleFiles?: readonly string[];
      classify?: import('../docs/scan-files').DocumentClassifier;
  }): FileInventoryResult;
  ```
- 5c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js` 98~98줄, `indexMarkdown` 의 `listTextDocumentFiles` 호출
- 5c 변경 전:
  ```js
          documents = (0, scan_files_1.listTextDocumentFiles)(projectRoot, { respectGitignore: opts.respectGitignore }, opts.visibleFiles);
  ```
- 5c 변경 후:
  ```js
          documents = (0, scan_files_1.listTextDocumentFiles)(projectRoot, { respectGitignore: opts.respectGitignore }, opts.visibleFiles, opts.classify);
  ```
- 5d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts` 20~22줄, `indexMarkdown` 선언의 opts
- 5d 변경 전:
  ```ts
      respectGitignore?: boolean;
      visibleFiles?: readonly string[];
  }): Promise<MarkdownIndexResult>;
  ```
- 5d 변경 후:
  ```ts
      respectGitignore?: boolean;
      visibleFiles?: readonly string[];
      classify?: import('./scan-files').DocumentClassifier;
  }): Promise<MarkdownIndexResult>;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['projectRoot, opts.classify);']])"`
- 기대 출력 1: `1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['classify?: import(']])"`
- 기대 출력 2: `1`
- 검증 3: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['opts.visibleFiles, opts.classify);']])"`
- 기대 출력 3: `1`
- 검증 4: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['classify?: import(']])"`
- 기대 출력 4: `1`
- 검증 5: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/inventory'); require('D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer'); console.log('load ok')"`
- 기대 출력 5: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 6: getDominantFile 저장값(K1)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js`, `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.d.ts`
- 동작: replace (6a~6c)
- 6a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js` 16~17줄, `isLowValueFile` 설명 주석 앞
- 6a 변경 전:
  ```js
  /**
   * Path-only heuristic for files that should not be candidates for
  ```
- 6a 변경 후:
  ```js
  /** getDominantFile 저장값의 project_metadata 키. 값은 {"fingerprint": 간선 지문, "dominant": 결과 또는 null} 이다 */
  const DOMINANT_FILE_META_KEY = 'dominant_file';
  /**
   * Path-only heuristic for files that should not be candidates for
  ```
- 6b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js` 451~452줄, `QueryBuilder.getDominantFile` 첫 두 줄
- 6b 변경 전:
  ```js
      getDominantFile() {
          if (!this.stmts.getDominantFile) {
  ```
- 6b 변경 후:
  ```js
      getDominantFile() {
          // 저장값이 지금 간선과 같은 시점이면 그 값을 쓴다. 아니면 계산만 하고 저장하지 않는다(읽기 경로는 쓰지 않음)
          const stored = this.readStoredDominantFile();
          if (stored && stored.fingerprint === this.getEdgeFingerprint())
              return stored.dominant;
          return this.computeDominantFile();
      }
      /**
       * 간선 지문이 저장값과 다를 때만 다시 계산해 project_metadata 의 dominant_file 에 저장하고 지금 값을 돌려준다.
       * 쓰기 잠금을 가진 쪽(sync, indexAll)만 부른다.
       */
      refreshDominantFile() {
          const fingerprint = this.getEdgeFingerprint();
          const stored = this.readStoredDominantFile();
          if (stored && stored.fingerprint === fingerprint)
              return stored.dominant;
          const dominant = this.computeDominantFile();
          this.setMetadata(DOMINANT_FILE_META_KEY, JSON.stringify({ fingerprint, dominant }));
          return dominant;
      }
      /** 간선 표의 지문. edges.id 가 AUTOINCREMENT 라 간선을 지우거나 더하면 개수나 최댓값이 바뀐다 */
      getEdgeFingerprint() {
          if (!this.stmts.getEdgeFingerprint) {
              this.stmts.getEdgeFingerprint = this.db.prepare('SELECT COUNT(*) AS c, MAX(rowid) AS m FROM edges');
          }
          const row = this.stmts.getEdgeFingerprint.get();
          return `${row.c}:${row.m ?? 0}`;
      }
      readStoredDominantFile() {
          const value = this.getMetadata(DOMINANT_FILE_META_KEY);
          const parsed = value ? (0, utils_1.safeJsonParse)(value, null) : null;
          return parsed && typeof parsed.fingerprint === 'string' && 'dominant' in parsed ? parsed : null;
      }
      /** 저장값을 보지 않고 그래프에서 다시 계산한다 */
      computeDominantFile() {
          if (!this.stmts.getDominantFile) {
  ```
- 6c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.d.ts` 90~94줄, 선언 파일의 `getDominantFile`
- 6c 변경 전:
  ```ts
      getDominantFile(): {
          filePath: string;
          edgeCount: number;
          nextEdgeCount: number;
      } | null;
  ```
- 6c 변경 후:
  ```ts
      getDominantFile(): {
          filePath: string;
          edgeCount: number;
          nextEdgeCount: number;
      } | null;
      /** 간선 지문이 저장값과 다를 때만 다시 계산해 project_metadata 의 dominant_file 에 저장한다 */
      refreshDominantFile(): {
          filePath: string;
          edgeCount: number;
          nextEdgeCount: number;
      } | null;
      /** 간선 표의 지문(`개수:최대 rowid`) */
      getEdgeFingerprint(): string;
      readStoredDominantFile(): {
          fingerprint: string;
          dominant: {
              filePath: string;
              edgeCount: number;
              nextEdgeCount: number;
          } | null;
      } | null;
      /** 저장값을 보지 않고 그래프에서 다시 계산한다 */
      computeDominantFile(): {
          filePath: string;
          edgeCount: number;
          nextEdgeCount: number;
      } | null;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const DOMINANT_FILE_META_KEY = ','refreshDominantFile() {','getEdgeFingerprint() {','readStoredDominantFile() {','computeDominantFile() {']])"`
- 기대 출력 1: `1 1 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/db/queries.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['refreshDominantFile(): {','getEdgeFingerprint(): string;','computeDominantFile(): {']])"`
- 기대 출력 2: `1 1 1`
- 검증 3: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/db/queries'); console.log('load ok')"`
- 기대 출력 3: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 7: sync 연결과 refreshDominant
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`, `index.d.ts`, `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js`, `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js`
- 동작: replace (7a~7j)
- 7a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 62~62줄, require 목록
- 7a 변경 전:
  ```js
  const inventory_1 = require("./inventory");
  ```
- 7a 변경 후:
  ```js
  const inventory_1 = require("./inventory");
  const classifier_1 = require("./inventory/classifier");
  ```
- 7b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 647~654줄, `CodeGraph.sync` 의 문서 스캔
- 7b 변경 전:
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
- 7b 변경 후:
  ```js
                  const visibleFiles = (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                      respectGitignore: options.respectGitignore,
                  });
                  // 문서 스캔과 파일 목록 갱신이 같은 판별 결과를 쓴다. 크기와 수정 시각이 그대로인 파일은 열지 않는다
                  const classify = (0, classifier_1.createDocumentClassifier)(this.db.getDb(), this.projectRoot);
                  try {
                      const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                          classify,
                      });
  ```
- 7c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 708~713줄, `CodeGraph.sync` 의 파일 목록 갱신
- 7c 변경 전:
  ```js
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                      });
                      if (result.inventory.byStatus.error > 0) {
                          result.warnings = [...(result.warnings ?? []),
  ```
- 7c 변경 후:
  ```js
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                          classify,
                      });
                      if (result.inventory.byStatus.error > 0) {
                          result.warnings = [...(result.warnings ?? []),
  ```
- 7d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 724~725줄, `CodeGraph.sync` 의 색인 건강도 읽기 앞
- 7d 변경 전:
  ```js
                  result.indexHealth = (0, index_health_1.readIndexHealth)(this.db.getDb());
                  if (!result.indexHealth.healthy)
  ```
- 7d 변경 후:
  ```js
                  if (options.refreshDominant) {
                      try {
                          this.queries.refreshDominantFile();
                      }
                      catch {
                          // 저장하지 못해도 context 가 읽을 때 계산한다
                      }
                  }
                  result.indexHealth = (0, index_health_1.readIndexHealth)(this.db.getDb());
                  if (!result.indexHealth.healthy)
  ```
- 7e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 498~507줄, `CodeGraph.indexAll` 끝
- 7e 변경 전:
  ```js
                  result.durationMs = Date.now() - operationStartedAt;
                  return result;
              }
              finally {
                  this.fileLock.release();
              }
          });
      }
      /**
       * Index specific files
  ```
- 7e 변경 후:
  ```js
                  if (result.success) {
                      try {
                          this.queries.refreshDominantFile();
                      }
                      catch {
                          // 저장하지 못해도 context 가 읽을 때 계산한다
                      }
                  }
                  result.durationMs = Date.now() - operationStartedAt;
                  return result;
              }
              finally {
                  this.fileLock.release();
              }
          });
      }
      /**
       * Index specific files
  ```
- 7f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 784~784줄, `CodeGraph.watch` 의 sync 콜백
- 7f 변경 전:
  ```js
              const result = await this.sync({ respectGitignore: options.respectGitignore });
  ```
- 7f 변경 후:
  ```js
              const result = await this.sync({ respectGitignore: options.respectGitignore, refreshDominant: true });
  ```
- 7g 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts` 57~60줄, `IndexOptions` 끝
- 7g 변경 전:
  ```ts
      respectGitignore?: boolean;
  }
  /**
   * Main CodeGraph class
  ```
- 7g 변경 후:
  ```ts
      respectGitignore?: boolean;
      /**
       * sync 끝에서 getDominantFile 저장값을 갱신할지. 감시기의 sync 와 context 명령의 sync 가 true 로 부른다.
       * indexAll 은 이 값과 상관없이 갱신한다.
       */
      refreshDominant?: boolean;
  }
  /**
   * Main CodeGraph class
  ```
- 7h 위치: `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js` 19~19줄, `syncForRead` 선언
- 7h 변경 전:
  ```js
  async function syncForRead(graph, projectPath) {
  ```
- 7h 변경 후:
  ```js
  async function syncForRead(graph, projectPath, extra = {}) {
  ```
- 7i 위치: `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js` 27~27줄, `syncForRead` 의 sync 옵션
- 7i 변경 전:
  ```js
      const options = { respectGitignore: watcher.configuration?.respectGitignore ?? true };
  ```
- 7i 변경 후:
  ```js
      const options = { respectGitignore: watcher.configuration?.respectGitignore ?? true, ...extra };
  ```
- 7j 위치: `D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js` 1472~1474줄, `context` 명령의 sync
- 7j 변경 전:
  ```js
                  let syncWarnings = [];
                  if (options.sync !== false) {
                      const sync = await syncForRead(cg, projectPath);
  ```
- 7j 변경 후:
  ```js
                  let syncWarnings = [];
                  if (options.sync !== false) {
                      // context 는 getDominantFile 저장값을 읽으므로 이 sync 에서 갱신한다. query 등 다른 명령의 sync 는 갱신하지 않는다
                      const sync = await syncForRead(cg, projectPath, { refreshDominant: true });
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/index.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const classifier_1 = require(','createDocumentClassifier)(this.db.getDb(), this.projectRoot)','if (options.refreshDominant) {','this.queries.refreshDominantFile();','refreshDominant: true });']])"`
- 기대 출력 1: `1 1 1 2 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['refreshDominant?: boolean;']])"`
- 기대 출력 2: `1`
- 검증 3: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['async function syncForRead(graph, projectPath, extra = {}) {','...extra };']])"`
- 기대 출력 3: `1 1`
- 검증 4: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/bin/codegraph.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['syncForRead(cg, projectPath, { refreshDominant: true })']])"`
- 기대 출력 4: `1`
- 검증 5: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/index'); require('D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness'); console.log('load ok')"`
- 기대 출력 5: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 8: 시험
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs`
- 위치: 새 파일
- 동작: create, 그다음 명령 실행
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
  const { listTextDocumentFiles, listVisibleFiles } = require('../lib/docs/scan-files');
  const { createDocumentClassifier } = require('../lib/inventory/classifier');

  function environment(context, values) {
      const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
      Object.assign(process.env, values);
      context.after(() => {
          for (const [key, value] of Object.entries(previous)) {
              if (value === undefined) delete process.env[key];
              else process.env[key] = value;
          }
      });
  }

  function fixture(context) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-sync-speed-'));
      execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
      const resources = [];
      context.after(() => {
          for (const resource of resources) resource.close();
          assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
          fs.rmSync(root, { recursive: true, force: true });
      });
      return { root, resources };
  }

  function relativeTo(root, file) {
      return path.relative(root, path.resolve(String(file))).split(path.sep).join('/');
  }

  // 루트 아래 파일(.codegraph 제외)을 fs.openSync 로 연 기록
  function recordOpens(context, root) {
      const opened = [];
      const openFile = fs.openSync;
      const mock = context.mock.method(fs, 'openSync', (file, ...rest) => {
          const relative = relativeTo(root, file);
          if (relative && !relative.startsWith('..') && relative !== '.codegraph' && !relative.startsWith('.codegraph/'))
              opened.push(relative);
          return openFile(file, ...rest);
      });
      return { opened, restore: () => mock.mock.restore() };
  }

  function chainClass(name, count) {
      const methods = [];
      for (let index = 0; index < count; index++) {
          const call = index + 1 < count ? `Step${index + 1}();` : '';
          methods.push(`    public void Step${index}() { ${call} }`);
      }
      return `public class ${name}\n{\n${methods.join('\n')}\n}\n`;
  }

  test('unchanged sync opens no project file and a changed document is sampled once and re-indexed', async context => {
      environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const { root, resources } = fixture(context);
      fs.writeFileSync(path.join(root, 'Runner.cs'), 'public class Runner { void Run() {} }\n');
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nFirst revision.\n');
      fs.writeFileSync(path.join(root, 'Settings.json'), '{ "speed": 1 }\n');
      fs.writeFileSync(path.join(root, 'Theme.uss'), '.panel { color: red; }\n');
      fs.writeFileSync(path.join(root, 'Blob.bin'), Buffer.from([0, 1, 2, 3, 0, 255]));
      fs.writeFileSync(path.join(root, 'Icon.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]));
      const graph = CodeGraph.initSync(root);
      resources.push(graph);
      const db = graph.getDb();
      assert.equal((await graph.indexAll()).success, true);
      const inventory = () => db.prepare('SELECT path, status, size, mime_type, adapter_id FROM file_inventory ORDER BY path').all().map(row => ({ ...row }));
      const indexed = inventory();
      const quiet = recordOpens(context, root);
      const unchanged = await graph.sync();
      quiet.restore();
      assert.equal(unchanged.status, 'current', JSON.stringify(unchanged));
      assert.deepEqual(quiet.opened, []);
      assert.equal(unchanged.docsUpdated, 0);
      assert.deepEqual(inventory(), indexed);
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nSecond revision with more text.\n');
      const changed = recordOpens(context, root);
      const updated = await graph.sync();
      changed.restore();
      assert.equal(updated.status, 'current', JSON.stringify(updated));
      assert.deepEqual(changed.opened, ['Notes.md']);
      assert.deepEqual(updated.docPaths, ['Notes.md']);
      const note = db.prepare("SELECT file_size FROM mdast_metadata WHERE file_path = 'Notes.md'").get();
      assert.equal(note.file_size, fs.statSync(path.join(root, 'Notes.md')).size);
      assert.equal(db.prepare("SELECT size FROM file_inventory WHERE path = 'Notes.md'").get().size, note.file_size);
  });

  test('a text file with a binary extension is never opened or indexed as a document', async context => {
      environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const { root, resources } = fixture(context);
      fs.writeFileSync(path.join(root, 'fake.png'), 'plain text that only looks like a document\n');
      fs.writeFileSync(path.join(root, 'Readme.md'), '# Readme\n');
      const opens = recordOpens(context, root);
      assert.deepEqual(listTextDocumentFiles(root).map(document => path.basename(document.absolutePath)), ['Readme.md']);
      const graph = CodeGraph.initSync(root);
      resources.push(graph);
      assert.equal((await graph.indexAll()).success, true);
      assert.equal((await graph.sync()).status, 'current');
      opens.restore();
      assert.equal(opens.opened.includes('fake.png'), false);
      const db = graph.getDb();
      const row = db.prepare("SELECT status, mime_type, adapter_id FROM file_inventory WHERE path = 'fake.png'").get();
      assert.deepEqual({ ...row }, { status: 'metadata-only', mime_type: 'application/octet-stream', adapter_id: null });
      assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path = 'fake.png'").get().c, 0);
  });

  test('stored verdicts are reused only when size, time and extension still agree', async context => {
      environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const { root, resources } = fixture(context);
      fs.writeFileSync(path.join(root, 'Broken.md'), Buffer.from([35, 0, 1, 2]));
      fs.writeFileSync(path.join(root, 'Blob.bin'), Buffer.from([0, 1, 2, 3]));
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n');
      const graph = CodeGraph.initSync(root);
      resources.push(graph);
      assert.equal((await graph.indexAll()).success, true);
      const classify = createDocumentClassifier(graph.getDb(), root);
      const opens = recordOpens(context, root);
      const verdicts = Object.fromEntries(['Broken.md', 'Blob.bin', 'Notes.md'].map(name => [name, classify(path.join(root, name), name)]));
      opens.restore();
      // 문서 확장자의 바이너리 판별은 읽기 실패로 생겼을 수 있어 다시 연다. 나머지는 저장된 판별을 쓴다
      assert.deepEqual(opens.opened, ['Broken.md']);
      assert.equal(verdicts['Broken.md'].document, null);
      assert.equal(verdicts['Blob.bin'].document, null);
      assert.equal(verdicts['Notes.md'].document.format, 'markdown');
      assert.equal(verdicts['Notes.md'].document.mimeType, 'text/markdown');
      const again = recordOpens(context, root);
      assert.equal(classify(path.join(root, 'Broken.md'), 'Broken.md'), verdicts['Broken.md']);
      again.restore();
      assert.deepEqual(again.opened, []);
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nlonger now\n');
      const fresh = createDocumentClassifier(graph.getDb(), root);
      const changed = recordOpens(context, root);
      assert.equal(fresh(path.join(root, 'Notes.md'), 'Notes.md').document.format, 'markdown');
      changed.restore();
      assert.deepEqual(changed.opened, ['Notes.md']);
  });

  test('git listing does not stat paths the ignore rules exclude', context => {
      const { root } = fixture(context);
      fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'readme.md'), '# vendored\n');
      fs.writeFileSync(path.join(root, 'Guide.md'), '# Guide\n');
      const statted = [];
      const statFile = fs.statSync;
      const mock = context.mock.method(fs, 'statSync', (file, ...rest) => {
          statted.push(relativeTo(root, file));
          return statFile(file, ...rest);
      });
      const visible = listVisibleFiles(root).map(file => relativeTo(root, file));
      mock.mock.restore();
      assert.deepEqual(visible, ['Guide.md']);
      assert.equal(statted.includes('node_modules/pkg/readme.md'), false);
  });

  test('dominant file is stored by indexing, read without recomputing, and refreshed only by refreshing syncs', async context => {
      environment(context, { CODEGRAPH_DOCS: '0', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const { root, resources } = fixture(context);
      fs.mkdirSync(path.join(root, 'Core'));
      fs.mkdirSync(path.join(root, 'Extra'));
      fs.writeFileSync(path.join(root, 'Core', 'Engine.cs'), chainClass('Engine', 30));
      fs.writeFileSync(path.join(root, 'Extra', 'Helper.cs'), chainClass('Helper', 3));
      const graph = CodeGraph.initSync(root);
      resources.push(graph);
      const db = graph.getDb();
      assert.equal((await graph.indexAll()).success, true);
      const stored = () => JSON.parse(db.prepare("SELECT value FROM project_metadata WHERE key = 'dominant_file'").get().value);
      const indexed = stored();
      assert.equal(indexed.dominant.filePath, 'Core/Engine.cs');
      assert.equal(indexed.fingerprint, graph.queries.getEdgeFingerprint());
      const compute = context.mock.method(graph.queries, 'computeDominantFile');
      assert.equal(graph.queries.getDominantFile().filePath, 'Core/Engine.cs');
      assert.equal(compute.mock.callCount(), 0);
      fs.writeFileSync(path.join(root, 'Extra', 'Helper.cs'), chainClass('Helper', 120));
      // query 처럼 refreshDominant 없이 맞추면 저장값은 그대로이고, 읽기는 계산만 하고 쓰지 않는다
      assert.equal((await graph.sync()).status, 'current');
      assert.equal(compute.mock.callCount(), 0);
      assert.equal(graph.queries.getDominantFile().filePath, 'Extra/Helper.cs');
      assert.equal(compute.mock.callCount(), 1);
      assert.deepEqual(stored(), indexed);
      // context 와 감시기처럼 refreshDominant 로 맞추면 다시 계산해 저장하고, 그 뒤 읽기는 계산하지 않는다
      assert.equal((await graph.sync({ refreshDominant: true })).status, 'current');
      assert.equal(compute.mock.callCount(), 2);
      const refreshed = stored();
      assert.equal(refreshed.dominant.filePath, 'Extra/Helper.cs');
      assert.equal(refreshed.fingerprint, graph.queries.getEdgeFingerprint());
      assert.equal(graph.queries.getDominantFile().filePath, 'Extra/Helper.cs');
      assert.equal(compute.mock.callCount(), 2);
  });

  test('codegraph data files are never listed, inventoried or indexed as documents', async context => {
      environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const { root, resources } = fixture(context);
      fs.mkdirSync(path.join(root, '.github'));
      fs.writeFileSync(path.join(root, '.github', 'ci.yml'), 'name: ci\n');
      fs.writeFileSync(path.join(root, '.codegraphignore'), '# extra ignores\n');
      fs.writeFileSync(path.join(root, 'Guide.md'), '# Guide\n');
      const graph = CodeGraph.initSync(root);
      resources.push(graph);
      assert.equal((await graph.indexAll()).success, true);
      assert.equal((await graph.sync()).status, 'current');
      const db = graph.getDb();
      const listed = listVisibleFiles(root).map(file => relativeTo(root, file));
      assert.equal(listed.some(file => file.startsWith('.codegraph/')), false);
      assert.equal(listed.includes('.github/ci.yml'), true);
      assert.equal(listed.includes('.codegraphignore'), true);
      assert.equal(db.prepare("SELECT COUNT(*) AS c FROM file_inventory WHERE path LIKE '.codegraph/%'").get().c, 0);
      assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path LIKE '.codegraph/%'").get().c, 0);
  });
  ```
- 8a 새 시험: `node --test D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs; echo exit=$?`
- 8a 기대 출력: 마지막 줄 `exit=0` (pass 6)
- 8b 회귀 시험: `cd D:/Fork/KIT/tools/codegraph/source/ && node --test test/freshness.test.cjs test/cli.test.cjs test/indexing-regression.test.cjs test/indexing-resolution.test.cjs test/indexing-lock.test.cjs test/indexing-revision.test.cjs test/watcher.test.cjs test/watcher-cli-edge.test.cjs test/watcher-daemon.test.cjs; echo exit=$?`
- 8b 기대 출력: 마지막 줄 `exit=0`. `watcher-hooks.test.cjs` 는 변경 전부터 3건 실패라 넣지 않음.
- 8c 문서·검색 시험: `node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp-conditional.test.cjs; echo exit=$?`
- 8c 기대 출력: 마지막 줄 `exit=0`
- 8d 사본 대조: `node D:/Fork/.AI/context/search-eval/sync-speed.cjs verify; echo exit=$?`
- 8d 기대 출력: 첫 줄 `6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3`, 둘째 줄 `exit=0`. `exit=5` 면 `MODE=BLOCKED`, `CURRENT=멈춤 S8: 바꾼 소스가 시험한 사본과 다름` 으로 쓰고 멈춤. 8a~8c 중 하나라도 `exit=0` 이 아니면 `CURRENT=멈춤 S8: <시험 이름>` 으로 쓰고 멈춤.

### 단계 9: 바꾼 뒤 측정
- 파일: `D:/Fork/.AI/context/search-eval/results/sync-speed-after.json`, `sync-speed.json`, `sync-speed.md` (명령이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 실행(수 분 걸림): `cd D:/Fork/.AI/context/search-eval/ && node sync-speed.cjs after > results-sync-after.log 2>&1; echo exit=$?`
- 판정:
  - `exit=0`: 다음 단계로 감.
  - `exit=3`: 저장된 판별이 새로 판별한 값이나 기준선과 다름. `MODE=BLOCKED`, `CURRENT=멈춤 S9: 판별 불일치, results/sync-speed.json 확인` 으로 쓰고 멈춤.
  - `exit=4`: 바꾼 뒤 명령이 새로 실패함. `MODE=BLOCKED`, `CURRENT=멈춤 S9: 명령 실패, results-sync-after.log 확인` 으로 쓰고 멈춤.
  - 그 밖의 값: `MODE=BLOCKED`, `CURRENT=멈춤 S9: results-sync-after.log 확인` 으로 쓰고 멈춤.
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sync-speed.json', encoding='utf-8')); print(r['passed'], len(r['projects']))"`
- 기대 출력: `True 5`

### 단계 10: 빌드, 전역 설치, 이 저장소 맞추기(사용자 승인 필요)
- 파일: KIT `artifacts/codegraph-win32-x64.zip`, `manifest.json`, 전역 설치본, 이 저장소의 배포 사본
- 위치: 명령 실행
- 동작: 실행
- 실행 전: AskUserQuestion 으로 "빌드·전역 설치·이 저장소 동기화를 진행할까요?" 를 묻고, 승인이 없으면 상태 파일 `CURRENT=S10 승인 대기` 로 쓰고 멈춤(MODE 는 EXECUTE 유지).
- 실행 도구: 10a, 10b, 10c 는 Bash 가 아니라 PowerShell 도구로 직접 실행함. Bash 에서 `pwsh -Command "..."` 로 부르면 Bash 가 `$env:` 와 `$LASTEXITCODE` 를 먼저 펼쳐 실패가 종료 코드 0 으로 보이고, PATH 의 Git `/usr/bin/tar` 가 먼저 잡혀 `D:` 경로를 읽지 못함(2026-11-03 안 A 실행에서 실제로 일어남).
- 10a 빌드(PowerShell 도구, 백그라운드): `Set-Location D:/Fork/KIT/tools/codegraph; node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`
- 10a 확인: 종료 코드가 0 이 아니거나 `D:/Fork/KIT/tools/codegraph/artifacts/codegraph-win32-x64.zip` 의 수정 시각이 이번 실행 시각보다 앞서면 `MODE=BLOCKED`, `CURRENT=멈춤 S10: build` 로 쓰고 멈춤.
- 10b 설치(PowerShell 도구, 백그라운드): `$env:CODEGRAPH_NO_WATCH = '1'; & D:/Fork/KIT/tools/codegraph/install.ps1; if (-not $?) { exit 1 }`
- 10c 이 저장소 맞추기(PowerShell 도구. robocopy 종료 코드는 8 미만이 성공): `robocopy D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/grammars D:/Fork/codegraph/grammars /MIR /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/artifacts D:/Fork/codegraph/artifacts /MIR /NFL /NDL /NJH /NJS /NP; Copy-Item D:/Fork/KIT/tools/codegraph/build.mjs,D:/Fork/KIT/tools/codegraph/install.ps1,D:/Fork/KIT/tools/codegraph/install.sh,D:/Fork/KIT/tools/codegraph/manifest.json,D:/Fork/KIT/tools/codegraph/LICENSE D:/Fork/codegraph/ -Force`
- 검증(Bash. 전역 shim 이 가리키는 설치 폴더 이름 끝 12자는 새 zip 의 sha256 앞 12자임): `S=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}' ~/.local/bin/codegraph.cmd | sed 's/.*-//'); grep -c "\"sha256\": \"$S" D:/Fork/KIT/tools/codegraph/manifest.json; codegraph --help | grep -c docs-batch; diff -rq D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source --exclude=node_modules | wc -l; CODEGRAPH_NO_WATCH=1 codegraph query DamageHitJob -p D:/Fork/Arcyn --limit 1 > /dev/null; echo exit=$?`
- 기대 출력: `1`, `1`, `0`, `exit=0`. 첫 줄이 `0` 이면 옛 빌드가 설치된 것임

## 수락 기준
```acceptance
{"id":"V1","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs","expect":"exit0"}
{"id":"V2","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs D:/Fork/KIT/tools/codegraph/source/test/cli.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-resolution.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-lock.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-revision.test.cjs","expect":"exit0"}
{"id":"V3","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/watcher.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-cli-edge.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-daemon.test.cjs","expect":"exit0"}
{"id":"V4","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp-conditional.test.cjs","expect":"exit0"}
{"id":"V5","kind":"auto","cmd":"node D:/Fork/.AI/context/search-eval/sync-speed.cjs verify","expect":"exit0"}
{"id":"V6","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sync-speed.json');process.exit(r.passed===true?0:1)\"","expect":"exit0"}
{"id":"V7","kind":"human","how":"D:/Fork/.AI/context/search-eval/results/sync-speed.md 의 표를 봄","expect":"모든 프로젝트에서 query 뒤 값이 query 기준보다 작고, Arcyn 의 context 뒤 값이 context 기준보다 작음. 감시기 열은 모두 꺼짐. 바이너리 확장자로 빠진 문서 열이 0 이 아니면 results/sync-speed.json 의 binaryExtension 목록을 보고 그 파일들이 문서가 아니어도 되는지 판단함"}
{"id":"V8","kind":"human","how":"단계 10 을 승인했다면 새 터미널에서 CODEGRAPH_NO_WATCH=1 codegraph context \"inventory grid layout\" -p D:/Fork/Arcyn 를 두 번 돌림","expect":"두 번 모두 결과가 나오고 두 번째가 첫 번째보다 느리지 않음. D:/Fork/codegraph/source 가 KIT source 와 같음"}
```

## 하지 않는 것
- 코드 추출 walk 와 문서 walk 합치기(R3 의 나머지). 서브모듈과 심볼릭 링크 처리가 달라 색인 파일 집합이 바뀜.
- `indexAll` 의 판별기 사용. 전체 색인은 지금처럼 모든 파일을 판별함.
- 감시기 쪽 변경(W1~W6)은 묶음 2 플랜에서 함. K2, N1, W4 는 측정이 먼저임(innovate 12절).
- KIT 규칙 문서(`rules/doc-graph.md`, `references/DOC_GRAPH_POLICY.md`)와 `source/README.md` 의 설명 갱신은 하지 않음. REVIEW 뒤 따로 정함.
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
