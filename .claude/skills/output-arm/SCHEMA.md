# Output Conclusion Schema — docs/output/*.md 필수 계약
<!-- BLK: 인프라 -->

Output Arm이 메인 컨텍스트 대신 적재하는 모든 산출물(`docs/output/YYYY-MM-DD-<slug>.md`)이 지켜야 할 **작성 계약**.

> **이 스키마 준수만으로는 회수되지 않는다.** 과거 이 자리에 "지키면 자동 인덱싱되고 재검색된다"고
> 적혀 있었으나 반증됐다(RX_1 실측: 스키마 준수 21건 전량 회수 0건 — 원인은 `.codegraphignore`가
> 산출물 디렉터리를 인덱스 범위에서 제외). 회수까지 보장하는 **바인딩 계약**과 그 정량 측정은
> [`output-binding`](../output-binding/SKILL.md) 스킬이 담당한다. 새 산출물을 쓰거나
> "회수가 안 된다"를 진단할 때는 그쪽을 먼저 볼 것.

## Frontmatter 필수 필드

```yaml
---
task: "1문장으로 무엇을 했는지"
date: 2026-07-06
project: claude-personal-integrated-workflow   # 레포명 또는 remote 식별자 — 절대경로 금지
blk:
  - "BLK-000"                                  # 비코드/인프라 산출물 예약 ID. 코드 작업이면 실제 BLK-XXX
links:
  - "[PLAN-3](../../.claude/memory-bank/main/plans/PLAN-3-output-conveyor.md)"
keywords: [output-conveyor, schema, compress, conclusion]   # codegraph 질의 트리거 3~7개
compressed: false
source_turns: 1
---
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `task` | string | 1문장 요약. 검색 스니펫으로 노출됨. |
| `date` | date | 작업일(YYYY-MM-DD). |
| `project` | string | 레포명 또는 원격 식별자. **절대경로 금지**(머신 이식성). |
| `blk` | string[] | BLK 좌표 배열. 코드 무관 산출물은 예약 ID `["BLK-000"]`(비코드/인프라). **회수 파서는 `BLK-\d+` 숫자 패턴만 인식**(2026-08-15 M2 실측 — `[인프라]`·`인프라-001` 등은 `hits.blk` null로 유실됨). 본문 2번째 줄 HTML 주석 `<!-- BLK: BLK-XXX -->`도 함께 넣어야 codegraph docs 회수 시 `hits.blk`가 채워진다(git 추적 파일에 한함). |
| `links` | string[] | 관련 문서로의 마크다운 링크 배열. |
| `keywords` | string[] | codegraph 질의 트리거 3~7개. 후속 세션이 이 문서를 재검색하는 통로. |
| `compressed` | bool | `compress-output.sh` 처리 여부(Step 3에서 갱신). |
| `source_turns` | int | 이 문서가 요약한 대화 턴 수(추정치 허용). |

## 본문 규격 (3섹션 고정)

```markdown
## Result
무엇이 달성됐는지 — 관찰 가능한 결과.

## Changes
변경된 파일·좌표 목록.

## Decisions
채택/기각된 옵션과 근거.
```

## 파싱 실패 Fallback

frontmatter 필수 필드 중 하나라도 없거나 `## Result`/`## Changes`/`## Decisions` 3섹션이 없으면 **스키마 미준수**로 간주 — `output-arm-gate.sh`(Step 2)가 경고하고, `compress-output.sh`(Step 3)는 처리를 건너뛴다. 반복 미준수 시 `docs/output/quarantine/YYYY-MM-DD-<slug>.md`로 이동(삭제 아님 — 사람이 나중에 검토).

## 예시 문서

```markdown
---
task: "output conveyor 스키마 확정"
date: 2026-07-06
project: claude-personal-integrated-workflow
blk: ["BLK-000"]
links:
  - "[PLAN-3](../../.claude/memory-bank/main/plans/PLAN-3-output-conveyor.md)"
keywords: [output-conveyor, schema, conclusion, frontmatter]
compressed: false
source_turns: 1
---

## Result
docs/output/*.md의 필수 frontmatter 계약과 3섹션 본문 규격을 확정했다.

## Changes
- [NEW] `.claude/skills/output-arm/SCHEMA.md`

## Decisions
- 압축은 규칙 기반 스크립트로만(LLM lossy 압축 금지) — Step 3에서 구현.
- 미준수 산출물은 삭제 대신 quarantine 이동 — 정보 손실 방지.
```
