# Andrej Karpathy Skills

이 문서는 Andrej Karpathy Skills를 일관되게 적용하기 위한 실행 가이드입니다.
프로젝트의 고유 운영 규칙은 `CLAUDE.md`를 우선하며, 본 문서는 행동 체크리스트를 제공합니다.

## 적용 범위
- 대상: 코드 작성, 수정, 리뷰, 리팩토링 전 과정
- 원칙: 빠름보다 정확성 우선. 단, 사소한 작업은 과도한 절차를 생략할 수 있음

## 1) Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

- 구현 전 `문제 정의 / 비목표 / 성공 기준 / 영향 파일`을 먼저 명시한다.
- 해석이 여러 개인 요청은 임의 선택하지 않고 옵션과 트레이드오프를 먼저 제시한다.
- 불확실한 요구사항은 추정으로 덮지 않고 확인 질문을 우선한다.

## 2) Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

- 요청을 충족하는 최소한의 변경만 수행한다.
- 단일 사용 코드를 위한 추상화, 미래 대비 설정, 미요청 기능을 추가하지 않는다.
- 구현이 불필요하게 길어지면 단순한 형태로 다시 줄인다.

- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3) Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

- 요청 범위 밖 리팩토링, 스타일 정리, 주변 코드 개선을 하지 않는다.
- 수정으로 인해 생긴 미사용 코드(import/변수/함수)만 정리한다.
- 기존에 있던 무관한 문제는 삭제하지 않고 별도 이슈로 보고만 한다.

## 4) Goal-Driven Execution
Define success criteria. Loop until verified.

- 작업을 검증 가능한 목표로 변환한다.
- 다단계 작업은 짧은 계획으로 쪼개고 각 단계마다 확인 방법을 명시한다.
- 구현 직후 컴파일/진단/재현 시나리오로 결과를 확인하고, 통과할 때까지 반복한다.

## 작업 시작 체크리스트
- [ ] 문제 정의가 한 문장으로 고정되었는가
- [ ] 비목표(하지 않을 것)가 명시되었는가
- [ ] 성공 기준이 검증 가능하게 정의되었는가
- [ ] 영향 파일이 명확한가
- [ ] 변경이 최소 범위인가

## 연동 규칙
- `CLAUDE.md`의 **Andrej Karpathy Skills 기본 적용** 항목과 함께 사용한다.
- 충돌 발생 시 `CLAUDE.md`를 우선 적용한다.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.