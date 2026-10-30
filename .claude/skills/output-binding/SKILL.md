---
name: output-binding
description: Use when creating, reviewing, or debugging docs/output artifacts and their codegraph retrievability — the binding contract between written artifacts and the index. Triggers - "산출물이 회수 안 됨", "codegraph에 안 걸림", "output 스키마", "바인딩률", "blk 좌표가 비어 있음", "과거 작업 기록이 검색되지 않음", writing a new docs/output report, or auditing whether past work is actually recoverable. NOT for prose/tone rules (comment-style), compression algorithms, or codegraph CLI internals.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(답 먼저 · 증거는 Review Pack 링크 · 사람 확인 항목 · codegraph-first · 서브에이전트·Workflow 게이트 승인 · Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-8.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Output Binding — 산출물이 회수에 실제로 도달하는가

`output-arm`/`SCHEMA.md`가 **어떻게 쓸지**를 규정한다면, 이 스킬은 **쓴 것이 회수되는지**를 규정하고 측정한다.
작성 규율은 지켜지는데 회수가 안 되는 상태가 실제로 존재했고(RX_1 21건 전량), 그 차이를 숫자로 가른다.

## 제1원칙 — 인덱스 범위가 모든 것에 선행한다

**산출물 디렉터리가 codegraph 인덱스 범위 밖이면 나머지 규칙은 전부 무의미하다.**
프론트매터를 완벽히 채워도, 좌표를 정확히 달아도, 회수는 0이다.

실증(2026-08-13): RX_1의 `.codegraphignore`가 화이트리스트 방식이었다.

```
*.md                    ← 모든 마크다운 제외
!/docs/*.md             ← docs 바로 아래만 복원
!/docs/contextmd/**  !/docs/specs/**  !/docs/superpowers/**  !/manage/**
```

`docs/output/**`가 복원 목록에 없어 산출물 21건이 인덱스에 진입하지 못했다(`index_entry` 0/21).

### 진입 조건은 둘이고, 둘 다 필요조건이다

| 조건 | 위반 시 | 실증 |
|---|---|---|
| C1. 디렉터리가 `.codegraphignore` 복원 목록에 있을 것 | 전량 미진입 | RX_1 21건 전량 0% |
| C2. 파일이 **git 추적** 상태일 것 | 해당 파일만 미진입 | 이 저장소 3건 — `.codegraphignore`는 허용(`!/docs/output/`)인데 `.gitignore:76`이 `docs/output/`를 무시해 미추적 |

**미추적 파일은 인덱스에 진입하지 못한다.** 따라서 산출물 적재 절차는 **커밋까지 포함해야 완료**다.
쓰기만 하고 커밋하지 않으면 그 산출물은 존재하지 않는 것과 같다.

### 최악의 형태 — 두 ignore 파일이 모순되는 경우

이 저장소에서 실제로 발생했다. `.codegraphignore`는 `!/docs/output/`로 **인덱싱하라** 하고,
`.gitignore`는 `docs/output/`로 **무시하라** 한다. codegraph 는 git 추적 파일만 인덱싱하므로
**git 쪽이 이긴다.**

이 조합은 서서히 죽는다. ignore 규칙 추가 **이전에 커밋된 파일은 추적이 유지**되므로(git ignore는
미추적 파일에만 적용) 과거 산출물은 계속 회수되고, **그 시점 이후 새로 만든 산출물만 조용히 사라진다.**
겉보기에는 "회수가 되긴 한다"라서 발견이 늦다. 이 저장소는 21건 회수 / 신규 3건 유실 상태였다.

진단:

```bash
git check-ignore -v docs/output/<새 파일>.md    # 무시 규칙이 잡히면 그것이 원인
```

조치는 둘 중 하나다 — `.gitignore`에서 산출물 디렉터리 제외를 풀거나, 산출물을 추적되는 위치로 옮긴다.
`.codegraphignore`만 고치는 것은 효과가 없다.

### 둘 다 무증상으로 실패한다

- RX_1: `pendingChanges` 0, `codegraph sync` → `Already up to date`
- 이 저장소: `codegraph index .` → `125 unchanged of 125 docs` (미추적 3건은 애초에 세지 않음)

두 CLI 응답 모두 "정상"이라 답한다. **CLI의 최신 여부 보고를 인덱스 완전성의 증거로 쓰지 말 것.**
유일하게 믿을 수 있는 것은 실제 회수 질의다:

```bash
codegraph docs "<산출물 고유어구>" -p . --json --limit 10   # 자기 문서가 나오는가
```

나오지 않으면 순서대로 확인한다 — (1) `git ls-files <경로>`로 추적 여부, (2) `.codegraphignore`
복원 규칙. 문서 내용을 고치는 것은 둘 다 통과한 뒤에나 의미가 있다.

## 필드 계약 — 회수 파이프라인이 실제로 소비하는 것만 필수

| 필드 | 소비 지점 | 등급 | 근거 |
|---|---|---|---|
| `blk` | **`hits.blk`로 회수됨** | **필수** | 프론트매터 `blk` 보유 문서가 회수 시 좌표를 실어 옴(실측) |
| `keywords` | 자기회수율 측정 기준 | **필수** | 이 값으로 질의해 자기 문서가 top-K에 드는지 판정 |
| `links` | doc_link 엣지 재료 | 권장 | 문서간 연결. 회수 자체에는 직접 미소비 |
| `task` `date` `project` | 회수 미소비 | 선택 | 사람·도구용 메타 |
| `compressed` `source_turns` | 회수 미소비 | 선택 | 파이프라인 어디에서도 읽히지 않음 |

본문 3섹션(`Result`/`Changes`/`Decisions`)은 **사람이 읽기 위한 규약**이다. 렉시컬 채널에 제목 토큰이
들어가긴 하나 회수 품질 기여는 미측정 — 회수 근거로 정당화하지 말 것.

좌표 정본은 **프론트매터 `blk` 배열**이다. 2행 HTML 주석은 회수에 도달하지 않으므로 사람용 중복이며
선택 사항이다. 둘이 불일치하면 프론트매터가 이긴다.

## 정량 지표 — 목표치와 측정

```bash
python3 .claude/skills/output-binding/scripts/verify-binding.py --dir docs/output --root .
```

| 지표 | 재는 것 | 목표 |
|---|---|---|
| `index_entry` | 산출물이 인덱스에 진입한 비율 | **100%** (미달 시 이하 전부 무의미) |
| `self_recall` | 선언한 `keywords`로 질의 시 top-3 진입 | 80% |
| `coord_bind` | 회수 hit에 `blk` 좌표가 실려 오는 비율 | 90% |
| `coord_match` | 실린 좌표가 문서 선언 좌표와 일치 | 95% |
| `code_roundtrip` | `codeRefs`/`symbols` 도달 | **0% (관측만)** — 아래 참조 |

스크립트는 지표별 실측치와 **미달 원인 문서를 지목**한다. 종료코드 0=충족, 1=미달, 2=측정 불가.

### 신호/잡음 분리 임계 = distance 1.20

벡터 회수는 `--limit`만큼 항상 반환하므로 **"히트 0"이라는 실패 신호가 원리적으로 없다.**
판정 수단은 `distance`뿐이다. 실측 분포:

| 질의 | distance |
|---|---|
| 정상 2종 | 0.0000 ~ **1.1658** |
| 무관 2종 | **1.2422** ~ 1.3645 |

두 분포가 겹치지 않으며 간극 중앙이 **1.20**이다. `distance > 1.20`이면 잡음으로 간주한다.
스크립트가 매 실행 시 무관 질의를 던져 이 임계가 여전히 유효한지 자동 재검한다.

### code_roundtrip 목표가 0인 이유 (CLI 측 한계)

`hits`는 `codeRefs`·`symbols` 필드를 노출하지만 **현재 CLI가 채우지 않는다**(양쪽 저장소 전량 0).
문서→코드 왕복은 명세로 달성할 수 없고 codegraph 자체 변경이 필요하다.
따라서 목표를 0으로 두고 **관측만** 한다. CLI가 채우기 시작하면 목표를 올린다.

## 미준수 처리 — 격리하지 않는다

스키마 미준수 산출물을 `quarantine/`으로 옮기는 정책은 폐지됐다. 과거 RX_1에서 격리율 100%
(정상 0건 / 격리 20건)에 복구 0건을 만들어, 사용자에게는 "정리해도 결과물이 없다"로 체감됐다.
**경고만 하고 파일은 그대로 둔다.** 파일 이동은 사용자 결정 영역이다.

## 기존 산출물 마이그레이션 — 재작성 불필요

형식은 바뀌지 않았다. 필요한 것은 문서 수정이 아니라 **진입 조건 충족**이다.

1. `.codegraphignore`에 산출물 디렉터리 복원 규칙 추가 (예: `!/docs/output/**`) — C1
2. 미추적 산출물을 커밋 — C2. `git ls-files docs/output/`로 누락분 확인
3. `codegraph index .` 재실행 (증분 `sync`는 "up to date"로 답하므로 전체 재인덱싱)
4. `verify-binding.py`로 `index_entry` 100% 확인 — CLI 보고가 아니라 이 값으로 판정

`keywords`가 없는 과거 문서는 `self_recall`에서 미달로 잡힌다. 본문에서 기계 추출이 가능하나
**선택 사항**이며, 재작성은 필요 없다.

## 사용하지 말아야 할 때 (Negative Constraints)

- 문체·주석 톤 규정 — `comment-style` 담당.
- 산출물 압축·요약 알고리즘 — `output-arm`의 `compress-output.sh` 담당.
- codegraph CLI 자체 수정 — 이 스킬 범위 밖. 필요하면 별도 보고(현재 `code_roundtrip` 1건 해당).
- 작성 규칙(필드 순서·본문 구조) 자체 — `output-arm/SCHEMA.md` 담당. 이 스킬은 **바인딩만** 규정한다.
