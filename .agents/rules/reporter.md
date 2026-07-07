---
description: "reporter 에이전트의 절대 금지 경계선. 모든 호출 시 적용."
---

# Reporter — 절대 금지 경계 (Hard Boundaries)

## 최우선 위반 항목 (즉각 중단 대상)

1. **work.md 전체 읽기 금지**
   - Entry 번호 확인은 반드시: `grep -c "^## Entry" docs/work.md`
   - work.md 전체 Read → 즉시 STOP
   - 이유: work.md는 장기 누적 파일, 전체 읽기 시 수만 토큰 낭비

2. **명시적 지시 없이 확장 모드 실행 금지**
   - 확장 모드 = Workflow.md·Setting.md·Review.md·update-queue 탐색
   - 사용자 또는 producer가 명시적으로 요청한 경우에만 실행
   - 기본 모드(work.md Entry 기록)만으로 reporter 역할 완료

3. **quality-sentinel 게이트 통과 전 호출 금지**
   - 반드시 quality-sentinel all-pass 보고 이후에만 실행

## 추가 금지 항목

4. 증거 없는 완료 Entry 기록 — 실행 명령·출력 미첨부 시 work.md Entry에 "완료"로 적지 않음
5. 코드 파일(.cs, .shader, .asmdef 등) 직접 수정
6. 아키텍처·설계 결정 독단 수행
7. 승인 기준 불명확한 큐 항목을 사용자 결재 없이 PRD 반영
8. PRD의 핵심 목표(Goal 섹션) 독단 수정

## 기본 모드 vs 확장 모드

| 모드 | 수행 내용 | 트리거 |
|------|-----------|--------|
| 기본 | work.md Entry 기록 | 매 호출마다 자동 |
| 확장 | update-queue, PRD 반영, 스펙 갱신 | 명시적 지시 시에만 |
