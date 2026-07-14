---
name: output-arm
description: Use when the user invokes /output-arm on|off|status, or to apply the Output Arm token-suppression policy (default ON). Korean triggers - "출력압축 켜/꺼", "아웃풋암". NOT for input-access control (RULE-1/Sonar) or turn limiting (turn-budget).
---

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (Cave-Man Output Arm · 전 스킬 공통)

> 이 스킬이 본 정책의 **정의 문서**다. 아래 본문이 규칙 전문이며, 타 스킬 헤더는 이 문서를 가리키는 **compact 포인터**(마커만 보존)다.

- **메인 컨텍스트 타이핑 금지** · **도구 사용 허용** · **서브에이전트 디스패치 금지**(예외: 사용자 발의 초대형/병렬) · 완료 시 `XX 완료`만 · **Auto-Clarity 예외**(보안·비가역·모호 다단계·반복질문·하드블로커)
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Output Arm — 출력측 토큰 게이트 (기본 ON · 토글 가능)

## 정체성

토큰 절감의 **출력측 축**. RULE-1(Cave-Man/Sonar)이 *입력 접근*(무엇을 읽을지)을 통제한다면, Output Arm은 *응답 표현*(메인 컨텍스트에 무엇을 흘릴지)을 통제한다. 두 축은 직교 → 가산. caveman 입국심사 Atom 1·2·4·5·6의 워크플로 구현체.

## 토글 명령

| 명령 | 동작 |
|------|------|
| `/output-arm on` | `.claude/state/output-arm` ← `on` |
| `/output-arm off` | `.claude/state/output-arm` ← `off` |
| `/output-arm status` | 현재 상태 출력 (이 명령만은 출력 허용) |

상태파일: `.claude/state/output-arm` (기본값 `on`). Stop 훅 `output-arm-gate.sh`가 사후 검증.

## ON일 때 행위 규칙 (Atom 5 — 출력 압축 모드)

1. **메인 컨텍스트 서술 억제.** 작업 과정 narration·중간 요약·"이제 ~하겠습니다" 출력 금지. 도구로 일하고, 끝에 **`XX 완료`** 한 줄만.
2. 관사·filler·hedging 제거, fragment 허용. 단 코드·에러·기술용어·API명·경로는 verbatim 보존 — "same brain, fewer tokens".
3. 진행 보고가 꼭 필요하면 메인이 아니라 `docs/output/`에 적재(아래).
4. **서브에이전트 디스패치 금지.** Agent/Task 호출 안 함 — 콜드스타트 토큰세금(소형 작업 시 메인 한계비용 대비 ~100배). 메인이 hook 통제下 codegraph-first로 직접 작업. 예외: 초대형 규모·병렬 독립 작업을 사용자가 발의한 경우만(`subagent-dispatch-gate.sh`가 Task를 `ask`로 경고). 정책: [[main-context-zero-delegation]].

## 압축을 멈추는 안전경계 (Atom 2 — Auto-Clarity · correctness > brevity)

다음에선 **억제를 풀고 메인에 정상 출력**한다:
- 보안 경고·민감정보 노출 위험
- 비가역 동작 확인(삭제·푸시·배포·외부 전송·권한 변경)
- fragment가 모호해 다단계 오독 위험
- 사용자가 같은 질문 반복(직전 압축 응답이 불충분했다는 신호)
- 하드 블로커·결정 필요(작업을 멈추고 물어야 하는 지점)

→ 안전·정확이 토큰 절감에 우선. 압축이 "정확도 사고"를 일으키면 즉시 중단.

## must-see 출력 적재 (Atom 1·4 — grep 가능 출력 계약)

억제 중이라도 **반드시 봐야 할 산출물**은 메인에 흘리지 말고 `docs/output/`에 통합 마크다운으로 저장.

- 경로: `docs/output/YYYY-MM-DD-<task-slug>.md`
- 코드베이스 위치 지목 → **BLK 태그**: `[BLK-XXX]` 또는 신규 `[NEW-BLK] 절대경로`
- 다른 마크다운 참조 → **마크다운 링크** `[제목](상대경로)` (추후 codegraph 질의로 추적)
- grep 가능 출력 계약(예외적 서브에이전트 사용 시 그 결과도 이 형식으로 수집):
  - 탐색: `path:line — \`symbol\` — 노트` / 없으면 `No match.`
  - 편집: `path:range — 변경요약(≤10단어)` + `verified: <OK | mismatch @ path:line>`
  - 검증: `path:line: <emoji severity> <문제>. <수정>.` + `totals: N🔴 N🟡 N🔵`
  - 종결 토큰(첫 토큰이 실패 신호): `too-big.` `needs-confirm.` `ambiguous.`
- 끝에 메인엔 그 문서로의 **링크 한 줄 + `XX 완료`**만.
- **대량저작 임계(온디맨드 원칙)**: 예상 산출물 ≥ 8K자(≈2K tok)는 메인이 직접 Write하지 않고 writer 서브에이전트 디스패치를 제안(manual 게이트 '초대형' 예외) — Write 인자도 가시출력과 동일하게 메인 윈도우에 실리므로(2026-07-06 실측), 대량 저작 토큰은 서브 컨텍스트에서 소화시키고 메인엔 링크만 남긴다.

## 민감파일 안전장치 (Atom 6)

docs/output 적재·파일 이동/압축 시:
- denylist 거부: `.env` · `*credentials*` · `*.pem` · `.ssh/` · `.aws/` · `*secret*` · `*.key`
- frontmatter(`---`) verbatim 분리·재prepend (lossy 변형 금지)
- 외부 전송·압축 전 원본 백업 + readback 검증

## 결정론 게이트 (Atom 3 — Stop 훅)

`.claude/hooks/output-arm-gate.sh`(Stop)가 사후 검증:
- ON인데 파일을 변경했으면서 `docs/output/` 적재가 없으면 → 경고(누락 리마인더)
- 구조 불변식만 검사(의미 검증 아님). 차단하지 않고 알림만.

## OFF일 때

평소대로 정상 출력. 본 규칙 전부 비활성.

## 절대 금지
- ON 상태에서 Auto-Clarity 경계를 무시하고 보안·비가역·블로커를 침묵 처리
- must-see 산출물을 메인에 장황하게 흘리기(→ docs/output로)
- 헌법급 문서(CLAUDE.md·schema) LLM lossy 압축 (Atom 7 반례 교훈: 구조 통과+의미 변질=침묵 오염)

## 사용하지 말아야 할 때 (Negative Constraints)

- 입력 접근(무엇을 읽을지) 통제 — RULE-1/Sonar(직교 축).
- 턴(도구 호출 수) 제한 — `turn-budget`.
- Auto-Clarity 경계(보안·비가역·모호·반복질문·블로커) — 이때는 본 정책을 *적용하지 말고* 정상 출력.
- 헌법급 문서 lossy 압축 — 금지(Atom 7).
