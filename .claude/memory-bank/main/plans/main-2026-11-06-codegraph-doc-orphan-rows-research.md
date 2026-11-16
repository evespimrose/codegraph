# 문서 색인 고아 행 생성 경로 조사 (RESEARCH)

- slug: main-2026-11-06-codegraph-doc-orphan-rows
- 날짜: 2026-11-06
- 대상: `D:/Fork/KIT/tools/codegraph/source/lib/` (KIT codegraph)
- 범위: 조사만 함. 소스 수정과 플랜 없음. 실제 DB 는 열지 않고 복사본(`.db` 만, `-wal` 제외)을 `node:sqlite` 로 읽음.

## 1. 결론

고아 행의 주 경로는 한 곳임. `QueryBuilder.clear()` (`lib/db/queries.js:1628-1659`)가 `mdast_metadata` 만 확실히 비우고 `document_fts` 는 건드리지 않음. `mdast_vectors` 는 `DELETE` 를 시도하지만 sqlite-vec 이 아직 안 올라온 연결이라 실패하고, 그 오류를 `catch {}` 로 삼킴(1647-1658줄).

`clear()` 는 전체 재색인(`indexAll`)에서 호출됨: `lib/index.js:304` `if (options.force || needsSourceParserRebuild(db)) this.clear()`. 파서 개정(`source_parser_revision`)이 바뀔 때도 같은 경로를 탐. 그래서 codegraph 를 올릴 때마다 일어날 수 있음.

`mdast_metadata.id` 는 `INTEGER PRIMARY KEY`(AUTOINCREMENT 아님, `lib/db/migrations.js:75-77`)라 비운 뒤 id 가 1부터 다시 매겨짐. 재색인 문서 수가 전보다 적거나 스캔 순서가 달라지면 새 최대 id 위쪽(또는 옛 id)에 FTS 행과 벡터가 남음.

## 2. 재현 근거

BLADE 복사본에서 `clear()` 의 SQL 을 그대로 실행함(scratchpad `b.mjs`):

```
before meta 1369 fts 1378 vecrowids 1439
cleared mdast_metadata
FAIL mdast_vectors no such module: vec0
after meta 0 fts 1378 vecrowids 1439
```

메타데이터만 비고 FTS 1378행과 벡터 1439개가 그대로 남음. `clear()` 는 vec0 로드 전에 불리므로(`docs/indexer.js:80` `loadVecExtension` 은 `indexMarkdown` 안) 실제 경로에서도 같은 실패가 남.

## 3. 고아 행 실측 (복사본, `a.mjs` `c.mjs`)

| DB | meta 행/최대 id | FTS 고아 | 벡터 고아 | FTS 고아 중 벡터 있음/없음 | 고아 FTS 의 file_path 가 현재 메타와 겹침 |
|---|---|---|---|---|---|
| BLADE | 1369 / 1369 | 9 (id 1370-1378) | 70 (id 1370-1439) | 9 / 0 | 9 of 9 (현재 id 226-234) |
| RX_1 | 133 / 133 | 81 (id 134, 250-285 사이 일부, 410-460) | 30 (id 134, 250-285 사이 일부) | 30 / 51 | 59 of 81 |

- 두 DB 모두 `source_parser_revision=team-source-v4`, 임베딩 모델은 한 종류(`dragonkue/multilingual-e5-small-ko`)뿐이라 모델 교체 흔적은 없음.
- 메타에는 있는데 FTS 에 없는 id 는 0.
- BLADE 벡터 1379-1439 (61개)는 FTS 도 메타도 없음. 이전 색인 때 문서가 1439개였다가 줄어든 꼬리로 보임.
- RX_1 FTS 410-460 (51행)은 벡터가 없고 file_path 가 `.kilo/worktrees/...` 임. 현재 메타에 없는 경로. 그때는 임베딩 불가 상태였거나 이 경로가 스캔 대상이었다가 빠진 것으로 보임(추정).
- 겹치는 경로의 고아 id 와 현재 id 가 다름(예: `docs/work.md` 고아 252, 현재 129). 재색인에서 스캔 순서나 대상 집합이 달라져 id 가 다시 매겨졌다는 뜻.

## 4. 다른 후보 점검

| 후보 | 결과 |
|---|---|
| `DocumentStore.removeDocuments` (`docs/document-store.js:66-76`) | 벡터, FTS, 메타, 노드를 한 트랜잭션에서 지움. 고아를 만들지 않음. |
| `DocumentStore.publish` (`document-store.js:78-96`) | 같은 id 의 FTS 와 벡터를 지우고 다시 넣음. 같은 id 를 다시 쓰는 문서는 고아를 덮어써서 스스로 치유됨. |
| 마이그레이션 (`db/migrations.js`, `migration-v9.js`) | `mdast_metadata` 컬럼 추가뿐. 행을 지우지 않음. |
| 문서 기능 끄기/켜기 (`docs/config.js`) | `docs_enabled` 값만 바꿈(복사본 `docs_enabled=1`). 행 삭제 없음. |
| 모델 교체 재임베딩 | `upsertMetadata` 가 `embedding_model=NULL` 로 만들고 같은 id 로 다시 게시함. id 불변이라 고아 아님. |
| `mdast_metadata` 를 직접 지우는 SQL | `docs/` 와 `db/` 에서 `DELETE FROM mdast_metadata` 는 `document-store.js:43`(removeDocuments 경유)과 `queries.js:1653`(clear) 둘뿐. |
| 옛 판 삭제 코드 | 옛 TS(`66e0c51^:src/docs/indexer.ts:98-132`)는 벡터와 메타만 지우고 FTS 는 아예 없었음. FTS 는 KIT 판(`5b81e8d`)에서 처음 생김. KIT 쪽 git 이력은 `5b81e8d` 한 커밋으로 합쳐져 있어 그 전 삭제 코드 변천은 확인할 수 없음. |

## 5. 영향 범위

- `docs/lexical-search.js:24-27`, `docs/rerank.js:129`: 메타와 JOIN 하므로 고아 FTS 행은 결과에서 빠짐. 단 FTS5 의 bm25 는 인덱스 전체 통계(문서 수, 평균 길이, 용어 빈도)를 쓰므로 고아 행이 IDF 에 섞임.
- `docs/search.js:102-105` 벡터 KNN `k=depth`: 고아 벡터가 후보 자리를 차지하고, 뒤의 메타 조회(`search.js:118-121`)에서 빠져 후보가 `depth` 보다 적어짐. BLADE 고아 70개는 id 1370-1439 라서 질의에 따라 이 자리를 차지함.
- `docs/semantic-edge-incremental.js:37-40`: `staleCount = vectorCount - documents.length` 만큼 k 를 키워 이미 고아 벡터를 보정하고 있음. 같은 보정이 `search.js` 에는 없음.
- `docs/semantic-edge-store.js:17`: 메타와 JOIN 하므로 영향 없음.
- 현재 DB 중 Zyxel, 원자그래프, Arcyn 은 고아 0. 전체 재색인이 없었거나 문서 수가 늘기만 한 경우로 보임(추정).

## 6. 시간 추정

- 고아 id 는 모두 "현재 최대 id 보다 큰 꼬리"(BLADE) 또는 "옛 id 가 현재 id 와 겹치지 않는 자리"(RX_1). 전체 재색인 뒤 문서 수가 줄거나 순서가 바뀐 흔적과 맞음.
- 정확한 시각은 DB 에 없음(`mdast_metadata.last_updated` 는 현재 행만 가짐). 복사본으로는 어느 재색인 때인지 못 가림. 감시기 로그(`D:/Fork/BLADE/.codegraph/watcher.log` 등)와 `source_parser_revision` 변경 이력으로 더 좁힐 수 있으나 이번엔 열어보지 않음.
- BLADE 벡터 1379-1439 처럼 FTS 없이 벡터만 남은 꼬리는, FTS 가 없던 판의 색인 흔적이 `clear()` 에서 안 지워진 채 남은 것으로 보이는 가설. 확정 증거 없음.

## 7. 정리 방법 후보 (선택하지 않음, 목록만)

1. 근본 경로: `clear()` 에서 `document_fts` 도 비움. 벡터는 vec0 로드 뒤에 지우거나, 로드 못 하면 shadow 테이블(`mdast_vectors_rowids` 등)이 아닌 가상 테이블 `DELETE` 가 가능한 시점으로 옮김.
2. 사후 정리: `indexMarkdown` 안에서 `loadVecExtension` 뒤에 `document_fts` 와 `mdast_vectors` 중 메타에 id 가 없는 rowid 를 지움.
3. 읽는 쪽 보정: `search.js` 도 `semantic-edge-incremental.js` 처럼 고아 수만큼 `k` 를 키움(고아를 남겨 둔 채 완화).
4. 이미 생긴 고아: 위 2번 방식의 일회성 정리, 또는 `docs` 전체 재생성.
5. `mdast_metadata` 를 AUTOINCREMENT 로 바꾸어 id 재사용을 막는 방법(마이그레이션 필요, 고아 자체는 안 없앰).

## 8. 한계

- DB 복사본은 `.db` 만이고 `-wal` 을 빼서 마지막 몇 번의 쓰기가 빠졌을 수 있음. 고아 판정에는 영향이 작음.
- 고아가 생긴 시점과 그때의 색인 호출(강제 여부, 파서 개정 변경)은 확인하지 못함.
- 소스 수정, 플랜, 실제 DB 접근, sync 실행 없음.

## 9. 사람이 확인할 항목

1. 7절 정리 방법 중 어느 방향으로 INNOVATE 를 진행할지.
2. 감시기 로그나 파서 개정 이력으로 발생 시점을 더 좁힐 필요가 있는지.

## 10. 사용자 결정 (2026-11-06)

정리 방법은 A+B로 진행함. A는 `clear()`에서 `document_fts` 비우기, B는 `indexMarkdown` 에서 `loadVecExtension` 직후 메타에 id 없는 FTS 행과 벡터 지우기. C(`search.js` 의 `k` 보정), E(AUTOINCREMENT)는 이번 범위에서 뺌. 실제 재색인 경로(`needsSourceParserRebuild` → `clear()` → `indexMarkdown`)를 끝까지 돌리는 검증을 수락 기준으로 잡을 것.
