# PLAN-1 — Workflow Token Diet & 적대적 검증 구멍 봉합
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선. 각 스텝 Scope 범위만 Read(offset+limit). -->
실행 세션: **claude-personal-integrated-workflow 로컬 레포 단독 세션** (rrdd 사본에서 실행 금지)
실행 모델: Haiku 4.5 · EXECUTOR CONTRACT: [PLAN-0-INDEX.md](PLAN-0-INDEX.md) 준수 (스텝 밖·타 레포 접근 금지, 승인게이트, 검증 의무, STOP 조건)
cxt 항목: 1(주입 토큰 극복) + 2(적대적 검증 구멍 봉합)
경로 규약: `<repo>/` = workflow 레포 루트. 절대경로는 이 PC 전역 `C:\Users\JANGHYEONGTAEK\.claude\` 한정.

## 배경 (2026-07-02 rrdd 실측 근거 — 재조사 금지, 그대로 신뢰)

- 세션당 시스템 주입 ≈ 50KB+: 프로젝트 CLAUDE.md ~7KB + 전역 CLAUDE.md ~3.5KB + rules 2종 ~3.1KB + 에이전트 목록 ~10KB + 스킬 목록 ~150건 ~20KB + MCP instructions ~6KB.
- 전역 SessionStart 훅 4개: `args` 배열은 Claude Code hook 스키마에 없음 → **bare powershell.exe만 스폰** → 스크립트 미실행(silent no-op) + 모지바케 배너 4개/세션. `__HOME__` 플레이스홀더 미치환 이중 결함. **이 PC 모든 세션 공통.**
- state-doctor: `git rev-parse` 전제 → 비-git/서브디렉터리 환경에서 영구 unknown → RULE-1 조건부 신뢰 상시 발동(자기모순). session-start의 python→bash 재스폰 경로에선 stdout 소실("no output") 관측 — WSL bash 오해석 의심.
- cxt 주입 glob = `docs/contextmd/`·`cxt/` ↔ 실사용 `docs/cxtmd/` 관측 → 드리프트 시 cxt 힌트 주입 0건(침묵 실패).
- CLAUDE.md ↔ `.claude/rules/*.md` ↔ output-arm 스킬 간 내용 중복(다중 주입원).

## Steps (9)

### Step 1 [승인게이트] 전역 훅 스키마 수정 (이 PC 전역 — 세션 위치 무관 1회)
- **Symbol**: hooks.SessionStart / PreToolUse.AskUserQuestion / SessionEnd / PreCompact
- **File**: `C:\Users\JANGHYEONGTAEK\.claude\settings.json`
- **Scope**: Lines [21-131] (hooks 블록)
- **BLK target**: [인프라]
- **Action**: replace — 7개 훅 전부 `{"type":"command","command":"powershell.exe","args":[...]}` → 단일 문자열 `"command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:/Users/JANGHYEONGTAEK/.claude/hooks/<이름>.ps1\""`. `__HOME__` → 실제 경로. 사전 확인: 각 .ps1 존재 여부(`ls C:/Users/JANGHYEONGTAEK/.claude/hooks/*.ps1`) — 부재 파일 훅은 삭제를 사용자에게 제안 후 처리.
- **Success criterion**: 새 세션 SessionStart 출력에 PowerShell 배너 0개 + 각 ps1 정상 실행 흔적.

### Step 2 [승인게이트] state-doctor no-git/서브디렉터리 폴백
- **Symbol**: state-doctor.sh ROOT 해석부 + Check 3 (grep 앵커: `git rev-parse --show-toplevel`, `Check 3`)
- **File**: `<repo>/.claude/hooks/state-doctor.sh`
- **Scope**: Lines [19-35] (ROOT/emit_unknown), Lines [82-101] (Check 3) — 드리프트 시 앵커 재탐색
- **BLK target**: [인프라]
- **Action**: replace — `ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"` 실패 시 CLAUDE.md 상향 탐색 fs 폴백(`d=$PWD; while [ "$d" != "/" ]; do [ -f "$d/CLAUDE.md" ] && ROOT="$d" && break; d=$(dirname "$d"); done`). NO_GIT=1 모드: Check 2 branch 비교·Check 3 `git ls-files` mtime 비교 skip(`nogit-degraded` info 1건, yellow 아님), Check 1(cxt drift)·riper 적법성은 그대로. health 파일은 모든 경로에서 기록.
- **Success criterion**: 비-git 임시 디렉터리(CLAUDE.md 존재)에서 실행 → `STATE HEALTH: green`(또는 사유 있는 yellow) + `.claude/state/health` 생성. 기존 git 레포에서 무회귀.

### Step 3 [승인게이트] session-start의 state-doctor 호출 경로 수정
- **Symbol**: session-start.sh state-doctor subprocess 블록 (grep 앵커: `state-doctor.sh`, `subprocess.run`)
- **File**: `<repo>/.claude/hooks/session-start.sh`
- **Scope**: Lines [5], [38-52]
- **BLK target**: [인프라]
- **Action**: replace — python 내부 `subprocess.run(["bash", ...])`(WSL bash 오해석으로 stdout 소실) 제거. heredoc 진입 **전** bash 레벨에서 `HEALTH_LINE="$(bash .claude/hooks/state-doctor.sh 2>/dev/null | head -1)"; export HEALTH_LINE` → python에서 `os.environ.get("HEALTH_LINE", "STATE HEALTH: unknown (no output)")`.
- **Success criterion**: `bash .claude/hooks/session-start.sh | python3 -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['additionalContext'])"` 출력에 실제 health 1행 포함(“no output” 아님).

### Step 4 [승인게이트] cxt 주입 경로 드리프트 수정
- **Symbol**: session-start.sh cxt_candidates glob (grep 앵커: `docs/contextmd`)
- **File**: `<repo>/.claude/hooks/session-start.sh`
- **Scope**: Line [77]
- **BLK target**: [인프라]
- **Action**: replace — `glob.glob("docs/contextmd/cxt*.md") + glob.glob("docs/cxtmd/cxt*.md") + glob.glob("cxt/*.md")` (합집합 — 프로젝트별 관례 차이 흡수).
- **Success criterion**: `docs/cxtmd/cxt*.md`가 있는 테스트 디렉터리에서 Step 3 검증 명령 출력에 해당 cxt HEAD 표시.

### Step 5 [승인게이트·사용자결재] 주입원 중복 제거 (단일 출처 + 포인터)
- **Symbol**: CLAUDE.md RULE-9·quality-sentinel/reporter 규칙 블록 ↔ `.claude/rules/*.md` ↔ `.claude/skills/output-arm/`
- **File**: `<repo>/CLAUDE.md`, `<repo>/.claude/rules/quality-sentinel.md`, `<repo>/.claude/rules/reporter.md`
- **Scope**: 중복 블록만 (diff로 동일 텍스트 확인 후)
- **BLK target**: [인프라]
- **Action**: replace — 동일 내용이 CLAUDE.md·rules·스킬에 2~3중 존재하는 블록을 **단일 출처 1곳 + 1행 포인터**로 정리(어느 쪽을 정본으로 할지 사용자 결재: rules를 정본, CLAUDE.md는 표+포인터 권장). 헌법급 문서 lossy 압축 금지(RULE-9) — 삭제분이 정본과 byte-동일한 중복임을 diff로 증명한 것만 제거.
- **Success criterion**: 세션 주입 claudeMd 합계(프로젝트 CLAUDE.md+rules) 30%↓ + 규칙 의미 손실 0(diff 증거).

### Step 6 [사용자결재] 스킬 목록 다이어트
- **File**: `C:\Users\JANGHYEONGTAEK\.claude\skills\*/SKILL.md` (전역) + `<repo>/.claude/skills/*/SKILL.md` (배포 마스터)
- **Scope**: frontmatter description 필드만 (본문 불변 — 호출 시에만 로드됨)
- **BLK target**: [인프라]
- **Action**: (a) deprecated 3종(brainstorm/execute-plan/write-plan) 제거 결재, (b) sc:* 25종 사용 실적 사용자 확인 후 미사용 제거 결재, (c) 200자 초과 description을 트리거 문구 보존 1~2문장으로 축약.
- **Success criterion**: 세션 스킬 목록 주입 바이트 40%↓ (before/after 합산 비교).

### Step 7 [사용자결재] 에이전트 디스크립션 다이어트
- **File**: `<repo>/.claude/agents/*.md` (배포 마스터 18종) frontmatter description
- **Scope**: frontmatter만 (본문 불변)
- **BLK target**: [인프라]
- **Action**: replace — 담당/비담당 나열을 트리거 핵심 1~2문장으로 축약.
- **Success criterion**: 에이전트 목록 주입 30%↓.

### Step 8 [사용자결재] /sync 재배포
- **BLK target**: [인프라]
- **Action**: Step 2~7 완료본을 `/sync`(--mixed)로 클라이언트 프로젝트(RX_1·Western-Salon·WIKI·BLADE·codegraph)에 배포. 배포 대상 목록은 `<repo>`의 sync 매니페스트(projects/list.txt) 기준 — rrdd 사본은 대상에서 제외.
- **Success criterion**: 각 대상에 신판 hooks 존재(해시/diff 확인), 백업 생성.

### Step 9 검증 총괄 & 보고
- **Action**: workflow 레포 새 세션 1회 + 클라이언트 1곳(예: Western-Salon) 새 세션 1회 실측: 배너 0 · health 실값 표시 · cxt HEAD 주입 · 주입량 before/after 기록 → `<repo>/docs/output/YYYY-MM-DD-plan1-execution.md` 적재(말미에 다음 세션 점화용 요지 ≤5줄).
- **Success criterion**: 체크리스트 전항 pass + 보고 파일 존재. 출력: "PLAN-1 완료" 1줄.
