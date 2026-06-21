# AGENTS.md — Universal Coding Workflow Ecosystem

이 파일은 세션 시작 시 자동으로 주입되어 Codex의 기본 행동을 정의한다.

---

## RULE-1: Sonar Protocol (DEADLY — 절대 위반 불가)

**bash로 파일을 탐색하지 말 것.**

```
❌ find Assets -name "*.cs"
❌ ls -r docs/
❌ grep -r "ClassName" .
❌ rg "pattern"
❌ fd "*.md"

✅ manage/dictionary.md § 1 에서 BLK 코드로 경로 조회
✅ Glob("Assets/**/*.cs") 도구 사용
✅ Grep("ClassName", glob="*.cs") 도구 사용
```

위반 시 sonar-guard.sh가 자동 차단. 위반 누적 = 세션 말기 컨텍스트 폭발의 주원인.

---

## RULE-2: RIPER 모드 상태 추적

**간단한 버그 수정 또는 소규모 기능 변경** → 직접 진행 후 `check-sync.sh` 훅을 실행하여 코드-인덱스 불일치 감지 및 딕셔너리 갱신 제안만.

현재 모드는 `.Codex/memory-bank/.riper-state` 파일에 기록.

모드 전환 시 해당 커맨드 파일이 자동으로 상태를 업데이트:
- `/riper:research` → MODE=RESEARCH
- `/riper:innovate` → MODE=INNOVATE
- `/riper:plan` → MODE=PLAN (PLAN_FILE 경로도 기록)
- `/riper:execute` → MODE=EXECUTE (PLAN_FILE 존재 확인 필수)
- `/riper:review` → MODE=REVIEW

**모드 위반 예시:**
- PLAN 모드에서 소스 코드 수정 → BLOCKED
- EXECUTE 모드 진입 시 PLAN_FILE 없음 → BLOCKED

---

## RULE-3: 게이트 최적화 (규모별 차등 적용)

| 규모 | 기준 | quality-sentinel | reporter |
|------|------|-----------------|---------|
| 소형 | 단일 파일·함수, 버그픽스, 플랜 파일 없음 | 선택 사항 | 기본 모드만 |
| 중·대형 | 멀티파일, 신규 시스템, 플랜 파일 존재 | 필수 | 필수 |

**플랜 파일 존재 여부가 규모 판단의 핵심 기준이다.**

---

## RULE-4: 소스 코드 쓰기 전 승인 (Collaboration Protocol Step 5)

소스 코드 파일(.cs, .py, .ts, .js 등) 수정 전 반드시:
> "이를 [파일경로]에 작성해도 될까요?"

단, 사용자가 이미 명시적으로 승인한 경우 생략 가능.
write-approval-reminder.sh가 자동 리마인드.

---

## RULE-5: doc-context 즉시 실행 (No Re-confirmation)

`/doc-context <path>` 수신 시:
- cxt 파일 = 사용자의 직접 지시
- 읽는 즉시 작업 착수
- **재확인, 요약 출력, "이해했습니다 확인해 주세요" 절대 금지**

---

## RULE-6: 컴팩션 전 메모리 저장

`/compact` 실행 전 반드시:
1. `/memory:save` 실행 (Codex-mem 플러그인)
2. `.riper-state` 파일 저장 확인
3. 이후 `/compact` 실행

컴팩션 후 복원: `/memory:recall` → session-start.sh 자동 주입 확인

---

## 에이전트 라우팅 (3-Tier Studio)

| Tier | 에이전트 | 모델 | 담당 |
|------|---------|------|------|
| 1 | producer, creative-director, technical-director | Opus | 의사결정·조율 |
| 2 | lead-programmer, unity-specialist | Sonnet | 구현 총괄 |
| 3 | quality-sentinel, reporter, writer, 도메인 전문가 | Sonnet | 실행·검증·문서화 |

**에이전트 호출 판단:**
- 단순 질문·소형 버그픽스 → 직접 처리 (에이전트 불필요)
- 2개 이상 서브시스템 얽힌 기능 → lead-programmer 경유
- 중형 이상 작업 착수 → producer → writer(플랜) → 구현 에이전트

---

## 워크플로 요약

```
사용자 요청
  ↓
규모 판단 (소형 / 중·대형)
  ↓
[소형] 직접 처리 → reporter 기본 모드
[중·대형] RIPER 워크플로:
  /riper:research → /riper:innovate → /riper:plan
    → (플랜 승인) → /riper:execute → /riper:review
  → quality-sentinel → reporter
```

---

## 네비게이션 규칙 (Sonar Protocol 상세)

1. 파일 경로가 필요할 때 → `manage/dictionary.md § 1` 먼저 조회
2. BLK 태그 없을 때 → `manage/dictionary.md § 3` 키워드 인덱스
3. 도구 우선순위: `manage/dictionary.md` > `Glob` > `Grep` > (bash 금지)
4. `manage/dictionary.md`가 없는 프로젝트: Glob/Grep 도구만 사용

---

## 메모리 아키텍처

```
L1: AGENTS.md + session-start.sh 주입 (세션마다 자동)
L2: .riper-state (RIPER 모드·플랜 경로, 파일 기반)
L3: Codex-mem /memory:save|recall (압축 전후 장기 보존)
L4: manage/dictionary.md (프로젝트 구조 인덱스)
```
