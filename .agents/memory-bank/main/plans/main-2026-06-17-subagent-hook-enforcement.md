[MODE: PLAN]

# PLAN — 서브에이전트 인식 hook 강제 & 탈옥 봉합

> 작성일: 2026-06-17 · 브랜치: main · 작성자: Claude (메인 컨텍스트 직접 작업)
> 출처 분석: `docs/Try_SubagentHookEnforcement.md` (§ 0~7)
> 사용자 채용 지시: ① ask→deny 승격 ② 매처 구멍 봉합 ③ violation-count.log에 agent_type 기록
> ④ B(agent tools 정비): codegraph 도구 채용 & codegraph 관련 도구 ask 허용
> ⑤ 서브에이전트 금지 정책 **존속** · 예외: 초대형 규모 변경 / 병렬 작업 — 사용자 or AI 판단 → **사용자 요청 발의**

---

## 1. Goal (한 줄)

워크플로우 hook(Sonar / codegraph-gate)을 **서브에이전트 컨텍스트에서 하드 차단(deny)** 으로 승격하고, 메인 컨텍스트의 매처 우회로(순수 Grep·bash cat·비코드 Glob)를 봉합하며, 모든 위반을 `agent_type`과 함께 기록한다. 동시에 18개 에이전트에 codegraph_* 합법 경로를 부여해 **교착(탐색 경로 0) 을 방지**하고, 서브에이전트 디스패치는 기본 금지·예외 시 사용자 발의로 통제한다.

## 2. 배경 — 왜 지금 (검증된 사실)

- Claude Code의 `PreToolUse`/`PostToolUse` hook은 **서브에이전트의 모든 도구 호출에도 발화**하며, 입력 JSON에 서브에이전트일 때만 `agent_id`·`agent_type`이 들어온다 (Try § 0).
- 따라서 탈옥 원인은 "서브에이전트가 hook 밖"이 아니라 **hook이 porous(구멍투성이)** 라는 것 (Try § 1):
  1. 모든 가드가 `ask` — 하드 차단 부재
  2. 매처 구멍: 순수 `Grep(pattern=)`, 비코드 Glob, bash `cat/head/tail *.cs` 통과
  3. 서브에이전트에 codegraph_* 미부여 → gate를 합법적으로 만족할 방법 자체가 없음
  4. `tool-history.log` `tail(5)` 공유 상태가 main/sub 교차로 오염
- **토큰 경제 결론(Try § 7)**: 서브에이전트 콜드스타트 세금(소형 작업 시 ~100배)으로 **서브에이전트 기본 제외는 유지**. 단 § 2의 hook 강화(매처 봉합·ask→deny)는 **메인 자체 단속 + 예외적으로 살아난 서브에이전트 방어** 용도로 여전히 유효.

## 3. Non-Goals (스코프 제외 — 명시)

- ❌ 서브에이전트 전면 부활 — 금지 정책 존속 (예외만 사용자 발의)
- ❌ `SubagentStop` 감사 ledger (Try § 2-C) — 선택 항목, **이번 스코프 제외**(후속 과제로 미결 섹션에 기록)
- ❌ 18개 에이전트의 `Grep`/`Glob`/`Bash` 도구 **제거** — 도구는 유지하고 hook으로 통제(교착·빌드/테스트 기능 보존). B는 "codegraph_* **추가**"가 핵심이지 raw 제거가 아님
- ❌ codegraph MCP 서버 자체(`src/mcp/*`) 수정 — 이 PLAN은 `.claude/` 하네스 레이어만 다룸
- ❌ Windows PowerShell hook의 실제 VM 검증 — EXECUTE 완료 후 별도 (`.parallels` SSH)
- ❌ 메인 컨텍스트 소스 탐색의 deny 강제 — 기본은 ask 유지(D1 참조). 과차단으로 메인 작업 마비 방지

## 4. 설계 결정 (Design Decisions — 승인 시 조정 가능)

각 결정은 **기본값**을 채택하되 근거·대안을 명시한다. RIPER 승인 시점에 사용자가 뒤집을 수 있도록 문서화 (질문 대신 결정 포인트로 박아넣음).

### D1. deny 적용 범위 — **기본: 서브에이전트만 deny, 메인은 ask**
- 근거: 사용자가 "Try 제안 구조 채용"을 명시 → Try § 2-A는 `agent_id` 존재(서브에이전트) 시에만 deny. A의 정의에 충실. 메인 deny는 비코드 Glob·로그 grep·빌드 ls 등 **정당 작업까지 마비**(과차단) 위험. Try § 4의 교착 경고와 § 7("메인은 porosity 수정=매처봉합")에 정합.
- 구현: hook이 입력 JSON `agent_id` 파싱 → 존재하면 위반 시 `deny`, 없으면(메인) `ask`.
- 대안 A(전면 deny): 메인 소스 탐색도 deny. Sonar "DEADLY" 취지엔 부합하나 과차단. → `CG_GATE_MAIN_STRICT=1` 환경변수로 **옵트인 토글** 제공(기본 off).
- 대안 B(단계적, Try § 5): 지금은 양쪽 ask+봉합, 1주 관측 후 deny. → 사용자가 "deny 승격"을 즉시 채용 지시했으므로 기본 채택 안 함. 토글로 ask 유지 가능.

### D2. 순수 Grep / 비코드 Glob 봉합 강도 — **기본: 소스 신호가 있을 때만 강화**
- 순수 `Grep(pattern=)` (type/glob 없음): 리터럴 검색(로그·주석·문자열)일 수 있어 일괄 차단 시 과차단. **기본**: pattern이 소스 심볼처럼 보이고(식별자 정규식) 직전 codegraph 없으면 → 메인 `ask`/서브 `deny`. 명백한 리터럴(공백·특수문자 포함 문장)은 통과.
- 비코드 Glob (`**/*.prefab`, `**/*.unity`): Sonar 위반 아님(소스 아님) → **통과 유지**. 단 서브에이전트가 `**/*` 같은 광역 와일드카드로 소스를 쓸어담는 경우만 서브 `deny`.
- bash `cat/head/tail/less/more/od/strings *.cs|*.py|*.ts...`: 소스 출력 우회 → 매처에 추가, 서브 `deny`/메인 `ask`.

### D3. B(codegraph 부여) 적용 범위 — **기본: 전체 18개 에이전트**
- 근거: Try § 3-E — 단일 choke-point가 아닌 per-agent 허용목록은 drift 위험. 전체 부여가 미래 에이전트 누락을 막고, 탐색이 드문 에이전트도 무해(도구 추가만, 강제 아님).
- 부여 도구(9종): `codegraph_context`, `codegraph_search`, `codegraph_node`, `codegraph_explore`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_trace`, `codegraph_files`.
- frontmatter 표기: `mcp__codegraph__codegraph_*` 풀네임 (단축형 인식 여부는 EXECUTE 1개 에이전트로 스모크 테스트 후 확정).

### D4. 서브에이전트 디스패치 통제 — **기본: Task/Agent 호출 시 ask(경고), deny 아님**
- 근거: 사용자 "서브 금지 존속, 예외는 사용자 발의". 일괄 deny하면 예외(초대형/병렬)도 막힘. `ask` + 경고(콜드스타트 ~100배 세금, 초대형/병렬만 정당)로 사용자 판단 게이트.

## 5. 영향 파일 인벤토리 (BLK 좌표 = 인프라)

> 전부 codegraph 인덱스 밖 인프라 파일 — `codegraph_files .claude` 결과 `.mjs` 1개뿐으로 확인. BLK 좌표는 `[인프라]`.

| # | File (절대경로) | 종류 | 현재 라인 수 | 변경 성격 |
|---|---|---|---|---|
| F1 | `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\sonar-guard.sh` | bash hook | 74 | 확장 |
| F2 | `...\.claude\hooks\sonar-guard-powershell.sh` | bash hook | 38 | 확장 |
| F3 | `...\.claude\hooks\codegraph-gate.sh` | bash hook | 126 | 확장 |
| F4 | `...\.claude\hooks\tool-history-recorder.sh` | bash hook | 21 | 확장 |
| F5 | `...\.claude\hooks\subagent-dispatch-gate.sh` | bash hook | (신규) | 신설 |
| F6 | `...\.claude\settings.json` | JSON 배선 | 122 | Task 매처 1블록 추가 |
| F7 | `...\.claude\state\violation-count.log` | 로그 | (런타임) | 형식 표준화(헤더 주석) |
| F8 | `...\.claude\agents\*.md` (18개) | frontmatter | 각 ~90 | `tools:` 줄 1행 편집 |
| F9 | `D:\Fork\...\CLAUDE.md` (RULE/정책) | 지침 | — | 서브에이전트 정책 섹션 갱신 |
| F10 | `C:\Users\...\.claude\projects\...\memory\main-context-zero-delegation.md` | memory | — | 정책 갱신(전면금지→허용+hook강제+예외) |

### 공통 헬퍼 (모든 hook 스텝에 동일 적용할 파싱 스니펫)
```bash
AGENT_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_type',''))" 2>/dev/null || echo "")
CTX_LABEL="${AGENT_TYPE:-MAIN}"            # 로깅용 라벨
if [ -n "$AGENT_ID" ]; then DECISION="deny"; else DECISION="ask"; fi   # D1 기본
[ "${CG_GATE_MAIN_STRICT:-0}" = "1" ] && DECISION="deny"               # D1 대안 토글
```
표준 위반 로그 1행: `echo "$(date +%s) ${CTX_LABEL} <ViolationType> <detail>" >> .claude/state/violation-count.log`

---

## 6. 구현 스텝 (번호순 · Plan Scope Lock · Max 10)

### STEP 1 — sonar-guard.sh: 서브 인식 deny + 매처 확장 + 위반 로깅
- **Symbol**: `sonar-guard.sh` (셸 스크립트, 심볼 N/A)
- **CodeGraph**: N/A (인덱스 밖 인프라 — `codegraph_files .claude` 확인)
- **File**: `...\.claude\hooks\sonar-guard.sh`
- **Scope**: Lines [10-13] 파싱부, [14-31] 매처부, [33-62] 결정부
- **BLK target**: `[인프라]`
- **Action**: replace/insert
- **변경 내용**:
  - [10-13]에 공통 헬퍼(§5) 삽입 — `AGENT_ID`/`AGENT_TYPE`/`CTX_LABEL`/`DECISION` 산출
  - [14-31] 매처 확장: 기존 find/ls-r/grep-r/rg/fd에 더해
    `cat|head|tail|less|more|od|strings|nl|xxd <...>.(cs|py|ts|tsx|js|jsx|java|cpp|c|h|hpp|go|rs|swift|kt)` 패턴(소스 출력),
    그리고 평범한 디렉토리 나열 `ls`(플래그 무관, 단 경미 → 메인 통과/서브만 경고)
  - [33-62] 위반 시: `permissionDecision`을 하드코딩 `ask` → `$DECISION` 변수로 치환,
    위반 직전 `echo "$(date +%s) ${CTX_LABEL} bash:$VIOLATION" >> .claude/state/violation-count.log` 추가(현재 sonar-guard는 미기록 — 신규)
- **Success criterion**: 모의 JSON `{"tool_input":{"command":"cat foo.cs"},"agent_id":"x","agent_type":"Explore"}` → `deny`; 동일 명령에 `agent_id` 없으면 → `ask`; 두 경우 모두 violation-count.log에 `Explore`/`MAIN` 라벨 행 1개 append.

### STEP 2 — sonar-guard-powershell.sh: 서브 인식 deny + 매처 확장 + agent_type 로깅
- **Symbol**: `sonar-guard-powershell.sh`
- **CodeGraph**: N/A (인프라)
- **File**: `...\.claude\hooks\sonar-guard-powershell.sh`
- **Scope**: Lines [6-7] 파싱, [9-17] 매처, [19-34] 결정/로깅
- **BLK target**: `[인프라]`
- **Action**: replace/insert
- **변경 내용**:
  - [6-7]에 공통 헬퍼 삽입
  - [9-17] 매처 확장: 기존 `-Recurse`/`Select-String -Path *`에 더해
    `Get-Content|gc|cat|type <...>.(cs|py|ts...)` (소스 출력 우회) 추가
  - [20] 기존 로깅 `$(date +%s) PowerShell-Bypass $VIOLATION` → `$(date +%s) ${CTX_LABEL} ps:$VIOLATION` (agent_type 포함)
  - [28] `permissionDecision: 'ask'` → `$DECISION` 치환
- **Success criterion**: 모의 JSON(서브, `Get-Content x.cs`) → `deny` + 로그에 agent_type; 메인 → `ask`.

### STEP 3 — codegraph-gate.sh: 서브 deny + 순수 Grep/비코드 Glob 봉합 + agent_type 로깅
- **Symbol**: `codegraph-gate.sh`
- **CodeGraph**: N/A (인프라)
- **File**: `...\.claude\hooks\codegraph-gate.sh`
- **Scope**: Lines [10-16] 파싱, [18-25] 화이트리스트, [31-122] Read/Glob/Grep 분기
- **BLK target**: `[인프라]`
- **Action**: replace/insert
- **변경 내용**:
  - [10-16]에 공통 헬퍼 삽입
  - [18-25] 화이트리스트 유지(메타 파일 통과) — 단 서브에이전트가 `.sh/.md`로 우회 남용 방지 위해 화이트리스트는 **메인 한정** 검토(서브는 화이트리스트도 codegraph 선행 권장 — D2). 기본은 화이트리스트 유지(과차단 회피).
  - [31-57] Read 위반 결정: `'ask'` → `$DECISION`; 로그 행 [43]에 `${CTX_LABEL}` 추가
  - [60-83] Glob: 코드 패턴(`**/*.{cs,py,ts,tsx,js}`)만 검증 유지 + 서브에이전트는 광역 `**/*` 와일드카드도 검증(D2); 로그 `${CTX_LABEL}`, 결정 `$DECISION`
  - [86-122] Grep 봉합(핵심): 현재 type/glob 소스만 검증 → 추가로 **type/glob 모두 비었고 pattern이 식별자 정규식(`^[A-Za-z_][A-Za-z0-9_]*$` 또는 `\bClass\.method\b`)이면** 소스 구조검색으로 간주 → codegraph 선행 없으면 `$DECISION`. 명백한 리터럴(공백/문장)·소스 필터 없는 자연어는 통과. 로그 `${CTX_LABEL}`
- **Success criterion**: 모의 ① 서브 `Read x.cs`(codegraph 없음) → `deny`; ② 메인 동일 → `ask`; ③ 메인 `Grep(pattern="UserService")` type 없음 → `ask`(봉합); ④ 메인 `Grep(pattern="TODO: fix")` → `allow`(리터럴); ⑤ codegraph 선행 후 모든 Read/Grep → `allow`(회귀 없음).

### STEP 4 — tool-history-recorder.sh: agent 컨텍스트 기록(공유상태 오염 완화)
- **Symbol**: `tool-history-recorder.sh`
- **CodeGraph**: N/A (인프라)
- **File**: `...\.claude\hooks\tool-history-recorder.sh`
- **Scope**: Lines [9-12] 기록부
- **BLK target**: `[인프라]`
- **Action**: replace
- **변경 내용**: [9]에 `AGENT_ID`/`AGENT_TYPE` 파싱 추가, [12] 기록 형식 `$(date +%s) $TOOL_NAME` → `$(date +%s) $TOOL_NAME ${AGENT_TYPE:-MAIN}`. (gate의 `tail(5)` codegraph 판정은 `grep 'codegraph_'`라 형식 확장과 호환 — 회귀 없음. 향후 컨텍스트별 윈도우 분리의 토대.)
- **Success criterion**: 서브 도구 호출 시 history 행에 agent_type 부착; 기존 `codegraph_` 매칭 정상; tail(100) 유지 동작 불변.

### STEP 5 — subagent-dispatch-gate.sh 신설 + settings.json 배선 (D4)
- **Symbol**: `subagent-dispatch-gate.sh`(신규), `settings.json` PreToolUse 배열
- **CodeGraph**: N/A (인프라)
- **File**: `...\.claude\hooks\subagent-dispatch-gate.sh` (신규), `...\.claude\settings.json`
- **Scope**: 신규 파일 전체; settings.json [17-67] PreToolUse 배열에 1블록 insert
- **BLK target**: `[인프라]`
- **Action**: create + insert
- **변경 내용**:
  - 신규 hook: 입력 `tool_name`이 `Task`(또는 `Agent`)면 → `permissionDecision: ask` + 경고(서브에이전트 콜드스타트 세금 ~100배, 초대형 규모 변경/병렬 작업만 정당, 사유 명시 요구). 그 외 `allow`.
  - settings.json: PreToolUse에 `{"matcher":"Task","hooks":[{"type":"command","command":"bash .claude/hooks/subagent-dispatch-gate.sh","timeout":5}]}` 추가. (현 환경 디스패치 도구명이 `Task`인지 `Agent`인지 EXECUTE에서 확인 후 매처 확정 — 필요 시 `Task|Agent`.)
- **Success criterion**: `Task` 호출 모의 JSON → `ask` + 경고 텍스트에 "초대형/병렬·사용자 발의" 포함; 다른 도구 → `allow`. settings.json 유효 JSON 유지(파싱 OK).

### STEP 6 — violation-count.log 형식 표준화
- **Symbol**: 로그 포맷 규약
- **CodeGraph**: N/A
- **File**: `...\.claude\state\violation-count.log` (헤더 주석 1회 기록), 규약은 STEP1~3에 이미 반영
- **Scope**: 파일 선두 주석 행
- **BLK target**: `[인프라]`
- **Action**: append(헤더)
- **변경 내용**: 표준 형식 `<epoch> <AGENT_TYPE|MAIN> <type:detail>` 을 파일 첫 주석(`# format: ...`)으로 1회 기록. 집계 스크립트가 `awk '{print $2}'`로 컨텍스트별 위반 카운트 가능하도록.
- **Success criterion**: STEP1~3 실행 후 신규 위반 행이 모두 `<epoch> <라벨> <type:detail>` 3필드 이상 형식; 라벨로 main/sub 구분 집계 가능.

### STEP 7 — agent frontmatter B 정비 (18개, codegraph_* 부여)
- **Symbol**: 18개 에이전트 `tools:` 필드
- **CodeGraph**: N/A (frontmatter)
- **File**: `...\.claude\agents\{creative-director,engine-programmer,gameplay-programmer,graphics-programmer,lead-programmer,performance-analyst,producer,prototyper,quality-sentinel,reporter,systems-designer,technical-director,unity-addressables-specialist,unity-dots-specialist,unity-shader-specialist,unity-specialist,unity-ui-specialist,writer}.md`
- **Scope**: 각 파일 frontmatter `tools:` 1행 (예: gameplay-programmer L4)
- **BLK target**: `[인프라]`
- **Action**: replace (행 단위)
- **변경 내용**: 각 `tools:` 줄에 9종 codegraph 도구(D3) 추가. 예:
  `tools: Read, Glob, Grep, Write, Edit, Bash, mcp__codegraph__codegraph_context, mcp__codegraph__codegraph_search, mcp__codegraph__codegraph_node, mcp__codegraph__codegraph_explore, mcp__codegraph__codegraph_callers, mcp__codegraph__codegraph_callees, mcp__codegraph__codegraph_impact, mcp__codegraph__codegraph_trace, mcp__codegraph__codegraph_files`
  raw `Grep`/`Glob`/`Bash`는 **유지**(Non-Goal). 먼저 1개(gameplay-programmer)로 스모크 테스트(단축형 vs 풀네임 인식) 후 나머지 17개 일괄.
- **Success criterion**: 18개 전부 codegraph_* 보유; 스모크 에이전트가 실제로 codegraph 도구를 호출 가능; codegraph 도구는 어떤 PreToolUse hook에도 안 걸려 자동 통과(매처에 MCP 없음 — 확인).

### STEP 8 — 정책 문서 갱신 (CLAUDE.md + memory)
- **Symbol**: 서브에이전트 정책 규약
- **CodeGraph**: N/A
- **File**: `D:\Fork\...\CLAUDE.md` (해당 정책 섹션), `C:\Users\...\memory\main-context-zero-delegation.md`
- **Scope**: 정책 단락
- **BLK target**: `[인프라]`
- **Action**: replace
- **변경 내용**:
  - memory `main-context-zero-delegation.md`: "서브에이전트 전면 금지(통제 밖)" 전제 → "서브에이전트 hook으로 강제 통제됨 + 토큰 경제로 기본 제외 + 예외(초대형/병렬)는 사용자 발의" 로 정정. `**Why:**`/`**How to apply:**` 갱신, `[[subagent-hook-enforcement]]` 링크.
  - CLAUDE.md: 서브에이전트 디스패치 정책 명문화(기본 금지·예외 조건·hook 강제). RULE 또는 워크플로 섹션. (헌법급 문서이므로 lossy 압축 금지 — RULE-9 Atom7 준수, 수동 정밀 편집.)
- **Success criterion**: 두 문서가 "전면 금지"가 아닌 "hook 강제 + 토큰경제 기본제외 + 예외 발의"를 일관 기술; MEMORY.md 인덱스 한 줄 갱신.

### STEP 9 — 검증 (hook 단위 모의 테스트)
- **Symbol**: 전체 hook 회귀 스위트
- **CodeGraph**: N/A
- **File**: 임시 검증(스크립트/수동 echo 파이프), 산출물 `docs/output/2026-06-17-subagent-hook-enforcement.md`
- **Scope**: 메인×서브 / 위반×정상 / codegraph선행 매트릭스
- **BLK target**: `[인프라]`
- **Action**: 실행·관찰 (소스 변경 아님)
- **검증 매트릭스** (각 hook에 모의 JSON `echo '...' | bash hook.sh` → `permissionDecision` 확인):
  | 케이스 | 입력 | 기대 |
  |---|---|---|
  | 서브 소스 Read, codegraph 없음 | agent_id 有 + x.cs | `deny` |
  | 메인 소스 Read, codegraph 없음 | agent_id 無 + x.cs | `ask` |
  | codegraph 선행 후 Read | history에 codegraph_ | `allow` (회귀 0) |
  | 서브 bash `cat x.cs` | agent_id 有 | `deny` |
  | 메인 순수 Grep 식별자 | pattern=UserService | `ask` |
  | 메인 리터럴 Grep | pattern="TODO: x" | `allow` |
  | 비코드 Glob | **/*.prefab | `allow` |
  | Task 디스패치 | tool_name=Task | `ask`+경고 |
  | 위반 로그 라벨 | 각 위반 후 | `agent_type|MAIN` 기록 확인 |
- **Success criterion**: 9/9 케이스 기대 일치; 정상·codegraph선행 경로 회귀 0; settings.json 유효.

### STEP 10 — 마무리: .riper-state·메모리 저장 권고
- **Action**: `.riper-state` MODE=REVIEW 전환(EXECUTE 후), 사용자에게 `/memory:save` 권고(컴팩션 안전), 변경 요약을 `docs/output/`에 적재(RULE-9 must-see).
- **Success criterion**: 상태 파일 일관; 산출물 링크 1개.

---

## 7. 전체 Success Criteria (수용 기준)

1. **서브에이전트(agent_id 존재)** 컨텍스트에서 raw 소스 탐색(find/cat *.cs/codegraph 없는 소스 Read·Grep) → **deny**.
2. **메인** 컨텍스트는 동일 행위에 **ask**(D1 기본) — `CG_GATE_MAIN_STRICT=1` 시 deny 옵트인.
3. 봉합: 순수 식별자 Grep·bash cat/head/tail 소스·PowerShell Get-Content 소스 → 강화 결정 적용. 리터럴/비코드는 통과(과차단 0).
4. 모든 위반 로그에 `agent_type`(없으면 `MAIN`) 라벨.
5. 18개 에이전트 전부 codegraph_* 9종 보유, codegraph 도구는 어떤 hook도 deny 안 함.
6. Task/Agent 디스패치 → ask + "초대형/병렬·사용자 발의" 경고.
7. codegraph 선행 후 정상 Read/Grep·비코드 작업 **회귀 0**.
8. 정책 문서(CLAUDE.md·memory) "hook 강제 + 토큰경제 기본제외 + 예외 발의"로 일관.

## 8. 검증 방법 (요약)

- 단위: 각 hook에 모의 JSON을 `echo | bash` 파이프, `permissionDecision`·로그 행 확인 (STEP 9 매트릭스).
- 통합: 실제 codegraph 호출→Read 시퀀스로 `allow` 회귀 확인.
- 크로스플랫폼: PowerShell hook은 Windows 본 환경(win32)에서 실행되므로 로컬 검증 가능; bash hook은 Git Bash 경로 확인.
- 회귀 가드: 기존 정상 플로(codegraph 선행 Read, 비코드 Glob, 리터럴 Grep) 8케이스 중 통과 케이스 유지.

## 9. 롤백 계획

- 모든 변경은 `.claude/` 하네스 레이어 — git 추적. 문제 시 `git checkout -- .claude/hooks/ .claude/settings.json .claude/agents/` 로 즉시 원복.
- hook은 독립적이라 STEP 단위 부분 롤백 가능(예: STEP3만 되돌리고 1·2 유지).
- D1 과차단 발생 시: `CG_GATE_MAIN_STRICT` 미설정(기본) 유지 + 서브 deny만 활성 → 영향 최소.

## 10. 미결 사항 / 사용자 확인 포인트 (승인 시 결정)

- **D1 deny 범위**: 기본=서브만 deny/메인 ask. 메인도 강제하려면 승인 시 "전면 deny" 지시 → STEP1~3의 `$DECISION` 기본을 deny로, 토글 의미 반전.
- **D4 디스패치 도구명**: 현 환경은 `Agent`, Claude Code 표준은 `Task`. EXECUTE에서 실제 발화 도구명 확인 후 매처 확정.
- **STEP7 단축형 인식**: frontmatter에서 `codegraph_search` 단축 표기가 먹는지 vs `mcp__codegraph__` 풀네임 필수인지 — 1개 스모크로 확정 후 17개 일괄.
- **후속(이번 제외)**: `SubagentStop` 감사 ledger(Try § 2-C) — 탈옥 추세 가시화용, 별도 PLAN.
- **순서 의존성**: STEP1~4(hook)는 독립 병렬 가능. STEP5는 settings.json 동시 편집이라 단독. STEP7(18개)은 STEP1~3 검증(STEP9 일부) 후 착수 권장(codegraph 경로가 실제로 deny를 면제하는지 먼저 확인).

---

## RIPER 체크리스트

- [x] Plan 파일 저장: `.claude/memory-bank/main/plans/main-2026-06-17-subagent-hook-enforcement.md`
- [x] 번호 매긴 구현 스텝 (10개, Plan Scope Lock 필드 포함)
- [x] Success criteria 정의 (§7)
- [x] Non-goals 명시 (§3)
- [x] 설계 결정 문서화 (D1~D4, 기본값+대안)
- [ ] `.riper-state` 갱신 (이 파일 직후)
- [ ] 사용자 승인 → EXECUTE
- [ ] `/memory:save` 권고 (컴팩션 안전)
