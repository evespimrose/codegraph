---
name: skill-creator
description: Use when creating or modifying a skill in THIS project (.claude/.agents/.trae) — the local variant that ENFORCES the project standard header (Cave-Man Output Arm). Triggers — "스킬 만들어", "새 스킬", "skill 생성", "skill-creator", make/author/scaffold/edit a skill. 비-스킬 산출물(훅·커맨드·문서)·정량 eval·.skill 패키징엔 쓰지 말 것 — 후자는 글로벌 skill-creator.
---

<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->

# Skill Creator — 로컬 스킬 생성기 (Cave-Man Output Arm 규약 강제판)

글로벌 [`anthropic-skills:skill-creator`](C:/Users/JANGHYEONGTAEK/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/SKILL.md)를 벤치마크한 **로컬 적용판**. 작성 철학(progressive disclosure·description triggering·writing patterns)은 그대로 계승하되, 이 프로젝트의 규약을 강제한다.

## 글로벌 대비 차이 (왜 로컬판이 필요한가)

| 측면 | 글로벌 skill-creator | 로컬 skill-creater |
|------|---------------------|---------------------|
| **표준 헤더** | 없음 | **모든 생성 스킬에 `<!-- CAVE-MAN-OUTPUT-ARM -->` 블록 필수 삽입** |
| **테스트/eval** | 서브에이전트 with/baseline 병렬 + eval-viewer | **메인 직접** 실행(서브 금지 정책). 깊은 정량 eval이 필요하면 글로벌 스킬로 위임 |
| **탐색** | 자유 Read | **codegraph-first** (RULE-1 Sonar) |
| **출력** | 일반 서술 | **Output Arm**(끝에 `XX 완료`만, must-see는 `docs/output/`) |
| **생성 위치** | 임의/패키징 | `.claude/skills/<name>/` (또는 `.agents`/`.trae` 지정 시) |

## 🔒 불변 규칙 — 표준 헤더(compact 포인터) 삽입 (이 스킬의 존재 이유)

**새 SKILL.md를 쓰거나 기존 스킬을 수정할 때, frontmatter(`---...---`) 바로 다음에 아래 compact 포인터를 삽입한다.** 멱등: 이미 `<!-- CAVE-MAN-OUTPUT-ARM -->` 마커가 있으면 건드리지 않는다.

````markdown
<!-- CAVE-MAN-OUTPUT-ARM -->
> **출력 규약**(메인 직접·서술0·완료만·codegraph-first·서브에이전트 manual·Auto-Clarity 예외) — 전문: `output-arm` 스킬 · CLAUDE.md RULE-9.
<!-- /CAVE-MAN-OUTPUT-ARM -->
````

- **근거**: 규칙 전문은 `output-arm`(정의 문서) + CLAUDE.md RULE-9(하네스 always-injected)에 항상 존재 → 스킬마다 풀 블록 반복은 on-trigger 중복. 마커(게이트 grep용) + 1줄 포인터로 충분.
- **디스패치형 커맨드**(`riper/*`·`memory/*`)도 동일 compact 포인터 사용(메인 직접 실행 규정은 RULE-9·output-arm).
- 마커 `<!-- CAVE-MAN-OUTPUT-ARM -->`는 검증이 grep하므로 **반드시 보존**.

## 스킬 생성 워크플로

### 1. 의도 파악 (Capture Intent)
대화에 이미 워크플로가 있으면 거기서 추출(쓰인 도구·단계 순서·사용자 교정·입출력 형식). 부족하면 묻는다:
1. 이 스킬이 Claude가 무엇을 하게 하나?
2. 언제 트리거되나? (사용자 표현/맥락)
3. 기대 출력 형식은?
4. 검증 테스트가 필요한가? (객관적 출력=유익, 주관적 출력=불필요)

### 2. SKILL.md 작성
- **name**: 스킬 식별자(kebab-case). 디렉토리명과 일치.
- **description**: 트리거의 1차 메커니즘. "무엇을 하는가 + 언제 쓰는가"를 모두 담고, **약간 pushy하게**(Claude는 스킬을 under-trigger하는 경향). 한국어 트리거 어구 포함 권장.
- **frontmatter 다음 → 표준 헤더 블록(위 불변 규칙) 삽입.**
- **body**: imperative form. "왜 중요한지"를 설명(무거운 대문자 MUST 남발 금지 — 글로벌 철학).

### 3. (선택) 검증 — 메인 직접
객관적 출력 스킬이면 현실적 테스트 프롬프트 2~3개로 **메인이 직접** 스킬 절차를 따라 실행해 본다. 서브에이전트 병렬 eval·eval-viewer가 꼭 필요한 규모면 글로벌 skill-creator로 위임(사용자 발의).

### 4. 검증 게이트
- frontmatter 유효(`name`·`description` 존재)
- **`<!-- CAVE-MAN-OUTPUT-ARM -->` 마커 존재** (Grep으로 확인 — `.md`라 codegraph-gate 통과)
- SKILL.md < 500 lines(초과 시 `references/`로 계층 분리)

## 스킬 작성 가이드 (글로벌 계승·압축)

### Progressive Disclosure (3단 로딩)
1. **메타데이터**(name+description) — 항상 컨텍스트(~100단어)
2. **SKILL.md body** — 트리거 시 로드(<500 lines)
3. **번들 리소스**(`scripts/`·`references/`·`assets/`) — 필요 시만

### 디렉토리 구조
```
skill-name/
├── SKILL.md (필수: frontmatter + 표준 헤더 + 본문)
└── (선택) scripts/ · references/ · assets/
```
다중 도메인이면 변형별로 `references/{aws,gcp}.md` 분리, SKILL.md는 선택 로직만.

### 작성 패턴
- 출력 형식은 템플릿으로 명시. 예시(Input/Output)는 유용.
- "왜"를 설명 — 오늘의 LLM은 똑똑하다. 경직된 MUST/NEVER 남발은 yellow flag.
- 초안 → 새 눈으로 다시 보기 → 개선.

### description 트리거링 원리
스킬은 `available_skills`의 name+description으로 선택된다. 단순 1단계 작업은 스킬 없이도 처리되어 트리거 안 될 수 있음 → description은 **복합·다단계·전문** 작업을 겨냥. under-trigger 방지 위해 트리거 맥락을 풍부히.

## 금지

- ❌ 생성 스킬에 표준 헤더 누락 (이 스킬의 핵심 위반)
- ❌ 서브에이전트 디스패치로 eval/작업 수행 (메인 직접 — 예외 사용자 발의)
- ❌ codegraph 없이 소스 탐색 (Sonar Protocol)
- ❌ 헌법급 문서(CLAUDE.md·schema) lossy 압축 (RULE-9 Atom7)

## 더 깊은 기능이 필요하면

정량 benchmark·variance 분석·description 자동 최적화(`run_loop.py`)·`.skill` 패키징은 글로벌 스킬에 인프라가 있다 → [`anthropic-skills:skill-creator`](C:/Users/JANGHYEONGTAEK/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/SKILL.md) 사용(서브에이전트 사용은 사용자 발의 예외).

## 사용하지 말아야 할 때 (Negative Constraints)

- 스킬이 아닌 산출물(훅·슬래시 커맨드·일반 문서·설정) 작성 — 일반 파일은 직접 Edit/Write.
- 정량 benchmark·variance·`.skill` 패키징 — 글로벌 `anthropic-skills:skill-creator`로 위임.
- 1회성 단순 작업(재사용 불요) — 스킬화는 과설계.
