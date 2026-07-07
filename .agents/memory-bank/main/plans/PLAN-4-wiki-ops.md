# PLAN-4 — WIKI 운영정책: 스테일 경로 정정·인덱스 범위/신선도·컨베이어 이관·로드맵 갱신
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선. 각 스텝 Scope 범위만 Read(offset+limit). -->
실행 세션: **WIKI 로컬 클론 단독 세션** (remote `https://github.com/evespimrose/WIKI.git` 추적 해석 · rrdd 사본에서 실행 금지)
실행 모델: Haiku 4.5 · EXECUTOR CONTRACT: [PLAN-0-INDEX.md](PLAN-0-INDEX.md) 준수
선행(점화 시 사용자 첨부): PLAN-3 실행 보고 요지 — **SCHEMA.md 사본(필드 목록) 필수**. 미첨부 시 Step 5는 STOP.
cxt 항목: 4 — wiki 운영정책 플랜
경로 규약: `<repo>/` = WIKI 로컬 클론 루트.

## 배경 (2026-07-02 rrdd 실측 — 재조사 금지)

- WIKI CLAUDE.md 사본에 구 머신 경로 `D:\Fork\WIKI\obsidian\` 하드코딩 잔존 — "절대경로 하드코딩 금지, 원격 추적 해석" 정책과 모순. 상태부패의 실물 사례. (codegraph 레포 CLAUDE.md에도 동일 잔존 — 그쪽은 PLAN-2 세션에서 별도 처리하도록 보고에 기재됨.)
- WIKI 인덱스: `obsidian/` 노트는 검색됨(Mastermind_Architecture_Manifesto 확인), **`docs/Roadmap/Workflow_End_To_End_LoadMap.md`(06-11 생성)는 검색 불가** — DB는 07-01 갱신됐으므로 **인덱싱 범위(docs/ 제외) 의심**.
- 크로스 프로젝트 질의는 sync 미유발(PLAN-2 구멍 A) → 타 세션이 WIKI를 참조하는 워크플로 특성상 stale 위험 상시.

## Steps (7)

### Step 1 [승인게이트] 스테일 하드코딩 경로 정정
- **Symbol**: "Wiki Second Brain" 섹션 · "메모리 아키텍처" L5 행 (grep 앵커: `D:\Fork\WIKI`)
- **File**: `<repo>/CLAUDE.md`
- **Scope**: 해당 2개 섹션만
- **BLK target**: [인프라]
- **Action**: replace — `D:\Fork\WIKI\obsidian\` → 원격 추적 정책 문구(remote `https://github.com/evespimrose/WIKI.git`, 로컬 경로 머신별 해석, `obsidian/`=노트·`raw/`=입력).
- **Success criterion**: `grep "D:\\\\Fork" <repo>/CLAUDE.md` 0건.

### Step 2 인덱스 범위 진단·복구
- **File**: `<repo>/.codegraphignore`(존재 시) · WIKI codegraph 설정
- **BLK target**: [인프라]
- **Action**: (a) `.codegraphignore`·init 설정에서 `docs/` 제외 여부 확인, (b) 제외였다면 정책 결정 기록 후 해제, (c) `<repo>`에서 `codegraph sync`(필요 시 `codegraph index`) 실행.
- **Success criterion**: `codegraph_search "Workflow_End_To_End_LoadMap"` 1건 반환.

### Step 3 [사용자결재] 신선도 정책 채택
- **File**: `<repo>/.claude/settings.json`
- **BLK target**: [인프라]
- **Action**: 두 안 중 결재: (A) SessionStart 훅에 `codegraph sync --quiet` 추가(세션 열 때 보정 — 저비용·권장), (B) 데몬 keepalive(`CODEGRAPH_IDLE_TIMEOUT_MS=0` — 와쳐 상시, 상주 비용). 점화 요지에 PLAN-2의 stale 배너 배포 여부가 있으면 (A)+배너 조합 기본. **훅 스키마: 단일 command 문자열, `args` 금지.**
- **Success criterion**: 채택안 적용 후 WIKI md 수정 → 새 세션 첫 질의에서 최신 내용 반환.

### Step 4 [승인게이트] compile-wiki 파이프라인에 인덱스 갱신 명문화
- **File**: `<repo>/.claude/skills/compile-wiki/SKILL.md`
- **Scope**: 파이프라인 종결부 섹션
- **BLK target**: [인프라]
- **Action**: append — 컴파일 완료(obsidian/ 노트 생성·archive 이동) 직후 `codegraph sync` 1회를 필수 스텝으로 추가. 링크 무결성(백링크) 확인 명령 포함.
- **Success criterion**: SKILL.md에 스텝 존재 + 시험 컴파일 1건에서 신규 노트 즉시 검색됨.

### Step 5 컨베이어 산출물 이관 규칙 (운영정책 본문)
- **File**: [NEW-BLK] `<repo>/docs/policy/output-intake-policy.md`
- **BLK target**: [NEW-BLK]
- **Action**: insert — 정책 문서: (1) 각 프로젝트 docs/output/*.md(점화 요지의 PLAN-3 SCHEMA 기준) 중 **지식성**(재사용 가능한 결정·원리) 산출물만 wiki `raw/`로 이관 — 작업 로그성 이관 금지, (2) 이관은 distill-to-raw/입국심사 경유(무심사 반입 금지), (3) `[WIKI-CONFLICT]` 시 중단 규칙 재확인, (4) 원격 정본 push는 사용자 결재. SCHEMA `keywords` → 위키 태그 매핑 표 포함.
- **Success criterion**: 정책 문서 존재 + SCHEMA 필드와 1:1 매핑 표 포함. (SCHEMA 요지 미첨부면 STOP.)

### Step 6 로드맵 구현 상태 갱신 (PLAN-3 핸드오프 수령분)
- **File**: `<repo>/docs/Roadmap/Workflow_End_To_End_LoadMap.md`
- **Scope**: §8.1~8.3 섹션만
- **BLK target**: [인프라]
- **Action**: append — 점화 요지의 PLAN-3 보고 기반으로 §8.1(Conclusion 스키마)·§8.2(compress)·§8.3(Hook) 각각에 구현 상태(done/부분/보류)·일자·근거 보고 파일명 1행씩 추가. 본문 개서 금지 — 상태 행 append만.
- **Success criterion**: 3개 소절에 상태 행 존재, 기존 본문 diff 무변경.

### Step 7 검증 총괄 & 보고
- **Action**: Step 1~6 Success criterion 재실행 체크리스트 → `<repo>/docs/output/YYYY-MM-DD-plan4-execution.md` 적재. 원격 정본 반영분(CLAUDE.md·정책·로드맵)은 커밋 메시지 초안만 작성, push는 사용자 핸드오프.
- **Success criterion**: 체크리스트 전항 pass + 보고 파일 존재. 출력: "PLAN-4 완료" 1줄.
