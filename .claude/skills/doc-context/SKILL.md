---
name: doc-context
description: Use when /doc-context loads a cxt file (BLK-aware dictionary lookup) before executing — NOT for plain file reading/summary (use Read) or non-.md/.txt files
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->


# doc-context (로컬 Skill)

## 실행 프로토콜

```
WHEN /doc-context <path> 수신:

1. Read(<path>)
2. BLK 태그 확인: 파일 2행 <!-- BLK: BLK-XXX --> 파싱
3. dictionary 조회:
   - 태그 있으면 → manage/dictionary.md § 1에서 해당 BLK 행 grep → 관련 파일 경로 확보
   - 태그 없으면 → manage/dictionary.md § 3 키워드 인덱스에서 작업 키워드 grep → BLK 추정
4. 파일 내용을 사용자의 직접 지시로 해석 → 즉시 작업 착수
```

## 규칙

- `.md` / `.txt` 파일만 지원. 다른 확장자 → "지원하지 않는 파일 형식입니다" 출력 후 중단
- No content echo. No re-confirmation. Empty or missing file → report and stop
- **bash find/grep/ls 탐색 금지** — dictionary § 1 경로만으로 파일 특정 (Sonar Protocol)
- BLK 추정 불가 시 → "BLK 태그 없음: § 3 키워드 인덱스 확인 필요" 출력 후 계속 진행

## Sonar Protocol 자체 점검

cxt 로드 후 작업 착수 전 확인:
- [ ] 대상 BLK 특정 완료
- [ ] 관련 파일 경로 dictionary § 1에서 확보
- [ ] bash 탐색 충동 없음 → 충동 발생 시 STOP → § 3 키워드 인덱스 확인으로 대체

## ⛔ 절대 금지 (DEADLY) — cxt 읽은 즉시 작업, 3가지 출력 금지

```
❌ 재확인     "이 방향 맞나요?" / "시작해도 될까요?" / "다음 단계 확인해주세요"
❌ 요약 출력  "내용을 요약하면…" / "cxt에 X, Y, Z 포함…"
❌ 수동 확인  "이해했습니다, 맞나요?" / "진행하겠습니다, 맞죠?"
✅ 올바름     cxt = 사용자 직접 지시. 읽는 즉시 첫 작업 단계 실행. 확인·요약·서론 없음.
```

**규칙 요약: /doc-context 수신 = 실행 명령. 대화 아님.**

## 사용하지 말아야 할 때 (Negative Constraints)

- 파일을 읽어 *보여주기/요약*만 할 때 — 본 스킬은 내용을 *직접 지시로 즉시 실행*. 단순 열람은 Read.
- `.md`/`.txt` 외 확장자 — 미지원.
- 작업 지시가 없는 순수 데이터 파일 로드 — 즉시-착수 의미 없음.
