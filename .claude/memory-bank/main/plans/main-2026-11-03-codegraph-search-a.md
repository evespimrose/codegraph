# 플랜: 안 A — 평가 장치, 순위 조정(D1 D2 D6), 식별자 분해(C1), 모델 로딩 겹치기(S2), 설치(S1)

## 목표
재임베딩 없이 문서·코드 검색의 Hit@1 을 올리고, 같은 질문 묶음으로 바꾸기 전과 후를 재서 기준선보다 나쁘지 않은 설정만 기본값으로 남긴다.

## 전제와 실행 규칙
- 근거 문서: `.claude/memory-bank/main/plans/main-2026-11-03-codegraph-structure-innovate.md` 3~6절. 라벨(E1, E2, S1, S2, D1, D2, D6, C1)의 뜻은 그 문서 끝 `## 라벨` 에 있음.
- 고치는 소스는 KIT(`D:/Fork/KIT/tools/codegraph/source`)임. 이 저장소(`D:/Fork/codegraph`)는 10단계에서만 바뀜.
- 측정 도구는 `D:/Fork/.AI/context/search-eval/` 에 둠. 앞선 평가(`rerank-eval`, `atom-eval`, `arcyn-docs-eval`)와 같은 곳임.
- 한 단계에 같은 파일이나 묶음의 변경이 여럿이면 `a`, `b`, `c` 로 나눔. 각 변경은 "변경 전" 원문을 찾아 "변경 후" 로 바꿈.
- 코드 블록은 목록 안에 있어 모든 줄 앞에 2칸이 더 붙어 있음. 파일과 맞출 때와 파일에 쓸 때 각 줄 앞 2칸을 뺌. 그 뒤의 들여쓰기는 파일 원문 그대로임.
- 단계 순서를 지킴. 2단계(기준선 측정)는 3~8단계보다 먼저 해야 함. 기준선은 바꾸기 전 소스로 재야 함.
- 모든 명령은 Git Bash 에서 돌림. `node` 는 PATH 의 v24 임.
- G1 승인은 1단계 `code-sets.tsv` 의 질문과 정답 확인을 겸함(사용자 결정 4: 모델 초안, 사람 확인, 검색 결과를 보기 전에 확정).
- 단계가 실패하면 고치려 하지 말고 멈춤. 상태 파일 `MODE=BLOCKED`, `CURRENT=멈춤 S<단계>: <한 줄 원인>` 으로 씀.

## 바뀔 파일
- `D:/Fork/.AI/context/search-eval/code-sets.tsv`: 새 파일. 코드 평가 질문 40개(E2)
- `D:/Fork/.AI/context/search-eval/run.cjs`: 새 파일. 기준선 측정과 설정 고르기(E1, E2)
- `D:/Fork/.AI/context/search-eval/.gitignore`: 새 파일. 색인 복사본 제외
- `D:/Fork/.AI/context/search-eval/results/`: 측정 결과(실행이 만듦)
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`: 새 파일. 순위 조정 기본값. 9단계 측정이 다시 씀
- `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js`: 새 파일. 기본값과 환경 변수 읽기
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js`: 열 가중치(D1), 어휘 비중(D2)
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.d.ts`: `fuseHits` 인자
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js`: 질의별 어휘 비중(D2), 마크다운 우선(D6), 모델 로딩 먼저 시작(S2)
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/embed.js`: 로딩 중 약속 공유, `warmEmbedder`
- `D:/Fork/KIT/tools/codegraph/source/lib/docs/embed.d.ts`: `warmEmbedder` 선언
- `D:/Fork/KIT/tools/codegraph/source/lib/search/name-tokens.js`: 새 파일. 식별자 낱말 분해(C1)
- `D:/Fork/KIT/tools/codegraph/source/lib/db/migration-v12.js`: 새 파일. `nodes.name_tokens` 와 FTS 열 추가
- `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.js`: v12 등록
- `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.d.ts`: 스키마 버전 12
- `D:/Fork/KIT/tools/codegraph/source/lib/db/schema.sql`: 새 DB 의 `name_tokens` 열, FTS, 트리거
- `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js`: `name_tokens` 쓰기, FTS 열 가중치
- `D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs`: 새 시험
- 10단계(사용자 승인 뒤): KIT 배포 zip, 전역 설치본, 이 저장소의 `source/`, `grammars/`, `artifacts/`, `build.mjs`, `install.ps1`, `install.sh`, `manifest.json`

## 단계

### 단계 1: 코드 평가 질문 묶음(E2)
- 파일: `D:/Fork/.AI/context/search-eval/code-sets.tsv`
- 위치: 새 파일
- 동작: create
- 변경 전:
  ```
  없음
  ```
- 변경 후: (열: 묶음|ID|구분|키워드 질의|자연어 질의|정답. 정답은 `파일 경로#심볼 이름`, 여럿이면 `;`. 표본은 색인에서 고정 시드 `20261103` 으로 뽑은 C# 심볼임)
  ```
  rx1|r01|tune|cost map|경로 탐색에서 출구와 이어진 셀마다 비용 지도를 쌓는 곳|Assets/Core/Scripts/Pathfinding/Domain/CostMapBuilder.cs#CostMapBuilder
  rx1|r02|report|hide if|조건이 맞으면 인스펙터에서 필드를 숨기는 속성|Assets/Percent_Editor/Runtime/Attributes/ConditionAttributes.cs#HideIfAttribute
  rx1|r03|tune|palette popup|color picker popup opened from a layer palette button|Assets/Core/Scripts/Pathfinding/Presentation/PalettePopupController.cs#PalettePopupController
  rx1|r04|report|layer view|층별 레이어를 켜고 끄는 포커스 모드 상태 관리|Assets/Core/Scripts/Pathfinding/Presentation/Helpers/LayerViewController.cs#LayerViewController
  rx1|r05|tune|range selection|obstacle range selection state machine with start, mid and end cells|Assets/Core/Scripts/Pathfinding/Presentation/Logic/RangeSelectionLogic.cs#RangeSelectionLogic
  rx1|r06|report|edit history|그리드 편집 되돌리기 기록을 최대 20단계로 남기는 곳|Assets/Core/Scripts/Pathfinding/Presentation/Logic/GridEditHistory.cs#GridEditHistory
  rx1|r07|tune|direction util|helper for the six axis directions and cached exit directions|Assets/Core/Scripts/Pathfinding/Domain/Direction.cs#DirectionUtil
  rx1|r08|report|card entry|장애물 프리셋 패널에서 카드 버튼의 클릭 리스너를 해제하는 항목|Assets/Core/Scripts/Pathfinding/Presentation/ObstaclePresetPanelController.cs#CardEntry
  rx1|r09|tune|value changed|attribute that calls a method when a field value changes in the inspector|Assets/Percent_Editor/Runtime/Attributes/OnValueChangedAttribute.cs#OnValueChangedAttribute
  rx1|r10|report|solve request|경로 계산 요청에 그리드, 포트, 직진 비용, 회전 비용을 담는 구조체|Assets/Core/Scripts/Pathfinding/Domain/SolveRequest.cs#SolveRequest
  rx1|r11|tune|create label|create a TextMeshPro label for a coordinate gizmo axis|Assets/Core/Scripts/Pathfinding/Presentation/CoordinateGizmo.cs#CreateLabel
  rx1|r12|report|after delay|툴팁을 지연 시간 뒤에 띄우는 비동기 처리|Assets/Core/Scripts/Pathfinding/Presentation/Helpers/UITooltipTrigger.cs#ShowAfterDelay
  rx1|r13|tune|ensure styles|hint guide editor creates GUI styles for lines and meta text|Assets/Core/Scripts/Pathfinding/Presentation/UxHints/UxHintGuideSOEditor.cs#EnsureStyles
  rx1|r14|report|zoom bounds|그리드 크기에 따라 카메라 최대 줌 범위를 다시 계산|Assets/Core/Scripts/Pathfinding/Presentation/CameraController.cs#UpdateZoomBounds
  rx1|r15|tune|axis geometry|rebuild the dimension line mesh and label position for one axis|Assets/Core/Scripts/Pathfinding/Presentation/StructureDimensionLines.cs#RebuildAxisGeometry
  rx1|r16|report|obstacle cell|선택한 장애물 셀을 지우고 셀 상태를 비움|Assets/Core/Scripts/Pathfinding/Presentation/Logic/InputHandler.cs#RemoveObstacleCell
  rx1|r17|tune|render hotkey|Ctrl+S hotkey cycles the render mode|Assets/Core/Scripts/Pathfinding/Presentation/FlowController.cs#PollRenderHotkey
  rx1|r18|report|apply mask|경로 인스턴스마다 보이기 마스크를 적용하고 길이가 다르면 경고|Assets/Core/Scripts/Pathfinding/Presentation/Logic/RouteVisibilityController.cs#ApplyMask
  rx1|r19|tune|shade grid|cycle the shade grid boundary mode between culled, dense, filtered and edge cage|Assets/Core/Scripts/Pathfinding/Presentation/LayerGridLines.cs#CycleShadeGridMode
  rx1|r20|report|in range|셀이 시작, 중간, 끝으로 정한 직육면체 범위 안에 있는지 검사|Assets/Core/Scripts/Pathfinding/Presentation/Logic/RangeSelectionLogic.cs#IsInRange
  arcyn|a01|tune|meter sections|HUD 미터 갤러리에서 내구도, 쉴드, 메모리 상태 칸을 그리는 곳|Assets/Arcyn/Runtime/UI/Views/GalleryMeterSections.cs#GalleryMeterSections
  arcyn|a02|report|item database|blob asset holding frames, signals, affixes, grades and glitch chance|Assets/Arcyn/Runtime/Simulation/Data/Items.cs#ItemDatabaseBlob
  arcyn|a03|tune|tree data|트리 에셋의 노드 배열을 블롭 데이터로 굽는 빌더|Assets/Arcyn/Runtime/Authoring/Blobs/TreeDataBlobBuilder.cs#TreeDataBlobBuilder
  arcyn|a04|report|follow owner|ECS system that moves entities to follow their owner transform|Assets/Arcyn/Runtime/Simulation/Abilities/Systems/Motion/PathSystems.cs#FollowOwnerSystem
  arcyn|a05|tune|lod view|애니메이션 LOD 계산에 쓰는 절두체 평면 여섯 개와 카메라 위치|Assets/Arcyn/Runtime/Animation/Systems/Utilities/AnimLodMath.cs#LodView
  arcyn|a06|report|baked action|baked animation action with hash, state and fade time|Assets/Arcyn/Runtime/Animation/Systems/Baked/BakedAnimationSet.cs#BakedAction
  arcyn|a07|tune|memory|현재, 최대, 예약, 누수 값을 가진 메모리 스탯 컴포넌트|Assets/Arcyn/Runtime/Simulation/Data/Stats.cs#Memory
  arcyn|a08|report|owner death|when the summoner dies its summons die too, before death detection runs|Assets/Arcyn/Runtime/Simulation/Core/Lifecycle/SummonOwnerDeathSystem.cs#SummonOwnerDeathSystem
  arcyn|a09|tune|incoming displacement|넉백 같은 강제 이동의 방향, 거리, 지속 시간, 높이를 담는 버퍼|Assets/Arcyn/Runtime/Simulation/Data/Status.cs#IncomingDisplacement
  arcyn|a10|report|particle mesh|UI particle vertex buffers and one overlay per UI layer|Assets/Arcyn/Runtime/UI/Fx/Particles/UiParticleMesh.cs#UiParticleMesh
  arcyn|a11|tune|ui particles|UI 입자 시스템을 만들 때 이미터 수와 예산 상한을 정하는 곳|Assets/Arcyn/Runtime/UI/Fx/Particles/UiParticles.cs#UiParticles
  arcyn|a12|report|hazard spawn|spawn hazards during combat waves after the configured start wave|Assets/Arcyn/Runtime/Simulation/World/Flow/HazardSpawnSystem.cs#OnUpdate;Assets/Arcyn/Runtime/Simulation/World/Flow/HazardSpawnSystem.cs#HazardSpawnSystem
  arcyn|a13|tune|hexagon|사각형 안에 육각형 꼭짓점 여섯 개를 계산|Assets/Arcyn/Runtime/UI/Controls/SkewDraw.cs#Hexagon
  arcyn|a14|report|restore|UI flow restores the floor plan, map table and run state and destroys created entities|Assets/Arcyn/Runtime/UI/Flow/UiFlowArchive.cs#Restore
  arcyn|a15|tune|rebuild|장착 슬롯이 바뀌면 능력 로드아웃을 다시 맞춤|Assets/Arcyn/Runtime/Simulation/World/Utilities/LoadoutBuilder.cs#Rebuild
  arcyn|a16|report|end view|run end screen binds kills, damage, signals, time labels and the restart button|Assets/Arcyn/Runtime/UI/Views/MenuViews.cs#EndView
  arcyn|a17|tune|per point|세그먼트 막대에서 칸 사이 간격을 빼고 포인트당 픽셀 수를 계산|Assets/Arcyn/Runtime/UI/Math/SegmentMath.cs#PixelsPerPoint
  arcyn|a18|report|room center|find the center of a placed room by room id on the archive floor|Assets/Arcyn/Runtime/UI/Flow/UiFlowFloorPicks.cs#RoomCenter
  arcyn|a19|tune|rebase|값이 바뀌어도 칩 잔상 끝이 튀지 않게 출발점을 다시 잡음|Assets/Arcyn/Runtime/UI/Core/ChipMath.cs#Rebase
  arcyn|a20|report|layout cells|lay out inventory grid cells by columns and rows|Assets/Arcyn/Runtime/UI/Views/InventoryGrid.cs#LayoutCells
  ```
- 검증: `python -c "print(sum(1 for l in open(r'D:/Fork/.AI/context/search-eval/code-sets.tsv', encoding='utf-8') if l.count('|') == 5))"`
- 기대 출력: `40`

### 단계 2: 측정 도구와 기준선(E1, E2)
- 파일: `D:/Fork/.AI/context/search-eval/run.cjs`, `D:/Fork/.AI/context/search-eval/.gitignore`
- 위치: 새 파일 2개
- 동작: create (2a, 2b), 그다음 명령 실행(2c)
- 변경 전:
  ```
  없음
  ```
- 변경 후 2a (`run.cjs`):
  ```js
  // 사용: node run.cjs baseline | node run.cjs sweep
  // baseline 은 바꾸기 전 KIT 소스로, sweep 은 바꾼 소스로 같은 질문을 재서 results/ 에 씀
  'use strict';
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');

  const HERE = __dirname;
  const CTX = 'D:/Fork/.AI/context';
  const KIT_SOURCE = 'D:/Fork/KIT/tools/codegraph/source';
  const CLI = path.join(KIT_SOURCE, 'lib/bin/codegraph.js');
  const TUNING_FILE = path.join(KIT_SOURCE, 'lib/search-tuning.json');
  const RESULTS = path.join(HERE, 'results');
  const MODEL_ROOT = process.env.CODEGRAPH_MODEL_ROOT
      || 'C:/Users/JANGHYEONGTAEK/.local/share/team-tech-support-harness/codegraph/1.1.2-345c0b4f3c8e/win32-x64/lib/models';
  const ENV = { ...process.env, CODEGRAPH_NO_WATCH: '1', CODEGRAPH_MODEL_ROOT: MODEL_ROOT };

  const ROOTS = {
      blade: 'D:/Fork/BLADE',
      zyxel: 'D:/Fork/.AI/guide/Zyxel-official/graph',
      atom: 'D:/Fork/.AI/위탁과제_원자그래프',
      arcyn: 'D:/Fork/Arcyn',
      rx1: 'D:/Fork/RX_1',
  };
  const DOC_SETS = [
      { name: 'blade', root: 'blade', queries: () => halves(jsonQueries(`${CTX}/rerank-eval/blade_queries.json`)) },
      { name: 'zyxel', root: 'zyxel', queries: () => halves(jsonQueries(`${CTX}/rerank-eval/zyxel_queries.json`)) },
      { name: 'atom', root: 'atom', queries: () => halves(jsonQueries(`${CTX}/atom-eval/queries.json`)), match: atomMatch },
      {
          name: 'arcyn-docs', root: 'arcyn',
          queries: () => [...pipeQueries(`${CTX}/arcyn-docs-eval/dev_labels.txt`, 'tune'), ...pipeQueries(`${CTX}/arcyn-docs-eval/test_queries.txt`, 'report')],
      },
  ];
  const CODE_SETS = [{ name: 'rx1', root: 'rx1' }, { name: 'arcyn', root: 'arcyn' }];
  const DOC_GRID = [];
  for (const weights of [[1, 1, 1, 1], [1, 4, 2, 1], [2, 4, 2, 1]])
      for (const lexical of [1, 0.5])
          for (const hangul of [1, 0.5, 0.25])
              for (const markdownFirst of [false, true])
                  DOC_GRID.push({ docsFtsWeights: weights, docsLexicalWeight: lexical, docsLexicalWeightHangul: hangul, docsMarkdownFirst: markdownFirst });
  const CODE_GRID = [2, 5, 10, 20];

  function jsonQueries(file) {
      return JSON.parse(fs.readFileSync(file, 'utf8')).queries.map((item, index) => ({ id: String(index + 1), q: item.q, gold: item.gold }));
  }
  function halves(items) {
      return items.map((item, index) => ({ ...item, split: index % 2 === 0 ? 'tune' : 'report' }));
  }
  function pipeQueries(file, split) {
      return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
          const [id, q, gold] = line.split('|');
          return { id, q, gold: gold.split(';'), split };
      });
  }
  // 원자 그래프 정답은 파일 이름의 첫 '_' 앞 ID 또는 개체 노트 이름임
  function atomMatch(file, gold) {
      const base = path.basename(file).replace(/\.md$/i, '');
      return gold.includes(base) || gold.includes(base.split('_')[0]);
  }
  function codeQueries(name) {
      return fs.readFileSync(path.join(HERE, 'code-sets.tsv'), 'utf8').split(/\r?\n/).filter(Boolean)
          .map((line) => line.split('|'))
          .filter((cols) => cols[0] === name)
          .map(([, id, split, kw, nl, gold]) => ({ id, split, kw, nl, gold: gold.split(';') }));
  }
  function rankOf(items, matches) {
      return items.slice(0, 5).findIndex(matches) + 1;
  }
  function round(value) {
      return Math.round(value * 100) / 100;
  }
  function score(queries, ranks) {
      const out = {};
      for (const split of ['tune', 'report']) {
          const picked = ranks.filter((_, index) => queries[index].split === split);
          const n = picked.length || 1;
          out[split] = {
              n: picked.length,
              hit1: round(100 * picked.filter((rank) => rank === 1).length / n),
              hit5: round(100 * picked.filter((rank) => rank >= 1).length / n),
              mrr: round(picked.reduce((sum, rank) => sum + (rank ? 1 / rank : 0), 0) / n),
          };
      }
      return out;
  }
  // 원본 색인을 건드리지 않으려고 복사본에서 잼. 새 소스는 복사본만 v12 로 옮김
  function copyIndex(phase) {
      const copies = {};
      for (const [key, root] of Object.entries(ROOTS)) {
          const target = path.join(HERE, 'work', phase, key, '.codegraph');
          fs.rmSync(path.dirname(target), { recursive: true, force: true });
          fs.mkdirSync(target, { recursive: true });
          for (const name of fs.readdirSync(path.join(root, '.codegraph'))) {
              if (/^(watcher|daemon|mcp-launch|errors)|\.log$|\.lock$|-shm$/.test(name))
                  continue;
              const from = path.join(root, '.codegraph', name);
              if (fs.statSync(from).isFile())
                  fs.copyFileSync(from, path.join(target, name));
          }
          copies[key] = path.dirname(target);
      }
      return copies;
  }
  function docsEnv(config) {
      if (!config)
          return ENV;
      return {
          ...ENV,
          CODEGRAPH_DOCS_FTS_WEIGHTS: config.docsFtsWeights.join(','),
          CODEGRAPH_DOCS_LEXICAL_WEIGHT: String(config.docsLexicalWeight),
          CODEGRAPH_DOCS_LEXICAL_WEIGHT_HANGUL: String(config.docsLexicalWeightHangul),
          CODEGRAPH_DOCS_MARKDOWN_FIRST: config.docsMarkdownFirst ? '1' : '0',
      };
  }
  function runDocs(set, root, env) {
      const queries = set.queries();
      const input = path.join(HERE, 'work', `${set.name}.jsonl`);
      fs.writeFileSync(input, queries.map((item) => JSON.stringify({ id: item.id, q: item.q })).join('\n') + '\n');
      const out = spawnSync(process.execPath, [CLI, 'docs-batch', '-p', root, '--input', input, '--limit', '5'], { env, encoding: 'utf8', maxBuffer: 1 << 28 });
      if (out.status !== 0)
          throw new Error(`docs-batch ${set.name} failed: ${out.stderr.slice(0, 400)}`);
      const lines = out.stdout.split(/\r?\n/).filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
      const summary = lines.pop().summary;
      const match = set.match ?? ((file, gold) => gold.includes(file));
      const ranks = lines.map((line, index) => rankOf(line.hits.map((hit) => String(hit.file).replace(/\\/g, '/')), (file) => match(file, queries[index].gold)));
      return { metrics: score(queries, ranks), msPerQuery: round(summary.totalMs / queries.length) };
  }
  function singleMs(set, root, env) {
      const query = set.queries()[0].q;
      const times = [];
      for (let run = 0; run < 3; run++) {
          const started = Date.now();
          const out = spawnSync(process.execPath, [CLI, 'docs', query, '-p', root, '--no-sync', '--json', '--limit', '5'], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
          if (out.status !== 0)
              throw new Error(`docs ${set.name} failed: ${out.stderr.slice(0, 400)}`);
          times.push(Date.now() - started);
      }
      return times.sort((a, b) => a - b)[1];
  }
  function runCode(set, root, weight) {
      const env = weight === undefined ? ENV : { ...ENV, CODEGRAPH_NAME_TOKENS_WEIGHT: String(weight) };
      const out = spawnSync(process.execPath, [__filename, 'code-once', set.name, root], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
      if (out.status !== 0)
          throw new Error(`code ${set.name} failed: ${out.stderr.slice(0, 400)}`);
      return JSON.parse(out.stdout.trim().split(/\r?\n/).pop());
  }
  async function codeOnce(name, root) {
      const { CodeGraph } = require(path.join(KIT_SOURCE, 'lib/index.js'));
      const queries = codeQueries(name);
      const cg = await CodeGraph.open(root);
      try {
          const key = (node) => `${node.filePath}#${node.name}`;
          const kwRanks = [];
          const nlRanks = [];
          const started = Date.now();
          for (const item of queries) {
              const found = cg.searchNodes(item.kw, { limit: 10 }).map((result) => result.node);
              kwRanks.push(rankOf(found, (node) => item.gold.includes(key(node))));
              const context = await cg.findRelevantContext(item.nl, {});
              const roots = context.roots.map((id) => context.nodes.get(id)).filter(Boolean);
              nlRanks.push(rankOf(roots, (node) => item.gold.includes(key(node))));
          }
          const msPerQuery = round((Date.now() - started) / queries.length);
          console.log(JSON.stringify({ kw: score(queries, kwRanks), nl: score(queries, nlRanks), msPerQuery }));
      }
      finally {
          cg.destroy();
      }
  }
  function measureDocs(copies, config) {
      const out = {};
      for (const set of DOC_SETS)
          out[set.name] = runDocs(set, copies[set.root], docsEnv(config));
      return out;
  }
  function measureCode(copies, weight) {
      const out = {};
      for (const set of CODE_SETS)
          out[set.name] = runCode(set, copies[set.root], weight);
      return out;
  }
  function mean(values) {
      return round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  function docsScore(docs, split) {
      return mean(DOC_SETS.map((set) => docs[set.name].metrics[split].hit1));
  }
  function docsKeepsHit5(docs, baseline, split) {
      return DOC_SETS.every((set) => docs[set.name].metrics[split].hit5 >= baseline[set.name].metrics[split].hit5);
  }
  function codeScore(code, split) {
      return mean(CODE_SETS.map((set) => (code[set.name].kw[split].hit1 + code[set.name].nl[split].hit1) / 2));
  }
  function codeKeepsHit5(code, baseline, split) {
      return CODE_SETS.every((set) => code[set.name].kw[split].hit5 >= baseline[set.name].kw[split].hit5
          && code[set.name].nl[split].hit5 >= baseline[set.name].nl[split].hit5);
  }
  // tune 절반으로 고르고 report 절반으로 기준선과 비교함. 같은 점수면 표의 앞 후보를 씀
  function pick(candidates, baseline, scoreOf, keepsHit5) {
      let best = null;
      for (const candidate of candidates) {
          if (!keepsHit5(candidate.result, baseline, 'tune'))
              continue;
          if (!best || scoreOf(candidate.result, 'tune') > scoreOf(best.result, 'tune'))
              best = candidate;
      }
      if (!best)
          return { winner: null, passed: false, reason: 'no candidate keeps tune Hit@5' };
      const passed = scoreOf(best.result, 'report') >= scoreOf(baseline, 'report') && keepsHit5(best.result, baseline, 'report');
      return { winner: best, passed, reason: passed ? 'ok' : 'report split below baseline' };
  }
  function report(baseline, docs, code) {
      const lines = ['# search-eval sweep', '', `- 실행: ${new Date().toISOString()}`, '', '## 문서', '',
          '| 묶음 | 구분 | 기준 Hit@1 | 선택 Hit@1 | 기준 Hit@5 | 선택 Hit@5 | 기준 ms/질의 | 선택 ms/질의 | 기준 단발 ms | 선택 단발 ms |',
          '|---|---|---|---|---|---|---|---|---|---|'];
      for (const set of DOC_SETS) {
          const b = baseline.docs[set.name];
          const w = docs.final[set.name];
          for (const split of ['tune', 'report'])
              lines.push(`| ${set.name} | ${split} | ${b.metrics[split].hit1} | ${w.metrics[split].hit1} | ${b.metrics[split].hit5} | ${w.metrics[split].hit5} | ${b.msPerQuery} | ${w.msPerQuery} | ${b.singleMs} | ${w.singleMs} |`);
      }
      lines.push('', `- 선택 설정: ${JSON.stringify(docs.config)} (${docs.reason})`, '', '## 코드', '',
          '| 묶음 | 구분 | 기준 kw Hit@1 | 선택 kw Hit@1 | 기준 nl Hit@1 | 선택 nl Hit@1 | 기준 kw Hit@5 | 선택 kw Hit@5 | 기준 nl Hit@5 | 선택 nl Hit@5 | 기준 ms/질의 | 선택 ms/질의 |',
          '|---|---|---|---|---|---|---|---|---|---|---|---|');
      for (const set of CODE_SETS) {
          const b = baseline.code[set.name];
          const w = code.final[set.name];
          for (const split of ['tune', 'report'])
              lines.push(`| ${set.name} | ${split} | ${b.kw[split].hit1} | ${w.kw[split].hit1} | ${b.nl[split].hit1} | ${w.nl[split].hit1} | ${b.kw[split].hit5} | ${w.kw[split].hit5} | ${b.nl[split].hit5} | ${w.nl[split].hit5} | ${b.msPerQuery} | ${w.msPerQuery} |`);
      }
      lines.push('', `- 선택 nameTokensWeight: ${code.weight} (${code.reason})`, '');
      return lines.join('\n');
  }
  async function main() {
      const [mode, ...rest] = process.argv.slice(2);
      if (mode === 'code-once')
          return codeOnce(rest[0], rest[1]);
      if (mode !== 'baseline' && mode !== 'sweep') {
          console.error('usage: node run.cjs baseline|sweep');
          process.exit(64);
      }
      fs.mkdirSync(RESULTS, { recursive: true });
      const copies = copyIndex(mode);
      if (mode === 'baseline') {
          const docs = measureDocs(copies, null);
          for (const set of DOC_SETS)
              docs[set.name].singleMs = singleMs(set, copies[set.root], ENV);
          const result = { docs, code: measureCode(copies, undefined) };
          fs.rmSync(path.join(HERE, 'work', mode), { recursive: true, force: true });
          fs.writeFileSync(path.join(RESULTS, 'baseline.json'), JSON.stringify(result, null, 2));
          console.log(JSON.stringify(result));
          return;
      }
      const baseline = JSON.parse(fs.readFileSync(path.join(RESULTS, 'baseline.json'), 'utf8'));
      const docCandidates = DOC_GRID.map((config) => ({ config, result: measureDocs(copies, config) }));
      const docPick = pick(docCandidates, baseline.docs, docsScore, docsKeepsHit5);
      const codeCandidates = CODE_GRID.map((weight) => ({ weight, result: measureCode(copies, weight) }));
      const codePick = pick(codeCandidates, baseline.code, codeScore, codeKeepsHit5);
      // 문서 쪽이 기준선을 못 넘으면 기준선과 같은 첫 후보를 씀. 코드 쪽은 기준선과 같은 값이 없어 멈춤
      const docsConfig = docPick.passed ? docPick.winner.config : DOC_GRID[0];
      const docsFinal = docPick.passed ? docPick.winner.result : measureDocs(copies, docsConfig);
      for (const set of DOC_SETS)
          docsFinal[set.name].singleMs = singleMs(set, copies[set.root], docsEnv(docsConfig));
      fs.rmSync(path.join(HERE, 'work', mode), { recursive: true, force: true });
      const docs = { config: docsConfig, reason: docPick.reason, final: docsFinal };
      const code = { weight: codePick.winner ? codePick.winner.weight : null, reason: codePick.reason, final: codePick.winner ? codePick.winner.result : baseline.code };
      fs.writeFileSync(path.join(RESULTS, 'sweep.json'), JSON.stringify({ passed: codePick.passed, docs, code, docCandidates, codeCandidates }, null, 2));
      fs.writeFileSync(path.join(RESULTS, 'sweep.md'), report(baseline, docs, code));
      if (!codePick.passed) {
          console.error(`code sweep did not pass: ${codePick.reason}`);
          process.exit(2);
      }
      fs.writeFileSync(TUNING_FILE, JSON.stringify({ ...docsConfig, docsMarkdownDepth: 50, nameTokensWeight: code.weight }, null, 2) + '\n');
      console.log(`tuning written: ${TUNING_FILE}`);
  }
  main().catch((error) => {
      console.error(error.stack || String(error));
      process.exit(1);
  });
  ```
- 변경 후 2b (`.gitignore`):
  ```
  work/
  ```
- 2c 실행(이 단계가 기준선임. 3단계 전에 돌림. 수 분 걸림): `cd D:/Fork/.AI/context/search-eval && node run.cjs baseline > results-baseline.log 2>&1; echo exit=$?`
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/baseline.json', encoding='utf-8')); print(sorted(r['docs']), sorted(r['code']))"`
- 기대 출력: `['arcyn-docs', 'atom', 'blade', 'zyxel'] ['arcyn', 'rx1']`

### 단계 3: 순위 조정값 파일
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json`, `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.js`
- 위치: 새 파일 2개
- 동작: create (3a, 3b)
- 변경 전:
  ```
  없음
  ```
- 변경 후 3a (`search-tuning.json`, 지금 동작과 같은 값):
  ```json
  {
    "docsFtsWeights": [1, 1, 1, 1],
    "docsLexicalWeight": 1,
    "docsLexicalWeightHangul": 1,
    "docsMarkdownFirst": false,
    "docsMarkdownDepth": 50,
    "nameTokensWeight": 10
  }
  ```
- 변경 후 3b (`search-tuning.js`):
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.loadSearchTuning = loadSearchTuning;
  exports.resetSearchTuning = resetSearchTuning;
  const fs = require("fs");
  const path = require("path");
  const TUNING_FILE = path.join(__dirname, 'search-tuning.json');
  let cached = null;
  // 측정 도구가 같은 빌드에서 값을 바꿔 비교하도록 환경 변수가 파일 값을 덮어씀
  function loadSearchTuning() {
      if (cached)
          return cached;
      const base = JSON.parse(fs.readFileSync(TUNING_FILE, 'utf8'));
      cached = {
          docsFtsWeights: weights(process.env.CODEGRAPH_DOCS_FTS_WEIGHTS, base.docsFtsWeights, 4),
          docsLexicalWeight: number(process.env.CODEGRAPH_DOCS_LEXICAL_WEIGHT, base.docsLexicalWeight, 1),
          docsLexicalWeightHangul: number(process.env.CODEGRAPH_DOCS_LEXICAL_WEIGHT_HANGUL, base.docsLexicalWeightHangul, 1),
          docsMarkdownFirst: flag(process.env.CODEGRAPH_DOCS_MARKDOWN_FIRST, base.docsMarkdownFirst),
          docsMarkdownDepth: number(process.env.CODEGRAPH_DOCS_MARKDOWN_DEPTH, base.docsMarkdownDepth, 50),
          nameTokensWeight: number(process.env.CODEGRAPH_NAME_TOKENS_WEIGHT, base.nameTokensWeight, 10),
      };
      return cached;
  }
  function resetSearchTuning() {
      cached = null;
  }
  function number(envValue, fileValue, fallback) {
      for (const value of [envValue, fileValue]) {
          if (value === undefined || value === null || value === '')
              continue;
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed >= 0)
              return parsed;
      }
      return fallback;
  }
  function flag(envValue, fileValue) {
      if (envValue !== undefined && envValue !== '')
          return /^(1|true|yes|on)$/i.test(envValue);
      return fileValue === true;
  }
  function weights(envValue, fileValue, count) {
      const source = envValue !== undefined && envValue !== '' ? String(envValue).split(',') : fileValue;
      const fallback = new Array(count).fill(1);
      if (!Array.isArray(source) || source.length !== count)
          return fallback;
      const parsed = source.map(Number);
      return parsed.every((value) => Number.isFinite(value) && value >= 0) ? parsed : fallback;
  }
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "console.log(JSON.stringify(require('./lib/search-tuning').loadSearchTuning()))"`
- 기대 출력: `{"docsFtsWeights":[1,1,1,1],"docsLexicalWeight":1,"docsLexicalWeightHangul":1,"docsMarkdownFirst":false,"docsMarkdownDepth":50,"nameTokensWeight":10}`

### 단계 4: 문서 어휘 검색의 열 가중치(D1)와 결합 비중(D2)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js` (4a~4e), `D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.d.ts` (4f)
- 위치: `require` 줄, `searchDocsLexical` 의 SQL, `fuseHits`
- 동작: replace
- 4a 변경 전:
  ```
  const links_util_1 = require("./links-util");
  ```
  4a 변경 후:
  ```
  const links_util_1 = require("./links-util");
  const search_tuning_1 = require("../search-tuning");
  ```
- 4b 변경 전:
  ```
  m.content_summary, m.format, m.title, bm25(document_fts) AS rank
  ```
  4b 변경 후:
  ```
  m.content_summary, m.format, m.title, bm25(document_fts, ${(0, search_tuning_1.loadSearchTuning)().docsFtsWeights.join(', ')}) AS rank
  ```
- 4c 변경 전:
  ```
  function fuseHits(vectorHits, lexicalHits, limit) {
      const ranked = new Map();
      const add = (hits, source) => {
  ```
  4c 변경 후:
  ```
  function fuseHits(vectorHits, lexicalHits, limit, lexicalWeight = 1) {
      const ranked = new Map();
      const add = (hits, source, weight) => {
  ```
- 4d 변경 전 / 후 (두 줄을 각각 바꿈):
  ```
  existing.score += 1 / (61 + index);
  ```
  ```
  existing.score += weight / (61 + index);
  ```
  ```
  ranked.set(hit.file, { hit, score: 1 / (61 + index), sources: new Set([source]) });
  ```
  ```
  ranked.set(hit.file, { hit, score: weight / (61 + index), sources: new Set([source]) });
  ```
- 4e 변경 전:
  ```
      add(vectorHits, 'vector');
      add(lexicalHits, 'lexical');
  ```
  4e 변경 후:
  ```
      add(vectorHits, 'vector', 1);
      add(lexicalHits, 'lexical', lexicalWeight);
  ```
- 4f 변경 전:
  ```
  export declare function fuseHits(vectorHits: DocHit[], lexicalHits: DocHit[], limit: number): DocHit[];
  ```
  4f 변경 후:
  ```
  export declare function fuseHits(vectorHits: DocHit[], lexicalHits: DocHit[], limit: number, lexicalWeight?: number): DocHit[];
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/lexical-search.js', encoding='utf-8').read(); print(s.count('search_tuning_1'), s.count('weight / (61 + index)'), s.count(\"add(lexicalHits, 'lexical', lexicalWeight)\"))"`
- 기대 출력: `2 2 1`

### 단계 5: 질의별 어휘 비중(D2), 마크다운 우선(D6), 모델 로딩 먼저 시작(S2)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js` (5a~5f), `D:/Fork/KIT/tools/codegraph/source/lib/docs/embed.js` (5g, 5h), `D:/Fork/KIT/tools/codegraph/source/lib/docs/embed.d.ts` (5i)
- 위치: `searchDocs`, `searchCandidates`, `semanticFailure` 앞, `getEmbedder`
- 동작: replace
- 5a 변경 전:
  ```
  const vec_1 = require("./vec");
  ```
  5a 변경 후:
  ```
  const vec_1 = require("./vec");
  const search_tuning_1 = require("../search-tuning");
  ```
- 5b 변경 전:
  ```
      const depth = rerank ? Math.max(topk, clampInt(opts.rerankDepth ?? DEFAULT_RERANK_DEPTH, 1, MAX_TOPK)) : topk;
  ```
  5b 변경 후:
  ```
      const tuning = (0, search_tuning_1.loadSearchTuning)();
      // 마크다운 우선은 넓게 뽑은 후보를 형식으로 다시 줄 세우므로 깊이가 출력 수보다 커야 함
      const candidateDepth = tuning.docsMarkdownFirst ? Math.max(topk, clampInt(tuning.docsMarkdownDepth, 1, MAX_TOPK)) : topk;
      const depth = rerank ? Math.max(candidateDepth, clampInt(opts.rerankDepth ?? DEFAULT_RERANK_DEPTH, 1, MAX_TOPK)) : candidateDepth;
  ```
- 5c 변경 전:
  ```
      await searchCandidates(db, normalizedQuery, result, { depth, codeLimit });
      if (reranking) {
          const reranked = await (0, rerank_1.rerankHits)(db, normalizedQuery, result.hits, topk, reranking);
          result.hits = reranked.hits;
          result.rerank = reranked.summary;
          result.warnings.push(...reranked.warnings);
      }
  ```
  5c 변경 후:
  ```
      await searchCandidates(db, normalizedQuery, result, { depth, codeLimit, lexicalWeight: lexicalWeightFor(normalizedQuery, tuning) });
      if (tuning.docsMarkdownFirst)
          result.hits = markdownFirst(result.hits);
      if (reranking) {
          const reranked = await (0, rerank_1.rerankHits)(db, normalizedQuery, result.hits, topk, reranking);
          result.hits = reranked.hits;
          result.rerank = reranked.summary;
          result.warnings.push(...reranked.warnings);
      }
      else {
          result.hits = result.hits.slice(0, topk);
      }
  ```
- 5d 변경 전:
  ```
  async function searchCandidates(db, normalizedQuery, result, { depth, codeLimit }) {
      const lexical = (0, lexical_search_1.searchDocsLexical)(db, normalizedQuery, depth, codeLimit);
  ```
  5d 변경 후:
  ```
  async function searchCandidates(db, normalizedQuery, result, { depth, codeLimit, lexicalWeight }) {
      // 모델 로딩이 어휘 검색과 겹치도록 벡터 검색을 쓸 수 있으면 먼저 시작함
      if ((0, vec_1.loadVecExtension)(db) && (await (0, embed_1.isEmbedAvailable)()) && staleEmbeddingModels(db).length === 0 && tableExists(db, 'mdast_vectors'))
          (0, embed_1.warmEmbedder)();
      const lexical = (0, lexical_search_1.searchDocsLexical)(db, normalizedQuery, depth, codeLimit);
  ```
- 5e 변경 전:
  ```
      result.hits = (0, lexical_search_1.fuseHits)(vectorHits, lexical.hits, depth);
  ```
  5e 변경 후:
  ```
      result.hits = (0, lexical_search_1.fuseHits)(vectorHits, lexical.hits, depth, lexicalWeight);
  ```
- 5f 변경 전:
  ```
  function semanticFailure(result, lexicalHits, warning) {
  ```
  5f 변경 후:
  ```
  function lexicalWeightFor(query, tuning) {
      // 라틴 식별자가 없는 질의는 조사 때문에 어휘 일치가 약해 비중을 따로 둠
      return /[A-Za-z][A-Za-z0-9_]{2,}/.test(query) ? tuning.docsLexicalWeight : tuning.docsLexicalWeightHangul;
  }
  function markdownFirst(hits) {
      const isMarkdown = (hit) => (hit.format ?? 'markdown') === 'markdown';
      return [...hits.filter(isMarkdown), ...hits.filter((hit) => !isMarkdown(hit))];
  }
  function semanticFailure(result, lexicalHits, warning) {
  ```
- 5g (`embed.js`) 변경 전:
  ```
  exports.getEmbedder = getEmbedder;
  ```
  5g 변경 후:
  ```
  exports.getEmbedder = getEmbedder;
  exports.warmEmbedder = warmEmbedder;
  ```
- 5h (`embed.js`) 변경 전:
  ```
  let _runtime = null;
  /** Lazy singleton. First call loads the model; subsequent runs are offline. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getEmbedder() {
      if (_extractor)
          return _extractor;
      if (embeddingsDisabled())
          throw new Error('Embeddings are disabled by CODEGRAPH_DISABLE_EMBEDDINGS.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mod;
  ```
  5h 변경 후:
  ```
  let _runtime = null;
  let _loading = null;
  /** Lazy singleton. First call loads the model; subsequent runs are offline. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getEmbedder() {
      if (_extractor)
          return _extractor;
      if (embeddingsDisabled())
          throw new Error('Embeddings are disabled by CODEGRAPH_DISABLE_EMBEDDINGS.');
      if (!_loading) {
          // 실패한 로딩은 다음 호출이 다시 시도하게 비움
          _loading = loadEmbedder().catch((error) => {
              _loading = null;
              throw error;
          });
      }
      return _loading;
  }
  /** Start loading the model without waiting. A load error surfaces on the next getEmbedder call. */
  function warmEmbedder() {
      if (_extractor || embeddingsDisabled())
          return;
      getEmbedder().catch(() => { });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadEmbedder() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mod;
  ```
- 5i (`embed.d.ts`) 변경 전:
  ```
  export declare function getEmbedder(): Promise<any>;
  ```
  5i 변경 후:
  ```
  export declare function getEmbedder(): Promise<any>;
  /** Start loading the model without waiting. A load error surfaces on the next getEmbedder call. */
  export declare function warmEmbedder(): void;
  ```
- 검증: `python -c "s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/search.js', encoding='utf-8').read(); e=open(r'D:/Fork/KIT/tools/codegraph/source/lib/docs/embed.js', encoding='utf-8').read(); print(s.count('warmEmbedder'), s.count('markdownFirst('), s.count('lexicalWeightFor('), e.count('async function loadEmbedder()'), e.count('function warmEmbedder()'))"`
- 기대 출력: `1 2 2 1 1`

### 단계 6: 식별자 낱말 분해와 v12 이주(C1)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search/name-tokens.js` (6a), `D:/Fork/KIT/tools/codegraph/source/lib/db/migration-v12.js` (6b), `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.js` (6c~6e), `D:/Fork/KIT/tools/codegraph/source/lib/db/migrations.d.ts` (6f)
- 위치: 새 파일 2개, `migrations` 배열 끝, 버전 상수
- 동작: create (6a, 6b), replace (6c~6f)
- 6a 변경 후 (`name-tokens.js`):
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.nameTokens = nameTokens;
  // FTS5 기본 토크나이저는 DamageHitJob 을 한 토큰으로 봐서 가운데 낱말(hit)로 찾지 못함
  function nameTokens(name) {
      if (!name)
          return null;
      const words = String(name)
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
          .replace(/([A-Za-z])([0-9])/g, '$1 $2')
          .split(/[^\p{L}\p{N}]+/u)
          .map((word) => word.toLowerCase())
          .filter(Boolean);
      if (words.length < 2)
          return null;
      return [...new Set(words)].join(' ');
  }
  ```
- 6b 변경 후 (`migration-v12.js`):
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.applyNameTokensMigration = applyNameTokensMigration;
  const name_tokens_1 = require("../search/name-tokens");
  // 외부 콘텐츠 FTS 에는 열을 더할 수 없어 트리거와 함께 다시 만듦. 값을 먼저 채우고 rebuild 해야 색인이 맞음
  function applyNameTokensMigration(db) {
      db.exec(`
      DROP TRIGGER IF EXISTS nodes_ai;
      DROP TRIGGER IF EXISTS nodes_ad;
      DROP TRIGGER IF EXISTS nodes_au;
      DROP TABLE IF EXISTS nodes_fts;
    `);
      const columns = db.prepare('PRAGMA table_info(nodes)').all().map((row) => row.name);
      if (!columns.includes('name_tokens'))
          db.exec('ALTER TABLE nodes ADD COLUMN name_tokens TEXT');
      const update = db.prepare('UPDATE nodes SET name_tokens = ? WHERE rowid = ?');
      for (const row of db.prepare('SELECT rowid AS rid, name FROM nodes').all())
          update.run((0, name_tokens_1.nameTokens)(row.name), row.rid);
      db.exec(`
      CREATE VIRTUAL TABLE nodes_fts USING fts5(
        id, name, qualified_name, docstring, signature, name_tokens,
        content='nodes', content_rowid='rowid'
      );
      CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
        VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
      END;
      CREATE TRIGGER nodes_ad AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
      END;
      CREATE TRIGGER nodes_au AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
        INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
        VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
      END;
      INSERT INTO nodes_fts(nodes_fts) VALUES ('rebuild');
    `);
  }
  ```
- 6c 변경 전:
  ```
  const migration_v11_1 = require("./migration-v11");
  ```
  6c 변경 후:
  ```
  const migration_v11_1 = require("./migration-v11");
  const migration_v12_1 = require("./migration-v12");
  ```
- 6d 변경 전:
  ```
  exports.CURRENT_SCHEMA_VERSION = 11;
  ```
  6d 변경 후:
  ```
  exports.CURRENT_SCHEMA_VERSION = 12;
  ```
- 6e 변경 전:
  ```
          up: migration_v11_1.applySemanticNeighborCacheMigration,
      },
  ];
  ```
  6e 변경 후:
  ```
          up: migration_v11_1.applySemanticNeighborCacheMigration,
      },
      {
          version: 12,
          description: 'Add identifier word tokens to node full-text search',
          up: migration_v12_1.applyNameTokensMigration,
      },
  ];
  ```
- 6f (`migrations.d.ts`) 변경 전:
  ```
  export declare const CURRENT_SCHEMA_VERSION = 11;
  ```
  6f 변경 후:
  ```
  export declare const CURRENT_SCHEMA_VERSION = 12;
  ```
- 검증: `cd D:/Fork/KIT/tools/codegraph/source && node -e "const {nameTokens}=require('./lib/search/name-tokens'); console.log(nameTokens('DamageHitJob'), '|', nameTokens('HTTPServer2'), '|', nameTokens('Memory'), '|', require('./lib/db/migrations').CURRENT_SCHEMA_VERSION)"`
- 기대 출력: `damage hit job | http server 2 | null | 12`

### 단계 7: 새 DB 스키마와 노드 쓰기·검색(C1)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/db/schema.sql` (7a, 7b), `D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js` (7c~7h)
- 위치: `nodes` 테이블, `nodes_fts` 와 트리거, `insertNode`, `updateNode`, `searchNodesFTS`
- 동작: replace
- 7a 변경 전:
  ```
      domain_kind TEXT,
      metadata_json TEXT,
      updated_at INTEGER NOT NULL
  ```
  7a 변경 후:
  ```
      domain_kind TEXT,
      metadata_json TEXT,
      name_tokens TEXT,
      updated_at INTEGER NOT NULL
  ```
- 7b 변경 전:
  ```
  CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      id,
      name,
      qualified_name,
      docstring,
      signature,
      content='nodes',
      content_rowid='rowid'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature);
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
  END;
  ```
  7b 변경 후:
  ```
  CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      id,
      name,
      qualified_name,
      docstring,
      signature,
      name_tokens,
      content='nodes',
      content_rowid='rowid'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
  END;
  ```
- 7c (`queries.js`) 변경 전:
  ```
  const query_parser_1 = require("../search/query-parser");
  ```
  7c 변경 후:
  ```
  const query_parser_1 = require("../search/query-parser");
  const name_tokens_1 = require("../search/name-tokens");
  const search_tuning_1 = require("../search-tuning");
  ```
- 7d 변경 전:
  ```
            decorators, type_parameters, domain_kind, metadata_json, updated_at
          ) VALUES (
            @id, @kind, @name, @qualifiedName, @filePath, @language,
            @startLine, @endLine, @startColumn, @endColumn,
            @docstring, @signature, @visibility,
            @isExported, @isAsync, @isStatic, @isAbstract,
            @decorators, @typeParameters, @domainKind, @metadataJson, @updatedAt
  ```
  7d 변경 후:
  ```
            decorators, type_parameters, domain_kind, metadata_json, name_tokens, updated_at
          ) VALUES (
            @id, @kind, @name, @qualifiedName, @filePath, @language,
            @startLine, @endLine, @startColumn, @endColumn,
            @docstring, @signature, @visibility,
            @isExported, @isAsync, @isStatic, @isAbstract,
            @decorators, @typeParameters, @domainKind, @metadataJson, @nameTokens, @updatedAt
  ```
- 7e 변경 전:
  ```
              metadataJson: node.metadata ? JSON.stringify(node.metadata) : null,
              updatedAt: node.updatedAt ?? Date.now(),
          });
      }
      /**
       * Insert multiple nodes in a transaction
  ```
  7e 변경 후:
  ```
              metadataJson: node.metadata ? JSON.stringify(node.metadata) : null,
              nameTokens: (0, name_tokens_1.nameTokens)(node.name),
              updatedAt: node.updatedAt ?? Date.now(),
          });
      }
      /**
       * Insert multiple nodes in a transaction
  ```
- 7f 변경 전:
  ```
            metadata_json = @metadataJson,
            updated_at = @updatedAt
          WHERE id = @id
  ```
  7f 변경 후:
  ```
            metadata_json = @metadataJson,
            name_tokens = @nameTokens,
            updated_at = @updatedAt
          WHERE id = @id
  ```
- 7g 변경 전:
  ```
              metadataJson: node.metadata ? JSON.stringify(node.metadata) : null,
              updatedAt: node.updatedAt ?? Date.now(),
          });
      }
      /**
       * Delete a node by ID
  ```
  7g 변경 후:
  ```
              metadataJson: node.metadata ? JSON.stringify(node.metadata) : null,
              nameTokens: (0, name_tokens_1.nameTokens)(node.name),
              updatedAt: node.updatedAt ?? Date.now(),
          });
      }
      /**
       * Delete a node by ID
  ```
- 7h 변경 전:
  ```
          // BM25 column weights: id=0, name=20, qualified_name=5, docstring=1, signature=2
  ```
  ```
        SELECT nodes.*, bm25(nodes_fts, 0, 20, 5, 1, 2) as score
  ```
  7h 변경 후 (두 곳을 각각 바꿈):
  ```
          // BM25 column weights: id=0, name=20, qualified_name=5, docstring=1, signature=2, name_tokens from search-tuning.json
  ```
  ```
        SELECT nodes.*, bm25(nodes_fts, 0, 20, 5, 1, 2, ${(0, search_tuning_1.loadSearchTuning)().nameTokensWeight}) as score
  ```
- 검증: `python -c "q=open(r'D:/Fork/KIT/tools/codegraph/source/lib/db/queries.js', encoding='utf-8').read(); s=open(r'D:/Fork/KIT/tools/codegraph/source/lib/db/schema.sql', encoding='utf-8').read(); print(q.count('nameTokens: (0, name_tokens_1.nameTokens)(node.name)'), q.count('@nameTokens'), q.count('nameTokensWeight'), s.count('name_tokens'))"`
- 기대 출력: `2 2 1 10`

### 단계 8: 시험
- 파일: `D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs`
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
  const { nameTokens } = require('../lib/search/name-tokens');
  const { fuseHits } = require('../lib/docs/lexical-search');
  const { applyNameTokensMigration } = require('../lib/db/migration-v12');
  const { loadSearchTuning, resetSearchTuning } = require('../lib/search-tuning');
  const { CodeGraph } = require('../lib/index');
  const { searchDocs } = require('../lib/docs/search');

  function tempGraph(context, prefix, files) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      for (const [name, text] of Object.entries(files))
          fs.writeFileSync(path.join(root, name), text);
      const graph = CodeGraph.initSync(root);
      context.after(() => {
          try { graph.close(); } catch { /* 이미 닫힘 */ }
          fs.rmSync(root, { recursive: true, force: true });
      });
      return graph;
  }

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

  test('identifiers split into lowercase words', () => {
      assert.equal(nameTokens('DamageHitJob'), 'damage hit job');
      assert.equal(nameTokens('HTTPServer2'), 'http server 2');
      assert.equal(nameTokens('sign_in_user'), 'sign in user');
      assert.equal(nameTokens('Memory'), null);
  });

  test('lexical weight scales the lexical side of the fusion', () => {
      const hit = (file) => ({ file, retrieval: [] });
      const vectorHits = [hit('v.md'), hit('both.md')];
      const lexicalHits = [hit('l.md'), hit('both.md')];
      assert.deepEqual(fuseHits(vectorHits, lexicalHits, 3).map((h) => h.file), ['both.md', 'l.md', 'v.md']);
      assert.deepEqual(fuseHits(vectorHits, lexicalHits, 3, 0.5).map((h) => h.file), ['both.md', 'v.md', 'l.md']);
  });

  test('environment overrides the tuning file', (context) => {
      withEnv(context, { CODEGRAPH_DOCS_FTS_WEIGHTS: '1,4,2,1', CODEGRAPH_DOCS_MARKDOWN_FIRST: '1', CODEGRAPH_NAME_TOKENS_WEIGHT: '5' });
      const tuning = loadSearchTuning();
      assert.deepEqual(tuning.docsFtsWeights, [1, 4, 2, 1]);
      assert.equal(tuning.docsMarkdownFirst, true);
      assert.equal(tuning.nameTokensWeight, 5);
  });

  test('migration v12 adds word tokens to an existing node index', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, qualified_name TEXT, docstring TEXT, signature TEXT);
        CREATE VIRTUAL TABLE nodes_fts USING fts5(id, name, qualified_name, docstring, signature, content='nodes', content_rowid='rowid');
        CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
          INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature)
          VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
        END;
        INSERT INTO nodes (id, name, qualified_name) VALUES ('n1', 'DamageHitJob', 'DamageHitJob');
      `);
      applyNameTokensMigration(db);
      const before = db.prepare(`SELECT id FROM nodes_fts WHERE nodes_fts MATCH '"hit"*'`).all();
      assert.deepEqual(before.map((row) => row.id), ['n1']);
      db.exec(`INSERT INTO nodes (id, name, qualified_name, name_tokens) VALUES ('n2', 'FollowOwnerSystem', 'FollowOwnerSystem', 'follow owner system')`);
      const after = db.prepare(`SELECT id FROM nodes_fts WHERE nodes_fts MATCH '"owner"*'`).all();
      assert.deepEqual(after.map((row) => row.id), ['n2']);
      db.close();
  });

  test('symbol search finds a name by inner words', async (context) => {
      withEnv(context, { CODEGRAPH_NAME_TOKENS_WEIGHT: '10' });
      const graph = tempGraph(context, 'codegraph-tokens-', {
          'Hit.cs': 'public class DamageHitJob { public void Run() {} }\n',
      });
      assert.equal((await graph.indexAll()).success, true);
      const names = graph.searchNodes('hit job', { limit: 5 }).map((result) => result.node.name);
      assert.ok(names.includes('DamageHitJob'));
  });

  test('markdown-first puts markdown hits ahead of other formats', async (context) => {
      withEnv(context, { CODEGRAPH_DOCS: '1', CODEGRAPH_DISABLE_EMBEDDINGS: '1', CODEGRAPH_DOCS_MARKDOWN_FIRST: '1' });
      const graph = tempGraph(context, 'codegraph-mdfirst-', {
          'notes.txt': 'inventory grid layout inventory grid layout inventory grid layout\n',
          'grid.md': '# Grid\n\ninventory layout\n',
      });
      await graph.indexAll();
      const result = await searchDocs(graph.getDb(), 'inventory grid layout', { topk: 2 });
      assert.equal(result.hits[0].file, 'grid.md');
  });
  ```
- 검증: `node --test D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-resolution.test.cjs 2>&1 | tail -8`
- 기대 출력: `fail 0` 이 든 줄이 있음 (Node 24 spec 출력은 `ℹ fail 0`)
- 수정 (2026-11-03, 루트 세션): 처음 플랜은 임시 폴더 삭제 훅을 `graph.close()` 훅보다 먼저 등록했음. node:test 는 `after` 훅을 등록 순서대로 돌리므로 Windows 에서 열린 DB 때문에 EPERM 이 남. `docs-batch.test.cjs` 처럼 닫기와 삭제를 훅 하나에 넣는 `tempGraph` 로 바꿈.

### 단계 9: 설정 고르기(sweep)
- 파일: `D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json` (명령이 다시 씀), `D:/Fork/.AI/context/search-eval/results/sweep.json`, `sweep.md`
- 위치: 명령 실행
- 동작: 실행
- 실행(수 분~10여 분 걸림): `cd D:/Fork/.AI/context/search-eval && node run.cjs sweep > results-sweep.log 2>&1; echo exit=$?`
- 판정:
  - `exit=0`: `search-tuning.json` 이 고른 값으로 바뀜. 다음 단계로 감.
  - `exit=2`: 코드 쪽 설정이 기준선보다 나빴음. `search-tuning.json` 은 3단계 값 그대로임. 상태 파일 `MODE=BLOCKED`, `CURRENT=멈춤 S9: code sweep below baseline` 으로 쓰고 멈춤.
  - 그 밖의 값: 상태 파일 `MODE=BLOCKED`, `CURRENT=멈춤 S9: results-sweep.log 확인` 으로 쓰고 멈춤.
- 검증: `python -c "import json; r=json.load(open(r'D:/Fork/.AI/context/search-eval/results/sweep.json', encoding='utf-8')); t=json.load(open(r'D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json', encoding='utf-8')); print(r['passed'], t['nameTokensWeight'] == r['code']['weight'])"`
- 기대 출력: `True True`

### 단계 10: 빌드, 전역 설치, 이 저장소 맞추기(S1, 사용자 승인 필요)
- 파일: KIT `artifacts/codegraph-win32-x64.zip`, `manifest.json`, 전역 설치본, 이 저장소의 배포 사본
- 위치: 명령 실행
- 동작: 실행
- 실행 전: AskUserQuestion 으로 "빌드·전역 설치·이 저장소 동기화를 진행할까요?" 를 묻고, 승인이 없으면 상태 파일 `CURRENT=S10 승인 대기` 로 쓰고 멈춤(MODE 는 EXECUTE 유지).
- 실행 도구: 10a, 10b, 10c 는 Bash 가 아니라 **PowerShell 도구**로 직접 실행함. Bash 에서 `pwsh -Command "..."` 로 부르면 Bash 가 `$env:` 와 `$LASTEXITCODE` 를 먼저 펼쳐 실패가 종료 코드 0 으로 보이고, PATH 에서 Git 의 `/usr/bin/tar` 가 먼저 잡혀 `D:` 경로를 읽지 못함(2026-11-03 안 A 실행에서 실제로 일어남).
- 10a 빌드(PowerShell 도구, 백그라운드): `Set-Location D:/Fork/KIT/tools/codegraph; node build.mjs --rerank-model-root D:/Fork/.AI/context/rerank-model; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`
- 10a 확인: 종료 코드가 0 이 아니거나 `D:/Fork/KIT/tools/codegraph/artifacts/codegraph-win32-x64.zip` 의 수정 시각이 이번 실행 시각보다 앞서면 `MODE=BLOCKED`, `CURRENT=멈춤 S10: build` 로 쓰고 멈춤.
- 10b 설치(PowerShell 도구, 백그라운드): `$env:CODEGRAPH_NO_WATCH = '1'; & D:/Fork/KIT/tools/codegraph/install.ps1; if (-not $?) { exit 1 }`
- 10c 이 저장소 맞추기(PowerShell 도구. robocopy 종료 코드는 8 미만이 성공): `robocopy D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/grammars D:/Fork/codegraph/grammars /MIR /NFL /NDL /NJH /NJS /NP; robocopy D:/Fork/KIT/tools/codegraph/artifacts D:/Fork/codegraph/artifacts /MIR /NFL /NDL /NJH /NJS /NP; Copy-Item D:/Fork/KIT/tools/codegraph/build.mjs,D:/Fork/KIT/tools/codegraph/install.ps1,D:/Fork/KIT/tools/codegraph/install.sh,D:/Fork/KIT/tools/codegraph/manifest.json,D:/Fork/KIT/tools/codegraph/LICENSE D:/Fork/codegraph/ -Force`
- 검증(Bash. 전역 shim 이 가리키는 설치 폴더 이름 끝 12자는 새 zip 의 sha256 앞 12자임): `S=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+-[0-9a-f]{12}' ~/.local/bin/codegraph.cmd | sed 's/.*-//'); grep -c "\"sha256\": \"$S" D:/Fork/KIT/tools/codegraph/manifest.json; codegraph --help | grep -c docs-batch; diff -rq D:/Fork/KIT/tools/codegraph/source D:/Fork/codegraph/source --exclude=node_modules | wc -l`
- 기대 출력: `1`, `1`, `0`. 첫 줄이 `0` 이면 옛 빌드가 설치된 것임
- 수정 (2026-11-03, 루트 세션): 처음 플랜의 10a~10c 는 Bash 에서 `pwsh -Command "..."` 로 불렀고 검증은 docs-batch 유무만 봐서, 빌드 실패와 옛 빌드 설치를 둘 다 놓쳤음. 위처럼 바꿈.

## 수락 기준
```acceptance
{"id":"V1","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/search-tuning.test.cjs","expect":"exit0"}
{"id":"V2","kind":"auto","cmd":"node --test D:/Fork/KIT/tools/codegraph/source/test/docs-batch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-model-mismatch.test.cjs D:/Fork/KIT/tools/codegraph/source/test/docs-rerank.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-regression.test.cjs D:/Fork/KIT/tools/codegraph/source/test/indexing-resolution.test.cjs","expect":"exit0"}
{"id":"V3","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sweep.json');process.exit(r.passed===true?0:1)\"","expect":"exit0"}
{"id":"V4","kind":"auto","cmd":"node -e \"const r=require('D:/Fork/.AI/context/search-eval/results/sweep.json');const t=require('D:/Fork/KIT/tools/codegraph/source/lib/search-tuning.json');process.exit(t.nameTokensWeight===r.code.weight&&JSON.stringify(t.docsFtsWeights)===JSON.stringify(r.docs.config.docsFtsWeights)?0:1)\"","expect":"exit0"}
{"id":"V5","kind":"human","how":"D:/Fork/.AI/context/search-eval/results/sweep.md 의 문서 표와 코드 표를 봄","expect":"모든 묶음의 report 행에서 선택 Hit@1 이 기준 Hit@1 이상이고, 선택 단발 ms 가 기준 단발 ms 의 1.1배 이하임. 아니면 G2 에서 반려함"}
{"id":"V6","kind":"human","how":"G1 때 단계 1 의 code-sets.tsv 40줄을 읽음","expect":"각 정답 심볼이 자연어 질의가 가리키는 코드임. 고칠 줄은 G1 전에 이 플랜에서 고침"}
{"id":"V7","kind":"human","how":"단계 10 을 승인했다면 새 터미널에서 codegraph --help 를 봄","expect":"docs-batch 가 보이고, D:/Fork/codegraph/source 가 KIT source 와 같음"}
```

## 하지 않는 것
- 모델, 임베딩 입력, 벡터 형식 변경(안 C)과 코드 심볼 임베딩(안 B)은 하지 않음.
- 상주 질의 서버(S5)는 하지 않음(사용자 결정 1).
- KIT 규칙 문서(`rules/doc-graph.md`, `references/DOC_GRAPH_POLICY.md`)와 `source/README.md` 의 설명 갱신은 하지 않음. REVIEW 뒤 따로 정함.
- 커밋, 브랜치 전환, stash 는 하지 않음.

## 미결 질문
- 없음
