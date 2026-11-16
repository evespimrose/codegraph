# 코드 kw 검색: FTS 상위 5 안의 정답이 최종 1위를 놓치는 원인 (RESEARCH)

- slug: `main-2026-11-06-codegraph-code-rank-loss`
- 국면: RESEARCH 완료. 수정 방향은 쓰지 않음.
- 측정일: 2026-11-06. 대상: KIT `tools/codegraph/source/lib` (작업 트리 현재 상태).
- 배경: BM25F 적대 검수(`D:/Fork/codegraph/docs/Try_ContextualBM25F.md`)에서 FTS 점수만 바꿔도 최종 kw 순위가 40문항 모두 그대로였음. 1위를 놓친 kw 23건 중 12건은 FTS 단계 상위 5 안에 정답이 있었음. 그 12건이 BM25 뒤 어느 단계에서 밀리는지 찾음.

## 1. 결론

1. 12건 중 9건(T1, T2, T4)에서 정답을 앞지른 노드의 `nameMatchBonus`(질의와 이름의 일치 가점)가 정답보다 크다. 앞선 노드는 이름 가점 60 또는 80을 받고, 정답은 15~29를 받는다. 나머지 3건(r13, a07, a19)은 정답도 가점 80을 받아 동점·벡터 문제다. bm25 는 10~25 범위라서 이 격차를 뒤집지 못한다.
   - 80: 질의를 공백 없이 붙인 문자열이 노드 이름과 같을 때 (`cost map` → `CostMap`, `costMap`).
   - 60: 질의가 2어 이상이고 그중 한 단어가 노드 이름과 같을 때 (`hide if` → `Hide`, `follow owner` → `Owner`).
   - 정답(`HideIfAttribute`, `CostMapBuilder` 같은 복합 이름)은 접두 일치 가점(10 + 30×길이비)이나 "모든 조각 포함" 가점 15만 받는다.
2. `scorePathRelevance` 는 정답에게 +26 정도 주는 경우가 많지만(파일명에 질의어 포함), 이름 가점 격차 40~65 를 메우지 못한다.
3. 정확 이름 보충(`searchNodes` 718~748행)은 12건 중 a12 한 건에서 결정적이다. 흔한 이름 `Spawn` 17개가 FTS 상위 100 밖에서 들어와 bm25 자리에 "FTS 최댓값"을 받고, 이름 가점 60 까지 얻어 정답 앞 18자리를 차지한다.
4. 코드 벡터 RRF 는 양쪽으로 작용한다. 12건 중 6건에서 정답을 올리고(r01 3→1, r02 7→1, r09 9→1, r06 6→2, a03 6→2, a12 19→3), 2건에서 내리고(a07 3→7, a19 1→2), 4건은 1위로 못 올린다(r12, r13 은 2위 그대로, a04 와 a08 은 렉시컬 20 밖에서 10 밖으로 남음).
5. RX_1 DB 에는 지금 코드 벡터가 있다(2,471개 / 노드 7,167개). 의뢰문의 "벡터 표 없음"과 다르다. 기존 V0 결과(rx1)는 벡터 없는 상태였고, 렉시컬 단계 재현 순위가 V0 의 `kwRank` 와 12건 모두 일치한다(아래 3절). 두 조건을 모두 적는다.

## 2. 원인 유형별 건수

한 건에 주된 원인 하나를 붙이고, 겹치는 것은 보조로 적는다.

| 유형 | 내용 | 건수 | 질문 |
|---|---|---|---|
| T1 | 질의 붙임 == 이름(가점 80)인 필드·속성·열거 멤버가 복합 이름 정답을 앞지름 | 3 | r01, r06, a03 |
| T2 | 다어 질의의 한 단어와 같은 짧은 이름(가점 60) 다수가 정답을 앞지름 | 5 | r02, r09, r12, a04, a08 |
| T3 | 같은 이름 노드끼리 가점이 같거나 비슷해 변별 못 함(동점은 FTS 순서) | 2 | r13, a07 |
| T4 | 정확 이름 보충이 FTS 밖 동명 노드를 최댓값 점수로 끌어올림 | 1 | a12 |
| T5 | 벡터 RRF 가 정답을 내림 (렉시컬은 1위) | 1 | a19 |
| 합계 | | 12 | |

보조 원인:
- a07 은 T3 로 렉시컬 3위가 된 뒤 T5 로 7위까지 내려감(보조 T5).
- a12 는 T4 외에 정답 자체가 FTS 3위인데 이름 가점이 29 에 그침(보조 T2).
- a04, a08 은 T2 노드가 30개, 28개여서 정답이 렉시컬 33위, 29위(20 밖)로 밀려 벡터 융합 후보에 들지 못함. 벡터 단독 순위는 7, 14.
- r12 는 정답이 렉시컬 2위이고 벡터 단독 7위라 벡터 융합으로도 못 올림.

## 3. 요약 표

순위 0 은 상위 5(또는 후보 밖)를 뜻하고, 괄호는 실제 순위다.

| id | 묶음 | FTS | 렉시컬 최종(벡터 없음) | 벡터 융합 최종 | 벡터 단독 | 앞선 노드 수 | 주된 원인 |
|---|---|---|---|---|---|---|---|
| r01 | rx1 | 2 | 3 | 1 | 1 | 2 | T1 |
| r02 | rx1 | 1 | 0 (7) | 1 | 1 | 6 | T2 |
| r06 | rx1 | 5 | 0 (6) | 2 | 9 | 5 | T1 |
| r09 | rx1 | 1 | 0 (9) | 1 | 1 | 8 | T2 |
| r12 | rx1 | 1 | 2 | 2 | 7 | 1 | T2 |
| r13 | rx1 | 2 | 2 | 2 | 1 | 1 | T3 |
| a03 | Arcyn | 3 | 0 (6) | 2 | 4 | 5 | T1 |
| a04 | Arcyn | 2 | 0 (33) | 0 (13) | 7 | 32 | T2 |
| a07 | Arcyn | 1 | 3 | 0 (7) | 20 밖 (37) | 2 | T3, 보조 T5 |
| a08 | Arcyn | 1 | 0 (29) | 0 (28) | 14 | 28 | T2 |
| a12 | Arcyn | 3 | 0 (19) | 3 | 2 | 18 (보충 17) | T4 |
| a19 | Arcyn | 2 | 1 | 2 | 20 밖 (21) | 0 | T5 |

- rx1 의 기존 V0 `kwRank`(r01 3, r02 0, r06 0, r09 0, r12 2, r13 2)는 "렉시컬 최종" 열과 같다. Arcyn 의 기존 `kwRank`(a03 2, a04 0, a07 0, a08 0, a12 3, a19 2)는 "벡터 융합 최종" 열과 같다.
- 벡터 융합 최종은 `searchNodesHybrid(kw, {limit:10})` 실제 호출 결과다. rx1 의 이 열은 현재 DB(벡터 있음) 값이며 V0 때는 없던 조건이다.
- a07 은 `limit 10` 안에서 7위라 kwRank 는 0 이다.

## 4. 단계 구조 (코드 위치)

호출 순서는 `searchNodesHybrid` → `searchNodes` → `searchNodesFTS`.

| 단계 | 위치 | 하는 일 |
|---|---|---|
| S0 FTS | `lib/db/queries.js:872` `searchNodesFTS` | `"term"* OR "term"*` 접두 매치. `bm25(nodes_fts,0,20,5,1,2,nameTokensWeight=2)` 의 절댓값. `ftsLimit = max(limit*5,100)` 이므로 limit 20 이면 100개. |
| S1 정확 이름 보충 | `queries.js:724-748` | 질의 각 단어와 `name = ? COLLATE NOCASE` 인 노드를 단어당 20개까지 추가. 점수는 FTS 결과의 최댓값. |
| S2 가점 합산 | `queries.js:750-764` | `score += kindBonus + scorePathRelevance + nameMatchBonus`, 정렬 후 limit(20)으로 자름. |
| S3 벡터 융합 | `lib/index.js:1024` `searchNodesHybrid`, `lib/search/code-vectors.js:173` `fuseNodeResults` | 렉시컬 20개와 벡터 20개를 RRF(`1/(61+순위)`, 벡터 가중 `codeVectorWeight=1`)로 합쳐 limit 10. 벡터가 0개면 렉시컬 앞 10개 그대로. |

가점 크기 (`lib/search/query-utils.js`):
- `nameMatchBonus`(284행): 이름 == 질의 붙임 80, 다어 질의에서 이름 == 질의 단어 하나 60, 이름이 질의 붙임으로 시작 `round(10+30×길이비)`, 질의 조각이 모두 이름에 포함 15, 이름이 질의 붙임을 포함 10.
- `kindBonus`(323행): function·method 10, interface·trait 9, class 8, struct 6, property·field·enum_member 3 등.
- `scorePathRelevance`(198행): 파일명에 질의어 +10, 디렉터리 +5, 경로 +3 (질의어별), 테스트 파일 -15.
- `searchNodes` 의 비교 값 단위: bm25 는 약 10~25, 가점은 합쳐 0~130.
- `codeVectorScore: 40` 은 `search-tuning.json` 에 있으나 읽은 범위(`code-vectors.js` 120~190행)에서는 쓰이지 않음. 다른 곳에서의 사용은 확인 안 함.

## 5. 환경 차이 (rx1 대 Arcyn)

| 항목 | rx1 (`D:/Fork/RX_1`) | Arcyn (`D:/Fork/Arcyn`) |
|---|---|---|
| 노드 수 | 7,167 | 67,093 |
| 코드 벡터 | 2,471 (모델 `dragonkue/multilingual-e5-small-ko`) | 22,418 |
| V0 측정 때 | 벡터 표 없음 → 렉시컬 순위가 최종 | 벡터 있음 → 융합 순위가 최종 |
| 이번 측정 | 두 조건을 모두 적음 | 융합 순위, 렉시컬 순위를 따로 적음 |

- 복사본 `rx1` 은 `-wal`, `-shm` 을 함께 복사했고, 그 안에 벡터 표가 있었다. 벡터가 언제 채워졌는지는 확인 안 함(DB 수정 시각 2026-11-06 11:42, watcher 가 상시 갱신 중).
- 렉시컬 순위가 V0 JSON 과 12건 모두 일치하므로 인덱스 내용은 V0 때와 같거나 순위에 영향 없는 차이로 본다. 단 정답 외 노드까지 같은지는 비교 안 함.

## 6. 재현

측정 스크립트는 scratchpad 사본과 노트 폴더에 보관한다.
`C:/Users/JANGHYEONGTAEK/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_cc0dd919-7418-469f-877c-309274184d52/code-rank-loss-stages.cjs`

```bash
# 1) DB 복사 (실제 DB 는 건드리지 않음). <SP> 는 임의의 작업 폴더
mkdir -p <SP>/proj/rx1/.codegraph <SP>/proj/arcyn/.codegraph
cp D:/Fork/RX_1/.codegraph/codegraph.db* <SP>/proj/rx1/.codegraph/
cp D:/Fork/Arcyn/.codegraph/codegraph.db <SP>/proj/arcyn/.codegraph/
# 2) 스크립트를 <SP> 에 두고 실행 (종료 코드 0, 표준 출력 JSON)
cd <SP> && node code-rank-loss-stages.cjs rx1 > rx1.json && node code-rank-loss-stages.cjs arcyn > arcyn.json
```

- 스크립트는 KIT 의 `lib/db/queries.js`, `lib/search/query-utils.js`, `lib/search/code-vectors.js`, `lib/index.js` 를 require 한다. 모델 경로는 전역 shim(`~/.local/bin/codegraph.cmd`)의 버전 폴더 `lib/models` 로 `CODEGRAPH_MODEL_ROOT` 를 준다.
- 질문과 정답은 `D:/Fork/.AI/context/search-eval/code-sets.tsv`, 기존 순위는 `try-bm25f/code-{rx1,arcyn}-V0.json`.
- 자체 검증: 단계 분해 결과가 실제 `qb.searchNodes()` 반환과 같은 순서인지(`sameAsReal`)와 융합 결과가 실제 `searchNodesHybrid` 와 같은지(`fusedSame`)를 12건 모두 true 로 확인했다.

## 7. 질문별 상세

`앞선 노드` 표의 `FTS순위`가 `보충`이면 FTS 상위 100 에 없어 정확 이름 보충으로 들어온 노드다. kind, path, name 열은 가점 값이다(종류 이름은 `종류` 열).

### r01 (rx1) kw=`cost map`

- 정답: `Domain/CostMapBuilder.cs#CostMapBuilder` (method)
- 단계별 정답 순위: FTS 2 → 보충·가점 뒤(렉시컬) 3 → 벡터 융합 뒤 1; 벡터 단독 순위 1. 기존 V0: 2 → 3
- 정답 점수: bm25 17.5 + kind 10 + path 26 + name 25 = **78.5**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Domain/SolveSession.cs#CostMap` | enum_member | 4 | 17.5 | 3 | 0 | 80 | 100.5 |
| `Domain/SolveSession.cs#costMap` | field | 5 | 17.3 | 3 | 0 | 80 | 100.3 |

- 벡터 융합 상위: `CostMapBuilder`(렉시컬 3, 벡터 1), `CostMapBuilder`(렉시컬 4, 벡터 2), `IsReached`(렉시컬 10, 벡터 3), `Relax`(렉시컬 9, 벡터 4), `MarkReachableCells`(렉시컬 11, 벡터 5), `Step`(렉시컬 15, 벡터 6)

### r02 (rx1) kw=`hide if`

- 정답: `Attributes/ConditionAttributes.cs#HideIfAttribute` (method)
- 단계별 정답 순위: FTS 1 → 보충·가점 뒤(렉시컬) 7 → 벡터 융합 뒤 1; 벡터 단독 순위 1. 기존 V0: 1 → 0
- 정답 점수: bm25 18.2 + kind 10 + path 0 + name 22 = **50.2**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Helpers/TooltipPopup.cs#Hide` | method | 6 | 10.0 | 10 | 0 | 60 | 80.0 |
| `Logic/IOPortIndicatorPreview.cs#Hide` | method | 7 | 10.0 | 10 | 0 | 60 | 80.0 |
| `Shell/ComponentCard.cs#Hide` | method | 8 | 10.0 | 10 | 0 | 60 | 80.0 |
| `Presentation/PlacementPopupUI.cs#Hide` | method | 27 | 9.8 | 10 | 0 | 60 | 79.8 |
| (외 2개) | | | | | | | |

- 벡터 융합 상위: `HideIfAttribute`(렉시컬 8, 벡터 1), `HideIfAttribute`(렉시컬 7, 벡터 2), `Hide`(렉시컬 2, 벡터 10), `HideIfAttribute`(렉시컬 9, 벡터 3), `HideIOPortIndicator`(렉시컬 17, 벡터 11), `HideCommittedIndicators`(렉시컬 15, 벡터 13)

### r06 (rx1) kw=`edit history`

- 정답: `Logic/GridEditHistory.cs#GridEditHistory` (method)
- 단계별 정답 순위: FTS 5 → 보충·가점 뒤(렉시컬) 6 → 벡터 융합 뒤 2; 벡터 단독 순위 9. 기존 V0: 5 → 0
- 정답 점수: bm25 13.8 + kind 10 + path 26 + name 15 = **64.8**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Logic/InputHandler.cs#editHistory` | field | 1 | 15.5 | 3 | 0 | 80 | 98.5 |
| `Logic/LayerViewObstacleDragHandler.cs#editHistory` | field | 2 | 15.5 | 3 | 0 | 80 | 98.5 |
| `Logic/Range.cs#editHistory` | field | 3 | 15.5 | 3 | 0 | 80 | 98.5 |
| `Presentation/FlowController.cs#editHistory` | field | 4 | 15.5 | 3 | 0 | 80 | 98.5 |
| (외 1개) | | | | | | | |

- 벡터 융합 상위: `SelectionHistory`(렉시컬 13, 벡터 1), `GridEditHistory`(렉시컬 6, 벡터 9), `SelectionHistory`(렉시컬 14, 벡터 4), `GridEditHistory`(렉시컬 7, 벡터 11), `EditState`(렉시컬 18, 벡터 19), `editHistory`(렉시컬 1, 벡터 -)

### r09 (rx1) kw=`value changed`

- 정답: `Attributes/OnValueChangedAttribute.cs#OnValueChangedAttribute` (method)
- 단계별 정답 순위: FTS 1 → 보충·가점 뒤(렉시컬) 9 → 벡터 융합 뒤 1; 벡터 단독 순위 1. 기존 V0: 1 → 0
- 정답 점수: bm25 16.7 + kind 10 + path 26 + name 15 = **67.7**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Logic/WaypointPlacement.cs#Changed` | enum_member | 6 | 12.4 | 3 | 0 | 60 | 75.4 |
| `Logic/CellVisualJobs.cs#Changed` | field | 7 | 12.4 | 3 | 0 | 60 | 75.4 |
| `Core/PercentEditorOptions.cs#Value` | property | 8 | 11.9 | 3 | 0 | 60 | 74.9 |
| `Domain/SearchHeap.cs#value` | field | 11 | 11.9 | 3 | 0 | 60 | 74.9 |
| (외 4개) | | | | | | | |

- 벡터 융합 상위: `OnValueChangedAttribute`(렉시컬 9, 벡터 1), `OnValueChangedAttribute`(렉시컬 10, 벡터 2), `HandleToggleValueChanged`(렉시컬 12, 벡터 5), `OnObjectChanged`(렉시컬 18, 벡터 7), `ValueType`(렉시컬 14, 벡터 13), `Changed`(렉시컬 1, 벡터 -)

### r12 (rx1) kw=`after delay`

- 정답: `Helpers/UITooltipTrigger.cs#ShowAfterDelay` (method)
- 단계별 정답 순위: FTS 1 → 보충·가점 뒤(렉시컬) 2 → 벡터 융합 뒤 2; 벡터 단독 순위 7. 기존 V0: 1 → 2
- 정답 점수: bm25 20.5 + kind 10 + path 0 + name 15 = **45.5**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Logic/GridEditHistory.cs#after` | field | 4 | 13.3 | 3 | 0 | 60 | 76.3 |

- 벡터 융합 상위: `ClearSaveStatusAfterDelay`(렉시컬 3, 벡터 3), `ShowAfterDelay`(렉시컬 2, 벡터 7), `CaptureDirtyAfter`(렉시컬 4, 벡터 12), `SyncAfterUndo`(렉시컬 6, 벡터 17), `after`(렉시컬 1, 벡터 -), `Tick`(렉시컬 -, 벡터 1)

### r13 (rx1) kw=`ensure styles`

- 정답: `UxHints/UxHintGuideSOEditor.cs#EnsureStyles` (method)
- 단계별 정답 순위: FTS 2 → 보충·가점 뒤(렉시컬) 2 → 벡터 융합 뒤 2; 벡터 단독 순위 1. 기존 V0: 2 → 2
- 정답 점수: bm25 25.2 + kind 10 + path 0 + name 80 = **115.2**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Localization/UITextTableWindow.cs#EnsureStyles` | method | 1 | 25.2 | 10 | 0 | 80 | 115.2 |

- 벡터 융합 상위: `EnsureStyles`(렉시컬 1, 벡터 2), `EnsureStyles`(렉시컬 2, 벡터 1), `Ensure`(렉시컬 3, 벡터 3), `EnsureIndex`(렉시컬 7, 벡터 4), `PercentStyles`(렉시컬 5, 벡터 14), `Ensure`(렉시컬 4, 벡터 -)

### a03 (Arcyn) kw=`tree data`

- 정답: `Blobs/TreeDataBlobBuilder.cs#TreeDataBlobBuilder` (class)
- 단계별 정답 순위: FTS 3 → 보충·가점 뒤(렉시컬) 6 → 벡터 융합 뒤 2; 벡터 단독 순위 4. 기존 V0: 3 → 2
- 정답 점수: bm25 19.8 + kind 8 + path 26 + name 23 = **76.8**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Data/Tree.Data.cs#TreeData` | struct | 4 | 19.6 | 6 | 30 | 80 | 135.6 |
| `Components/RuntimeState.cs#treeData` | field | 8 | 19.4 | 3 | 5 | 80 | 107.4 |
| `Hub/HubCategoryTree.cs#Tree` | property | 21 | 12.2 | 3 | 13 | 60 | 88.2 |
| `measure/zoom.mjs#data` | constant | 보충 | 22.1 | 3 | 0 | 60 | 85.1 |
| (외 1개) | | | | | | | |

- 벡터 융합 상위: `TreeData`(렉시컬 1, 벡터 1), `TreeDataBlobBuilder`(렉시컬 6, 벡터 4), `SetTreeData`(렉시컬 14, 벡터 3), `BuildTreeData`(렉시컬 17, 벡터 2), `Build`(렉시컬 18, 벡터 10), `TreeAsset`(렉시컬 20, 벡터 12)

### a04 (Arcyn) kw=`follow owner`

- 정답: `Motion/PathSystems.cs#FollowOwnerSystem` (struct)
- 단계별 정답 순위: FTS 2 → 보충·가점 뒤(렉시컬) 0(전체 33) → 벡터 융합 뒤 0(깊이100 기준 13); 벡터 단독 순위 7. 기존 V0: 2 → 0
- 정답 점수: bm25 21.3 + kind 6 + path 0 + name 29 = **56.3**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Data/Deliveries.cs#FollowOwner` | struct | 1 | 21.6 | 6 | 0 | 80 | 107.6 |
| `Core/MotionOwnership.cs#Owner` | method | 11 | 12.8 | 10 | 13 | 60 | 95.8 |
| `Runtime/RuntimeSceneFollow.cs#Follow` | method | 53 | 12.1 | 10 | 13 | 60 | 95.1 |
| `Core/MotionOwnership.cs#Owner` | struct | 14 | 12.8 | 6 | 13 | 60 | 91.8 |
| (외 28개) | | | | | | | |

- 벡터 융합 상위: `FollowOwner`(렉시컬 1, 벡터 3), `Owner`(렉시컬 2, 벡터 9), `Owner`(렉시컬 4, 벡터 11), `Follow`(렉시컬 13, 벡터 5), `OnUpdate`(렉시컬 -, 벡터 1), `Execute`(렉시컬 -, 벡터 2)

### a07 (Arcyn) kw=`memory`

- 정답: `Data/Stats.cs#Memory` (struct)
- 단계별 정답 순위: FTS 1 → 보충·가점 뒤(렉시컬) 3 → 벡터 융합 뒤 7; 벡터 단독 순위 20 밖(37). 기존 V0: 1 → 0
- 정답 점수: bm25 10.7 + kind 6 + path 0 + name 80 = **96.7**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Hud/HudMemoryInput.cs#Memory` | field | 27 | 10.6 | 3 | 13 | 80 | 106.6 |
| `Views/GalleryMeterSections.cs#Memory` | method | 5 | 10.6 | 10 | 0 | 80 | 100.6 |

- 벡터 융합 상위: `MemoryBar`(렉시컬 14, 벡터 1), `MemoryTag`(렉시컬 15, 벡터 5), `MemoryCore`(렉시컬 16, 벡터 11), `Memory`(렉시컬 1, 벡터 -), `Memory`(렉시컬 2, 벡터 -), `MemoryFragmentationSystem`(렉시컬 -, 벡터 2)

### a08 (Arcyn) kw=`owner death`

- 정답: `Lifecycle/SummonOwnerDeathSystem.cs#SummonOwnerDeathSystem` (struct)
- 단계별 정답 순위: FTS 1 → 보충·가점 뒤(렉시컬) 0(전체 29) → 벡터 융합 뒤 0(깊이100 기준 28); 벡터 단독 순위 14. 기존 V0: 1 → 0
- 정답 점수: bm25 17.8 + kind 6 + path 26 + name 15 = **64.8**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Core/MotionOwnership.cs#Owner` | method | 2 | 12.8 | 10 | 13 | 60 | 95.8 |
| `Core/MotionOwnership.cs#Owner` | struct | 5 | 12.8 | 6 | 13 | 60 | 91.8 |
| `Hub/HubValidation.cs#Owner` | method | 3 | 12.8 | 10 | 0 | 60 | 82.8 |
| `Lease/LeaseArgs.cs#Owner` | method | 4 | 12.8 | 10 | 0 | 60 | 82.8 |
| (외 24개) | | | | | | | |

- 벡터 융합 상위: `Owner`(렉시컬 1, 벡터 20), `OwnerAlive`(렉시컬 -, 벡터 1), `Owner`(렉시컬 2, 벡터 -), `_find_existing`(렉시컬 -, 벡터 2), `Owner`(렉시컬 3, 벡터 -), `OwnerJob`(렉시컬 -, 벡터 3)

### a12 (Arcyn) kw=`hazard spawn`

- 정답: `Flow/HazardSpawnSystem.cs#HazardSpawnSystem` (struct) 외 정답 1개
- 단계별 정답 순위: FTS 3 → 보충·가점 뒤(렉시컬) 19 → 벡터 융합 뒤 3; 벡터 단독 순위 2. 기존 V0: 3 → 3
- 정답 점수: bm25 18.1 + kind 6 + path 26 + name 29 = **79.1**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|
| `Utilities/DeliverySpawner.cs#Spawn` | method | 보충 | 20.5 | 10 | 13 | 60 | 103.5 |
| `Archive/ArchivePieceSpawner.cs#Spawn` | method | 보충 | 20.5 | 10 | 13 | 60 | 103.5 |
| `Lifecycle/PickupSpawnUtility.cs#Spawn` | method | 보충 | 20.5 | 10 | 13 | 60 | 103.5 |
| `Lifecycle/UnitSpawnSystem.cs#Spawn` | method | 보충 | 20.5 | 10 | 13 | 60 | 103.5 |
| (외 14개) | | | | | | | |

- 벡터 융합 상위: `Spawn`(렉시컬 1, 벡터 12), `Spawn`(렉시컬 3, 벡터 14), `HazardSpawnSystem`(렉시컬 19, 벡터 15), `TryGetPlayerPosition`(렉시컬 -, 벡터 1), `Spawn`(렉시컬 2, 벡터 -), `OnUpdate`(렉시컬 -, 벡터 2)

### a19 (Arcyn) kw=`rebase`

- 정답: `Core/ChipMath.cs#Rebase` (method)
- 단계별 정답 순위: FTS 2 → 보충·가점 뒤(렉시컬) 1 → 벡터 융합 뒤 2; 벡터 단독 순위 20 밖(21). 기존 V0: 2 → 2
- 정답 점수: bm25 20.1 + kind 10 + path 0 + name 80 = **110.1**

| 앞선 노드 | 종류 | FTS순위 | bm25 | kind | path | name | 합 |
|---|---|---|---|---|---|---|---|

- 벡터 융합 상위: `sqlite3_rebaser`(렉시컬 3, 벡터 1), `Rebase`(렉시컬 1, 벡터 -), `RebaseLimit`(렉시컬 2, 벡터 -), `Remap`(렉시컬 -, 벡터 2), `RebuildLabels`(렉시컬 -, 벡터 3), `MaterialRemap`(렉시컬 -, 벡터 4)


## 8. 사람이 확인할 항목

1. 의뢰문은 "rx1 실제 DB 에 벡터 표 없음"이라 했으나 지금 RX_1 DB 에는 벡터 2,471개가 있다. 언제 채워졌는지, 이후 rx1 40문항 결과를 다시 잴지 판단 필요.
2. 12건 중 a03 의 앞선 노드 `Tree.Data.cs#TreeData` 는 질의 `tree data` 의 다른 정의(struct)라 정답 선정 자체가 맞는지 확인 필요(정답은 `TreeDataBlobBuilder`).
3. 유형 분류는 단일 원인 기준이다. 이름 가점 대신 다른 가점이 순위를 바꿨을 때를 따로 재는 실험(가점 하나씩 끄기)은 하지 않았다(RESEARCH 범위 밖).
4. `codeVectorScore` 사용처는 확인 못 함.
