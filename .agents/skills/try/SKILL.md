---
name: try
description: Use when the user asks whether a proposed change is worth doing - architecture splits, refactoring, package additions, layer separation. Compares current state vs proposed state before any code is touched. Korean alias - "ganboги" / feasibility check.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (Cave-Man Output Arm · 전 스킬 공통)

- **메인 컨텍스트 타이핑 금지** — 과정 narration·중간 요약·"이제 ~하겠습니다" 출력 안 함
- **도구 사용 허용** — codegraph→(보완)Read/Edit 등으로 메인이 직접 작업 (hook 통제下)
- **서브에이전트 디스패치 금지** — Agent/Task 호출 안 함 (콜드스타트 토큰세금 ~100배). 예외: 초대형 규모·병렬 독립 작업을 **사용자가 발의**한 경우만
- **완료 보고만 허용** — 끝에 `XX 완료` 1~2단어 간단 보고만 타이핑
- **Auto-Clarity 예외** — 보안·비가역·모호 다단계·반복질문·하드블로커 → 정상 출력 (correctness > brevity)

정책: [[main-context-zero-delegation]] · `/output-arm` · CLAUDE.md RULE-9
<!-- /CAVE-MAN-OUTPUT-ARM -->


# Try — 사전 타당성 분석 (Feasibility Taste-Test)

## Overview

**코드를 건드리기 전, 변경의 실제 가치를 검증한다.**

구현 착수 전 토큰 효율을 최대화하는 것이 핵심 목적이다.
분석 결과는 `docs/try/Try_{주제}.md`에 저장한다. 구현 착수는 하지 않는다.

## State Update (MANDATORY — on invocation)

/try 호출 즉시 `.Codex/memory-bank/.riper-state` 업데이트:
```
MODE=PRE-ANALYSIS
TASK=try: <주제>
PLAN_FILE=
BRANCH=<current git branch>
STARTED=<current date YYYY-MM-DD>
```

Use: `git rev-parse --abbrev-ref HEAD` for branch name.

## 언제 사용하는가

- 새 레이어/어셈블리 분리 검토
- 리팩토링·폴더 재구성 검토
- 패키지 도입/제거 검토
- "이거 하면 어때?" 류의 아키텍처 질문

## 실행 프로토콜

```
1. STATE   .riper-state에 MODE=PRE-ANALYSIS 기록
2. READ    현재 코드베이스 구조 파악 (관련 파일·asmdef·namespace)
3. MODEL   제안 구조를 다이어그램 또는 표로 시각화
4. COMPARE 현상유지 vs 제안 — 아래 5개 축으로 비교
5. RISK    단기 비용(마이그레이션 비용, 씬/prefab 영향 등) 명시
6. RECOMMEND 조건부 추천 또는 반대 근거 제시
7. WRITE   docs/try/Try_{주제}.md 저장
```

## 5개 비교 축 (필수 — 하나라도 생략 금지)

| 축 | 분석 내용 |
|----|---------|
| **아키텍처 명확성** | 레이어 경계, 의존성 방향, 순환 참조 위험 |
| **컴파일·빌드 영향** | 증분 컴파일 속도, asmdef 수, 참조 그래프 복잡도 |
| **장기 유지보수** | 신규 기여자 온보딩, 레이어 위반 조기 감지, 테스트 격리 가능성 |
| **단기 비용** | 마이그레이션 범위, 씬/prefab 재설정 필요 여부, namespace 변경 파급력 |
| **현재 작업과의 연관성** | 미결 사항·플랜과의 연계, 착수 최적 타이밍 |

## 출력 형식 (`docs/try/Try_{주제}.md`)

```markdown
# Try — {작업 제목}

> 작성일: YYYY-MM-DD
> 대상 작업: {한 줄 설명}

## 1. 현황 (As-Is)
레이어/파일 구조 (표 또는 코드블록)
현황의 핵심 문제

## 2. 제안 구조 (To-Be)
다이어그램 또는 변경 내용 표

## 3. 장단점 비교
3-A. 아키텍처 명확성
3-B. 컴파일·빌드 영향
3-C. 현재 작업과의 연관성
3-D. 단기 비용 (마이그레이션 리스크)
3-E. 장기 유지보수

## 4. 순환 의존성·방향 위험 분석

## 5. 종합 평가 및 추천
결론 (조건부 추천 / 반대 / 타이밍 제안)
단계별 추천 순서 (진행 시)

## 6. 미결 사항 연계 (해당 시)
```

## 파일 저장 규칙

- 경로: `docs/try/Try_{주제}.md`
- 주제 명명: 영어 CamelCase + 한국어 허용 (예: `Try_ServiceLayerSplit.md`, `Try_DOTS도입.md`)
- 이 파일은 분석 문서. 구현 착수는 별도 사용자 결재 후 producer 경유.

## 금지 사항

```
NEVER:
- try 수행 중 코드 파일(.cs, .asmdef 등) 수정
- 결재 없이 구현 착수
- 분석 없이 추천만 제시
- 5개 비교 축 중 하나 이상 생략
- bash find/grep -r/ls -r/rg/fd 탐색 (Sonar Protocol)

INSTEAD:
- 현황 파악 먼저 (파일 읽기, 구조 확인, dictionary.md § 1 참조)
- 비교 표로 시각화
- 조건부 추천 + 타이밍 제안
```

## 착수 경계

```
try 완료 후:
  "해줘" / "진행해" / "OK" → producer 경유 구현 착수 (.riper-state → MODE=RESEARCH 전환 권장)
  "알겠어" / 별도 지시 없음 → docs/try/Try_xxx.md 기록만, 대기
  "다른 옵션도 봐줘" → 추가 try 수행
```
