# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RULE-1: Sonar Protocol (DEADLY · L1 Hook 강제)

**모든 소스 코드 접근 전 codegraph 우선 사용.**

### ❌ 자동 차단 (PreToolUse hook)
- `find` / `ls -r` / `grep -r` / `rg` / `fd` (bash)
- `Get-ChildItem -Recurse` / `Select-String -Path *` (PowerShell)
- `cat .cs` / `head .py` / `tail .ts` (bash 소스 출력)
- **codegraph 미사용 후 소스 코드 Read** (자동 차단)

### ✅ 올바른 순서
```
1. codegraph_context / codegraph_search → 심볼 위치
2. codegraph_callers / codegraph_impact → 영향 범위
3. codegraph_node / codegraph_explore → 소스 코드
4. (보완 시만) Read / Glob / Grep
```

차단 hook: `.claude/hooks/sonar-guard*.sh`, `codegraph-gate.sh`
위반 로그: `.claude/state/violation-count.log`

### ⚖️ 조건부 신뢰 (Conditional Trust · state-doctor 게이트)

**"네 눈보다 codegraph를 믿어라"는 STATE HEALTH=green 일 때만 권위다.**
파생 표현(codegraph·dictionary·BLK·cxt 주입·riper-state)은 코드의 사본 → 부패한다. 그 충실도를 git/fs(지상 진실)에 자동 대조하는 센서가 `.claude/hooks/state-doctor.sh` (session-start 가 매 세션 발화 → `=== 파생상태 건강도 ===` 1행 주입, 결과 토큰은 `.claude/state/health` 1행).

- `health` 토큰이 **green 이 아니면**(yellow/red/unknown): 해당 파생 표현을 **권위 → 참고(reference)로 강등**하고 RULE-1 일시 해제. → 영향 부분을 Read 로 ground-truth 확인 후 가능하면 재생성(reindex·dictionary 재산출·경로 정정).
- **최악의 실패 모드**: yellow/red 를 무시하고 stale 표현에 "충실히" 따르는 것 — 저신뢰 환각을 고신뢰 상태부패로 세탁한다. green 점검이 신뢰 명령의 전제다.

## RULE-2: /doc-context 즉시 실행
- cxt 파일 = 사용자의 직접 지시
- 재확인·요약 금지, 즉시 작업 착수
- cxt 2행 `<!-- BLK: BLK-XXX -->` 의무
- cxt 3행 `<!-- SONAR-REMINDER: ... -->` 의무 (L5 외부 이전)

## RULE-3: RIPER 상태 추적
`.claude/memory-bank/.riper-state` 파일에 기록.
- /riper:research|innovate|plan|execute|review
- PLAN_FILE 부재 시 EXECUTE 진입 차단

## RULE-4: PRD Spatial Mapping (PLAN 단계 BLK 좌표 강제)
모든 Action Item에 BLK 좌표 + 파일 경로 필수.
- 기존: `[BLK-XXX] Assets/.../File.cs 내 대상`
- 신규: `[NEW-BLK] + 절대경로`
- 금지: 위치 없는 추상 지시 ("ExplosionSystem 수정")

## RULE-5: EXECUTE Scope Lock
- BLK 좌표 → `Read(offset+limit)` 또는 `grep -A -B` 최소 로드
- 파일 전체 Read 금지 (1,000자 이상 = 실패)
- 자가검증: "내가 건드리는 좌표가 PLAN의 BLK와 일치?"

## RULE-6: 게이트 (규모별 차등)
| 규모 | quality-sentinel | reporter |
|------|-----------------|---------|
| 소형 (단일 파일, 플랜 없음) | 선택 | 기본 |
| 중·대형 (멀티파일, 플랜 존재) | 필수 | 필수 |

## RULE-7: 소스 코드 쓰기 전 승인
.cs/.py/.ts/.js 등 수정 전 사용자 승인.
`write-approval-reminder.sh` 자동 알림.

## RULE-8: 컴팩션 전 메모리 저장
/compact 실행 전 `/memory:save` 필수. 복원: `/memory:recall`

## RULE-9: Output Arm (출력 압축 · 기본 ON · 토글)
출력측 토큰 게이트. 기본 ON. 상태: `.claude/state/output-arm` (`on`/`off`), 토글: `/output-arm on|off`.
- **ON**: 메인 컨텍스트 서술 억제 → 도구로 작업, 끝에 `XX 완료` 한 줄만. **서브에이전트 디스패치 = 3-모드 게이트**(`.claude/state/subagent-dispatch` · 토글 `/subagent-dispatch auto|manual|off` · 기본 `manual`). Agent/Task 콜드스타트 토큰세금 ~100배라 기본 `manual`=디스패치마다 사용자 승인(ask) — 초대형·병렬 독립 작업만 승인 권장. `auto`=상시 허용, `off`=차단(메인 직접). 강제: `subagent-dispatch-gate.sh`. must-see 산출물은 `docs/output/YYYY-MM-DD-<task>.md`에 적재(코드 위치=BLK 태그, 참조=마크다운 링크 → codegraph 추적).
- **Auto-Clarity 예외(억제 해제)**: 보안·비가역 동작·모호 다단계·반복 질문·하드 블로커 → 정상 출력. correctness > brevity.
- 사후 게이트: Stop 훅 `output-arm-gate.sh` (변경 있는데 docs/output 적재 없으면 경고).
- 스킬: `.claude/skills/output-arm/`(규칙 전문 단일 출처). 설계: caveman 입국심사 Atom 1·2·4·5·6. **실적용**: 전 스킬/커맨드 frontmatter에 `<!-- CAVE-MAN-OUTPUT-ARM -->` **compact 포인터**(6핵심 1줄 요약 + RULE-9·output-arm 참조) 삽입 — 마커는 게이트 grep용 보존, 풀 규칙은 본 RULE-9 + output-arm에만 둔다(중복 제거). riper/memory 커맨드는 "디스패치"→"메인 직접" 대체.
- 금지: 헌법급 문서(CLAUDE.md·schema) LLM lossy 압축(Atom 7 반례).

## Plan Scope Lock 필드 (PLAN 단계 모든 스텝에 포함)
- **Symbol**: `ClassName.MethodName`
- **CodeGraph**: codegraph_search/context 결과
- **File**: 절대 경로 (dictionary 크로스 검증)
- **Scope**: `Lines [N-M]`
- **BLK target**: `[BLK-XXX]` 또는 `[인프라]`
- **Action**: insert/replace/delete/append
- **Success criterion**: 관찰 가능 결과
- Max 10 steps

## Wiki Second Brain
원격 정본: `https://github.com/evespimrose/WIKI.git` (머신마다 클론 경로 상이 → 절대경로 하드코딩 금지, remote 추적으로 로컬 해석; `obsidian/`=노트·`raw/`=입력)
- 설계 결정 전 Atomic Note 조회
- 충돌 시 `[WIKI-CONFLICT]` 경고 + 중단
- 참조 시 파일명 인용

## 메모리 아키텍처
- L1: CLAUDE.md + session-start.sh (세션 주입)
- L2: `.claude/memory-bank/.riper-state` (RIPER)
- L3: `/memory:save|recall` (장기)
- L4: `manage/dictionary.md` (구조 인덱스)
- L5: WIKI — remote `https://github.com/evespimrose/WIKI.git` (로컬 경로 머신별, remote 추적 해석) (Single Source of Truth)
- 코드 인텔리전스: codegraph MCP (실시간 심볼 그래프)

## 에이전트 라우팅 (3-Tier Studio)
| Tier | 에이전트 | 모델 | 담당 |
|------|---------|------|------|
| 1 | producer, creative-director, technical-director | Opus | 의사결정 |
| 2 | lead-programmer, unity-specialist | Sonnet | 구현 총괄 |
| 3 | quality-sentinel, reporter, writer, 도메인 전문가 | Sonnet | 실행·검증 |

## Claude vs trae
| 측면 | Claude | trae |
|------|--------|------|
| Memory | `.claude/memory-bank/` | `.trae/memory-bank/` |
| Instruction | CLAUDE.md | AGENTS.md |
| Role | Dev, debug | Infrastructure, CI/CD |
| Validation | 사용자 승인 | validate-cxt hook |
| Context | Direct tools | context-sharer skill |
| RIPER | 참여 | 금지 |

## 워크플로
```
[소형] codegraph → Edit/Write → 완료
[중·대형] /riper:research → innovate → plan → execute → review → quality-sentinel → reporter
```
