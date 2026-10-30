# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 우선순위

충돌하면 위쪽이 이긴다.

1. 플랫폼·앱 지시 (시스템 프롬프트, 도구 게이트)
2. 사용자 채팅 지시
3. 프로젝트 규칙 (이 파일과 `.claude/rules/`)
4. KIT 공용 규칙 (배포 하네스. 이 프로젝트에서는 수정하지 않음)

## 규칙 번호

아래 RULE 번호 한 체계를 쓴다. `.claude/hooks/session-start.sh` 와 `post-compact.sh` 의 `CORE_RULES` 가 RULE-1~6 을 같은 번호로 인용한다. 번호나 문구를 바꾸면 두 훅의 `CORE_RULES` 도 같이 바꾸고 byte-equal 을 확인한다(cache-aligner 스킬).

## RULE-1: Sonar Protocol (DEADLY · L1 Hook 강제)

**모든 소스 코드 접근 전 codegraph 우선 사용.**

### ❌ 자동 차단 (PreToolUse hook)
- `find`(깊이 제한 없음) / `ls -R` / `grep -r` / `rg` / `fd` (bash)
- `Get-ChildItem -Recurse` / `Select-String -Path *` (PowerShell)
- `cat` 등 범위 없는 소스 출력. `head`·`tail`·범위를 준 `sed -n 'A,Bp'` 는 허용
- **codegraph 미사용 후 소스 코드 Read** (자동 차단)
- 문서·설정 문자열 검색은 Grep 도구(type/glob 소스 필터 없이)로 한다. codegraph 인덱스에 없는 문자열이라 막지 않는다.

### ✅ 올바른 순서 (codegraph는 MCP가 아니라 CLI — Bash로 직접 호출)
```
1. codegraph context "<intent>" -p <root> / codegraph query "<symbol>" -p <root> → 심볼 위치
2. codegraph callers "<symbol>" -p <root> / codegraph impact "<symbol>" -p <root> → 영향 범위
3. Read(offset+limit) 로 좌표 구간만 읽음 → 소스 코드
4. (보완 시만) Glob / Grep
```

`mcp__codegraph__*` 툴은 더 이상 존재하지 않는다(CLI 바이너리 전환, 920cd03). codegraph MCP를 등록·기동하지 말 것.
차단 hook: `.claude/hooks/sonar-guard*.sh`, `codegraph-gate.sh` — 게이트는 Bash로 호출된 `codegraph <subcommand>`를
`tool-history-recorder.sh`가 `codegraph_<subcommand>`로 번역 기록해야 인식한다(둘 다 이미 반영됨).
위반 로그: `.claude/state/violation-count.log`

### ⚖️ 조건부 신뢰 (Conditional Trust · state-doctor 게이트)

**"네 눈보다 codegraph를 믿어라"는 STATE HEALTH=green 일 때만 권위다.**
파생 표현(codegraph·dictionary·BLK·cxt 주입·riper-state)은 코드의 사본 → 부패한다. 그 충실도를 git/fs(지상 진실)에 자동 대조하는 센서가 `.claude/hooks/state-doctor.sh` (session-start 가 매 세션 발화 → `=== 파생상태 건강도 ===` 1행 주입, 결과 토큰은 `.claude/state/health` 1행).

- `health` 토큰이 **green 이 아니면**(yellow/red/unknown): 해당 파생 표현을 **권위 → 참고(reference)로 강등**하고 RULE-1 일시 해제. → 영향 부분을 Read 로 ground-truth 확인 후 가능하면 재생성(reindex·dictionary 재산출·경로 정정).
- **최악의 실패 모드**: yellow/red 를 무시하고 stale 표현에 "충실히" 따르는 것 — 저신뢰 환각을 고신뢰 상태부패로 세탁한다. green 점검이 신뢰 명령의 전제다.

## RULE-2: RIPER 상태 추적
`.claude/memory-bank/<branch>/riper/<slug>.state` 에 작업마다 파일 1개로 기록 (규칙 전문: [.claude/rules/riper-state.md](.claude/rules/riper-state.md)). 세션 묶음은 `riper-bind.sh` 가 자동 처리.
- /riper:research|innovate|plan|execute|review
- PLAN_FILE 부재 시 EXECUTE 진입 차단 (state-doctor 가 red 표시)
- 여러 세션이 한 상태 파일을 돌려 쓸 수 있다. 쓰기 직전에 다시 읽고 자기 칸만 고친다.

## RULE-3: 게이트 (규모별 차등)
| 규모 | 기준 | 플랜 | 확인 |
|------|------|------|------|
| 소형 | 단일 파일, 버그픽스 1곳, 플랜 없음 | 없음 | 메인이 직접 처리 |
| 중·대형 | 멀티파일, 신규 시스템, 플랜 파일 존재 | 필수 (수락 기준 포함) | G1: 플랜·수락 기준 승인, G2: Review Pack 확인 |

G1·G2 는 사람이 한다. 모델이 대신 통과시키지 않는다.

## RULE-4: 소스 코드 쓰기 전 승인
.cs/.py/.ts/.js 등 소스 수정 전 사용자 승인. 승인된 플랜(G1)이 플랜 범위 파일의 쓰기 승인을 겸한다. 플랜에 없는 파일은 고치지 않는다.

## RULE-5: /doc-context 즉시 실행
- 세션 시작 때 cxt 본문은 주입하지 않는다. 최근 cxt 경로 한 줄만 보인다.
- /doc-context 로 부르면 cxt 파일 = 사용자의 직접 지시로 보고 즉시 작업한다. 재확인·요약 금지.
- cxt 파일의 BLK 태그와 SONAR 리마인더 줄은 있으면 쓴다.

## RULE-6: 컴팩션 전 메모리 저장
/compact 실행 전 `/memory:save` 필수. 컴팩션 후 `/memory:recall`.

## RULE-7: 범위와 수락 기준
- 플랜의 각 단계에는 파일(절대 경로), 범위(줄 또는 심볼), 동작(insert/replace/delete/append), 성공 기준(관찰 가능한 결과)을 적는다. 최대 10단계.
- 플랜에는 ` ```acceptance ` 블록이 있어야 한다. 한 줄에 JSON 객체 하나. `kind: auto` 는 `cmd` 와 `expect`(`exit0`), `kind: human` 은 `how` 와 `expect`. 블록이 없으면 APPROVAL 로 넘기지 않는다. 형식은 `.claude/commands/riper/plan.md` 를 따른다.
- BLK 좌표는 있으면 쓴다. 없으면 파일 경로만 적는다.
- 플랜 범위 밖 파일은 고치지 않는다. 범위 밖 문제는 보고만 한다.
- 대형 파일은 전문을 읽지 않는다. 좌표 주변만 읽는다. 규율 전문: [.claude/rules/retrieval-discipline.md](.claude/rules/retrieval-discipline.md)

## RULE-8: 출력 규약 (D4)
1. 답을 먼저 쓴다. 과정 서술은 줄인다.
2. 증거는 Review Pack(`plans/<slug>-review.md`) 링크로 건넨다. 긴 로그를 채팅에 붙이지 않는다.
3. 끝에 사람이 확인할 항목만 남긴다. 없으면 "없음".
4. **Auto-Clarity 예외**: 보안, 비가역 동작, 모호한 다단계, 반복 질문, 하드 블로커는 숨기지 않고 정상 출력한다.
- 토글: `/output-arm on|off` (상태 파일 `.claude/state/output-arm`, 기본 `on`). 규칙 전문: `.claude/skills/output-arm/`.
- 사후 게이트: Stop 훅 `output-arm-gate.sh`. REVIEW 상태인데 Review Pack 이 없으면 알린다.
- 금지: 헌법급 문서(CLAUDE.md·schema) LLM lossy 압축.

## RULE-9: 위임 (서브에이전트와 Workflow)
- 서브에이전트(`Agent`/`Task`)와 `Workflow` 는 게이트 `subagent-dispatch-gate.sh` 가 매번 승인을 묻는다. 기본 모드 `manual`. 토글: `/subagent-dispatch auto|manual|off`.
- 위임 단위는 사용자가 승인한 **세션 카드**다. 작업 하나에 카드 1장이 기본이다. 파일 집합이 겹치지 않을 때만 카드를 나눠 동시에 돌린다. 카드는 같은 폴더에서 돈다(`use_worktree: false`).
- 소형 작업은 메인이 직접 한다.

## RULE-10: 언어와 완료 보고
- 응답은 한국어. 메서드·클래스·코드 용어는 영어로 쓸 수 있다.
- 완료 보고에는 실행한 명령과 종료 코드, 바꾼 파일 목록, 사람 확인 항목을 적는다(RULE-8 과 같은 형식).

## Wiki Second Brain
원격 정본: `https://github.com/evespimrose/WIKI.git` (머신마다 클론 경로 상이 → 절대경로 하드코딩 금지, remote 추적으로 로컬 해석; `obsidian/`=노트·`raw/`=입력)
- 설계 결정 전 Atomic Note 조회
- 충돌 시 `[WIKI-CONFLICT]` 경고 + 중단
- 참조 시 파일명 인용

### 온디맨드 티어드 순회 (조회 규약)
위키는 `hot → index → domain → page` 순서로만 내려간다. **각 계층에서 답이 나오면 즉시 중단**(조기 종료)하고 다음 계층을 열지 않는다.
- `hot`: `.claude/state/hot.md` (세션 핫캐시 — 직전 세션 요약, 세션 시작 시 자동 주입됨)
- `index`: 볼트 인덱스/목차 노트
- `domain`: 해당 도메인 허브 노트
- `page`: 개별 Atomic Note 전문
- 위키와 무관한 작업이면 **어느 계층도 열지 않는다.**

근거: [[Sonar_Protocol]]·[[위키_기반_에이전트_맥락공유]]의 "탐색은 최소 조회로" 원리를 조회 대상이 아니라 소비 측(위키 읽기)에 적용한 규약이다. RULE-1이 코드 회수에 부과하는 제약과 같은 것을 지식 회수에 부과한다.

## 참고 문서 (세션 시작 때 싣지 않음)
메모리 아키텍처, 에이전트 라우팅(3-Tier Studio), Claude vs trae 비교는 `.claude/references/harness-notes.md` 에 있다. 필요할 때 Read 한다.

## 워크플로
```
[소형] codegraph → Edit/Write → 완료 보고
[중·대형] research → innovate → plan (수락 기준 포함) → G1 사람 승인 → execute 카드 → review (pack.py build) → G2 사람 확인
```
