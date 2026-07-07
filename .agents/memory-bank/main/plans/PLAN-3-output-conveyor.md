# PLAN-3 — Output Conveyor: 메인 윈도우 무침범 output → 마크다운 → 0유실 compress → codegraph 인계
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선. 각 스텝 Scope 범위만 Read(offset+limit). -->
실행 세션: **claude-personal-integrated-workflow 로컬 레포 단독 세션** (rrdd 사본에서 실행 금지 · codegraph 레포 접근 금지)
실행 모델: Haiku 4.5 · EXECUTOR CONTRACT: [PLAN-0-INDEX.md](PLAN-0-INDEX.md) 준수
선행: PLAN-2 실행 보고 요지(사용자가 점화 시 첨부) — 단, **컨베이어 코어(Step 1~5)는 codegraph 신기능 무의존**이라 선행 없이도 진행 가능. 신선도 의존부(Step 6~7)만 Step 0 자가검증 결과에 따라 분기.
cxt 항목: 3 — "서브에이전트 디스패치로 탈옥하지 않는, output의 메인 컨텍스트 윈도우 타이핑 침범 금지 & output 마크다운화 & 자동 맥락 0유실 compress + codegraph 마크다운 watcher 인계 + 인덱스 배선 갱신"
경로 규약: `<repo>/` = workflow 레포 루트.

## 설계 원칙 (로드맵 §8.1~8.3 대응)

1. **침범 금지** = Output Arm ON의 기존 규약("도구로 작업, 끝에 1줄") + 산출물은 docs/output/*.md로만.
2. **탈옥 금지** = 서브에이전트에 의존하지 않음: 메인이 직접 적재하고, 훅(결정론)이 스키마를 강제. 디스패치가 승인된 경우에도 동일 스키마가 SubagentStop 훅으로 강제됨.
3. **0유실 compress** = LLM lossy 압축 금지(RULE-9 Atom 7). compress는 **규칙 기반 스크립트**(코드블록→BLK 참조 치환, 중복 섹션 제거, 원문 archive 보존)로만.
4. **codegraph 인계** = md watcher 자동 인덱싱(docs-on 실측 완료) — "적재만 하면 인덱스는 따라온다"를 전제로 하되 Step 0·6에서 로컬 자가검증.

## Steps (9)

### Step 0 선행조건 자가검증 (타 세션 신뢰 대신 로컬 재검증)
- **BLK target**: [인프라]
- **Action**: (a) `codegraph --version` 기록. (b) 이 레포 `codegraph_status`로 "Docs indexed" 확인(docs-on 여부). (c) PLAN-2 산출(stale 배너·`CODEGRAPH_CROSS_PROJECT_SYNC`) 포함 여부를 점화 프롬프트의 PLAN-2 보고 요지에서 확인 — 요지 부재 시 "미포함"으로 간주.
- **Success criterion**: 3항 기록 완료. docs-off이면 Step 6에서 활성화 절차 우선. PLAN-2 산출 미포함이어도 Step 1~5는 진행, Step 7의 크로스 프로젝트 검증 항목만 [보류] 마킹.

### Step 1 Conclusion 스키마 확정 (로드맵 §8.1)
- **File**: [NEW-BLK] `<repo>/.claude/skills/output-arm/SCHEMA.md`
- **BLK target**: [NEW-BLK]
- **Action**: insert — frontmatter 필수 필드: `task`(1문장), `date`, `project`(대상 레포 식별자 — 절대경로 금지, 레포명/remote), `blk`(BLK 좌표 배열 또는 `[인프라]`), `links`(마크다운 링크 배열), `keywords`(codegraph 질의 트리거 3~7개), `compressed`(bool), `source_turns`. 본문 규격: `## Result` / `## Changes` / `## Decisions` 3섹션 고정. 파싱 실패 fallback: 미준수 파일은 `docs/output/quarantine/` 이동 규칙 명시.
- **Success criterion**: SCHEMA.md 존재 + 예시 문서 1개 포함.

### Step 2 [승인게이트] output-arm-gate 검증 승격
- **Symbol**: output-arm-gate.sh (grep 앵커: `git status --porcelain`)
- **File**: `<repo>/.claude/hooks/output-arm-gate.sh`
- **Scope**: Lines [14-25]
- **BLK target**: [인프라]
- **Action**: replace — (a) git 부재 시 폴백: `git status --porcelain` 실패하면 최근 N분 mtime 변경 파일 스캔으로 대체(현재 비-git에서 침묵 무력화). (b) docs/output/ 최신 파일에 Step 1 필수 frontmatter 필드 존재를 grep 검증 — 누락 시 systemMessage로 필드명 적시 경고(차단 안 함 — 센서는 막지 않는다).
- **Success criterion**: 비-git 임시 디렉터리에서 변경+무적재 시 경고 발화, 스키마 미준수 적재 시 필드명 경고.

### Step 3 [승인게이트] 결정론 compress 스크립트
- **File**: [NEW-BLK] `<repo>/.claude/hooks/compress-output.sh`
- **BLK target**: [NEW-BLK]
- **Action**: insert — 입력 md 1개: 30줄 초과 코드블록 → `[BLK/파일:라인 참조]` 1행 치환, 연속 중복 문단 제거, 원문은 `docs/output/archive/YYYY-MM/` 이동, frontmatter `compressed: true` 마킹. **삭제 없는 이동+참조 치환만** — 유실률 0 원칙. 멱등(재실행 무변화).
- **Success criterion**: 샘플 md 처리 → 압축본에서 archive 링크로 전체 복원 가능 + 2회 실행 diff 0.

### Step 4 [승인게이트] Stop 훅에 compress 배선
- **File**: `<repo>/.claude/settings.json`
- **Scope**: hooks.Stop 배열
- **BLK target**: [인프라]
- **Action**: insert — Stop 체인에 `compress-output.sh --latest`(마지막 세션 적재분만) 추가, output-arm-gate 뒤 순서. **훅 스키마 준수: 단일 command 문자열, `args` 배열 금지**(PLAN-1 Step 1 결함 재발 방지).
- **Success criterion**: 세션 종료 시 최신 output md 자동 압축·archive 생성.

### Step 5 [승인게이트] SubagentStop 스키마 강제 (탈옥 방지)
- **File**: `<repo>/.claude/settings.json` + [NEW-BLK] `<repo>/.claude/hooks/subagent-conclusion-gate.sh`
- **BLK target**: [NEW-BLK]
- **Action**: insert — SubagentStop 훅 신설: 디스패치가 승인돼 서브에이전트가 돌았던 경우, docs/output 적재 부재·스키마 미준수면 systemMessage 경고 + quarantine 이동. 서브에이전트도 메인과 동일 컨베이어 강제.
- **Success criterion**: 테스트 디스패치 1건에서 미준수 산출물이 quarantine으로 이동.

### Step 6 codegraph 인계 자가검증 (이 레포 한정)
- **BLK target**: [인프라]
- **Action**: **이 레포에서만**: docs-on 확인(Step 0-b), off면 docs 인덱싱 재-init 절차 실행(사용자 결재). md 프로브 1건 생성→검색→삭제로 watcher 3종 확인. 타 프로젝트 docs-on 점검은 **핸드오프 항목**으로 보고에 기재(각 프로젝트 세션에서 `codegraph_status` 1콜 — PLAN-4 및 각 클라이언트 세션 몫).
- **Success criterion**: 이 레포 watcher 3종 pass + 핸드오프 체크리스트 작성.

### Step 7 E2E 무인 통과 테스트
- **BLK target**: [인프라]
- **Action**: 프로브 작업 1건: 사소한 md 수정 → docs/output 적재(스키마 준수) → Stop 훅 compress → 2초 대기 → `codegraph_search "<keywords 중 1개>"`로 압축본 검색까지 무인 통과. 크로스 프로젝트 신선도 항목은 Step 0 분기에 따라 실행 또는 [보류]. 실패 지점 발생 시 STOP + 보고.
- **Success criterion**: 검색 결과에 압축본 1건 + archive 링크 유효.

### Step 8 [사용자결재] 롤아웃 & 핸드오프
- **BLK target**: [인프라]
- **Action**: (a) `/sync`로 클라이언트 프로젝트(RX_1·Western-Salon·WIKI·BLADE) 배포 — sync 매니페스트 기준, rrdd 사본 제외. (b) 로드맵(§8.1~8.3) 갱신은 **WIKI 세션 몫** — 직접 수정 금지, PLAN-4 점화용 요지에 "구현 상태·일자·스키마 필드 목록"을 포함해 핸드오프. → `<repo>/docs/output/YYYY-MM-DD-plan3-execution.md` 적재(말미에 PLAN-4 점화용 요지: SCHEMA.md 전문 사본 포함 ≤한 화면).
- **Success criterion**: 배포 대상에 훅·스키마 존재 + 보고에 SCHEMA 사본 포함. 출력: "PLAN-3 완료" 1줄.
