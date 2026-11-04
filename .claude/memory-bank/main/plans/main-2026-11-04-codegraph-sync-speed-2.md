# 플랜: 묶음 2 — 감시기 상시 운용 비용 줄이기(W1 W2 W3 W5)

## 목표
감시기를 켜 둔 채 쓸 때 감시기 sync 가 바뀐 경로만 맞추고(W1), 질의가 직접 sync 하지 않고 감시기의 맞추기를 기다리며(W2), 감시기가 상태 파일을 덜 쓰고(W3), 설치가 감시기를 새 런타임으로 옮기지 않게(W5) 해서, 질의 규칙에서 `CODEGRAPH_NO_WATCH=1` 을 뺄 수 있는 상태를 만든다.

## 전제와 실행 규칙
- 근거 문서: `.claude/memory-bank/main/plans/main-2026-11-04-codegraph-sync-speed-research.md`, `...-innovate.md` 6~10, 12절. 라벨(W1~W6, K1)의 뜻은 innovate 끝 `## 라벨` 에 있음.
- 시작 조건: 묶음 1 플랜(`main-2026-11-04-codegraph-sync-speed.md`)의 EXECUTE, REVIEW, G2 가 끝난 뒤에 시작함(innovate 12절). 2a 가 KIT source 가 묶음 1 의 결과와 바이트까지 같은지 확인함.
- 고치는 곳은 KIT 임: `D:/Fork/KIT/tools/codegraph/source/`, `D:/Fork/KIT/tools/codegraph/install.ps1`, `D:/Fork/KIT/tools/codegraph/install.sh`, `D:/Fork/KIT/tools/codegraph/test/`(새 Pester 시험). 이 저장소(`D:/Fork/codegraph`)는 10단계에서만 바뀜.
- 변경 전 원문은 이 저장소의 `source/` 에 묶음 1 플랜을 그대로 적용한 사본에서 베꼈음. 설치기 원문은 이 저장소의 `install.ps1`, `install.sh` 에서 베꼈고, 2b 가 KIT 의 두 파일이 그것과 같은지 확인함.
- PLAN 세션이 3~8단계(Pester 제외)를 리눅스 사본에 그대로 적용해 Node 22.23 과 24.16 에서 시험 파일 20개가 모두 통과함을 확인했음. 새 시험과 바뀐 시험 8건 중 7건은 묶음 1 만 있는 소스에서 실패함. 감시기 측정 도구도 기준선과 변경 뒤를 리눅스에서 돌려 봤음. PowerShell 은 이 세션에서 쓸 수 없어 `install.ps1` 과 Pester 시험은 실행해 보지 못했음(문자열 검사와 설치기 안 JS 의 문법만 확인함). 8i `verify` 가 바꾼 소스와 설치기가 시험한 사본과 같은지 확인함(소스 지문 `1d99f2f9…`).
- 한 단계에 변경이 여럿이면 a, b, c 로 나눔. "변경 전" 이 있는 변경은 replace 임. 원문은 그 파일 안에서 한 번만 나옴. 같은 파일의 변경은 적힌 순서대로 함. 위치의 줄 번호는 그 변경 직전 파일 기준의 참고값임. "새 파일" 은 그 내용으로 파일을 만듦.
- 코드 블록은 목록 안에 있어 모든 줄 앞에 2칸이 더 붙어 있음. 파일과 맞출 때와 파일에 쓸 때 각 줄 앞 2칸을 뺌. 그 뒤의 들여쓰기는 파일 원문 그대로임. 줄 끝은 LF 임(설치기 파일이 CRLF 라 Edit 가 원문을 찾지 못하면 멈춤).
- 단계 순서를 지킴. 2단계(기준선 측정)는 3~8단계보다 먼저 해야 함.
- 모든 명령은 Git Bash 에서 돌림. 8h 와 10a~10c 만 PowerShell 도구로 돌림. `node` 는 PATH 의 v24, `python` 은 PATH 의 Python 3 임.
- 감시기 측정은 임시 폴더의 합성 프로젝트(C# 400개, md 100개)에서만 함. 실제 프로젝트에는 감시기를 띄우지 않음. 측정 도구는 임시 감시기 등록 폴더를 써서 `~/.codegraph/watchers` 를 건드리지 않고, 끝나면 감시기를 멈추고 임시 폴더를 지움.
- 단계가 실패하면 고치려 하지 말고 멈춤. 상태 파일 `.claude/memory-bank/main/riper/main-2026-11-04-codegraph-sync-speed-2.state` 에 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <한 줄 원인>` 으로 씀.

## 설계 메모 (G1 검토용)
- W1 국소 sync: 감시기(`FileWatcher.flush`)는 (가) 전체 맞추기가 필요 없고 (나) 기다리는 경로가 1~200개이고 (다) 마지막 전체 sync 뒤 10분이 안 지났을 때만 그 경로를 sync 에 넘김. 아니면 전체 sync. `CodeGraph.sync` 는 넘어온 경로가 모두 `file_inventory` 에 있고(지난 전체 sync 가 본 파일) `.gitignore`, `.codegraphignore` 가 아니면 국소 sync 를 하고, 새 경로가 하나라도 있으면 전체 sync 를 함. 새 파일의 범위(중첩 `.gitignore`, 중첩 저장소, 서브모듈)는 전체 sync 가 정함. 국소 sync 는 트리를 훑지 않음: 코드는 그 경로만 크기·수정 시각·해시로 맞추고, 문서 색인과 파일 목록은 그 경로만 고치거나 지움(범위 밖 항목과 범위 밖 문서 실패 기록은 그대로). 이벤트를 놓쳐도 200개 넘는 묶음, 10분 주기, 감시기 재시작의 전체 sync 가 메움.
- W2: 질의(`syncForRead`)는 같은 런타임의 감시기가 활성인데 결과를 보증하지 못하면(기다리는 변경, 맞추는 중) IPC `flush` 를 보내 최대 30초 기다림. 감시기는 디바운스를 건너뛰고 바로 맞춘 뒤 상태를 돌려줌. 그래도 보증하지 못하면(준비 전, 실패, 시간 초과) 지금처럼 직접 sync 함. 런타임이 다른 감시기(설치본과 KIT 소스 CLI)에는 flush 를 보내지 않음.
- W3: `watcher.json` 은 `heartbeatAt` 을 뺀 내용이 바뀔 때와 5초마다만 씀(지금은 1초마다). `manager.ensureWatcher` 의 시작 판정(`heartbeatAt` 10초)과 `protocol.request` 의 토큰 읽기는 그대로 됨. 쓰기 실패(EPERM 등)는 실패가 이어지는 동안 한 번만 기록하고 다음 박동에 다시 씀.
- W5: 설치기(`install.ps1`, `install.sh`)는 활성 감시기를 멈추기만 함. 설치 실패로 되돌릴 때도 다시 띄우지 않음. 다음 CLI 사용 때 새 런타임으로 뜸. KIT `test/Codegraph-Installer.Tests.ps1` 의 감시 이전 시험은 PLAN 세션이 볼 수 없어 사람이 고침(수락 기준 V7, 사용자 결정).
- K1 과의 관계: 감시기 sync 는 묶음 1 대로 `refreshDominant` 로 getDominantFile 저장값을 갱신함(사용자 결정). 그래서 코드가 바뀐 감시기 sync 와 그 sync 를 기다리는 질의는 집계 시간(Arcyn 0.74~3.3초)을 함께 씀. 게시한 뒤 따로 갱신하는 안은 갱신하는 동안 감시기가 맞추는 중으로 보여 질의가 직접 sync 로 빠지므로 쓰지 않음.
- 바뀌는 동작: (1) sync 결과에 `scope`(`full` 또는 `paths`), 감시기 sync 결과에 `full` 이 생김. (2) 소스도 문서도 아닌 파일(이미지 등)의 파일 목록 항목은 다음 전체 sync 때 갱신됨(지금도 감시기는 그 이벤트로 sync 하지 않음). (3) 런타임 지문(`runtimeId`)이 바뀌므로 배포 뒤 옛 감시기는 다음 사용 때 새로 뜸.

## 바뀔 파일
- `D:/Fork/.AI/context/search-eval/watch-speed.cjs`: 새 파일. 바꾼 소스 확인, 감시기 기준선과 바꾼 뒤 측정
- `D:/Fork/.AI/context/search-eval/results/watch-speed-baseline.json`, `watch-speed-after.json`, `watch-speed.json`, `watch-speed.md`: 측정 결과(실행이 만듦)
- `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js`, `watcher.d.ts`: W1 경로 넘기기, W2 `flushNow`
- `D:/Fork/KIT/tools/codegraph/source/lib/index.js`, `index.d.ts`: W1 `resolveSyncTargets` 와 국소 sync 연결, W2 `flushWatcher`
- `D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.js`, `index.d.ts`: W1 경로만 맞추기, `scope`
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`, `indexer.d.ts`: W1 범위 안 문서만 지우기, 실패 기록 합치기
- `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`, `index.d.ts`: W1 범위 안 항목만 고치기
- `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js`: W2 `flush` 명령, W3 상태 파일 쓰기
- `D:/Fork/KIT/tools/codegraph/source/lib/watch/manager.js`: W2 `flushWatcher`
- `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js`: W2 감시기 기다리기
- `D:/Fork/KIT/tools/codegraph/install.ps1`, `install.sh`: W5
- `D:/Fork/KIT/tools/codegraph/source/test/watch-speed.test.cjs`: 새 시험
- `D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs`: W2 반영
- `D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer-WatcherStop.Tests.ps1`: 새 Pester 시험(정적 검사)
- 10단계(사용자 승인 뒤): KIT 배포 zip, `manifest.json`, 전역 설치본, 이 저장소의 `source/`, `grammars/`, `artifacts/`, `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`

## 단계

### 단계 1: 감시기 측정 도구
- 파일: `D:/Fork/.AI/context/search-eval/watch-speed.cjs`
- 위치: 새 파일
- 동작: create
- 변경 전:
  ```
  없음
  ```
- 변경 후:
  ```js
  // 사용: node watch-speed.cjs verify | baseline | after
  // verify : 바꾼 KIT source 와 설치기(install.ps1, install.sh)가 플랜을 시험한 사본과 같은지 확인함. 다르면 종료 코드 5
  // 임시 프로젝트(C# 400개, md 100개)에서 KIT 소스 런타임의 감시기를 띄우고 잼. 실제 프로젝트는 건드리지 않음
  // (가) 파일 하나를 고친 직후 query(sync 포함) 시간과 결과 반영 여부, 3번
  // (나) C# 300개를 한꺼번에 고친 뒤 감시기가 다시 준비될 때까지 시간, 그 뒤 직접 sync 가 더 맞출 것이 있는지(놓친 변경 수)
  // (다) 쉬는 감시기가 20초 동안 watcher.json 을 쓴 횟수
  // after 는 기준선과 견줘 results/watch-speed.json, watch-speed.md 를 씀. 놓친 변경이 있거나 결과가 반영되지 않으면 종료 코드 3
  'use strict';
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const { spawnSync } = require('node:child_process');
  const { setTimeout: delay } = require('node:timers/promises');

  const HERE = __dirname;
  const KIT_SOURCE = process.env.WATCH_SPEED_KIT_SOURCE || 'D:/Fork/KIT/tools/codegraph/source';
  const CLI = path.join(KIT_SOURCE, 'lib/bin/codegraph.js');
  const RESULTS = process.env.WATCH_SPEED_RESULTS || path.join(HERE, 'results');
  const SOURCES = 400;
  const DOCS = 100;
  const BULK = 300;
  const RUNS = 3;
  const EXPECTED_AFTER_DIGEST = '1d99f2f9141bbb57e104f6d1d83d137ab93471968b9f97e064423c8a1d919f53';
  const EXPECTED_INSTALLERS = { 'install.ps1': '0051db8dd81c75d8f1ce543162b137459ea161ec547874411e67f7f4bae161b6', 'install.sh': '352215fb197d97be6aea88435fdbd88e62145bfc19d703c8a6f53663097545f4' };

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

  // 설치기는 줄 끝(CRLF/LF)을 맞춘 뒤 견줌
  function installerDigest(file) {
      return crypto.createHash('sha256').update(fs.readFileSync(file).toString('utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');
  }

  function cli(args, env) {
      const started = process.hrtime.bigint();
      const run = spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
      return { ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6), exit: run.status ?? -1, stdout: run.stdout || '' };
  }

  function source(index, version) {
      return `public class Unit${index} { public int Value${version}() { return ${index}; } }\n`;
  }

  function median(values) {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
  }

  async function waitReady(manager, root, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
          const status = await manager.watcherStatus(root);
          if (status.active && status.ready && status.pendingFiles.length === 0)
              return true;
          await delay(100);
      }
      return false;
  }

  async function measure(phase) {
      const registry = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-speed-registry-'));
      Object.assign(process.env, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_WATCH_REGISTRY: registry });
      delete process.env.CODEGRAPH_NO_WATCH;
      const env = { ...process.env };
      const manager = require(path.join(KIT_SOURCE, 'lib/watch/manager'));
      const { CodeGraph } = require(path.join(KIT_SOURCE, 'lib/index'));
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-speed-'));
      const out = { phase, node: process.version, cli: CLI, startedAt: new Date().toISOString() };
      try {
          spawnSync('git', ['init', '--quiet', root], { windowsHide: true });
          fs.mkdirSync(path.join(root, 'Src'));
          fs.mkdirSync(path.join(root, 'Docs'));
          for (let index = 0; index < SOURCES; index++)
              fs.writeFileSync(path.join(root, 'Src', `Unit${index}.cs`), source(index, 0));
          for (let index = 0; index < DOCS; index++)
              fs.writeFileSync(path.join(root, 'Docs', `Note${index}.md`), `# Note ${index}\n\nversion 0\n`);
          out.initExit = cli(['init', root], { ...env, CODEGRAPH_NO_WATCH: '1' }).exit;
          const startAt = Date.now();
          out.watcherActive = (await manager.ensureWatcher(root, { timeoutMs: 30000 })).active === true;
          out.readyMs = await waitReady(manager, root, 120000) ? Date.now() - startAt : null;
          const edits = [];
          for (let version = 1; version <= RUNS; version++) {
              fs.writeFileSync(path.join(root, 'Src', 'Unit0.cs'), source(0, version));
              await delay(200); // 감시기가 저장 이벤트를 받을 시간
              const query = cli(['query', `Value${version}`, '-p', root, '--limit', '1', '-j'], env);
              edits.push({ ms: query.ms, exit: query.exit, found: query.stdout.includes(`Value${version}`) });
              await waitReady(manager, root, 60000);
          }
          out.editQuery = { runs: edits, median: median(edits.map((edit) => edit.ms)), allFound: edits.every((edit) => edit.found && edit.exit === 0) };
          const bulkAt = Date.now();
          for (let index = 0; index < BULK; index++)
              fs.writeFileSync(path.join(root, 'Src', `Unit${index}.cs`), source(index, 100));
          await delay(500);
          out.bulkReadyMs = await waitReady(manager, root, 120000) ? Date.now() - bulkAt : null;
          const graph = await CodeGraph.open(root, { sync: false });
          try {
              const direct = await graph.sync();
              out.missed = direct.filesAdded + direct.filesModified + direct.filesRemoved;
          }
          finally {
              graph.close();
          }
          const state = path.join(root, '.codegraph', 'watcher.json');
          let last = fs.statSync(state).mtimeMs;
          let writes = 0;
          for (let tick = 0; tick < 200; tick++) {
              await delay(100);
              const modified = fs.statSync(state).mtimeMs;
              if (modified !== last) {
                  writes++;
                  last = modified;
              }
          }
          out.idleStateWrites = writes;
      }
      finally {
          await manager.stopWatcher(root).catch(() => {});
          fs.rmSync(root, { recursive: true, force: true });
          fs.rmSync(registry, { recursive: true, force: true });
      }
      fs.mkdirSync(RESULTS, { recursive: true });
      fs.writeFileSync(path.join(RESULTS, `watch-speed-${phase}.json`), JSON.stringify(out, null, 2));
      console.log(`${phase}: ready ${out.readyMs} ms, edit query ${out.editQuery.median} ms (found ${out.editQuery.allFound}), bulk ready ${out.bulkReadyMs} ms, missed ${out.missed}, idle writes ${out.idleStateWrites}`);
      return out;
  }

  function compare(baseline, after) {
      const passed = after.watcherActive && after.readyMs !== null && after.bulkReadyMs !== null && after.editQuery.allFound && after.missed === 0;
      const result = { passed, baseline, after };
      fs.writeFileSync(path.join(RESULTS, 'watch-speed.json'), JSON.stringify(result, null, 2));
      const row = (name, key) => `| ${name} | ${key(baseline) ?? '-'} | ${key(after) ?? '-'} |`;
      const lines = [
          '# 감시기 묶음 2 측정 (임시 프로젝트: C# 400, md 100)',
          '',
          `- 기준선 ${baseline.startedAt}, 바꾼 뒤 ${after.startedAt}. passed: ${passed}`,
          '',
          '| 항목 | 기준선 | 바꾼 뒤 |',
          '|---|---|---|',
          row('감시기 시작부터 준비까지 ms', (item) => item.readyMs),
          row('고친 직후 query 중앙값 ms', (item) => item.editQuery?.median),
          row('고친 내용이 query 에 반영됨', (item) => item.editQuery?.allFound),
          row('300개 대량 변경 뒤 준비까지 ms', (item) => item.bulkReadyMs),
          row('감시기가 놓친 변경 수', (item) => item.missed),
          row('쉬는 20초 동안 watcher.json 쓰기 횟수', (item) => item.idleStateWrites),
          '',
      ];
      fs.writeFileSync(path.join(RESULTS, 'watch-speed.md'), lines.join('\n'));
      console.log(lines.join('\n'));
      return result;
  }

  const command = process.argv[2];
  if (command === 'verify') {
      const digest = sourceDigest(KIT_SOURCE);
      const installers = Object.fromEntries(Object.keys(EXPECTED_INSTALLERS).map((name) => [name, installerDigest(path.join(KIT_SOURCE, '..', name))]));
      console.log(digest);
      for (const [name, value] of Object.entries(installers))
          console.log(`${name} ${value}`);
      const same = digest === EXPECTED_AFTER_DIGEST && Object.entries(EXPECTED_INSTALLERS).every(([name, value]) => installers[name] === value);
      process.exit(same ? 0 : 5);
  }
  else if (command === 'baseline') {
      measure('baseline').then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
  }
  else if (command === 'after') {
      const baseline = JSON.parse(fs.readFileSync(path.join(RESULTS, 'watch-speed-baseline.json'), 'utf8'));
      measure('after').then((after) => process.exit(compare(baseline, after).passed ? 0 : 3), (error) => { console.error(error); process.exit(1); });
  }
  else {
      console.error('usage: node watch-speed.cjs verify | baseline | after');
      process.exit(2);
  }
  ```
- 검증: `node --check D:/Fork/.AI/context/search-eval/watch-speed.cjs; echo exit=$?`
- 기대 출력: `exit=0`

### 단계 2: 원본 확인과 기준선 측정
- 파일: `D:/Fork/.AI/context/search-eval/results/watch-speed-baseline.json` (명령이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 2a 소스 확인: `node D:/Fork/.AI/context/search-eval/sync-speed.cjs verify; echo exit=$?`
- 2a 기대 출력: 첫 줄 `6a94b2980f69f309be614f214ef3eac4ee0c70d401bb9a4c45f4518c548876f3`, 둘째 줄 `exit=0`. `exit=5` 면 `MODE=BLOCKED`, `CURRENT=멈춤 S2: KIT source 가 묶음 1 결과와 다름` 으로 쓰고 멈춤.
- 2b 설치기 확인: `python -c "import hashlib; h=lambda p: hashlib.sha256(open(p,'rb').read().replace(bytes([13,10]), bytes([10]))).hexdigest(); print(h(r'D:/Fork/KIT/tools/codegraph/install.ps1'), h(r'D:/Fork/KIT/tools/codegraph/install.sh'))"`
- 2b 기대 출력: `716513e6d97268dbd8c64dc766a4be90e0834f66dc8ca0c78a5832b7f8c1ed4a fde3e8c3d4bb4f2eff8ee8cabd3a0df2bff492b037dbb7224456f9690338f863`. 다르면 `MODE=BLOCKED`, `CURRENT=멈춤 S2: KIT 설치기가 플랜의 원문과 다름` 으로 쓰고 멈춤.
- 2c 시험 폴더 확인: `ls D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer.Tests.ps1`
- 2c 기대 출력: `D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer.Tests.ps1`. 없으면 `MODE=BLOCKED`, `CURRENT=멈춤 S2: KIT test 폴더 위치가 다름` 으로 쓰고 멈춤.
- 2d 기준선(1~3분): `cd D:/Fork/.AI/context/search-eval/ && node watch-speed.cjs baseline > results-watch-baseline.log 2>&1; echo exit=$?`
- 2d 기대 출력: `exit=0`. 아니면 `MODE=BLOCKED`, `CURRENT=멈춤 S2: results-watch-baseline.log 확인` 으로 쓰고 멈춤.
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/watch-speed-baseline.json', encoding='utf-8')); print(r['watcherActive'], r['editQuery']['allFound'], r['missed'])"`
- 기대 출력: `True True 0`

### 단계 3: 감시기의 경로 넘기기와 즉시 맞추기(W1, W2)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js`, `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.d.ts`
- 동작: replace (3a~3f)
- 3a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js` 78~78줄, 모듈 상수
- 3a 변경 전:
  ```js
  const PATH_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOENT']);
  ```
- 3a 변경 후:
  ```js
  const PATH_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOENT']);
  // 기다리는 경로가 이보다 많으면(체크아웃, 대량 재임포트) 국소 sync 대신 전체 sync 를 함. 그때 놓친 이벤트도 함께 메움
  const MAX_TARGETED_FILES = 200;
  // 국소 sync 만 이어질 때 마지막 전체 sync 뒤 이 시간이 지나면 다음 맞추기는 전체 sync 로 함(놓친 이벤트 메우기)
  const FULL_RECONCILE_MS = 10 * 60 * 1000;
  ```
- 3b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js` 109~110줄, `FileWatcher` 필드
- 3b 변경 전:
  ```js
      fullSyncPending = false;
      failures = 0;
  ```
- 3b 변경 후:
  ```js
      fullSyncPending = false;
      lastFullSyncAt = 0;
      inFlight = null;
      failures = 0;
  ```
- 3c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js` 381~388줄, `flush` 앞부분
- 3c 변경 전:
  ```js
          const generation = this.generation;
          this.syncVersion = this.eventVersion;
          this.syncing = true;
          try {
              const result = await this.syncFn();
              if (generation !== this.generation)
                  return;
              this.fullSyncPending = false;
  ```
- 3c 변경 후:
  ```js
          const generation = this.generation;
          this.syncVersion = this.eventVersion;
          this.syncing = true;
          let settle;
          this.inFlight = new Promise((resolve) => { settle = resolve; });
          // 전체 맞추기가 필요 없고 기다리는 경로가 적으면 그 경로만 넘김(W1). undefined 면 전체 sync
          const paths = !this.fullSyncPending && this.pendingFiles.size > 0 && this.pendingFiles.size <= MAX_TARGETED_FILES
              && Date.now() - this.lastFullSyncAt < FULL_RECONCILE_MS
              ? [...this.pendingFiles.keys()]
              : undefined;
          try {
              const result = await this.syncFn(paths);
              if (generation !== this.generation)
                  return;
              if (!paths || result?.full)
                  this.lastFullSyncAt = Date.now();
              this.fullSyncPending = false;
  ```
- 3d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js` 430~431줄, `flush` 의 finally
- 3d 변경 전:
  ```js
          finally {
              this.syncing = false;
  ```
- 3d 변경 후:
  ```js
          finally {
              this.syncing = false;
              this.inFlight = null;
              settle();
  ```
- 3e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js` 444~445줄, `getPendingFiles` 설명 주석 앞
- 3e 변경 전:
  ```js
      /**
       * Snapshot of files seen by the watcher since the last successful sync.
  ```
- 3e 변경 후:
  ```js
      /**
       * 기다리던 변경을 지금 맞추고 그 시도가 끝나면 돌아옴(W2, 질의가 감시기를 기다릴 때 씀).
       * 다른 sync 가 돌고 있으면 그것이 끝나기를 기다린 뒤, 남은 변경이 있을 때만 한 번 더 맞춤. 준비 전이거나 멈췄으면 바로 돌아옴.
       */
      async flushNow() {
          while (this.inFlight)
              await this.inFlight;
          if (this.stopped || !this.chokidarReady || (this.pendingFiles.size === 0 && !this.fullSyncPending))
              return;
          if (this.debounceTimer) {
              clearTimeout(this.debounceTimer);
              this.debounceTimer = null;
          }
          await this.flush();
      }
      /**
       * Snapshot of files seen by the watcher since the last successful sync.
  ```
- 3f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.d.ts` 194~194줄, 선언 파일의 `getPendingFiles`
- 3f 변경 전:
  ```ts
      getPendingFiles(): PendingFile[];
  ```
- 3f 변경 후:
  ```ts
      getPendingFiles(): PendingFile[];
      /** 기다리던 변경을 지금 맞추고 그 시도가 끝나면 돌아온다 */
      flushNow(): Promise<void>;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const MAX_TARGETED_FILES = 200;','const FULL_RECONCILE_MS = ','lastFullSyncAt = 0;','inFlight = null;','await this.syncFn(paths)','this.lastFullSyncAt = Date.now();','settle();','async flushNow() {']])"`
- 기대 출력 1: `1 1 1 2 1 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['flushNow(): Promise<void>;']])"`
- 기대 출력 2: `1`
- 검증 3: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/sync/watcher'); console.log('load ok')"`
- 기대 출력 3: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 4: CodeGraph 의 국소 sync 와 flushWatcher(W1, W2)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/index.js`, `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts`
- 동작: replace (4a~4i)
- 4a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 46~47줄, require 목록
- 4a 변경 전:
  ```js
  const path = __importStar(require("path"));
  const db_1 = require("./db");
  ```
- 4a 변경 후:
  ```js
  const fs = __importStar(require("fs"));
  const path = __importStar(require("path"));
  const db_1 = require("./db");
  ```
- 4b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 598~601줄, `CodeGraph.sync` 의 코드 맞추기
- 4b 변경 전:
  ```js
                  this.queries.beginReferenceUpdate();
                  const result = await this.orchestrator.sync(options.onProgress, {
                      respectGitignore: options.respectGitignore,
                  });
  ```
- 4b 변경 후:
  ```js
                  this.queries.beginReferenceUpdate();
                  // 감시기가 넘긴 경로가 모두 지난 전체 sync 가 본 파일이면 그 경로만 맞춤(W1). 아니면 전체 sync
                  const targets = this.resolveSyncTargets(options.paths);
                  const result = await this.orchestrator.sync(options.onProgress, {
                      respectGitignore: options.respectGitignore,
                      paths: targets?.paths,
                  });
                  result.scope = targets ? 'paths' : 'full';
  ```
- 4c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 660~670줄, `CodeGraph.sync` 의 문서 스캔
- 4c 변경 전:
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
- 4c 변경 후:
  ```js
                  const visibleFiles = targets ? targets.existing : (0, scan_files_1.listVisibleFiles)(this.projectRoot, {
                      respectGitignore: options.respectGitignore,
                  });
                  // 문서 스캔과 파일 목록 갱신이 같은 판별 결과를 쓴다. 크기와 수정 시각이 그대로인 파일은 열지 않는다
                  const classify = (0, classifier_1.createDocumentClassifier)(this.db.getDb(), this.projectRoot);
                  try {
                      const docs = await (0, indexer_1.indexMarkdown)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                          classify,
                          paths: targets?.paths,
                      });
  ```
- 4d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 722~726줄, `CodeGraph.sync` 의 파일 목록 갱신
- 4d 변경 전:
  ```js
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                          classify,
                      });
  ```
- 4d 변경 후:
  ```js
                      result.inventory = (0, inventory_1.refreshFileInventory)(this.db.getDb(), this.projectRoot, {
                          respectGitignore: options.respectGitignore,
                          visibleFiles,
                          classify,
                          paths: targets?.paths,
                      });
  ```
- 4e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 764~767줄, `isIndexing` 앞
- 4e 변경 전:
  ```js
      /**
       * Check if an indexing operation is currently in progress
       */
      isIndexing() {
  ```
- 4e 변경 후:
  ```js
      /**
       * 감시기가 넘긴 경로로 국소 sync 를 할 수 있는지 정한다(W1). 모든 경로가 file_inventory 에 있고(지난 전체 sync 가 본 파일)
       * 무시 규칙 파일이 아니면 { paths, existing } 을 돌려준다. existing 은 지금 디스크에 있는 경로의 절대 경로다.
       * 새 경로가 하나라도 있으면 null 을 돌려 전체 sync 를 하게 한다. 새 파일의 범위(.gitignore, 중첩 저장소)는 전체 sync 가 정한다.
       */
      resolveSyncTargets(paths) {
          if (!Array.isArray(paths) || paths.length === 0)
              return null;
          const known = this.db.getDb().prepare('SELECT 1 AS found FROM file_inventory WHERE path = ?');
          const unique = [...new Set(paths)];
          const existing = [];
          for (const relativePath of unique) {
              const name = relativePath.split('/').pop();
              if (name === '.gitignore' || name === '.codegraphignore' || !known.get(relativePath))
                  return null;
              const absolutePath = path.join(this.projectRoot, relativePath);
              try {
                  if (fs.statSync(absolutePath).isFile())
                      existing.push(absolutePath);
              }
              catch {
                  // 지워진 파일: 국소 sync 가 색인과 파일 목록에서 지운다
              }
          }
          return { paths: unique, existing };
      }
      /** 감시기가 기다리던 변경을 지금 맞추게 하고 그 시도가 끝날 때까지 기다린다(W2). 감시기가 없으면 바로 돌아온다 */
      async flushWatcher() {
          await this.watcher?.flushNow();
      }
      /**
       * Check if an indexing operation is currently in progress
       */
      isIndexing() {
  ```
- 4f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 820~821줄, `CodeGraph.watch` 의 sync 콜백 첫 줄
- 4f 변경 전:
  ```js
          this.watcher = new sync_1.FileWatcher(this.projectRoot, async () => {
              const result = await this.sync({ respectGitignore: options.respectGitignore, refreshDominant: true });
  ```
- 4f 변경 후:
  ```js
          this.watcher = new sync_1.FileWatcher(this.projectRoot, async (paths) => {
              const result = await this.sync({ respectGitignore: options.respectGitignore, refreshDominant: true, paths });
  ```
- 4g 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.js` 828~829줄, `CodeGraph.watch` 의 sync 콜백 반환
- 4g 변경 전:
  ```js
              const filesChanged = result.filesAdded + result.filesModified + result.filesRemoved;
              return { filesChanged, durationMs: result.durationMs, warnings: result.warnings ?? [] };
  ```
- 4g 변경 후:
  ```js
              const filesChanged = result.filesAdded + result.filesModified + result.filesRemoved;
              return { filesChanged, durationMs: result.durationMs, warnings: result.warnings ?? [], full: result.scope !== 'paths' };
  ```
- 4h 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts` 62~63줄, `IndexOptions` 끝
- 4h 변경 전:
  ```ts
      refreshDominant?: boolean;
  }
  ```
- 4h 변경 후:
  ```ts
      refreshDominant?: boolean;
      /** 감시기가 넘긴 프로젝트 기준 POSIX 경로. 모두 알려진 파일이면 그 경로만 맞춘다(sync 전용) */
      paths?: readonly string[];
  }
  ```
- 4i 위치: `D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts` 148~148줄, `sync` 선언 뒤
- 4i 변경 전:
  ```ts
      sync(options?: IndexOptions): Promise<SyncResult>;
  ```
- 4i 변경 후:
  ```ts
      sync(options?: IndexOptions): Promise<SyncResult>;
      resolveSyncTargets(paths?: readonly string[]): {
          paths: string[];
          existing: string[];
      } | null;
      flushWatcher(): Promise<void>;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/index.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const fs = __importStar(require(','const targets = this.resolveSyncTargets(options.paths);','paths: targets?.paths','result.scope = targets ? ','resolveSyncTargets(paths) {','async flushWatcher() {','refreshDominant: true, paths });','full: result.scope ']])"`
- 기대 출력 1: `1 1 3 1 1 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/index.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['paths?: readonly string[];','resolveSyncTargets(paths?: readonly string[]): {','flushWatcher(): Promise<void>;']])"`
- 기대 출력 2: `1 1 1`
- 검증 3: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/index'); console.log('load ok')"`
- 기대 출력 3: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 5: 코드 추출, 문서 색인, 파일 목록의 국소 처리(W1)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.js`, `index.d.ts`, `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js`, `indexer.d.ts`, `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js`, `index.d.ts`
- 동작: replace (5a~5j)
- 5a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.js` 1268~1271줄, `ExtractionOrchestrator.sync` 의 파일 목록
- 5a 변경 전:
  ```js
          const currentFiles = scanDirectory(this.rootDir, undefined, scanOpts);
          filesChecked = currentFiles.length;
          const currentSet = new Set(currentFiles);
          const trackedFiles = this.queries.getAllFiles();
  ```
- 5a 변경 후:
  ```js
          // scanOpts.paths 가 있으면(감시기의 국소 sync) 그 경로만 본다. 트리를 훑지 않고, 그 밖의 색인 파일은 건드리지 않는다
          const targeted = Array.isArray(scanOpts?.paths);
          const currentFiles = targeted
              ? scanOpts.paths.filter((filePath) => (0, grammars_1.isSourceFile)(filePath) && fs.existsSync(path.join(this.rootDir, filePath)))
              : scanDirectory(this.rootDir, undefined, scanOpts);
          filesChecked = currentFiles.length;
          const currentSet = new Set(currentFiles);
          const trackedFiles = targeted
              ? scanOpts.paths.map((filePath) => this.queries.getFileByPath(filePath)).filter(Boolean)
              : this.queries.getAllFiles();
  ```
- 5b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.d.ts` 126~128줄, `ScanOptions` 끝
- 5b 변경 전:
  ```ts
      respectGitignore?: boolean;
  }
  export declare function scanDirectory(rootDir: string, onProgress?: (current: number, file: string) => void, opts?: ScanOptions): string[];
  ```
- 5b 변경 후:
  ```ts
      respectGitignore?: boolean;
      /** 감시기의 국소 sync 가 넘긴 경로. 있으면 sync 가 트리를 훑지 않고 이 경로만 맞춘다 */
      paths?: readonly string[];
  }
  export declare function scanDirectory(rootDir: string, onProgress?: (current: number, file: string) => void, opts?: ScanOptions): string[];
  ```
- 5c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.d.ts` 71~71줄, `SyncResult.status` 뒤
- 5c 변경 전:
  ```ts
      status?: 'current' | 'blocked' | 'failed';
  ```
- 5c 변경 후:
  ```ts
      status?: 'current' | 'blocked' | 'failed';
      /** 전체 sync 인지, 감시기가 넘긴 경로만 맞춘 국소 sync 인지 */
      scope?: 'full' | 'paths';
  ```
- 5d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js` 111~111줄, `indexMarkdown` 의 지울 문서
- 5d 변경 전:
  ```js
      const removedDocuments = storedDocuments.filter((document) => !diskPaths.has(document.file_path));
  ```
- 5d 변경 후:
  ```js
      // opts.paths 가 있으면(감시기의 국소 sync) 그 경로의 문서만 지울 수 있다
      const scope = opts.paths ? new Set(opts.paths) : null;
      const removedDocuments = storedDocuments.filter((document) => (!scope || scope.has(document.file_path)) && !diskPaths.has(document.file_path));
  ```
- 5e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js` 188~190줄, `indexMarkdown` 끝
- 5e 변경 전:
  ```js
      persistDocumentFailures(db, result.errors);
      return result;
  }
  ```
- 5e 변경 후:
  ```js
      persistDocumentFailures(db, scope ? mergeDocumentFailures(db, scope, result.errors) : result.errors);
      return result;
  }
  ```
- 5f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js` 277~277줄, `persistDocumentFailures` 앞
- 5f 변경 전:
  ```js
  function persistDocumentFailures(db, errors) {
  ```
- 5f 변경 후:
  ```js
  // 국소 sync 는 범위 밖 문서의 지난 실패 기록을 그대로 두고, 범위 안 문서의 기록만 이번 결과로 바꾼다
  function mergeDocumentFailures(db, scope, errors) {
      const row = db.prepare("SELECT value FROM project_metadata WHERE key = 'document_index_errors'").get();
      let previous = [];
      try {
          previous = row ? JSON.parse(row.value) : [];
      }
      catch {
          previous = [];
      }
      const kept = Array.isArray(previous) ? previous.filter((failure) => typeof failure?.filePath === 'string' && !scope.has(failure.filePath)) : [];
      return [...kept, ...errors];
  }
  function persistDocumentFailures(db, errors) {
  ```
- 5g 위치: `D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts` 22~23줄, `indexMarkdown` 선언의 opts
- 5g 변경 전:
  ```ts
      classify?: import('./scan-files').DocumentClassifier;
  }): Promise<MarkdownIndexResult>;
  ```
- 5g 변경 후:
  ```ts
      classify?: import('./scan-files').DocumentClassifier;
      /** 감시기의 국소 sync 범위. 있으면 이 경로의 문서만 지우고, 실패 기록도 이 경로만 바꾼다 */
      paths?: readonly string[];
  }): Promise<MarkdownIndexResult>;
  ```
- 5h 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js` 60~60줄, `refreshFileInventory` 의 기존 항목 표
- 5h 변경 전:
  ```js
      const existing = new Map(existingRows.map((row) => [row.path, row]));
  ```
- 5h 변경 후:
  ```js
      const existing = new Map(existingRows.map((row) => [row.path, row]));
      // opts.paths 가 있으면(감시기의 국소 sync) 그 경로의 항목만 고치거나 지운다
      const scope = opts.paths ? new Set(opts.paths) : null;
  ```
- 5i 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js` 135~143줄, `refreshFileInventory` 끝
- 5i 변경 전:
  ```js
              if (!currentPaths.has(row.path)) {
                  remove.run(row.path);
                  result.removed++;
              }
          }
      })();
      result.updated = pending.length;
      return result;
  }
  ```
- 5i 변경 후:
  ```js
              if (!currentPaths.has(row.path) && (!scope || scope.has(row.path))) {
                  remove.run(row.path);
                  result.removed++;
              }
          }
      })();
      result.updated = pending.length;
      if (scope) {
          // 국소 갱신의 개수는 표 전체 기준으로 돌려준다(sync 의 오류 항목 경고가 전체를 보게)
          result.byStatus = getFileInventorySummary(db);
          result.scanned = Object.values(result.byStatus).reduce((sum, count) => sum + count, 0);
      }
      return result;
  }
  ```
- 5j 위치: `D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts` 12~13줄, `refreshFileInventory` 선언의 opts
- 5j 변경 전:
  ```ts
      classify?: import('../docs/scan-files').DocumentClassifier;
  }): FileInventoryResult;
  ```
- 5j 변경 후:
  ```ts
      classify?: import('../docs/scan-files').DocumentClassifier;
      /** 감시기의 국소 sync 범위. 있으면 이 경로의 항목만 고치거나 지운다 */
      paths?: readonly string[];
  }): FileInventoryResult;
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const targeted = Array.isArray(scanOpts?.paths);','this.queries.getFileByPath(filePath)).filter(Boolean)']])"`
- 기대 출력 1: `1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/extraction/index.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['paths?: readonly string[];','scope?: ']])"`
- 기대 출력 2: `1 1`
- 검증 3: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const scope = opts.paths ? new Set(opts.paths) : null;','function mergeDocumentFailures(db, scope, errors)','mergeDocumentFailures(db, scope, result.errors)']])"`
- 기대 출력 3: `1 1 1`
- 검증 4: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['paths?: readonly string[];']])"`
- 기대 출력 4: `1`
- 검증 5: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const scope = opts.paths ? new Set(opts.paths) : null;','|| scope.has(row.path))','result.byStatus = getFileInventorySummary(db);']])"`
- 기대 출력 5: `1 1 1`
- 검증 6: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/inventory/index.d.ts',encoding='utf-8').read(); print(*[t.count(s) for s in ['paths?: readonly string[];']])"`
- 기대 출력 6: `1`
- 검증 7: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/extraction'); require('D:/Fork/KIT/tools/codegraph/source/lib/docs/indexer'); require('D:/Fork/KIT/tools/codegraph/source/lib/inventory'); console.log('load ok')"`
- 기대 출력 7: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 6: 감시 프로세스의 flush 와 상태 파일, 질의 쪽 기다리기(W2, W3)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js`, `D:/Fork/KIT/tools/codegraph/source/lib/watch/manager.js`, `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js`
- 동작: replace (6a~6i)
- 6a 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 11~11줄, 모듈 상수
- 6a 변경 전:
  ```js
  const MAX_START_ATTEMPTS = 5;
  ```
- 6a 변경 후:
  ```js
  const MAX_START_ATTEMPTS = 5;
  // flush 요청이 감시기의 맞추기를 기다리는 최대 시간. 질의 쪽 직접 sync 의 잠금 대기 한도(bin/freshness.js)와 같음
  const FLUSH_WAIT_MS = 30000;
  // 상태 파일은 내용이 바뀔 때만 쓰고, 그대로면 이 간격으로만 다시 씀. manager 의 시작 판정(10초)보다 짧아야 함
  const STATE_REFRESH_MS = 5000;
  ```
- 6b 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 33~33줄, `runWatcher` 앞
- 6b 변경 전:
  ```js
  async function runWatcher(projectPath, options = {}) {
  ```
- 6b 변경 후:
  ```js
  // 상태 파일 쓰기 판정(W3). heartbeatAt 을 뺀 내용이 바뀌었거나 마지막 쓰기 뒤 refreshMs 가 지났을 때만 write 를 부름.
  // write 가 던지면(Windows 의 EPERM 등) 기록을 바꾸지 않으므로 다음 박동에 다시 씀
  function createStateWriter(write, refreshMs = STATE_REFRESH_MS, now = Date.now) {
      let written = null;
      let writtenAt = 0;
      return (state) => {
          const { heartbeatAt, ...content } = state;
          const text = JSON.stringify(content);
          if (text === written && now() - writtenAt < refreshMs)
              return false;
          write(state);
          written = text;
          writtenAt = now();
          return true;
      };
  }

  async function runWatcher(projectPath, options = {}) {
  ```
- 6c 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 82~86줄, `persist`
- 6c 변경 전:
  ```js
      const persist = () => {
          state.heartbeatAt = Date.now();
          Object.assign(state, snapshot());
          protocol.writeJson(location.state, state);
      };
  ```
- 6c 변경 후:
  ```js
      // 상태 파일은 내용이 바뀔 때와 STATE_REFRESH_MS 마다만 씀(W3). 1초마다 쓰면 Windows 에서 교체 rename 이 EPERM 으로 거부되곤 했음
      const writeState = createStateWriter(value => protocol.writeJson(location.state, value));
      let writeFailing = false;
      const persist = () => {
          state.heartbeatAt = Date.now();
          Object.assign(state, snapshot());
          writeState(state);
      };
  ```
- 6d 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 115~118줄, IPC 명령 처리
- 6d 변경 전:
  ```js
              } else if (request.command === 'status') {
                  lastRequestAt = Date.now();
                  socket.end(JSON.stringify(snapshot()) + '\n');
              } else {
  ```
- 6d 변경 후:
  ```js
              } else if (request.command === 'status') {
                  lastRequestAt = Date.now();
                  socket.end(JSON.stringify(snapshot()) + '\n');
              } else if (request.command === 'flush') {
                  // 질의가 직접 sync 하지 않고 감시기의 맞추기를 기다림(W2). 끝나거나 시간 제한에 걸리면 지금 상태를 돌려줌
                  lastRequestAt = Date.now();
                  socket.setTimeout(FLUSH_WAIT_MS + 2000, () => socket.destroy());
                  const flushed = graph && !initializing ? graph.flushWatcher() : Promise.resolve();
                  void Promise.race([flushed.catch(() => {}), delay(FLUSH_WAIT_MS)]).then(() => {
                      if (!socket.destroyed) socket.end(JSON.stringify(snapshot()) + '\n');
                  });
              } else {
  ```
- 6e 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 235~236줄, 심장 박동의 상태 쓰기
- 6e 변경 전:
  ```js
          try { persist(); } catch (error) { writeDiagnostic(`Watcher state write failed: ${error.message}\n`); }
      }, 1000);
  ```
- 6e 변경 후:
  ```js
          try { persist(); writeFailing = false; }
          catch (error) {
              // 실패가 이어지는 동안은 한 번만 기록하고 다음 박동에 다시 씀
              if (!writeFailing) writeDiagnostic(`Watcher state write failed: ${error.message}\n`);
              writeFailing = true;
          }
      }, 1000);
  ```
- 6f 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js` 246~246줄, module.exports
- 6f 변경 전:
  ```js
  module.exports = { runWatcher };
  ```
- 6f 변경 후:
  ```js
  module.exports = { runWatcher, createStateWriter };
  ```
- 6g 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/manager.js` 24~24줄, `stopWatcher` 앞
- 6g 변경 전:
  ```js
  async function stopWatcher(projectPath, options = {}) {
  ```
- 6g 변경 후:
  ```js
  // 감시기에게 기다리던 변경을 지금 맞추게 하고 끝날 때까지 기다림(W2). 응답이 없으면 지금 상태를 돌려줌
  async function flushWatcher(projectPath, options = {}) {
      const location = protocol.locations(projectPath);
      const response = await protocol.request(location, 'flush', options.timeoutMs ?? 32000);
      return response.error ? watcherStatus(projectPath) : response;
  }

  async function stopWatcher(projectPath, options = {}) {
  ```
- 6h 위치: `D:/Fork/KIT/tools/codegraph/source/lib/watch/manager.js` 148~148줄, module.exports
- 6h 변경 전:
  ```js
  module.exports = { ensureWatcher, stopWatcher, watcherStatus, listWatchers, runWatcher: (...args) => require('./worker').runWatcher(...args) };
  ```
- 6h 변경 후:
  ```js
  module.exports = { ensureWatcher, stopWatcher, flushWatcher, watcherStatus, listWatchers, runWatcher: (...args) => require('./worker').runWatcher(...args) };
  ```
- 6i 위치: `D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js` 19~21줄, `syncForRead` 첫 부분
- 6i 변경 전:
  ```js
  async function syncForRead(graph, projectPath, extra = {}) {
      const watcher = await manager.watcherStatus(projectPath);
      if (publishedByWatcher(graph, watcher)) {
  ```
- 6i 변경 후:
  ```js
  async function syncForRead(graph, projectPath, extra = {}) {
      let watcher = await manager.watcherStatus(projectPath);
      // 같은 런타임의 감시기가 맞추는 중이거나 기다리는 변경이 있으면 직접 sync 하지 않고 감시기의 맞추기를 기다림(W2)
      if (!publishedByWatcher(graph, watcher) && watcher.active && watcher.runtimeId === protocol.runtimeId()) {
          watcher = await manager.flushWatcher(projectPath);
      }
      if (publishedByWatcher(graph, watcher)) {
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/watch/worker.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['const FLUSH_WAIT_MS = 30000;','const STATE_REFRESH_MS = 5000;','function createStateWriter(write, refreshMs = STATE_REFRESH_MS, now = Date.now)','const writeState = createStateWriter(','request.command === ','graph.flushWatcher()','writeFailing = true;','module.exports = { runWatcher, createStateWriter };']])"`
- 기대 출력 1: `1 1 1 1 3 1 1 1`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/watch/manager.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['async function flushWatcher(projectPath, options = {})','stopWatcher, flushWatcher, watcherStatus']])"`
- 기대 출력 2: `1 1`
- 검증 3: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness.js',encoding='utf-8').read(); print(*[t.count(s) for s in ['let watcher = await manager.watcherStatus(projectPath);','watcher = await manager.flushWatcher(projectPath);']])"`
- 기대 출력 3: `1 1`
- 검증 4: `node -e "require('D:/Fork/KIT/tools/codegraph/source/lib/watch/worker'); require('D:/Fork/KIT/tools/codegraph/source/lib/watch/manager'); require('D:/Fork/KIT/tools/codegraph/source/lib/bin/freshness'); console.log('load ok')"`
- 기대 출력 4: `load ok` (stderr 의 SQLite ExperimentalWarning 은 무시)

### 단계 7: 설치기는 감시기를 멈추기만 함(W5)
- 파일: `D:/Fork/KIT/tools/codegraph/install.ps1`, `D:/Fork/KIT/tools/codegraph/install.sh`
- 동작: replace (7a~7d)
- 7a 위치: `D:/Fork/KIT/tools/codegraph/install.ps1` 139~156줄, `Upgrade-Watchers` 함수 전체
- 7a 변경 전:
  ```powershell
  function Upgrade-Watchers([string]$Root, [string[]]$RestartProjects = @()) {
      if ($env:CODEGRAPH_NO_WATCH -eq '1') { return }
      $managerPath = Join-Path $Root 'lib\dist\watch\manager.js'
      if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) { return }
      $script = @'
  const manager = require(process.argv[1]);
  (async () => {
    const projects = new Set([...JSON.parse(process.argv[2]), ...(await manager.listWatchers()).map(watcher => watcher.projectPath)]);
    for (const projectPath of projects) {
      const running = await manager.ensureWatcher(projectPath, { timeoutMs: 30000 });
      if (!running.active || running.restartPending) throw new Error(`Watcher migration is incomplete for ${projectPath}: ${running.phase || 'inactive'}`);
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
  '@
      $restartJson = ConvertTo-Json -InputObject @($RestartProjects) -Compress
      & (Join-Path $Root 'node.exe') -e $script $managerPath $restartJson
      if (-not $?) { throw 'CodeGraph was installed, but an active project watcher could not migrate to the installed runtime.' }
  }
  ```
- 7a 변경 후:
  ```powershell
  # 설치 뒤 활성 감시기를 새 런타임으로 옮기지 않고 멈추기만 함(W5). 다음 CLI 사용 때 새 런타임으로 다시 뜸.
  # 옮기면 감시기마다 새 런타임으로 처음부터 다시 맞추고, 모델이 바뀐 설치에서는 한꺼번에 다시 임베딩함
  function Stop-ActiveWatchers([string]$Root) {
      if ($env:CODEGRAPH_NO_WATCH -eq '1') { return }
      $managerPath = Join-Path $Root 'lib\dist\watch\manager.js'
      if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) { return }
      $script = @'
  const manager = require(process.argv[1]);
  (async () => {
    for (const watcher of await manager.listWatchers()) {
      const stopped = await manager.stopWatcher(watcher.projectPath, { timeoutMs: 30000 });
      if (stopped.active || stopped.stopPending) throw new Error(`Watcher did not stop: ${watcher.projectPath}`);
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
  '@
      & (Join-Path $Root 'node.exe') -e $script $managerPath
      if (-not $?) { throw 'CodeGraph was installed, but an active project watcher could not stop.' }
  }
  ```
- 7b 위치: `D:/Fork/KIT/tools/codegraph/install.ps1` 390~394줄, 설치 실패 되돌리기의 catch
- 7b 변경 전:
  ```powershell
          } catch {
              if ($restartProjects.Count -gt 0 -and (Test-Path -LiteralPath $launcher -PathType Leaf)) {
                  Upgrade-Watchers $target $restartProjects
              }
              throw
  ```
- 7b 변경 후:
  ```powershell
          } catch {
              # 되돌린 옛 런타임의 감시기는 다시 띄우지 않음. 다음 CLI 사용 때 뜸(W5)
              throw
  ```
- 7c 위치: `D:/Fork/KIT/tools/codegraph/install.ps1` 431~431줄, 설치 끝의 감시기 처리
- 7c 변경 전:
  ```powershell
  if (-not $WhatIfPreference) { Upgrade-Watchers $target $restartProjects }
  ```
- 7c 변경 후:
  ```powershell
  if (-not $WhatIfPreference) { Stop-ActiveWatchers $target }
  ```
- 7d 위치: `D:/Fork/KIT/tools/codegraph/install.sh` 170~180줄, 설치 끝의 감시기 처리
- 7d 변경 전:
  ```sh
  if [ "$dry_run" -eq 0 ] && [ "${CODEGRAPH_NO_WATCH:-}" != 1 ] && [ -f "$target/lib/dist/watch/manager.js" ]; then
      "$target/node" - "$target/lib/dist/watch/manager.js" <<'JS'
  const manager = require(process.argv[2]);
  (async () => {
      for (const watcher of await manager.listWatchers()) {
          const running = await manager.ensureWatcher(watcher.projectPath, { timeoutMs: 30000 });
          if (!running.active || running.restartPending) throw new Error(`Watcher migration is incomplete for ${watcher.projectPath}: ${running.phase || 'inactive'}`);
      }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
  JS
  fi
  ```
- 7d 변경 후:
  ```sh
  # 설치 뒤 활성 감시기를 새 런타임으로 옮기지 않고 멈추기만 함(W5). 다음 CLI 사용 때 새 런타임으로 다시 뜸
  if [ "$dry_run" -eq 0 ] && [ "${CODEGRAPH_NO_WATCH:-}" != 1 ] && [ -f "$target/lib/dist/watch/manager.js" ]; then
      "$target/node" - "$target/lib/dist/watch/manager.js" <<'JS'
  const manager = require(process.argv[2]);
  (async () => {
      for (const watcher of await manager.listWatchers()) {
          const stopped = await manager.stopWatcher(watcher.projectPath, { timeoutMs: 30000 });
          if (stopped.active || stopped.stopPending) throw new Error(`Watcher did not stop: ${watcher.projectPath}`);
      }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
  JS
  fi
  ```
- 검증 1: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/install.ps1',encoding='utf-8').read(); print(*[t.count(s) for s in ['function Stop-ActiveWatchers(','Stop-ActiveWatchers ','Upgrade-Watchers','ensureWatcher']])"`
- 기대 출력 1: `1 1 0 0`
- 검증 2: `python -c "t=open(r'D:/Fork/KIT/tools/codegraph/install.sh',encoding='utf-8').read(); print(*[t.count(s) for s in ['manager.stopWatcher(watcher.projectPath','ensureWatcher']])"`
- 기대 출력 2: `1 0`

### 단계 8: 시험
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/watch-speed.test.cjs`, `D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer-WatcherStop.Tests.ps1`, `D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs`
- 동작: create (8a, 8b), replace (8c, 8d), 그다음 명령 실행
- 8a 새 파일: `D:/Fork/KIT/tools/codegraph/source/test/watch-speed.test.cjs`
- 8a 내용:
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const { CodeGraph, FileWatcher } = require('../lib');
  const scanFiles = require('../lib/docs/scan-files');
  const manager = require('../lib/watch/manager');
  const { createStateWriter } = require('../lib/watch/worker');

  function environment(context, values) {
      const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
      for (const [key, value] of Object.entries(values)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
      }
      context.after(() => {
          for (const [key, value] of Object.entries(previous)) {
              if (value === undefined) delete process.env[key];
              else process.env[key] = value;
          }
      });
  }

  function temporaryRoot(context, prefix) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      context.after(() => fs.rmSync(root, { recursive: true, force: true }));
      return root;
  }

  test('watcher passes pending paths after the first full reconcile and goes full for a large batch', async t => {
      const root = temporaryRoot(t, 'cg-watch-paths-');
      const calls = [];
      let hold = false;
      let release;
      const watcher = new FileWatcher(root, async paths => {
          calls.push(paths);
          if (hold) { hold = false; await new Promise(resolve => { release = resolve; }); }
          return { filesChanged: 0, durationMs: 0, full: !paths };
      }, { debounceMs: 100 });
      t.after(() => { release?.(); watcher.stop(); });
      assert.equal(watcher.start(), true);
      await watcher.waitUntilReady();
      await t.waitFor(() => assert.equal(calls.length, 1), { timeout: 5000 });
      assert.equal(calls[0], undefined);
      fs.writeFileSync(path.join(root, 'Edit.cs'), 'public class Edit {}');
      await t.waitFor(() => assert.equal(calls.length, 2), { timeout: 5000 });
      assert.deepEqual(calls[1], ['Edit.cs']);
      // 맞추는 동안 201개가 쌓이면 다음 맞추기는 경로 없이 전체 sync 로 함
      hold = true;
      fs.writeFileSync(path.join(root, 'Hold.cs'), 'public class Hold {}');
      await t.waitFor(() => assert.ok(release), { timeout: 5000 });
      for (let index = 0; index <= 200; index++) fs.writeFileSync(path.join(root, `Bulk${index}.cs`), `public class Bulk${index} {}`);
      await t.waitFor(() => assert.equal(watcher.getPendingFiles().length, 202), { timeout: 10000 });
      release();
      await t.waitFor(() => assert.deepEqual(watcher.getPendingFiles(), []), { timeout: 10000 });
      assert.deepEqual(calls[2], ['Hold.cs']);
      assert.equal(calls[3], undefined);
  });

  test('flushNow reconciles pending edits at once instead of waiting for the debounce', async t => {
      const root = temporaryRoot(t, 'cg-watch-flush-now-');
      const calls = [];
      const watcher = new FileWatcher(root, async paths => { calls.push(paths); return { filesChanged: 0, durationMs: 0 }; }, { debounceMs: 60000 });
      t.after(() => watcher.stop());
      assert.equal(watcher.start(), true);
      await watcher.waitUntilReady();
      await watcher.flushNow();
      assert.deepEqual(calls, [undefined]);
      fs.writeFileSync(path.join(root, 'Late.cs'), 'public class Late {}');
      await t.waitFor(() => assert.equal(watcher.getPendingFiles().length, 1), { timeout: 5000 });
      await watcher.flushNow();
      assert.deepEqual(calls, [undefined, ['Late.cs']]);
      assert.deepEqual(watcher.getPendingFiles(), []);
      await watcher.flushNow();
      assert.equal(calls.length, 2);
  });

  test('sync with known paths reconciles only those files without listing the tree', async context => {
      environment(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1' });
      const root = temporaryRoot(context, 'codegraph-targeted-');
      execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
      fs.writeFileSync(path.join(root, 'Alpha.cs'), 'public class Alpha { void First() {} }\n');
      fs.writeFileSync(path.join(root, 'Beta.cs'), 'public class Beta { void Keep() {} }\n');
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nfirst\n');
      fs.writeFileSync(path.join(root, 'Other.md'), '# Other\n');
      const graph = CodeGraph.initSync(root);
      context.after(() => graph.close());
      const db = graph.getDb();
      assert.equal((await graph.indexAll()).success, true);
      fs.writeFileSync(path.join(root, 'Alpha.cs'), 'public class Alpha { void First() {} void Second() {} }\n');
      fs.writeFileSync(path.join(root, 'Notes.md'), '# Notes\n\nsecond revision\n');
      const listing = context.mock.method(scanFiles, 'listVisibleFiles', () => { throw new Error('targeted sync must not list the tree'); });
      const targeted = await graph.sync({ paths: ['Alpha.cs', 'Notes.md'] });
      assert.equal(targeted.status, 'current', JSON.stringify(targeted));
      assert.equal(targeted.scope, 'paths');
      assert.equal(targeted.filesChecked, 1);
      assert.equal(targeted.filesModified, 1);
      assert.deepEqual(targeted.docPaths, ['Notes.md']);
      assert.ok(graph.getNodesInFile('Alpha.cs').some(node => node.name === 'Second'));
      assert.equal(db.prepare("SELECT COUNT(*) AS c FROM mdast_metadata WHERE file_path = 'Other.md'").get().c, 1);
      assert.ok(db.prepare("SELECT path FROM file_inventory WHERE path = 'Beta.cs'").get());
      fs.rmSync(path.join(root, 'Beta.cs'));
      const removed = await graph.sync({ paths: ['Beta.cs'] });
      assert.equal(removed.scope, 'paths');
      assert.equal(removed.filesRemoved, 1);
      assert.equal(graph.getNodesInFile('Beta.cs').length, 0);
      assert.equal(db.prepare("SELECT path FROM file_inventory WHERE path = 'Beta.cs'").get(), undefined);
      assert.ok(db.prepare("SELECT path FROM file_inventory WHERE path = 'Other.md'").get());
      assert.equal(listing.mock.callCount(), 0);
      listing.mock.restore();
      // 새 경로나 무시 규칙 파일이 섞이면 전체 sync 로 감
      fs.writeFileSync(path.join(root, 'Gamma.cs'), 'public class Gamma {}\n');
      const added = await graph.sync({ paths: ['Gamma.cs'] });
      assert.equal(added.scope, 'full');
      assert.ok(graph.getNodesInFile('Gamma.cs').some(node => node.name === 'Gamma'));
      assert.equal((await graph.sync({ paths: ['.gitignore'] })).scope, 'full');
      assert.equal((await graph.sync()).scope, 'full');
  });

  test('watcher state is written only when it changes or the refresh interval passes', () => {
      let now = 1000;
      let fail = false;
      const writes = [];
      const write = createStateWriter(state => {
          if (fail) throw new Error('EPERM');
          writes.push(state.phase);
      }, 5000, () => now);
      assert.equal(write({ phase: 'watching', heartbeatAt: 1 }), true);
      now += 1000;
      assert.equal(write({ phase: 'watching', heartbeatAt: 2 }), false);
      assert.equal(write({ phase: 'reconciling', heartbeatAt: 3 }), true);
      now += 5000;
      assert.equal(write({ phase: 'reconciling', heartbeatAt: 4 }), true);
      fail = true;
      assert.throws(() => write({ phase: 'stopped', heartbeatAt: 5 }), /EPERM/);
      fail = false;
      assert.equal(write({ phase: 'stopped', heartbeatAt: 6 }), true);
      assert.deepEqual(writes, ['watching', 'reconciling', 'reconciling', 'stopped']);
  });

  test('a flush request makes the watcher publish a pending edit through a targeted sync', { timeout: 90000 }, async t => {
      environment(t, {
          CODEGRAPH_NO_WATCH: undefined,
          CODEGRAPH_DOCS: '0',
          CODEGRAPH_DISABLE_EMBEDDINGS: '1',
          CODEGRAPH_WATCH_REGISTRY: temporaryRoot(t, 'cg-watch-registry-'),
      });
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-flush-'));
      fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Health() { return 1; } }');
      const initial = await CodeGraph.init(root, { index: true });
      initial.close();
      let reader = null;
      t.after(async () => {
          reader?.close();
          await manager.stopWatcher(root);
          fs.rmSync(root, { recursive: true, force: true });
      });
      const started = await manager.ensureWatcher(root, { debounceMs: 60000 });
      assert.equal(started.active, true);
      await t.waitFor(async () => assert.equal((await manager.flushWatcher(root)).ready, true), { timeout: 30000 });
      fs.writeFileSync(path.join(root, 'Combat.cs'), 'public class Combat { public int Shield() { return 2; } }');
      await t.waitFor(async () => assert.equal((await manager.watcherStatus(root)).pendingFiles.length, 1), { timeout: 15000 });
      const flushed = await manager.flushWatcher(root);
      assert.equal(flushed.ready, true, JSON.stringify(flushed));
      assert.deepEqual(flushed.pendingFiles, []);
      assert.equal(flushed.lastSync.full, false);
      reader = CodeGraph.openSync(root);
      assert.ok(reader.getDb().prepare('SELECT name FROM nodes WHERE name = ?').get('Shield'));
  });
  ```
- 8b 새 파일: `D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer-WatcherStop.Tests.ps1`
- 8b 내용:
  ```powershell
  # W5: 설치기는 활성 감시기를 새 런타임으로 옮기지 않고 멈추기만 한다. 다음 CLI 사용 때 새 런타임으로 뜬다
  Describe 'CodeGraph installer watcher handling' {
      BeforeAll {
          $root = Split-Path -Parent $PSScriptRoot
          $ps1 = Get-Content -Raw -LiteralPath (Join-Path $root 'install.ps1')
          $sh = Get-Content -Raw -LiteralPath (Join-Path $root 'install.sh')
      }
      It 'install.ps1 stops active watchers instead of migrating them' {
          $ps1 | Should -Match 'function Stop-ActiveWatchers\(\[string\]\$Root\)'
          $ps1 | Should -Match 'Stop-ActiveWatchers \$target'
          $ps1 | Should -Not -Match 'Upgrade-Watchers'
          $ps1 | Should -Not -Match 'ensureWatcher'
      }
      It 'install.sh stops active watchers instead of migrating them' {
          $sh | Should -Match 'manager\.stopWatcher\(watcher\.projectPath'
          $sh | Should -Not -Match 'ensureWatcher'
      }
  }
  ```
- 8c 위치: `D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs` 52~55줄, 둘째 시험의 mock 과 개수 확인
- 8c 변경 전:
  ```js
      const status = context.mock.method(manager, 'watcherStatus', async () => watchers.shift() ?? ready);
      const sync = context.mock.method(graph, 'sync');
      for (let index = 0; index < 4; index++) assert.equal((await syncForRead(graph, root)).status, 'current');
      assert.equal(sync.mock.callCount(), 4);
  ```
- 8c 변경 후:
  ```js
      const status = context.mock.method(manager, 'watcherStatus', async () => watchers.shift() ?? ready);
      // 같은 런타임의 바쁜 감시기에는 먼저 flush 를 청하고, 그래도 보증하지 못하면 직접 맞춤(W2)
      const flush = context.mock.method(manager, 'flushWatcher', async () => ({ ...ready, ready: false }));
      const sync = context.mock.method(graph, 'sync');
      for (let index = 0; index < 4; index++) assert.equal((await syncForRead(graph, root)).status, 'current');
      assert.equal(sync.mock.callCount(), 4);
      assert.equal(flush.mock.callCount(), 2);
  ```
- 8d 위치: `D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs` 61~63줄, 파일 끝(둘째 시험 끝)
- 8d 변경 전:
  ```js
      assert.equal(sync.mock.callCount(), 5);
      assert.equal(status.mock.callCount(), 5);
  });
  ```
- 8d 변경 후:
  ```js
      assert.equal(sync.mock.callCount(), 5);
      assert.equal(status.mock.callCount(), 5);
  });

  test('reads wait for a busy watcher of the same runtime instead of reconciling inline', async context => {
      const { root, graph } = await indexedProject(context);
      const ready = { active: true, ready: true, pendingFiles: [], runtimeId: protocol.runtimeId(), configuration: { respectGitignore: true }, lastSync: { warnings: [] } };
      context.mock.method(manager, 'watcherStatus', async () => ({ ...ready, ready: false, pendingFiles: [{ path: 'Runner.cs' }] }));
      const flush = context.mock.method(manager, 'flushWatcher', async () => ready);
      const sync = context.mock.method(graph, 'sync');
      assert.equal((await syncForRead(graph, root)).status, 'current');
      assert.equal(flush.mock.callCount(), 1);
      assert.equal(sync.mock.callCount(), 0);
  });
  ```
- 8e 새 시험: `node --test D:/Fork/KIT/tools/codegraph/source/test/watch-speed.test.cjs; echo exit=$?`
- 8e 기대 출력: 마지막 줄 `exit=0` (pass 5)
- 8f 회귀 시험: `cd D:/Fork/KIT/tools/codegraph/source/ && node --test test/freshness.test.cjs test/cli.test.cjs test/indexing-regression.test.cjs test/indexing-resolution.test.cjs test/indexing-lock.test.cjs test/indexing-revision.test.cjs test/sync-speed.test.cjs test/watcher.test.cjs test/watcher-cli-edge.test.cjs test/watcher-daemon.test.cjs; echo exit=$?`
- 8f 기대 출력: 마지막 줄 `exit=0`. `watcher-hooks.test.cjs` 는 변경 전부터 3건 실패라 넣지 않음.
- 8g 문서·검색 시험: `node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp-conditional.test.cjs; echo exit=$?`
- 8g 기대 출력: 마지막 줄 `exit=0`
- 8h Pester(PowerShell 도구): `Import-Module Pester -MinimumVersion 5.0 -ErrorAction Stop; $r = Invoke-Pester -Path D:/Fork/KIT/tools/codegraph/test/Codegraph-Installer-WatcherStop.Tests.ps1 -PassThru -Output Detailed; if ($r.FailedCount -gt 0 -or $r.PassedCount -lt 2) { exit 1 }`
- 8h 기대 결과: 종료 코드 0, `Tests Passed: 2`. `Import-Module` 이 실패하면(Pester 5 없음) `CURRENT=멈춤 S8: Pester 5 없음` 으로 쓰고 멈춤.
- 8i 사본 대조: `node D:/Fork/.AI/context/search-eval/watch-speed.cjs verify; echo exit=$?`
- 8i 기대 출력: 첫 줄 `1d99f2f9141bbb57e104f6d1d83d137ab93471968b9f97e064423c8a1d919f53`, 다음 두 줄 `install.ps1 0051db8d…`, `install.sh 352215fb…`, 마지막 줄 `exit=0`. `exit=5` 면 `MODE=BLOCKED`, `CURRENT=멈춤 S8: 바꾼 소스나 설치기가 시험한 사본과 다름` 으로 쓰고 멈춤. 8e~8h 중 하나라도 실패하면 `CURRENT=멈춤 S8: <시험 이름>` 으로 쓰고 멈춤.

### 단계 9: 바꾼 뒤 감시기 측정
- 파일: `D:/Fork/.AI/context/search-eval/results/watch-speed-after.json`, `watch-speed.json`, `watch-speed.md` (명령이 만듦)
- 위치: 명령 실행
- 동작: 실행
- 실행(1~3분): `cd D:/Fork/.AI/context/search-eval/ && node watch-speed.cjs after > results-watch-after.log 2>&1; echo exit=$?`
- 판정:
  - `exit=0`: 다음 단계로 감.
  - `exit=3`: 감시기가 변경을 놓쳤거나 고친 내용이 질의에 반영되지 않음. `MODE=BLOCKED`, `CURRENT=멈춤 S9: results/watch-speed.json 확인` 으로 쓰고 멈춤.
  - 그 밖의 값: `MODE=BLOCKED`, `CURRENT=멈춤 S9: results-watch-after.log 확인` 으로 쓰고 멈춤.
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/watch-speed.json', encoding='utf-8')); print(r['passed'], r['after']['missed'], r['after']['idleStateWrites'] <= 6)"`
- 기대 출력: `True 0 True`

### 단계 10: 빌드, 전역 설치, 이 저장소 맞추기(사용자 승인 필요)
- 파일: KIT `artifacts/codegraph-win32-x64.zip`, `manifest.json`, 전역 설치본, 이 저장소의 배포 사본
- 위치: 명령 실행
- 동작: 실행
- 실행 전: AskUserQuestion 으로 "빌드·전역 설치·이 저장소 동기화를 진행할까요?" 를 묻고, 승인이 없으면 상태 파일 `CURRENT=S10 승인 대기` 로 쓰고 멈춤(MODE 는 EXECUTE 유지).
- 실행 도구: 10a, 10b, 10c 는 Bash 가 아니라 PowerShell 도구로 직접 실행함(묶음 1 의 10단계와 같은 까닭).
- 10a 빌드(PowerShell 도구, 백그라운드): `Set-Location D:/Fork/KIT/tools/codegraph; node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`
- 10a 확인: 종료 코드가 0 이 아니거나 `D:/Fork/KIT/tools/codegraph/artifacts/codegraph-win32-x64.zip` 의 수정 시각이 이번 실행 시각보다 앞서면 `MODE=BLOCKED`, `CURRENT=멈춤 S10: build` 로 쓰고 멈춤.
- 10b 설치(PowerShell 도구, 백그라운드): `$env:CODEGRAPH_NO_WATCH = '1'; & D:/Fork/KIT/tools/codegraph/install.ps1; if (-not $?) { exit 1 }`
- 10c 이 저장소 맞추기(PowerShell 도구. robocopy 종료 코드는 8 미만이 성공): `robocopy D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/grammars D:/Fork/codegraph/grammars /MIR /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/artifacts D:/Fork/codegraph/artifacts /MIR /NFL /NDL /NJH /NJS /NP; Copy-Item D:/Fork/KIT/tools/codegraph/build.mjs,D:/Fork/KIT/tools/codegraph/install.ps1,D:/Fork/KIT/tools/codegraph/install.sh,D:/Fork/KIT/tools/codegraph/manifest.json,D:/Fork/KIT/tools/codegraph/LICENSE D:/Fork/codegraph/ -Force`
- 검증(Bash. 전역 shim 이 가리키는 설치 폴더 이름 끝 12자는 새 zip 의 sha256 앞 12자임): `S=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}' ~/.local/bin/codegraph.cmd | sed 's/.*-//'); grep -c "\"sha256\": \"$S" D:/Fork/KIT/tools/codegraph/manifest.json; codegraph --help | grep -c docs-batch; diff -rq D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source --exclude=node_modules | wc -l; grep -c Stop-ActiveWatchers D:/Fork/codegraph/install.ps1`
- 기대 출력: `1`, `1`, `0`, `2`. 첫 줄이 `0` 이면 옛 빌드가 설치된 것임

## 수락 기준
```acceptance
{"id":"V1","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/watch-speed.test.cjs","expect":"exit0"}
{"id":"V2","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/freshness.test.cjs D:/Fork/KIT/tools/codegraph/source/test/cli.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-resolution.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-lock.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-revision.test.cjs D:/Fork/KIT/tools/codegraph/source/test/sync-speed.test.cjs","expect":"exit0"}
{"id":"V3","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/watcher.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-cli-edge.test.cjs D:/Fork/KIT/tools/codegraph/source/test/watcher-daemon.test.cjs","expect":"exit0"}
{"id":"V4","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-cache.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-embed-tokenization.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-csharp-conditional.test.cjs","expect":"exit0"}
{"id":"V5","kind":"auto","cmd":"node D:/Fork/.AI/context/search-eval/watch-speed.cjs verify","expect":"exit0"}
{"id":"V6","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/watch-speed.json');process.exit(r.passed===true?0:1)\"","expect":"exit0"}
{"id":"V7","kind":"human","how":"KIT test/Codegraph-Installer.Tests.ps1 에서 설치 뒤 감시기가 새 런타임으로 다시 뜨는지 보는 시험을 '설치 뒤 감시기가 멈춰 있음'을 보도록 고친 뒤, PowerShell 에서 Invoke-Pester -Path D:/Fork/KIT/tools/codegraph/test 를 돌림","expect":"Codegraph-Installer-WatcherStop.Tests.ps1 의 2건을 포함해 모두 통과함. 변경 전부터 실패하던 시험이 있으면 그 이름을 Review Pack 에 적음"}
{"id":"V8","kind":"human","how":"D:/Fork/.AI/context/search-eval/results/watch-speed.md 의 표를 봄","expect":"놓친 변경 수가 둘 다 0, 고친 내용이 query 에 반영됨이 둘 다 true, 쉬는 20초 동안 watcher.json 쓰기 횟수가 기준선의 절반 이하, 고친 직후 query 중앙값이 기준선보다 크게 늘지 않음"}
```

## 하지 않는 것
- KIT 규칙 문서(`rules/doc-graph.md`, `references/DOC_GRAPH_POLICY.md`)에서 질의의 `CODEGRAPH_NO_WATCH=1` 을 빼는 정책 변경(innovate 10절)은 하지 않음. G2 뒤 사람이 정함. 설치와 시험에는 계속 남김.
- W4(Windows 단일 재귀 감시), W6(KIT 소스 CLI 정책), K2, N1 은 하지 않음. 측정이 먼저임(innovate 12절).
- 감시기가 소스도 문서도 아닌 파일의 이벤트로 sync 하게 바꾸지 않음.
- 실제 프로젝트(Arcyn 등)에 감시기를 띄워 재는 일은 하지 않음.
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
