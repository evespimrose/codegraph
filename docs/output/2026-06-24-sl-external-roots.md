# SL external roots — `.codegraph/sl_root_cache.txt` (구현 + 검증)

> 2026-06-24 · branch `codegraph_sl_treesitter_parser`
> 근거: [Try_SLSchemaAutoInject.md](../Try_SLSchemaAutoInject.md) 옵션 D의 경량 변형 (사용자 발의).
> 목표: FEGate `fegate_api` 헤더/예제를 **매 프로젝트에 복사하지 않고**, 공유 폴더를 참조해 `.sl`의 `dbX::Method()` 콜을 API 선언에 해석.

## 메커니즘

프로젝트가 `.codegraph/sl_root_cache.txt`에 **외부 루트 디렉터리의 절대경로**를 한 줄씩 적는다(`#` 주석·빈 줄 무시). 인덱싱 시 그 루트들의 소스 파일을 **절대경로 식별자**로 같은 그래프에 병합 → `.sl`(루트)의 콜이 외부 헤더 스텁(`dbNode::First` 등)에 **해석 직전 단계에서** 매칭된다.

### 변경 (모두 `src/extraction/index.ts`)
- `readExternalRootDirs(rootDir)` / `scanExternalRootFiles(rootDir)` (+ `SL_ROOT_CACHE_FILE` 상수): 캐시 파일 파싱 + 외부 루트 스캔(절대경로 반환). 존재하지 않는 경로는 경고 후 스킵.
- `indexAll`: 프로젝트 스캔 직후 외부 루트 파일을 `files`에 append(해석 전 → 같은 런에서 해석됨).
- 배치 리더: `path.isAbsolute(fp)`면 within-root 가드 우회하고 직접 read(신뢰된 사용자 설정).
- `sync`: 삭제 reconcile에서 절대경로(외부) 파일은 **purge 면제**(rootDir 스캔에 없어도 유지).

테스트: `__tests__/extraction.test.ts` — `SL external roots` describe 2건(캐시 읽기+스캔, 부재/주석 시 빈 결과). 2/2 통과.

## 검증 (베어 SL 프로젝트, 헤더 0개)

`sltest/myquery.sl`만 둔 프로젝트 + `.codegraph/sl_root_cache.txt`(→ `…/SL/fegate_api`, `…/SL/fegate_api_exam`):

| 단계 | 결과 |
|---|---|
| 캐시 없이 index | myquery 2노드, `dbNode::First` 스텁 0, 해석 0 |
| 캐시 + `index --force` | **774 파일 인덱싱**, slheader 1,713 스텁, `dbNode::First` 스텁 생성 |
| myquery `main`의 콜 | **6/6 해석** → `dbNode::GetAll`·`dbNode::Label`·`dbNode::First`·`dbElem::CountAll`·`msgLog`×2 (전부 외부 스텁) |

→ 헤더를 프로젝트에 두지 않고도 베어 `.sl`의 API 콜이 call graph로 연결됨.

## 사용법

```
1. (최초) codegraph init        # .codegraph 생성
2. .codegraph/sl_root_cache.txt 작성:
     D:\path\to\fegate_api
     D:\path\to\fegate_api_exam   # 선택(예제 사용 패턴까지 원하면)
3. codegraph index --force       # 외부 루트 + 내 .sl 전체 해석
```

## 주의 / 한계 (v1)

- **`--force` 필요**: 캐시를 *나중에* 추가하면, 이미 인덱싱된(미변경) 내 `.sl`은 증분 `index`가 스킵해 외부 스텁에 재해석되지 않는다 → 캐시 추가·수정 후 `index --force`. (캐시가 처음부터 있으면 1회 full index로 전부 해석.)
- 외부 노드는 **external 표식 없음**(v1) — 검색·노드수에 포함된다(사용자가 API를 검색 가능하길 원하므로 의도된 동작). 향후 `external` provenance로 "내 코드" 지표와 분리 가능.
- 매 full index마다 외부 루트 전체 재파싱(소규모라 ~1s). 향후 hash 기반 증분 가능.
- chicken-egg: `init -i`는 `.codegraph`를 갓 만들어 캐시가 없으므로, `init`(인덱스 없이) → 캐시 작성 → `index --force` 순.

## 후속(비범위)
external provenance 표식 · 외부 루트 증분 해석 · `init --external <path>` 플래그 · 범용화(SL 외 SDK).
