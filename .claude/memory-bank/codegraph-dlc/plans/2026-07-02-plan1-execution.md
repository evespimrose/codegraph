# PLAN-1 실행 보고 — Workflow Token Diet & 적대적 검증 구멍 봉합
<!-- BLK: 인프라 -->

플랜: [PLAN-1-workflow-token-diet.md](../../.claude/memory-bank/main/plans/PLAN-1-workflow-token-diet.md) · 실행일: 2026-07-02 · 모델: Sonnet 5(대화 세션 직접 실행, Haiku 4.5 tear-off 미사용)

## Step별 결과

| Step | 상태 | 비고 |
|---|---|---|
| 1. 전역 훅 스키마 수정 | ✅ | `C:\Users\JANGHYEONGTAEK\.claude\settings.json` 7개 훅 `args`배열→단일문자열 command, `__HOME__`치환. 검증: 배너 0, `codegraph-session.ps1`이 실제 JSON 출력 생성(이전 no-op). |
| 2. state-doctor no-git 폴백 | ✅ | `.claude/hooks/state-doctor.sh`: ROOT fs폴백(CLAUDE.md 상향탐색)+NO_GIT 가드(Check2 branch비교·Check3 git ls-files skip, DB integrity는 유지). 검증: 기존 git repo 무회귀(green), 비-git 서브디렉터리에서 unknown→yellow(사유 명시)로 전환. |
| 3. session-start state-doctor 호출 경로 | ✅ | python 내부 `subprocess.run(["bash",...])` 제거 → bash레벨 `HEALTH_LINE` env 사전계산+`os.environ` 읽기. 검증: 주입에 실제 `STATE HEALTH: green` 확인(이전 "no output" 의심 해소). |
| 4. cxt 경로 드리프트 | ✅ | glob에 `docs/cxtmd/cxt*.md` 합집합 추가. 검증: 임시 마커 파일로 실제 흡수 확인 후 제거. |
| 5. 주입원 중복 제거 | **SKIP** | diff 증거상 CLAUDE.md RULE-6/RULE-9가 rules/output-arm과 byte-동일 중복이 아님(이미 요약+포인터 구조, RULE-9는 이전 세션에서 이미 단일출처화됨). 전제 불성립 → 사용자 승인 하 skip. |
| 6. 스킬 목록 다이어트 | ✅(범위 재지정) | (a)(b): 플랜이 지정한 `~/.claude/skills/`에 deprecated 3종·sc:* 없음 — 실제 위치는 `~/.claude/commands/`로 좌표 정정 후 사용자 승인받아 brainstorm/execute-plan/write-plan.md 3개 + sc/*.md 21개 삭제(세션이력검색 0건 확인, 삭제 전 스크래치패드 백업). (c) repo 스킬 재압축: 별도 RIPER플랜에서 이미 완료(−38%) 확인 후 skip. |
| 7. 에이전트 디스크립션 다이어트 | ✅(목표 재조정) | 이전 세션 조치로 5067→4455자(−12%) 완료 상태 확인. 플랜 목표 −30%는 0-유실 원칙과 충돌(추가 압축 시 비담당 목록 등 라우팅 정보 손실) → 사용자 승인 하 −12% 최종 확정. |
| 8. /sync 재배포 | ✅ | list.txt(사용자가 세션 중 BLADE·codegraph·RX_1·WIKI 추가, rrdd는 계획대로 제외) 5개 타깃 전부 `--mixed` 적용. 전 타깃 `Error: null` + 백업 생성 확인(Western-Salon 3파일·BLADE 83·codegraph 74·RX_1 118·WIKI 93). |
| 9. 검증 총괄 | ✅ | 아래 |

## Step 9 검증 증거

```
A) workflow repo session-start.sh 재실행 → health line: "STATE HEALTH: green" (실값, len=14515 — MODE=EXECUTE라 현재 플랜 파일 본문 포함 정상 증가, 회귀 아님)
B) 배포된 D:\Fork\Western-Salon\.claude\hooks\session-start.sh 독립 실행
   → health line: "STATE HEALTH: yellow (1) riper-stale" (그 레포 자체 실제 상태를 정확히 감지 — 센서 배포 후 기능 확인)
C) 전역 git-sync.ps1 재확인 → exit:0, 배너 없음(Step 1 무회귀)
```

## 전제 불일치 2건 (플랜 대비, 사용자 승인 하 처리)

1. **Step 5**: "CLAUDE.md ↔ rules ↔ output-arm 중복"이 diff상 존재하지 않음 — 이미 정본+포인터 구조. 향후 플랜 작성 시 "diff로 동일 텍스트 확인"을 사전 단계로 넣을 것 권장.
2. **Step 6(a)(b)**: 대상 경로가 `~/.claude/skills/`가 아니라 `~/.claude/commands/`였음 — 플랜의 좌표 전제가 잘못됨. 사용자 승인 하 올바른 경로로 재지정해 처리 완료.

## 다음 세션 점화용 요지 (≤5줄)

- PLAN-1 전 9스텝 처리 완료(Step5 skip·Step6·7 범위재지정, 근거는 본 보고서 상단 표).
- 전역 훅 7개 정상화, state-doctor no-git 폴백, session-start 경로수정, cxt 경로합집합 — 전부 검증됨.
- 에이전트 디스크립션은 −12%(0-유실 천장)에서 최종 확정, 추가 압축 안 함.
- /sync 5개 타깃(Western-Salon·BLADE·codegraph·RX_1·WIKI) 배포 완료, 전 타깃 백업 존재.
- 다음: PLAN-2(codegraph, 병렬 가능) 또는 PLAN-3(output conveyor, PLAN-2 보고 권장) 진행 검토.
