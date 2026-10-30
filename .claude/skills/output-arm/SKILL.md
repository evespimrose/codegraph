---
name: output-arm
description: Use when the user invokes /output-arm on|off|status, or to apply the Output Arm token-suppression policy (default ON). Korean triggers - "출력압축 켜/꺼", "아웃풋암". NOT for input-access control (RULE-1/Sonar) or turn limiting (turn-budget).
---

<!-- CAVE-MAN-OUTPUT-ARM -->
## ⚙️ 실행 규칙 (Cave-Man Output Arm · 전 스킬 공통)

> 이 스킬이 본 정책의 **정의 문서**다. 아래 본문이 규칙 전문이며, 타 스킬 헤더는 이 문서를 가리키는 **compact 포인터**(마커만 보존)다.

- **답 먼저** · 과정 서술은 줄이고 도구로 작업 · 증거는 Review Pack 링크로 · 끝에 사람 확인 항목만 · **서브에이전트·Workflow 는 게이트 승인제**(기본 manual) · **Auto-Clarity 예외**(보안·비가역·모호 다단계·반복질문·하드블로커는 정상 출력)
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Output Arm — 출력측 토큰 게이트 (기본 ON · 토글 가능)

## 정체성

토큰 절감의 **출력측 축**. RULE-1(Cave-Man/Sonar)이 *입력 접근*(무엇을 읽을지)을 통제한다면, Output Arm은 *응답 표현*(메인 컨텍스트에 무엇을 흘릴지)을 통제한다. 두 축은 직교 → 가산. caveman 입국심사 Atom 1·2·4·5·6의 워크플로 구현체.

설계 출처(codegraph 추적 가능):
- [출력_표현_압축](D:/Unity/WIKI/obsidian/출력_표현_압축.md) — Atom 5
- [서브에이전트_출력압축_원리](D:/Unity/WIKI/obsidian/서브에이전트_출력압축_원리.md) — Atom 1·4

## 토글 명령

| 명령 | 동작 |
|------|------|
| `/output-arm on` | `.claude/state/output-arm` ← `on` |
| `/output-arm off` | `.claude/state/output-arm` ← `off` |
| `/output-arm status` | 현재 상태 출력 (이 명령만은 출력 허용) |

상태파일: `.claude/state/output-arm` (기본값 `on`). Stop 훅 `output-arm-gate.sh`가 사후 검증.

## ON일 때 행위 규칙 (Atom 5 — 출력 압축 모드)

1. **과정 서술 줄이기.** 작업 과정 narration·중간 요약·"이제 ~하겠습니다" 출력은 생략한다. 도구로 일하고, 끝에 **답(결론 먼저)** 을 쓴다.
2. 관사·filler·hedging 제거, fragment 허용. 단 코드·에러·기술용어·API명·경로는 verbatim 보존 — "same brain, fewer tokens".
3. 증거가 길면 채팅에 붙이지 않고 Review Pack 링크로 건넨다(아래 "증거 링크").
4. **서브에이전트·Workflow 는 게이트 승인제.** `subagent-dispatch-gate.sh` 가 `Agent|Task|Workflow` 호출마다 승인을 묻는다(기본 `manual`). 위임 단위는 사용자가 승인한 세션 카드다. 콜드스타트 비용이 커서 소형 작업은 메인이 직접 한다. 정책: [[main-context-zero-delegation]].

## 압축을 멈추는 안전경계 (Atom 2 — Auto-Clarity · correctness > brevity)

다음에선 **억제를 풀고 메인에 정상 출력**한다:
- 보안 경고·민감정보 노출 위험
- 비가역 동작 확인(삭제·푸시·배포·외부 전송·권한 변경)
- fragment가 모호해 다단계 오독 위험
- 사용자가 같은 질문 반복(직전 압축 응답이 불충분했다는 신호)
- 하드 블로커·결정 필요(작업을 멈추고 물어야 하는 지점)

→ 안전·정확이 토큰 절감에 우선. 압축이 "정확도 사고"를 일으키면 즉시 중단.

## 증거 링크 (D4 · grep 가능 출력 계약)

사람이 봐야 할 증거(자동 기준 결과, 변경 파일, 확인 항목)는 **Review Pack** 에 모은다. 채팅에는 링크 한 줄과 확인 항목만 남긴다.

- 경로: `.claude/memory-bank/<branch>/plans/<slug>-review.md` (`pack.py build <slug>` 가 만든다. 모델이 직접 쓰지 않는다.)
- 아래 "구버전 적재 경로(`docs/output/`)" 절의 형식은 과거 산출물 호환용이다. 새 증거에는 쓰지 않는다.
- 코드베이스 위치 지목 → **BLK 태그**: `[BLK-XXX]` 또는 신규 `[NEW-BLK] 절대경로`
- 다른 마크다운 참조 → **마크다운 링크** `[제목](상대경로)` (추후 codegraph 질의로 추적)
- grep 가능 출력 계약(예외적 서브에이전트 사용 시 그 결과도 이 형식으로 수집):
  - 탐색: `path:line — \`symbol\` — 노트` / 없으면 `No match.`
  - 편집: `path:range — 변경요약(≤10단어)` + `verified: <OK | mismatch @ path:line>`
  - 검증: `path:line: <emoji severity> <문제>. <수정>.` + `totals: N🔴 N🟡 N🔵`
  - 종결 토큰(첫 토큰이 실패 신호): `too-big.` `needs-confirm.` `ambiguous.`
- 끝에 메인엔 Review Pack 링크 한 줄과 사람 확인 항목만 남긴다.

### 구버전 적재 경로 (`docs/output/`, 호환용)
- **대량저작 임계(온디맨드 원칙)**: 예상 산출물 ≥ 8K자(≈2K tok)는 메인이 직접 Write하지 않고 writer 서브에이전트 디스패치를 제안(manual 게이트 '초대형' 예외) — Write 인자도 가시출력과 동일하게 메인 윈도우에 실리므로(2026-07-06 실측), 대량 저작 토큰은 서브 컨텍스트에서 소화시키고 메인엔 링크만 남긴다.

### 저작 간접화 — `emit-output.sh` (M3, 2026-08-15)

내용을 3등급으로 나눠 **A등급은 서브에이전트도 없이 스크립트가 직접 조립**한다(콜드스타트 0):

| 등급 | 성격 | 조립 주체 | 실측 비중(5건 샘플) |
|---|---|---|---|
| A | 기계 도출 가능 — diff·변경파일·날짜·BLK | `emit-output.sh`가 자동 조립 | ~73% |
| B | 판단 필요하나 짧음(결론·근거 3줄 이내) | 메인이 `--note` 인자로 전달 | ~8% |
| C | 긴 서사·설계 논증 | 사람/별도 세션이 직접 저작 | ~20% |

```bash
.claude/skills/output-arm/scripts/emit-output.sh \
  --task "<1문장>" --blk BLK-XXX --source-turns <N> [--note "<B등급 3줄 이내>"] [--dry-run]
```
- `--blk`는 `BLK-\d+` 형식만 허용(비코드 산출물은 `BLK-000`) — 아니면 즉시 실패(M2: 다른 값은 codegraph `hits.blk`가 null로 유실).
- A등급 필드(date/project/links/keywords/diff)는 `git diff --stat`에서 자동 조립, `docs/output/` 자체는 자기참조 방지로 diff 스캔에서 제외.
- **8K자 임계 우선순위**: A등급 비중이 높은 산출물(실행 보고서 등)은 서브에이전트 디스패치보다 `emit-output.sh` 우선 — 콜드스타트 자체가 없다. C등급 서사가 많은 산출물만 서브에이전트/직접 저작 고려.
- 기존 `Write` 경로는 폐지되지 않음(emit은 추가 경로, 폴백 유지).

## 민감파일 안전장치 (Atom 6)

docs/output 적재·파일 이동/압축 시:
- denylist 거부: `.env` · `*credentials*` · `*.pem` · `.ssh/` · `.aws/` · `*secret*` · `*.key`
- frontmatter(`---`) verbatim 분리·재prepend (lossy 변형 금지)
- 외부 전송·압축 전 원본 백업 + readback 검증

## 결정론 게이트 (Atom 3 — Stop 훅)

`.claude/hooks/output-arm-gate.sh`(Stop)가 사후 검증:
- 묶인 작업이 `MODE=REVIEW` 인데 `<slug>-review.md`(Review Pack)가 없으면 → 세션당 1회 알림
- 구조 불변식만 검사(의미 검증 아님). 차단하지 않고 알림만.

## OFF일 때

평소대로 정상 출력. 본 규칙 전부 비활성.

## 절대 금지
- ON 상태에서 Auto-Clarity 경계를 무시하고 보안·비가역·블로커를 침묵 처리
- 증거를 메인에 장황하게 흘리기(→ Review Pack 링크로)
- 헌법급 문서(CLAUDE.md·schema) LLM lossy 압축 (Atom 7 반례 교훈: 구조 통과+의미 변질=침묵 오염)

## 사용하지 말아야 할 때 (Negative Constraints)

- 입력 접근(무엇을 읽을지) 통제 — RULE-1/Sonar(직교 축).
- 턴(도구 호출 수) 제한 — `turn-budget`.
- Auto-Clarity 경계(보안·비가역·모호·반복질문·블로커) — 이때는 본 정책을 *적용하지 말고* 정상 출력.
- 헌법급 문서 lossy 압축 — 금지(Atom 7).
