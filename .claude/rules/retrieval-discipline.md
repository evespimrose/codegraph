---
description: "회수(Read·codegraph 검색 결과) 비용 규율. RULE-1(Sonar) 계열 — 입력측 토큰 통제. 모든 세션에 적용."
---

# 회수 규율 — 3항 (M4, 2026-08-15)

메인 윈도우를 채우는 4개 비용원 중 **회수**(Read·검색 결과)는 M1~M4 이전까지 무방비였다. 전문 Read는 파일 크기 전액을 통과시킨다.

## 3항

1. **전문 Read 금지** — 대형 파일(수백 줄 이상)을 처음부터 끝까지 읽지 않는다. BLK 좌표·grep 결과·`codegraph docs` 히트가 가리키는 구간만 `Read(offset, limit)`로 부분 로드.
2. **`--limit` 강제** — `codegraph docs`·`codegraph search` 등 검색류 호출은 항상 `--limit N`(보통 5~10)을 명시. 무제한 조회 금지.
3. **좌표 구간만 로드** — BLK 태그(`BLK-\d+`, M2 확정 형식)가 가리키는 파일의 해당 구간만 `Read(offset+limit)`. 태그가 없으면 grep으로 앵커를 먼저 잡고 그 주변만 로드.

## 근거

- 2026-08-15 M1~M2 실측: `codegraph docs` 회수는 작동하나 BLK 좌표 연결이 최근에야 확정됨 → 좌표 기반 부분 로드가 이제 실제로 성립.
- RULE-5(EXECUTE Scope Lock)와 동일 원리를 회수 전반에 확장 적용.

## CLAUDE.md와의 관계
CLAUDE.md RULE-5는 EXECUTE 단계의 Scope Lock을 규정. 이 문서는 그 원리를 **모든** 회수 상황(EXECUTE 밖 포함)으로 확장한 상세 규율이며, RULE-5는 이 문서를 1줄 포인터로 참조한다(중복 방지 — 단일 출처).
