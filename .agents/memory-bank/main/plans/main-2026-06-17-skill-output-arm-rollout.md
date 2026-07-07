[MODE: PLAN]

# PLAN — Cave-Man Output Arm 전 스킬/커맨드 실적용 완전판

> 2026-06-17 · main · 사용자 지시: "모든 스킬에 동일 규칙 적용 + output-arm 팔로우업"
> 범위 확정(AskUserQuestion): **이 프로젝트 전체** · 충돌 스킬 **예외 문구로 적용**

## Goal
프로젝트 스킬 20 + 커맨드 11에 통일 규칙 헤더("메인 타이핑 금지·도구 허용·서브에이전트 디스패치 금지·`XX 완료`만") 적용. output-arm 스킬 + CLAUDE.md RULE-9를 이에 맞춰 팔로우업.

## 대상 (31 파일 + 2 팔로우업)
- **스킬 삽입 (20)**: `.claude/skills/`{handover,visualize-graph,add-lang,agent-eval,output-arm,sync-global-codegraph,doc-context,cache-aligner,turn-budget,try}, `.agents/skills/`{handover,doc-context,try}, `.trae/skills/`{cs,cb,doc-context,handover,context-bundler,context-sharer,try}
- **커맨드 삽입 (1)**: `.claude/commands/rebase.md` (디스패치 헤더 없음 → 표준 삽입)
- **커맨드 대체 (10)**: `.claude/commands/riper/`{execute,innovate,plan,research,review,strict,workflow}, `memory/`{list,recall,save} — 기존 "전부 서브에이전트에서 수행" 디스패치 래퍼를 "메인 직접" 헤더로 대체. `## 작업 정의 (서브에이전트 전용)` 이후 실제 작업 정의는 **보존**.
- **팔로우업 (2)**: `output-arm/SKILL.md`(서브 디스패치 금지 명시 추가), `CLAUDE.md` RULE-9(정밀 편집, 헌법급)

## 표준 헤더 (멱등 마커 `<!-- CAVE-MAN-OUTPUT-ARM -->`)
- SKILL_HEADER: 메인 타이핑 금지·도구 허용·서브 디스패치 금지(예외 사용자 발의)·`XX 완료`만·Auto-Clarity 예외
- CMD_HEADER: 위 + "메인이 직접 수행, 서브 디스패치 안 함" 강조(이전 디스패치 방식 폐기 명시)

## 방식
- python 스크립트 일괄: 스킬=frontmatter 직후 삽입, 커맨드=`## 작업 정의 (서브에이전트 전용)` 마커로 분리 후 래퍼 대체. 마커 존재 시 skip(멱등).
- 충돌/벤치마크 스킬(agent-eval, add-lang): 외부 `claude` CLI 실행은 Agent/Task 도구 디스패치와 구분 — 표준 헤더의 "Agent/Task 호출 안 함"이 외부 CLI를 막지 않음. 필요 시 예외 주석.
- git 추적 → `git checkout` 롤백.

## 검증
- 마커 카운트 == 31
- 커맨드 10개 "작업 정의" 이후 내용 보존 (git diff 확인)
- 샘플 육안 (riper/plan, 스킬 1개)

## Non-Goals
- 전역 스킬 27·커맨드 3 (범위 밖)
- 플러그인/Anthropic 기본 스킬 (외부 패키지)
- 에이전트 frontmatter codegraph 부여 (별도 PLAN STEP7)
