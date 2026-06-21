---
name: doc-context
description: Use when /doc-context command received to load a cxt file and apply BLK-aware dictionary lookup before executing instructions
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

## ⛔ 절대 금지 위반 시나리오 (DEADLY)

아래 행동은 즉각 STOP하고 수정해야 한다:

### 위반 1 — 재확인 요청 (DEADLY)
```
❌ cxt 파일을 읽은 후:
   "이 방향으로 진행하면 될까요?"
   "작업을 시작해도 괜찮을까요?"
   "다음 단계를 확인해 주세요."

✅ 올바른 행동:
   cxt 파일 = 사용자의 직접 지시.
   읽는 즉시 작업 착수. 확인 없음.
```

### 위반 2 — 내용 요약 출력 (위반)
```
❌ cxt 파일 읽기 후:
   "내용을 요약하면 다음과 같습니다..."
   "cxt 파일에는 X, Y, Z 내용이 포함되어 있습니다."

✅ 올바른 행동:
   요약 출력 없이 즉시 작업 착수.
   진행 중 필요한 정보만 언급.
```

### 위반 3 — 수동 확인 요청 (위반)
```
❌ cxt 파일 읽기 후:
   "이해했습니다. 확인해 주세요."
   "진행하겠습니다. 맞나요?"
   "이렇게 이해했는데 맞으면 시작할게요."

✅ 올바른 행동:
   "이해했습니다" 없이 첫 번째 작업 단계 즉시 실행.
```

**규칙 요약: /doc-context 수신 = 실행 명령. 대화 아님.**
