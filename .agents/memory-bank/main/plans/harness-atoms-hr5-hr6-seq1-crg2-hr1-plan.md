[MODE: PLAN]

# RIPER PLAN — 하네스/워크플로우 레이어 5원자 (HR5 · HR6 · Seq1 · CRG2강제 · HR1)

> 작성일: 2026-06-16 · Branch: main
> 의사결정 출처: `D:\Fork\codegraph\docs\Try_AtomImport_DLC_vs_Workflow.md` §6·§7
> 경계 원리: "정적 인덱스가 더 좋은 답 = codegraph / 에이전트의 컨텍스트 조립·세션·행동을 바꾸는 것 = 워크플로우". 이 5원자는 모두 후자 → **claude-personal-integrated-workflow** 소속. codegraph 편입 금지.
> **이 문서는 PLAN 전용. EXECUTE(구현) 없음.** 각 원자의 EXECUTE는 별도 사용자 승인 후 착수.

---

## 0. RESEARCH 요약 (현재 상태 조사 결과)

조사 도구: Glob + 표적 Read (RULE-1 Sonar 준수; -Recurse/grep -r 미사용). 인프라는 전부 bash 훅 + MD 스킬 + 상태파일.

### 0.1 기존 훅 (`.claude/hooks/`)
| 훅 | 이벤트 | 역할 | 5원자 관련성 |
|---|---|---|---|
| `session-start.sh` | SessionStart | CORE_RULES + CLAUDE.md + .riper-state + cxt(mtime순) 주입 | **HR5 직접 대상** (프리픽스 churn 원천) |
| `post-compact.sh` | SessionStart | 컴팩션 후 CORE_RULES 재주입 | **HR5** (프리픽스 일관성 2번째 진입점) |
| `pre-compact.sh` | PreCompact | .riper-state·플랜 백업 + /memory:save 지시 | HR6 보조(세션 종료 신호) |
| `codegraph-gate.sh` | PreToolUse:Read\|Glob\|Grep | Cave-Man L1 하드 게이트, 위반 로그 | CRG2강제 패턴 레퍼런스(PreToolUse `ask`) |
| `output-arm-gate.sh` | Stop | Output Arm 사후 게이트(경고만, 차단X) | **CRG2강제·HR1 패턴 레퍼런스**(Stop 훅) |
| `write-approval-reminder.sh` | PreToolUse:Write\|Edit | 소스 쓰기 전 승인 리마인더 | 게이트 패턴 레퍼런스 |
| `gate-check.sh` | PostToolUse:Write\|Edit | 플랜/결론 파일 저장 후 게이트 체크리스트 | Seq1(플랜 파일 감지 로직 재사용 가능) |
| `tool-history-recorder.sh` | PostToolUse | 모든 도구 호출 → tool-history.log(직전 100개) | **CRG2강제 턴 카운터 기반 인프라** |
| `dict-sync-check.sh` / `dict-blk-announce.sh` / `post-commit-dict-sync.sh` | 사전류 | dictionary 동기화 | 무관 |

### 0.2 기존 스킬 (`.claude/skills/`)
`output-arm`(출력 토큰 게이트, 토글 가능, Stop 훅 연동), `doc-context`, `try`, `handover`, `agent-eval`, `add-lang`, `sync-global-codegraph`, `visualize-graph`. → **HR1·CRG2강제는 output-arm 스킬 구조(스킬 MD + 상태파일 + 토글 + Stop 훅)를 그대로 본뜬다.**

### 0.3 상태파일 (`.claude/state/`)
- `output-arm` (`on`/`off`) — 토글 상태파일 선례
- `violation-count.log` — Sonar 위반 누적(epoch + 도구 + 경로)
- `tool-history.log` — `<epoch> <ToolName>` 라인, 세션 시작 시 초기화(session-start.sh L86-92)

### 0.4 메모리뱅크 (`.claude/memory-bank/`)
- `.riper-state` — 5키(`MODE`/`TASK`/`PLAN_FILE`/`BRANCH`/`STARTED`), 현재 `MODE=NONE`. session-start.sh가 정규식으로 `MODE=`/`PLAN_FILE=` 파싱.
- `main/plans/` — 없었음 → 본 작업에서 생성. 명명 규칙(plan.md 커맨드 L40): `[branch]-[YYYY-MM-DD]-[feature].md`
- `main/20260521-session.md` — 세션 메모리 선례.

### 0.5 settings 구조
- `.claude/settings.json` — **훅 등록 단일 지점**. SessionStart 1, PreToolUse 4(matcher: Bash / PowerShell / Read|Glob|Grep / Write|Edit), PostToolUse 3, Stop 1.
- `.claude/settings.local.json` — permissions·MCP enable만(훅 없음). → **새 훅 등록은 settings.json에만.**

### 0.6 RIPER 커맨드 (`.claude/commands/riper/plan.md`)
PLAN 모드는 서브에이전트 위임 + `.riper-state` MODE=PLAN 기록 + 플랜 파일 저장 + 체크리스트 강제. → **Seq1은 이 기존 RIPER 배선을 "Seq1 실현체"로 형식화/문서화하는 것이지 신규 구축 아님.**

### 0.7 CLAUDE.md 규칙 표면 (RULE-1~9 + Plan Scope Lock)
RULE-9(Output Arm)가 출력측 토큰 게이트의 헌법 근거. "Plan Scope Lock 필드"가 본 문서 Step 필드 형식의 근거. HR1·CRG2강제는 RULE-9와 같은 계열(토큰 1급 자원)로 위치시킨다.

---

## 1. INNOVATE 요약 (원자별 접근 후보 비교 → 권장안)

각 원자 1~2 후보를 비교하고 1개 선택. **공통 원칙(try 문서 §5 검증): codegraph의 저살리언스 채널로 "에이전트 행동을 강제"하는 것은 안 먹힌다 → 강제가 필요하면 hook, 규율이면 스킬+문서, 자동화면 별도 스크립트(세션 외).** correctness > brevity.

### HR5 — CacheAligner (프리픽스 KV캐시 안정화)
- **후보 A (규율+린트)**: session-start.sh의 주입 *순서·내용*을 결정론화(고정 블록 우선, 가변 블록 후순위) + cxt mtime 정렬이 일으키는 churn을 줄이는 안정 정렬키 도입. 신규 훅 없이 기존 훅 1개 정비 + 검증 스킬.
- **후보 B (전용 프리프로세서 훅)**: 프리픽스를 캐노니컬라이즈하는 새 훅 추가.
- **권장: A.** try 문서가 "하네스 규율" 성격이라 판정. 신규 훅 도입 비용 없이 기존 두 SessionStart 훅(session-start·post-compact)의 *불변 prefix / 가변 suffix* 분리만으로 KV 캐시 히트율을 올린다. B는 진입점만 늘려 오히려 churn 증가 위험.

### HR6 — learn 루프
- **후보 A (세션 외 오프라인 배치)**: 세션 종료 후 별도 스크립트가 tool-history/violation 로그를 분석 → 제안 diff 생성 → **검토 게이트(사용자 승인) 후에만** 메모리 파일 반영. 자동 쓰기 없음.
- **후보 B (세션 내 Stop 훅 자동 교정)**: Stop 시 자동으로 메모리 파일 수정.
- **권장: A.** B는 "사용자 모르게 메모리 변형"=헌법 위반(Atom 7 lossy 오염 교훈, RULE-9 금지). A는 분석/제안과 반영을 분리, 반영은 반드시 인간 게이트. **단 EXECUTE는 5원자 중 후순위**(가장 비싼 축, try §2에서 HIGH).

### Seq1 — 사고 외재화 (= RIPER)
- **후보 A (형식화/배선만)**: 기존 RIPER가 이미 Seq1 실현체임을 문서로 명문화 + `.riper-state` 추적이 모든 모드 전이에서 보장되는지 검증·보강. 신규 구축 최소.
- **후보 B (신규 사고-외재화 레이어 구축)**: 별도 thinking-log 시스템.
- **권장: A.** try 문서가 "이미 존재"로 판정. B는 RIPER와 중복(역시너지). A는 RIPER↔Seq1 매핑 문서 1개 + `.riper-state` 전이 보장 점검만. **최저비용 → 1순위.**

### CRG2강제 — 턴/토큰 예산 강제
- **후보 A (PreToolUse 카운트 게이트 + Stop 사후 게이트)**: tool-history.log 기반 세션 턴 카운터로 예산 초과 시 경고/ask. output-arm-gate·codegraph-gate 패턴 재사용.
- **후보 B (토큰 추정 게이트)**: 입력/출력 토큰을 추정해 임계 강제.
- **권장: A.** try 문서가 "hook으로만 가능"으로 판정(저살리언스 벽). 토큰 정밀 측정은 훅 환경에서 비결정적 → **턴(도구 호출) 수 = 결정론적 프록시**를 1차 강제. B(토큰 추정)는 부정확·비용↑ → 미결로 남김. **차단보다 경고 우선**(output-arm-gate 선례), 강제 차단은 옵트인.

### HR1 — CCR 프록시 (입력 압축 프록시)
- **후보 A (스킬+문서 규율, 프록시 미구축)**: "도구/컨텍스트 출력 압축"을 output-arm처럼 *에이전트 행위 규율*로 형식화(LLM 앞단 별도 프로세스 없이). 토글·상태파일·Stop 게이트.
- **후보 B (실제 프록시 레이어 구축)**: LLM 앞단에 압축 프록시(별도 프로세스/번들) 구축.
- **권장: A(설계)+B(미결).** try 문서가 5원자 중 **최고비용**, "짓는다면 LLM 앞단"으로 판정. B는 외부 프로세스·손실 리스크·운영비용이 커서 본 PLAN에서는 **설계 골격(A: 규율형 입력 압축 계약)만** 확정하고, 실제 프록시 구축(B)은 가치 입증 후 별도 결재로 미룬다. **5원자 중 최후순위.**

### 우선순위 (저비용→고비용, try §5 권장 순서 반영)
```
Seq1 (최저, 문서/배선)  →  HR5 (저, 훅 1개 정비)  →  CRG2강제 (중, 신규 훅+상태)
   →  HR6 (고, 오프라인 배치+게이트)  →  HR1 (최고, 설계만/프록시 보류)
```
의존: CRG2강제·HR6·HR1은 모두 tool-history.log(이미 존재) 위에 선다. HR5는 Seq1과 독립(병렬 가능). HR1 설계는 output-arm·CRG2강제 패턴 확정 후 착수가 자연스러움.

---

## 2. 원자별 PLAN

> 형식: 각 Step = **Symbol / CodeGraph / File / Scope / BLK target / Action / Success criterion**. 원자당 Max 10 steps. 인프라(셸/MD/JSON)는 CodeGraph = "N/A(인프라)".

---

### ATOM Seq1 — 사고 외재화 형식화 (RIPER = Seq1 실현체) · 우선순위 1 (최저비용)

**목표**: 신규 구축 없이, 기존 RIPER가 Seq1(사고 외재화)의 실현체임을 명문화하고 `.riper-state` 추적이 전 모드 전이에서 보장되는지 점검·보강.

**Step S1-1**
- Symbol: `riper-state 전이 보장 점검`
- CodeGraph: N/A(인프라 MD)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\commands\riper\research.md`, `innovate.md`, `plan.md`, `execute.md`, `review.md`
- Scope: 각 파일의 "State Update" 섹션 유무 확인 (plan.md L23-32 형식이 기준)
- BLK target: [인프라]
- Action: (점검) — 5개 모드 커맨드 전부가 `.riper-state` MODE 기록 절차를 갖는지 확인, 누락 모드만 식별
- Success criterion: 5개 모드별 `.riper-state` write 절차 유무 표가 도출됨 (누락 0이면 보강 불필요)

**Step S1-2**
- Symbol: `Seq1↔RIPER 매핑 문서`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\docs\design\seq1-riper-externalization.md`
- Scope: 신규 파일 (~40줄): Seq1 정의 → RIPER 5단계가 각 사고 외재화 단계에 대응함을 매핑, `.riper-state`가 외재화 산출물임을 명시
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\docs\design\seq1-riper-externalization.md`
- Action: create
- Success criterion: 문서가 RESEARCH→INNOVATE→PLAN→EXECUTE→REVIEW ↔ 사고 외재화 단계 매핑표를 포함하고, "신규 시스템 아님 — RIPER가 실현체" 결론을 명시

**Step S1-3**
- Symbol: `누락 모드 .riper-state write 보강`
- CodeGraph: N/A(인프라 MD)
- File: S1-1에서 누락으로 식별된 `.claude\commands\riper\*.md` (해당 시에만)
- Scope: 누락 파일의 "State Update" 섹션 (plan.md L23-32 형식 복제)
- BLK target: [인프라]
- Action: insert (조건부 — 누락 시에만)
- Success criterion: 모든 RIPER 모드 커맨드가 진입 시 `.riper-state` MODE를 기록 (전이 추적 빈틈 0)

---

### ATOM HR5 — CacheAligner (프리픽스 KV캐시 안정화) · 우선순위 2

**목표**: SessionStart 프리픽스(session-start.sh / post-compact.sh 주입물)를 *불변 블록 우선 + 가변 블록 후순위*로 재배치해 Anthropic 프롬프트 KV 캐시 히트율을 올린다. cxt mtime 정렬이 만드는 churn을 줄인다. **신규 훅 없음 — 기존 훅 2개 정비 + 검증 스킬.**

**Step H5-1**
- Symbol: `session-start.sh prefix 구조 분석`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\session-start.sh`
- Scope: Lines [8-92] (parts 조립 전체: CORE_RULES→CLAUDE.md→.riper-state→플랜→cxt→위반이력→history 초기화)
- BLK target: [인프라]
- Action: (분석) — 어떤 블록이 매 세션 불변(CORE_RULES, CLAUDE.md)이고 어떤 게 가변(.riper-state, cxt mtime, 위반이력)인지 분류
- Success criterion: 블록별 불변/가변 분류표 도출 (캐시 prefix 경계 후보 확정)

**Step H5-2**
- Symbol: `prefix 불변·가변 분리 재배치`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\session-start.sh`
- Scope: Lines [8-67] (parts append 순서)
- BLK target: [인프라]
- Action: replace — 불변 블록(CORE_RULES, CLAUDE.md)을 항상 동일 순서·동일 내용으로 prefix 선두 고정, 가변 블록(.riper-state·cxt·위반이력)을 뒤로 이동
- Success criterion: 동일 입력(.riper-state·cxt 무변경)으로 2회 실행 시 prefix 선두(불변 구역) byte-equal

**Step H5-3**
- Symbol: `cxt 안정 정렬키`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\session-start.sh`
- Scope: Lines [53-54] (`cxt_candidates ... sorted(..., key=os.path.getmtime, reverse=True)`)
- BLK target: [인프라]
- Action: replace — mtime 1차 정렬은 유지하되 동률·근접변경 churn 완화(예: 파일명 보조 정렬키 추가)로 빈번한 prefix 재구성 억제
- Success criterion: cxt 파일 내용 무변경 + touch만 발생한 경우에도 주입 블록 순서가 흔들리지 않음

**Step H5-4**
- Symbol: `post-compact.sh prefix 일치`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\post-compact.sh`
- Scope: Lines [24-46] (CORE_RULES 정의)
- BLK target: [인프라]
- Action: (점검 후 조건부 replace) — post-compact의 CORE_RULES 텍스트가 session-start의 것과 형식·순서 일치하는지 확인, 불일치 시 동일 불변 블록으로 정렬
- Success criterion: 두 SessionStart 진입점(최초/컴팩션후)이 동일 불변 prefix를 산출 (캐시 재사용 가능)

**Step H5-5**
- Symbol: `CacheAligner 검증 스킬`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\skills\cache-aligner\SKILL.md`
- Scope: 신규 파일: HR5 규율 명문화(프리픽스 churn 금지 규칙) + 검증 절차(동일 입력 2회 실행 후 prefix diff 0 확인)
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\skills\cache-aligner\SKILL.md`
- Action: create
- Success criterion: 스킬이 "불변 prefix를 churn시키는 편집 금지" 규율 + 결정론 검증 명령(2회 실행 diff)을 제공

---

### ATOM CRG2강제 — 턴/토큰 예산 강제 · 우선순위 3

**목표**: 세션 턴(도구 호출) 수를 결정론적 프록시로 삼아 예산 초과 시 경고(옵트인 ask). tool-history.log 재사용, output-arm-gate·codegraph-gate 패턴 복제. **토큰 정밀 강제는 미결(§3).**

**Step C2-1**
- Symbol: `turn-budget 상태/설정 파일`
- CodeGraph: N/A(인프라 상태파일)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\state\turn-budget`
- Scope: 신규 파일: 예산 설정(예: `LIMIT=<N>` 또는 `off`) — output-arm 상태파일(`on`/`off`) 패턴
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\state\turn-budget`
- Action: create
- Success criterion: 파일 부재/`off` 시 게이트가 침묵 통과, 값 존재 시 임계로 사용

**Step C2-2**
- Symbol: `turn-budget-gate.sh`
- CodeGraph: N/A(인프라 셸)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\turn-budget-gate.sh`
- Scope: 신규 훅: tool-history.log 라인 수(세션 턴 카운트) ≥ LIMIT 이면 경고. codegraph-gate.sh L31-57 ask 패턴 + output-arm-gate.sh 침묵통과 패턴 차용
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\turn-budget-gate.sh`
- Action: create
- Success criterion: tool-history.log 라인 수가 LIMIT 미만이면 통과, 초과 시 budget 경고 1회 출력 (기본은 경고, 차단 아님)

**Step C2-3**
- Symbol: `tool-history 세션 턴 카운트 기반`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\turn-budget-gate.sh`
- Scope: 카운트 로직 (tool-history.log는 session-start.sh L86-92에서 세션 시작 시 초기화됨 → 라인 수=금세션 누적 턴)
- BLK target: [인프라]
- Action: insert
- Success criterion: 카운트가 금세션 한정(이전 세션 누적 비포함)임이 동작으로 확인됨 (session-start 초기화에 의존)

**Step C2-4**
- Symbol: `turn-budget-gate Stop 사후 게이트`
- CodeGraph: N/A(인프라 셸)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\hooks\turn-budget-gate.sh`
- Scope: Stop 분기 (output-arm-gate.sh L1-26 패턴: 경고만, exit 0)
- BLK target: [인프라]
- Action: insert
- Success criterion: 세션 종료 시 총 턴이 예산 초과면 사후 요약 경고, 미초과면 침묵 통과

**Step C2-5**
- Symbol: `settings.json 훅 등록`
- CodeGraph: N/A(인프라 JSON)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\settings.json`
- Scope: Lines [17-58] PreToolUse 배열 + Lines [95-105] Stop 배열
- BLK target: [인프라]
- Action: insert — PreToolUse(matcher 광범위 또는 무matcher)와 Stop에 `turn-budget-gate.sh` 등록
- Success criterion: JSON 유효성 유지 + 훅이 PreToolUse/Stop에서 발화 (기존 훅 발화 영향 0)

**Step C2-6**
- Symbol: `turn-budget 토글/문서`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\skills\turn-budget\SKILL.md`
- Scope: 신규 파일: 예산 설정/토글(`/turn-budget <N>|off|status`) + 경고 vs 차단(옵트인) 정책 + CRG2강제가 RULE-9 계열임을 명시
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\skills\turn-budget\SKILL.md`
- Action: create
- Success criterion: 스킬이 예산 설정·조회·토글 명령과 "기본 경고, 차단은 옵트인" 정책을 문서화

---

### ATOM HR6 — learn 루프 (세션 로그 → 메모리 안전 교정) · 우선순위 4 (고비용)

**목표**: 세션 종료 후 **오프라인 배치**가 tool-history/violation 로그를 분석해 메모리 파일 교정 *제안 diff*를 만들고, **사용자 검토 게이트 통과 후에만** 반영. 세션 내 자동 쓰기 금지.

**Step H6-1**
- Symbol: `learn-loop 분석 스크립트`
- CodeGraph: N/A(인프라 스크립트)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\scripts\learn-loop.sh`
- Scope: 신규 스크립트: `.claude/state/tool-history.log` + `violation-count.log` 읽어 패턴(빈발 위반, 반복 실패 도구 시퀀스) 집계
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\scripts\learn-loop.sh`
- Action: create
- Success criterion: 스크립트가 로그에서 상위 N개 위반·실패 패턴을 집계 출력 (메모리 파일은 아직 미수정)

**Step H6-2**
- Symbol: `교정 제안 diff 생성`
- CodeGraph: N/A(인프라 스크립트)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\scripts\learn-loop.sh`
- Scope: 제안 산출 단계 — 집계 결과 → 메모리 파일(MEMORY.md / 세션 메모리) 교정 *제안*을 별도 파일에 기록
- BLK target: [인프라]
- Action: insert
- Success criterion: 제안이 `docs/output/` 또는 `.claude/memory-bank/learn-suggestions-YYYY-MM-DD.md`에 적재되고, 원본 메모리 파일은 무변경

**Step H6-3**
- Symbol: `검토 게이트 (사용자 승인)`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\skills\learn-loop\SKILL.md`
- Scope: 신규 파일: 제안 → 사용자 승인 → 반영 워크플로 명문화. 자동 쓰기 절대 금지(RULE-9·Atom7) 경계 명시
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\skills\learn-loop\SKILL.md`
- Action: create
- Success criterion: 스킬이 "제안만 자동, 반영은 인간 게이트" 불변식과 denylist(민감파일) 회피를 문서화

**Step H6-4**
- Symbol: `반영 단계 (승인 후 적용)`
- CodeGraph: N/A(인프라 스크립트)
- File: `D:\Fork\claude-personal-integrated-workflow\.claude\scripts\learn-loop.sh`
- Scope: `--apply` 플래그 분기 — 승인된 제안만 메모리 파일에 반영(frontmatter verbatim 보존, 백업 후 readback)
- BLK target: [인프라]
- Action: insert
- Success criterion: `--apply` 없이는 절대 메모리 미수정; `--apply` 시 백업 생성 후에만 반영, 헌법급 문서(CLAUDE.md/schema) 대상 제외

---

### ATOM HR1 — CCR 프록시 (입력 압축) · 우선순위 5 (최고비용 · 설계만, 프록시 구축 보류)

**목표**: "도구/컨텍스트 출력 압축"을 output-arm처럼 *에이전트 행위 규율(입력 압축 계약)*로 형식화. **실제 LLM-앞단 프록시 구축(외부 프로세스)은 본 PLAN 범위 밖 → §3 미결.** 본 원자는 설계 골격 + 규율 스킬까지만.

**Step H1-1**
- Symbol: `입력 압축 계약 설계 문서`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\docs\design\hr1-input-compression-proxy.md`
- Scope: 신규 파일: HR1 두 갈래(A 규율형 / B 프록시 구축) 명시, output-arm(출력측)과의 직교성(입력측), try §3 최고비용 판정·보류 근거 기록
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\docs\design\hr1-input-compression-proxy.md`
- Action: create
- Success criterion: 문서가 "입력 압축 = output-arm의 입력측 쌍" 위치를 정의하고 프록시(B) 구축의 비용·손실 리스크·보류 결정을 명시

**Step H1-2**
- Symbol: `입력 압축 규율 스킬 (골격)`
- CodeGraph: N/A(인프라 MD)
- File: (신규) `D:\Fork\claude-personal-integrated-workflow\.claude\skills\input-arm\SKILL.md`
- Scope: 신규 파일: output-arm SKILL 구조 미러 — 토글·상태파일(`.claude/state/input-arm`) 골격, 도구 출력 요약 규율, Auto-Clarity 안전경계 동일 적용. **프록시 미언급(규율형만).**
- BLK target: [NEW-BLK] `D:\Fork\claude-personal-integrated-workflow\.claude\skills\input-arm\SKILL.md`
- Action: create
- Success criterion: 스킬이 output-arm과 대칭(입력측) 규율을 정의하되, 안전경계(보안·비가역·블로커 비압축)와 헌법급 문서 lossy 금지를 그대로 상속

**Step H1-3**
- Symbol: `HR1 보류 경계 명시`
- CodeGraph: N/A(인프라 MD)
- File: `D:\Fork\claude-personal-integrated-workflow\docs\design\hr1-input-compression-proxy.md`
- Scope: "Open / 보류" 섹션 — 실제 프록시(B) 구축 전 충족돼야 할 가치 입증 기준(측정 가능한 토큰 절감 + 손실 0 검증)
- BLK target: [인프라]
- Action: append
- Success criterion: 프록시 구축 착수 조건이 측정 가능한 형태로 명시(가치 입증 전 미착수)

---

## 3. 미결 사항 / Open Decisions

> 코드만으로 도출 불가 → 사용자가 EXECUTE 승인 시 결정. **임의 발명 금지.**

1. **CRG2강제 — 예산 임계값(LIMIT)과 강제 강도**: 세션당 턴 수 기본 임계(예: 50? 100?)와 "경고 vs 차단(ask)" 기본값. try §2는 "예산 강제는 저살리언스 벽"이라 경고를 권하나, 차단을 옵트인으로 둘지/임계 기본값은 사용자 운영 패턴에 의존 → **미결**.
2. **CRG2강제 — 토큰(정밀) 예산 포함 여부**: 본 PLAN은 턴 수 프록시만 강제(결정론적). 실제 토큰 카운트 강제는 훅 환경에서 비결정·비용↑ → 도입할지/추정 허용오차는 **미결**.
3. **HR6 — 자동화 트리거 시점**: learn-loop를 (a) 수동 `/learn` 호출, (b) pre-compact 훅 연동, (c) 세션 외 cron 중 무엇으로 돌릴지. 자동 트리거는 "사용자 모르게 분석" 우려 → 트리거 정책 **미결**.
4. **HR6 — 교정 대상 메모리 파일 범위**: MEMORY.md만? 세션 메모리도? `.riper-state`는 제외(휘발성)인지. 헌법급(CLAUDE.md) 제외는 확정, 그 외 경계 **미결**.
5. **HR1 — 프록시(B) 실제 구축 여부**: 본 PLAN은 설계+규율(A)까지만. LLM-앞단 프록시는 최고비용·손실 리스크 → 구축 자체가 **미결**(별도 결재). 구축 시 언어/배포(번들 vs 외부 프로세스)도 미결.
6. **HR5 — cxt 정렬 정책 변경 영향**: mtime 보조 정렬키 도입이 "최신 cxt 우선" UX를 해치지 않는지(사용자가 방금 만든 cxt가 prefix에서 밀리면 안 됨) → 정렬 정책 최종형 **미결**.

---

## 4. 비-목표 (Non-Goals / Scope Exclusions)

- 이 5원자를 codegraph(정적 AST 인덱스)에 편입하는 것 — **명시적 금지**(try §6 경계 위반).
- HR1 실제 프록시 레이어 구축 — 본 PLAN은 설계/규율 골격까지만.
- HR6 세션 내 자동 메모리 쓰기 — 반영은 인간 게이트 필수.
- CRG2강제 토큰 정밀 측정 강제 — 본 PLAN은 턴 수 프록시만.
- 소스 코드(.ts 등) 수정 — 이 5원자는 전부 하네스 인프라(셸/MD/JSON/상태파일).
- 본 문서에서의 EXECUTE — 전 원자 구현은 사용자 승인 후 별도 착수.
