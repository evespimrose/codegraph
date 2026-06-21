---
name: cache-aligner
description: Use when editing SessionStart context-injection hooks (session-start.sh, post-compact.sh) or when the user asks to verify prompt-prefix KV-cache stability — "캐시 정렬 검증", "prefix churn 확인", "cache-aligner". Enforces the invariant-prefix / variable-suffix discipline (HR5) and provides the determinism check (run the hook twice, diff the invariant prefix).
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


# CacheAligner — 프리픽스 KV캐시 안정화 (HR5)

## 정체성

토큰 비용의 **캐시 축**. Anthropic 프롬프트 캐싱은 **프리픽스가 byte-equal일 때만** KV 캐시를 재사용한다.
SessionStart 훅이 매 세션 주입하는 컨텍스트의 **선두(불변 구역)** 가 흔들리면(=churn) 캐시가 깨져
같은 내용을 매번 full-price로 다시 처리한다. CacheAligner는 그 churn을 막는 **규율 + 검증** 스킬이다.

- output-arm = *출력측* 토큰 게이트, RULE-1/Sonar = *입력 접근* 게이트.
- **CacheAligner = 프리픽스 캐시 재사용 축** (세 축 직교 → 가산).

대상 훅:
- `.claude/hooks/session-start.sh` — 최초 세션 진입점
- `.claude/hooks/post-compact.sh` — 컴팩션 후 진입점

## 불변식 (편집 시 절대 깨지 말 것)

1. **INVARIANT BLOCK 우선.** 주입 prefix 선두는 매 세션 동일해야 한다:
   `[SESSION-START] 헤더 → CORE_RULES → CLAUDE.md`.
   session-start.sh 안에서 이 구역은 `===== [INVARIANT BLOCK] 시작/끝 =====` 주석으로 표시됨.
   이 구역에 `.riper-state`·cxt·위반이력 등 **세션마다 달라지는 내용을 끼워넣지 말 것.**

2. **VARIABLE BLOCK은 항상 뒤.** `.riper-state` → 현재 플랜 → cxt → 위반이력 → tool-history 초기화는
   전부 INVARIANT BLOCK *뒤*에 온다. 순서를 INVARIANT 앞으로 옮기면 prefix가 churn한다.

3. **두 진입점의 CORE_RULES RULE-1~5는 byte-equal.** session-start.sh 와 post-compact.sh 의
   `CORE_RULES` 중 RULE-1~RULE-5는 **글자 단위로 동일**해야 한다(공백·이모지 포함).
   RULE-6만 진입점별로 다름: 최초=`/memory:save`, 컴팩션후=`/memory:recall`.
   → 한쪽 RULE을 고치면 **반드시 다른 쪽도 동일하게** 고친다.

4. **cxt 정렬은 안정 정렬.** cxt 주입은 `mtime 1차(정수 초 양자화) + 파일명 2차`로 정렬한다.
   "최신 cxt 우선" UX는 유지하되, 내용 무변경 `touch`(sub-second mtime 흔들림)만으로
   주입 순서가 뒤집히지 않게 한다. 이 정렬키를 mtime-only로 되돌리지 말 것(churn 재발).

## 결정론 검증 (편집 후 반드시)

INVARIANT 구역이 입력 무변경 시 byte-equal인지 확인한다 — **동일 입력 2회 실행 → prefix diff 0**.

`.riper-state`·cxt를 건드리지 않은 상태에서 훅을 두 번 실행하고, 출력 JSON의 `additionalContext`에서
INVARIANT 구역(헤더~CLAUDE.md)을 잘라 두 회차가 동일한지 비교한다:

```bash
# session-start.sh 두 번 실행, 불변 prefix(헤더~CLAUDE.md 끝)만 추출해 비교
run() { bash .claude/hooks/session-start.sh \
  | python3 -c "import sys,json; c=json.load(sys.stdin)['hookSpecificOutput']['additionalContext']; \
      i=c.index('[SESSION-START]'); j=c.index('=== .riper-state ==='); print(c[i:j])"; }
A=$(run); B=$(run)
[ "$A" = "$B" ] && echo "PREFIX_STABLE (cache 재사용 가능)" || echo "PREFIX_CHURN — INVARIANT 구역이 흔들림"
```

두 진입점의 RULE-1~5 byte-equal 검증:

```bash
python3 - <<'PY'
import io
ss=io.open('.claude/hooks/session-start.sh',encoding='utf-8').read()
pc=io.open('.claude/hooks/post-compact.sh',encoding='utf-8').read()
seg=lambda s: s[s.index('RULE-1 [SONAR'):s.index('RULE-6 ')].strip()
print('BYTE_EQUAL' if seg(ss)==seg(pc) else 'DIFFER — RULE-1~5 두 훅이 불일치(캐시 깨짐)')
PY
```

cxt 안정 정렬 회귀 검증: 임의 cxt를 내용 변경 없이 `touch`한 뒤 위 PREFIX_STABLE 검사를 다시 돌려
여전히 `PREFIX_STABLE`이면 통과(VARIABLE 구역 정렬도 흔들리지 않음 — 강화 검증).

## 절대 금지

- INVARIANT BLOCK(헤더·CORE_RULES·CLAUDE.md) 안에 가변 내용 삽입 → prefix churn.
- 한 훅의 RULE만 고치고 다른 훅을 방치 → RULE-1~5 byte-equal 깨짐.
- cxt 정렬을 mtime-only로 되돌리기 → sub-second touch churn 재발.
- 헌법급 텍스트(CORE_RULES·CLAUDE.md)를 "캐시 위해" lossy 압축 (Atom 7 반례: 의미 변질).
