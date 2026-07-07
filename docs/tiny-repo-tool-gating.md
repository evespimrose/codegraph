# Tiny-Repo Tool Gating — 무엇이고, 왜 있으며, 어떤 선택을 낳는가

> 작성일: 2026-06-15
> 맥락: "codegraph MCP 도구가 레지스트리에 안 뜬다 / `codegraph_status`가 쿼리되지 않는다" 조사 중 발견된 **설계상 동작**(버그 아님)에 대한 정리.
> 대상 코드: `src/mcp/tools.ts` `ToolHandler.getTools()` (게이트 본체 `:818-854`)

---

## 0. 이 문서가 나온 배경 — 3계층 원인

`mcp__codegraph__codegraph_status` 등이 세션에서 보이지 않던 문제를 추적한 결과, 원인은 **서로 독립적인 3계층**이었다.

| 계층 | 내용 | 상태 |
|---|---|---|
| **1. 등록 누락** | codegraph MCP 서버가 `~/.claude.json`·프로젝트 `.mcp.json` 어디에도 등록돼 있지 않아 **모든** 도구가 부재 → "No matching deferred tools found" | ✅ 수정됨 (`.mcp.json` + 전역 `mcpServers.codegraph`) |
| **2. tiny-repo 게이트** | 등록을 고쳐도, 이 레포가 < 500파일이라 **6개 도구가 의도적으로 숨겨짐** (`status` 포함) | 📄 **이 문서의 주제** |
| **3. 패키지 rename** | `@colbymchenry`→`@evespimrose` 변경은 직접 원인이 아니라, 재설치 churn이 `mcpServers` 블록을 비운 것이 실제 메커니즘 | 참고 |

계층 1은 고쳤다. 사용자가 `codegraph_status`를 콕 집어 물었는데, 그게 **계층 2**에 걸린다. 이 문서는 계층 2를 상세히 설명한다.

---

## 1. tiny-repo 게이트란 무엇인가

`ToolHandler.getTools()`(MCP `tools/list` 응답을 만드는 함수)는 **인덱싱된 파일 수**가 `TINY_REPO_FILE_THRESHOLD`(= **500**) 미만이면, 노출하는 MCP 도구를 **핵심 5개 + docs**로 제한한다.

| 구분 | 도구 |
|---|---|
| **노출 (작은 레포에서도 유지)** | `codegraph_search`, `codegraph_context`, `codegraph_node`, `codegraph_explore`, `codegraph_trace` (+ `codegraph_docs` — docs 기능이 켜진 경우) |
| **숨김 (작은 레포에서 제거)** | `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_status`, `codegraph_files`, `codegraph_backlinks` |

`TINY_REPO_CORE_TOOLS` 집합은 `tools.ts:841-847`에 하드코딩돼 있고, 임계값 500은 `tools.ts:840`에 하드코딩돼 있다. **우회용 환경변수는 현재 없다.**

---

## 2. 무엇을 위해 만들어졌나 — 목적과 실측 근거

### 2.1 설계 철학
CodeGraph의 핵심 가치는 *에이전트가 구조/흐름 질문("X가 어떻게 Y에 도달하나", 영향 범위, 호출자)을 **적은 수의 빠른 codegraph 호출**과 **Read/Grep 0**으로 답하게 하는 것*이다. 최적화 대상은 **wall-clock 지연 + 도구 호출 수**(토큰 비용이 아님). (CLAUDE.md "Retrieval performance" 참조.)

핵심 통찰: **에이전트는 codegraph 답이 불충분한 순간 즉시 Read/Grep으로 후퇴한다.** 그래서 "도구를 더 많이 주는 것"이 항상 이득은 아니다 — 작은 레포에서는 오히려 손해다.

### 2.2 작은 레포에서 숨김 도구가 손해인 이유
`callers`/`callees`/`impact`/`status`/`files`는 **작은 레포에서는 grep 한 번으로 환원**된다. 코드가 적으면 에이전트가 그 도구들을 고르고 호출하는 오버헤드를, 절약되는 탐색량으로 **회수하지 못한다**. 도구 표면이 넓을수록 에이전트의 도구-선택 비용만 늘고 효용은 작다.

### 2.3 "5개가 하한"이라는 실측 (코드 주석의 n=2 A/B 감사)
임의로 정한 숫자가 아니라 측정으로 내려온 하한이다 (`tools.ts:823-839`):

- **3-tool 게이트**(search+context+trace): cobra/ky/sinatra에서 비용 **회귀**. 에이전트가 `node`+`explore`가 답했을 것을 raw Read로 대체.
- **1-tool 게이트**(search만): **파국적 회귀** — express가 **-43% WIN → +107% LOSS**. search만으로는 콜그래프를 구조적으로 못 따라가 전부 Read.
- → **5개가 경험적 하한.** search/context/node/explore/trace 너머의 도구는 작은-레포 흐름 질문에서 회수 안 되는 오버헤드.

### 2.4 임계값 150 → 500 상향 (ITER4)
원래 임계값은 150이었으나, 단일 파일 프레임워크(sinatra ≈ 159파일, slim ≈ 200파일)도 같은 구조적 문제(단일 파일에서 WITHOUT-arm의 Read가 이김)를 보여, 5-tool 표면을 받도록 **500으로 상향**했다 (`tools.ts:834-839`).

---

## 3. 정확히 무엇을 하는가 — 동작

### 3.1 `getTools()` 필터 순서
```
1. CODEGRAPH_MCP_TOOLS allowlist(env) 적용 — 미설정이면 전체(tools)
2. docs 게이트 — docs 기능 off면 codegraph_docs 제거
3. 프로젝트 미오픈(this.cg == null)이면 여기서 반환 (tiny 게이트 없음)
4. 프로젝트 오픈 시: getStats().fileCount 조회
5. fileCount < 500 이면 → {핵심5 + docs}로 필터   ← tiny-repo 게이트
6. explore 설명에 동적 budget 주입 후 반환
```

### 3.2 중요한 성질들
- **숨김 = "거부"가 아니라 "존재하지 않음".** `tools/list`에 아예 안 실리므로, 에이전트의 ToolSearch가 그 이름을 **찾지 못한다**. 이것이 사용자가 본 `codegraph_status` → "No matching deferred tools found"의 정체(계층 2 몫).
- **런타임·동적 게이트.** *같은* 글로벌 바이너리라도 **레포 파일 수**에 따라 노출이 달라진다. 그래서 "글로벌이 stale인가?"가 아니라 "이 레포가 작아서"가 정답이었다. (글로벌·로컬 dist 모두 12개 도구를 **정의**하고 있음 — 정의는 12, 노출이 6.)
- **오픈 후에만 적용.** 프록시가 프로젝트 오픈 전 답하는 정적 표면(`getStaticTools()` `:686-695`)에는 tiny 게이트가 **없다**(엔진/통계가 없으므로). 프로젝트가 열리면 `getTools()`가 권위를 가지며 게이트가 작동한다.
- **allowlist로 우회 불가.** 게이트가 allowlist *뒤*에 무조건 적용되므로, `CODEGRAPH_MCP_TOOLS=status`로 지정해도 게이트가 다시 `status`를 제거 → **0개**가 된다.

---

## 4. 이 레포(D:\Unity\codegraph)의 실측

| 지표 | 값 |
|---|---|
| Files | **217** (< 500 → 게이트 발동) |
| Nodes / Edges | 3,343 / 8,645 |
| Backend | node:sqlite (built-in, WAL) |
| 핸드셰이크 `tools/list` 결과 | **정확히 6개**: search, context, docs, node, explore, trace |
| 부재 | callers, callees, impact, **status**, files, backlinks |

즉 등록 수정(계층 1) 후 **재시작하면 6개가 보이고, `codegraph_status`는 여전히 안 보인다** — 버그가 아니라 §2의 최적화 때문.

---

## 5. 어째서 "2가지 선택지"가 나왔나

- 사용자 의도: `codegraph_status`를 포함해 "codegraph 도구들을 쿼리 가능"하게.
- 그러나 `status`는 tiny-repo 게이트의 **숨김 대상**이고, 게이트는 하드코딩(500)에 **우회 env가 없다**(§1, §3.2).
- allowlist로도 못 푼다(§3.2). 따라서 217파일 레포에서 12개를 모두 노출하려면 **게이트 자체를 무력화하는 길** 외에 방법이 없다.

→ 결국 둘 중 하나다:
- **(A)** 게이트를 그대로 두고 핵심 6개로 사용
- **(B)** 게이트를 우회하는 **opt-in 코드 변경**을 넣어 전체 12개 노출

---

## 6. 선택지별 영향

### 선택 A — 재시작만 (게이트 유지) · 코드 변경 없음
- **할 일:** Claude Code 재시작(+ `.mcp.json` 신뢰 프롬프트 승인)뿐.
- **결과:** 핵심 6개(search, context, docs, node, explore, trace) 쿼리 가능.
- **숨김 6개 접근:** CLI로 대체 — `codegraph status`, `codegraph query`, `codegraph affected`(impact), `codegraph files` 등.
- **장점:** 무위험. 빌드/글로벌-sync 불필요. **실제 엔드유저(< 500파일 레포) 경험을 그대로 도그푸딩**.
- **단점:** MCP에서 `status`/`callers`/`callees`/`impact`/`files`/`backlinks`를 **직접 호출 불가**.

### 선택 B — 전체 12개 노출 (opt-in 오버라이드 추가) · 코드 변경
- **할 일(체인):**
  1. `tools.ts`에 opt-in env 게이트 추가 (예: `CODEGRAPH_ALL_TOOLS` / `CODEGRAPH_DISABLE_TINY_GATE`). 기본 **off** → 다른 유저 동작 불변.
  2. `npm run build`
  3. `sync-global-codegraph` (글로벌 `@evespimrose` 바이너리 갱신 — **글로벌 bin EEXIST 충돌 이력 주의**, 스킬이 `--force`로 처리)
  4. `.mcp.json` / 전역 `~/.claude.json`의 서버 항목 `env`에 플래그 추가
  5. 재시작
- **결과:** 이 레포에서 12개 전부 쿼리 가능.
- **장점:** 코드그래프 자체를 개발/디버깅할 때 `callers`/`impact`/`backlinks`를 MCP로 직접 호출.
- **단점:** §2의 **실측 최적화를 우회** → 도그푸딩 시 엔드유저와 다른 표면을 보게 됨. 빌드+sync 체인 필요. **RULE-7: 소스 수정 승인 필요.**
- **구현 메모(영향 최소화):** 게이트는 `getTools()` **한 곳**(`:848`)에만 있다. 정적 표면(`getStaticTools()`)엔 없으므로 그 한 줄의 `if`를 `if (!allToolsOverride() && stats.fileCount < THRESHOLD)`로 바꾸는 최소 변경으로 충분. allowlist와의 상호작용은 그대로 유지.

  ```ts
  // 예시(미적용): tools.ts:848 인근
  const allTools = process.env.CODEGRAPH_ALL_TOOLS === '1';
  if (!allTools && stats.fileCount < TINY_REPO_FILE_THRESHOLD) {
    visible = visible.filter(t => TINY_REPO_CORE_TOOLS.has(t.name) || t.name === 'codegraph_docs');
  }
  ```

### 절충안 (B의 변형) — 배포 기본은 유지, 이 레포만 풀 표면
B를 구현하되 env 기본 off로 두고, **이 레포의 `.mcp.json`에만** `env: { "CODEGRAPH_ALL_TOOLS": "1" }`를 넣는다. → 배포된 다른 유저는 최적화(게이트) 유지, 개발 레포만 12개 전부. **권장 절충.**

---

## 7. 권장

- 일상 사용(흐름/구조 질문)에는 **핵심 6개로 충분** — search/context/node/explore/trace가 고가치 표면이고, `status`/`files`는 CLI가 더 적합. → **선택 A**가 기본값으로 합리적.
- 단, **코드그래프를 직접 개발/디버깅**하며 MCP로 `callers`/`impact`/`backlinks`를 자주 호출한다면 **절충안**(B + 레포-로컬 env)이 깔끔. 기본 off라 배포 영향 0.
- 어느 쪽이든 **계층 1(등록)은 이미 적용**돼 있으니, **재시작은 필수**.

---

## 8. 부록 — 계층 1(MCP 등록) 수정 요약 (이미 적용됨)

- 생성: `D:\Unity\codegraph\.mcp.json` (커밋 대상) — `{ codegraph: { type: stdio, command: codegraph, args: [serve, --mcp] } }`
- 추가: `~/.claude.json` 최상위 `mcpServers.codegraph` (전역, 모든 프로젝트) — 동일 내용. Claude Code의 라이브 재직렬화에도 보존 확인.
- `command: codegraph` → `@evespimrose` 글로벌 bin(0.9.8.1, 정상) 사용 → **rename 유지하면서 도구 쿼리 가능**.
- MCP config는 세션 시작 시 로드 → **현재 세션엔 미반영, 재시작 필요.**
- 검증: `initialize` + `tools/list` 핸드셰이크로 서버 정상 응답(6개 반환) 확인.

---

## 9. 참조

- `src/mcp/tools.ts` — `getStaticTools()` `:686-695`, `getTools()` `:801-868`, tiny 게이트 `:818-854`, 임계값 `:840`, 핵심집합 `:841-847`
- `CLAUDE.md` — "Retrieval performance & dynamic-dispatch coverage", "Explore budget — keep BOTH budgets monotonic"
- 이 레포 인덱스: 217 files (`codegraph status`)
