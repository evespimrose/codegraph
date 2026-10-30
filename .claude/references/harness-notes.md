# 하네스 참고 노트

`CLAUDE.md` 에서 옮긴 배경 정보다. 세션 시작 때 싣지 않는다. 필요할 때 Read 한다.

## 메모리 아키텍처
- L1: CLAUDE.md + session-start.sh (세션 주입)
- L2: `.claude/memory-bank/<branch>/riper/<slug>.state` (RIPER, 작업별)
- L3: `/memory:save|recall` (장기)
- L4: `manage/dictionary.md` (구조 인덱스)
- L5: WIKI — remote `https://github.com/evespimrose/WIKI.git` (로컬 경로 머신별, remote 추적 해석) (Single Source of Truth)
- 코드 인텔리전스: codegraph CLI (심볼 그래프)

## 에이전트 라우팅 (3-Tier Studio)
| Tier | 에이전트 | 모델 | 담당 |
|------|---------|------|------|
| 1 | producer, creative-director, technical-director | Opus | 의사결정 |
| 2 | lead-programmer, unity-specialist | Sonnet | 구현 총괄 |
| 3 | quality-sentinel, reporter, writer, 도메인 전문가 | Sonnet | 실행·검증 |

> **[cxt10] Tier 1 모델(Opus)은 하향 금지 대상** — 검증가능성 앵커: 의사결정 계층(producer·creative-director·technical-director)은 opus 고정. haiku 신설은 기계 검증 가능 대역(reporter·memory 커맨드 등)에 한정한다.

## Claude vs trae
| 측면 | Claude | trae |
|------|--------|------|
| Memory | `.claude/memory-bank/` | `.trae/memory-bank/` |
| Instruction | CLAUDE.md | AGENTS.md |
| Role | Dev, debug | Infrastructure, CI/CD |
| Validation | 사용자 승인 | validate-cxt hook |
| Context | Direct tools | context-sharer skill |
| RIPER | 참여 | 금지 |
