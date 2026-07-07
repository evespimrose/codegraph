# RIPER PLAN — 스킬 cxt9 원칙 정합 + 주입 토큰 다이어트
<!-- BLK: 인프라 -->

> MODE: PLAN · Branch: main · 생성: 2026-06-26
> 대상: `.claude/skills/*` 12개 SKILL.md
> Symbol/CodeGraph: **N/A** (markdown — codegraph 비대상). File+Scope+Action+Success로 스코프 락.

## 문제 (적대적 검증 실측 근거)
- always-injected `description` 합 **5,564 chars**; 4개 비대 — sync(785)·sync-global(684)·visualize-graph(623)·skill-creator(598) = 48%. 본문에 있어야 할 열거·메커니즘·중복 트리거를 always-injected에 적재.
- **Examples-Over-Essays 미달**: add-lang 본문 236줄(10펜스), doc-context 위반 3블록 반복.
- on-trigger 헤더(`CAVE-MAN-OUTPUT-ARM`) 풀 11줄 × 11스킬 중복 — 전문은 CLAUDE.md RULE-9(하네스 always-injected)와 **중복**.

## 성공 기준 (전체)
- always-injected desc 합 5,564 → **≤ 3,500 chars** (−37%↑). 모든 트리거 어구·네거티브 보존.
- add-lang 본문 236 → **≤ 180줄** (10-step·scripts·tests·corpus·negative 잔존).
- doc-context 본문 89 → **≤ 60줄** (재확인·요약·수동확인 금지 3규칙 보존).
- 12/12: name=dir · `<!-- CAVE-MAN-OUTPUT-ARM -->` 마커 · 4원칙 절(트리거·목표·예시·네거티브) · YAML 유효(스킬 목록 반영).

## Steps (Max 10)

### Step 1 — sync description 다이어트
- File: `.claude/skills/sync/SKILL.md` · Scope: frontmatter description(line 3, 785) · BLK [인프라] · Action: replace
- 디렉토리 전체 열거·3모드 설명은 본문 §동기화 대상·§플래그에 이미 존재 → desc에서 제거. 트리거(한국어 6 + /sync) + 네거티브만.
- Success: desc ≤ 450, 트리거·네거티브 유지, 본문 무변경.

### Step 2 — sync-global-codegraph description 다이어트
- File: `.claude/skills/sync-global-codegraph/SKILL.md` · Scope: description(684, folded `>`) · Action: replace
- 본문장 트리거와 `Trigger on:` 행의 **이중 나열** 중복 제거(1세트만).
- Success: desc ≤ 400, 트리거 1세트+네거티브 유지.

### Step 3 — visualize-graph description 다이어트
- File: `.claude/skills/visualize-graph/SKILL.md` · Scope: description(623) · Action: replace
- 집계 메커니즘 설명은 본문 §그래프 집계 방식에 존재 → desc에서 제거.
- Success: desc ≤ 380, 트리거·네거티브 유지.

### Step 4 — skill-creator description 다이어트
- File: `.claude/skills/skill-creator/SKILL.md` · Scope: description(598) · Action: replace
- 장황 트리거 나열+표 참조 축약. 핵심 트리거 + 로컬판 핵심(표준헤더 강제) + 네거티브 유지.
- Success: desc ≤ 400.

### Step 5 — add-lang 본문 압축 (Examples-Over-Essays)
- File: `.claude/skills/add-lang/SKILL.md` · Scope: body [36-233] · Action: compress
- 10-step 체크리스트·scripts 호출·핵심 주의(ABI health-check·5th core touch·STOP 조건)·tests·corpus 유지. 반복 산문 제거, >5줄 bash는 핵심만.
- Success: body ≤ 180줄, 10 step·verify·tests·corpus·negative 전부 잔존.

### Step 6 — doc-context 위반 블록 압축
- File: `.claude/skills/doc-context/SKILL.md` · Scope: body [48-86] (위반 1/2/3) · Action: compress→1
- 3 반복 ❌/✅ → 1 압축 블록. 재확인 금지·요약 금지·수동확인 금지 3규칙은 1줄씩 유지.
- Success: body ≤ 60줄, 3규칙 의미 보존.

### Step 7 — 압축 헤더 규약 정의 (convention)
- File: `.claude/skills/skill-creator/SKILL.md`(불변규칙 ~32-51) + `.claude/skills/output-arm/SKILL.md`(정의 문서) · Action: replace
- 근거: 헤더 전문 = CLAUDE.md RULE-9(하네스 always-injected)와 중복 → 마커+1줄 포인터로 충분.
- 표준헤더를 풀 11줄 → **1줄 포인터**(`<!-- CAVE-MAN-OUTPUT-ARM -->` 마커 보존 + 요약 1줄 + "정의: output-arm·RULE-9"). gate 검사 마커 유지. output-arm은 풀 정의 유지.
- Success: skill-creator가 compact 포인터를 강제, 마커 보존.

### Step 8 — 11개 스킬 헤더 compact 적용
- File: `.claude/skills/{add-lang,agent-eval,cache-aligner,doc-context,handover,skill-creator,sync,sync-global-codegraph,try,turn-budget,visualize-graph}/SKILL.md` (output-arm 제외) · Action: replace
- Scope: 각 파일 `<!-- CAVE-MAN-OUTPUT-ARM -->` ~ `<!-- /CAVE-MAN-OUTPUT-ARM -->` 블록 → 1줄 포인터.
- Success: 11파일 헤더 ≤ 2줄, 마커 존재, on-trigger 중복 ~110줄 → ~11줄.

### Step 9 — 검증
- 측정 스크립트 재실행: desc 합 ≤ 3,500 · add-lang ≤ 180 · doc-context ≤ 60.
- Grep: 12/12 `## 사용하지 말아야 할 때` · 12/12 마커 · name=dir.
- 스킬 목록 반영(YAML 유효) 확인.
- Success: 전 기준 충족, 트리거·네거티브·4원칙 무손상.

## RIPER 게이트
- 본 PLAN 승인 → EXECUTE. 중·대형(멀티파일) → quality-sentinel → reporter 게이트 대상.
- 비가역성: git 추적, 복원 가능. 트리거 손상이 유일 리스크 → Step 9가 desc 트리거 어구 보존 검증.

### Step 10 — (확장 · 2026-06-26 사용자 승인) 나머지 desc 트리밍
- 사유: Step 9에서 desc 합 ≤3500 미달(4517) — 4-scope의 산술 한계(−19%, 플랜 −37% 추정 오류). 사용자 승인으로 범위 확장.
- File: cache-aligner·add-lang·agent-eval·turn-budget·output-arm·try·handover·doc-context + sync 재트림
- Action: 본문-중복 메커니즘 설명·중복 트리거 제거, 트리거 어구·네거티브 보존.
- Success: desc 합 ≤ 3,500.
