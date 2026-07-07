# PLAN-0 INDEX — cxt1 종합진단 후속 플랜 마스터 인덱스
<!-- BLK: 인프라 -->
<!-- SONAR-REMINDER: codegraph 우선 (codegraph_context → search → node). find/grep -r/ls -r/rg/fd 자동 차단됨 -->
날짜: 2026-07-02 · 발부 모델: Fable 5 · 실행 모델: **Haiku 4.5 고정 (opus 폴백 금지)**
근거 진단: [docs/output/2026-07-02-comprehensive-diagnosis.md](../../../../docs/output/2026-07-02-comprehensive-diagnosis.md)

## 실행 모델 — 세션 분리 (Tear-off)

**rrdd(D:\rrdd)는 실측용 임시 우산이다. rrdd 안의 사본에서는 어떤 플랜도 실행하지 않는다.**
각 플랜은 대상 프로젝트의 **실제 로컬 레포 단독 세션**에서 실행하며, 세션 간 직접 소통은 없다.

### 이식(Import) 절차 — 플랜당 1회, 사용자가 수행
1. 플랜 파일 1개를 대상 레포의 `.claude/memory-bank/{branch}/plans/`로 복사.
2. 대상 레포 `.claude/memory-bank/.riper-state`에 기록: `MODE=EXECUTE`, `PLAN_FILE=<복사한 플랜 경로>`, `BRANCH=<현재 브랜치>`, `STARTED=<날짜>`.
3. 아래 점화 프롬프트로 새 세션 시작.

### 핸드오프 프로토콜 — 세션 간 소통 대체
- 각 세션은 종료 시 **자기 레포의** `docs/output/YYYY-MM-DD-<plan>-execution.md`에 실행 보고(증거 포함)를 적재하고 "PLAN-X 완료" 1줄만 출력.
- 다음 세션 점화 시 사용자가 이전 보고의 **요지(또는 파일 사본)**를 프롬프트에 첨부. 실행 세션은 타 레포를 탐색하지 않는다.
- 선행조건은 각 플랜의 **선행조건 자가검증 스텝**이 세션 내부에서 로컬 명령으로 확인한다(타 세션 신뢰 대신 재검증).

### 점화 프롬프트 템플릿
```
/doc-context .claude/memory-bank/{branch}/plans/<플랜파일>.md
(또는) 이 레포의 <플랜파일> 플랜을 EXECUTOR CONTRACT대로 실행해. 이전 세션 보고 요지: <붙여넣기>
```

### 경로 표기 규약
- `<repo>/` = 대상 레포 루트 (머신마다 클론 경로 상이 → 절대경로 하드코딩 금지, 세션 cwd 기준 상대 해석).
- 절대경로는 **이 PC 전역 설정** `C:\Users\JANGHYEONGTAEK\.claude\` 한정.

## 실행 순서 (세션 체인)

| 순서 | 플랜 | 실행 세션(레포) | 요약 | 선행 |
|---|---|---|---|---|
| 1 | [PLAN-1-workflow-token-diet.md](PLAN-1-workflow-token-diet.md) | claude-personal-integrated-workflow | session-start/dispatch 주입 토큰 절감 + 검증 구멍 봉합 + 전역 훅 수리 | 없음 |
| 2 | [PLAN-2-codegraph.md](PLAN-2-codegraph.md) | codegraph | 크로스프로젝트 신선도, MCP 로드 실패 수정, npm/마켓플레이스 | 없음 (1과 병렬 가능) |
| 3 | [PLAN-3-output-conveyor.md](PLAN-3-output-conveyor.md) | claude-personal-integrated-workflow (단독) | output 컨베이어 e2e — 코어는 무의존, 신선도 의존 스텝만 PLAN-2 산출 자가검증 후 진행 | PLAN-2 보고 권장 |
| 4 | [PLAN-4-wiki-ops.md](PLAN-4-wiki-ops.md) | WIKI (로컬 클론, remote 추적 해석) | 스테일 경로 정정, 인덱스 범위/신선도, conveyor 이관 규칙, 로드맵 갱신 | PLAN-3 보고(스키마 사본 첨부) |

## EXECUTOR CONTRACT (모든 플랜 공통 · Haiku 4.5 준수 사항)

1. **스텝 밖 금지**: 플랜에 명시된 파일·좌표 외 접근 금지. 스텝 순서 고정. 플랜 자체 개정 금지 — 개정 필요 발견 시 즉시 STOP 후 사용자 보고. **타 레포 접근 금지**(핸드오프 프로토콜로 대체).
2. **Scope Lock**: 각 스텝은 `Read(offset+limit)`로 Scope 범위만 로드. 파일 전체 Read 금지(1,000자 초과 = 실패).
3. **좌표 드리프트 대응**: 착수 시 codegraph_search로 Symbol 존재 확인. 명시 라인에 없으면 ±30줄 내 재탐색, 그래도 없으면 STOP. (라인 넘버는 2026-07-02 rrdd 실측 사본 기준 — 실제 레포와 어긋날 수 있음, 심볼·grep 앵커 우선.)
4. **[승인게이트] 스텝**: RULE-7에 따라 .sh/.ts/.js/.json/.ps1 수정 전 반드시 사용자 승인. 승인 없이 Write/Edit 금지.
5. **검증 의무**: 각 스텝의 Success criterion 검증 명령을 실제 실행하고 출력을 증거로 기록. 실패 시 1회 재시도 → 재실패 시 STOP.
6. **서브에이전트 디스패치 금지** (subagent-dispatch=manual·Output Arm ON). 메인이 codegraph→Read/Edit 직접 수행.
7. **완료 보고**: 플랜당 자기 레포 `docs/output/YYYY-MM-DD-<plan>-execution.md` 1개 적재 + 메인 출력 "PLAN-X 완료" 1줄. 보고 말미에 **다음 세션 점화용 요지 5줄 이내** 포함.
8. **STOP 조건**: 검증 2회 실패 / 좌표 소실 / 승인 미획득 / 플랜 간 충돌 발견 / git 이력 파괴 위험 감지.

## 전역 사실 (플랜 공통 전제 · 2026-07-02 rrdd 실측)

- 실측은 rrdd 사본에서 수행됐고 **수정은 각 원본 레포에서** 한다. rrdd 루트 비-git 관련 항목은 "비-git 환경 강건성" 근거로만 쓴다.
- codegraph 전역 v0.9.8.3 (`C:\Users\JANGHYEONGTAEK\AppData\Roaming\npm\codegraph`), md 와쳐 **생성·수정 감지 정상 실측** / **삭제 미반영 결함 확정**(디스크 부재 후 catch-up 2회에도 인덱스 잔존 — PLAN-2 Step 6에서 수정).
- claude-personal-integrated-workflow = codegraph **0.9.8.1 포크 사본** (버전 스큐), codegraph 레포 = 0.9.8.3 개발 본선.
- 전역 `C:\Users\JANGHYEONGTAEK\.claude\settings.json` 훅 7개가 비표준 `args` 배열 스키마 → 전부 no-op + PS 배너 4개/세션 주입 (이 PC 전 세션 공통 영향).
- 크로스 프로젝트 질의(projectPath)는 대상 DB in-process 열람만 — catchUpSync·watcher 미기동 → 타 프로젝트 인덱스 stale 위험.
