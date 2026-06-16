# Try — codecompressor BLK-보존 뼈대 압축 편입 타당성

> 작성일: 2026-06-16
> 대상 작업: Headroom의 codecompressor("LLM에 파일 넘기기 직전 뼈대만 남기고 다이어트")를 BLK는 무손실로 "뼈대"에 강제 포함시키도록 개조해 codegraph에 편입 — 로드맵 정합성 측정 + 사용자 낙관론("in/out 모두 압축저장하니 codecompressor는 보험일 뿐, 깎을 게 없다")에 대한 적대적 검증
> 탐색: codegraph_context/search/node + 보완 Read — Cave-Man 준수

---

## 0. 한 줄 결론 (먼저)

**개념(BLK 무손실 뼈대)은 로드맵 정합 / 구현 수단(Headroom codecompressor 편입)은 정합 위반.** codegraph는 이미 **더 우월한** 코드 스켈레톤화기(`adaptive-explore-sizing`, default-on)와 **코드 주석 BLK 보존기**(`extractBlkReferences`)를 갖고 있다. 사용자의 "깎을 게 없다"는 결론은 **맞지만 이유가 틀렸고, 그 틀린 이유가 곧 기각 근거**다.

---

## 1. 현황 (As-Is)

### 1-A. codegraph가 *이미* 가진 것 (정찰로 확인)

| 기능 | 위치 | 무엇을 하나 | codecompressor 대비 |
|---|---|---|---|
| **adaptive-explore-sizing** | `getExploreOutputBudget` tools.ts:150, `adaptiveExploreEnabled` tools.ts:264, 설계문서 `docs/design/adaptive-explore-sizing.md` | **"signatures only, bodies elided" 스켈레톤** 렌더. default-on(`CODEGRAPH_ADAPTIVE_EXPLORE=0`로만 해제) | **codecompressor++** : 플로우-인지·충분성-인지 |
| **코드 BLK 추출** | `extractBlkReferences` tree-sitter.ts:518 (`/\/\/\s*\[(BLK-[\w.-]+)\]/g`) | 모든 function/class/method 노드에서 `// [BLK-XXX]` → `governs` ref 생성 | BLK를 **본문이 아니라 엣지로 승격** → 본문이 깎여도 BLK는 그래프에 영속 |
| **마크다운 BLK** | `extractBlkTags` parse.ts:34, `linkGovernsEdges` governs-linker.ts:53 | line-2/frontmatter BLK → `concept` 노드 → `governs` 엣지(concept→code) | BLK가 1급 그래프 시민 |
| **구조적 다이어트 예산** | `getExploreOutputBudget` (per-file char cap, gapThreshold, excludeLowValueFiles, 리포 규모별 5티어) | 심볼 단위로 출력 트리밍 | 이미 "다이어트" 레이어 존재 |

**핵심**: codegraph의 스켈레톤화기는 **플로우 척추(spine)는 풀로 유지하고, off-spine 다형 형제(redundant sibling impl)만** 서명-only로 깎는다. 그리고 설계문서가 증언하듯 — **순진한(플로우-맹목) 스켈레톤화는 OkHttp/Django에서 회귀(읽기 되돌림)를 냈고**, 명명-callable spare·supertype override·uniqueness-aware spare·per-symbol focused view 등 **여러 충분성 가드를 더해서야** "grep보다 비쌈 → ~14–17% 쌈, median 0 reads"로 전환됐다.

### 1-B. Headroom codecompressor + 사용자 개조안

- Headroom codecompressor: ContentRouter가 타입=code로 라우팅 → AST로 서명/구조만 남기고 본문·주석 제거 (LLM에 넘기기 직전, **읽기 경로 프록시**, Rust/Python).
- 사용자 개조: 깎되 `// [BLK-XXX]`는 반드시 뼈대에 잔존.
- 사용자 전제: 로드맵이 in(doc-context)/out(conclusion)을 이미 압축·구조화 저장 → codecompressor는 "보험", 깎을 게 적음.

### 1-C. 현황의 핵심 문제 (사용자 전제의 균열)

사용자 전제는 **두 개의 서로 다른 압축 대상을 같은 축으로 합산**한다 → §3에서 해부.

---

## 2. 제안 구조 (To-Be) — 두 해석으로 분리

| | **해석 A: Headroom codecompressor 편입** | **해석 B: 기존 스켈레톤화기에 BLK-보존 불변식 추가** |
|---|---|---|
| 무엇 | Rust/Python 코드 압축기를 읽기 경로에 + BLK 보존 패치 | adaptive-explore-sizing이 본문 elide 시 `// [BLK-XXX]` 라인은 **절대 제거 금지** 불변식 1개 + 테스트 |
| 위치 | LLM 앞단 프록시 (Read 가로채기) | `src/mcp/tools.ts` 스켈레톤 렌더부 (이미 존재) |
| 신규 의존성 | Rust 빌드 + ML | 없음 |
| 비용 | HIGH | LOW |
| 로드맵 정합 | ✗ (중복·손실·레이어 오류) | ✓ (기존 메커니즘 경화) |

---

## 3. 적대적 검증 — 사용자 낙관론 해부 (핵심)

**반론 1 — 레이어/카테고리 혼동(전제 오류).**
로드맵 in/out 압축(§2.3·§8)은 **대화 산출물의 *저장***(doc-context 입력, conclusion 출력 → markdown + codegraph 노드)이다. codecompressor는 **소스 코드 파일을 *읽는 시점*에 압축**한다 — 다른 데이터, 다른 파이프라인 지점. 로드맵은 "읽히는 소스"를 압축하지 않는다. 그 일은 **codegraph의 구조적 검색이 읽기 자체를 *대체*함으로써** 푼다. "in/out 둘 다 압축하니까"는 codecompressor의 표적을 **커버하지 않는다**.

**반론 2 — 결론은 맞으나 이유가 기각 근거.**
"깎을 게 적다"는 맞다. 단 이유는 "저장 압축" 때문이 아니라 **codegraph가 이미 (a) 읽기-대체 경로에서 코드를 서명-only로 스켈레톤화하고 (b) BLK를 엣지로 승격**하기 때문. 즉 BLK-보존 codecompressor는 codegraph가 *더 잘* 하는 일을 하는 **두 번째 스켈레톤화기** = 중복.

**반론 3 — "보험" 프레이밍의 딜레마.**
- 적게 깎으면(낙관) → 가치 낮음 → 편입(프록시·손실·유지비) 정당화 불가.
- 많이 깎으면 → 에이전트가 **풀 파일을 Read 중**이라는 뜻 → 그게 바로 codegraph가 막으려는 실패. 해법은 codegraph 검색(trace/explore/node) 강화이지 읽기 경로 압축기가 아님.
- 어느 가지든 결론: **codecompressor는 잘못된 레버.** "위험이 이미 커버된 곳에 드는 보험" = 무료 안전망이 아니라 사중(死重).

**반론 4 — 플로우-맹목 스켈레톤화는 중립이 아니라 *음(−)*. (codegraph 자체 데이터가 증명)**
`adaptive-explore-sizing.md`: 첫 순진 컷이 OkHttp `RealCall`·Django `compiler.py`를 깎았다가 **에이전트가 Read 되돌림 → 더 비쌈**. Headroom codecompressor는 **플로우-맹목**(어느 파일이 척추인지 모름)이라 정확히 이 **원본 회귀를 재현** — 에이전트가 실제 필요한 파일을 깎아 Read-back 유발. CLAUDE.md "부분 커버리지는 무(無)보다 나쁘다"의 압축판. **사중이 아니라 순손실.**

**반론 5 — BLK 보존은 필요하나 이미 해결됐고, codecompressor는 해결처가 틀림.**
사용자 직관("BLK는 절대 유실 금지")은 옳고 §3.1 공간맵핑과 정합. 그러나 (a) `extractBlkReferences`가 코드 주석 BLK를 governs 엣지로 이미 승격 → 본문이 깎여도 BLK는 **독립 영속**. (b) 만에 하나 미래 스켈레톤 뷰가 BLK 주석을 elide하면, 고칠 곳은 **codegraph 자기 스켈레톤화기의 한 줄 가드**이지 Headroom 압축기 도입이 아니다(= 해석 B).

**반론 6 — 로드맵 §4·§7·§8 정면 위반.**
§4 candor + §8.3 무결성 훅 = 0% 손실 요구. 손실성 코드 압축기를 읽기 경로에 두는 건 §4가 경고한 "노이즈/손실 → 인덱스 오염 → 환각" 그 자체. §7 초미세토큰: 설계문서가 순진 스켈레톤화의 **토큰 증가**(read-back)를 실측 — §7 목표의 역행.

---

## 4. 5축 비교 (해석 A 편입 vs 해석 B 불변식)

| 축 | A: codecompressor 편입 | B: BLK-보존 불변식 |
|---|---|---|
| **아키텍처 명확성** | 두 스켈레톤화기 공존 → 권위 모호(Rust 프록시 vs TS explore 중 무엇이 도나). 읽기 경로 가로채기는 codegraph가 안 하는 일(레이어 침범) | 단일 메커니즘 내부 경화. 경계 깨끗 |
| **컴파일·빌드 영향** | Rust 빌드 + ML 런타임 + 언어별 서명 로직(extractor 중복) 신규 | tools.ts 렌더부 수 줄 + 테스트 1개, 신규 의존성 0 |
| **장기 유지보수** | tree-sitter 문법 변화에 **두 곳** 동기화. codecompressor 자체 per-lang 유지 | 1개 사이트, adaptive-explore 테스트군에 흡수 |
| **단기 비용** | HIGH — 프록시 배선 + "Read를 어디서 가로채나"(codegraph는 Read 훅 없음 → 하네스 필요) | LOW — elide 시 BLK 라인 retain 가드 + 테스트 |
| **현재 작업 연관성** | 낮음/역행 — default-on 스켈레톤화기와 충돌, 회귀 재현 위험 | 높음 — 이미 켜진 기능의 무손실 보강. DLC/P0 레이어에 자연 편입 |

---

## 5. 파이프라인 레이어·방향 위험 (순환의존 대체 분석)

- **읽기-가로채기 = 하네스 책임, codegraph 책임 아님.** codegraph는 에이전트의 Read 도구를 가로채지 않는다 — 검색으로 *대체*할 뿐. codecompressor를 codegraph에 넣으려면 "파일이 LLM에 가기 직전"을 잡아야 하는데 그 지점은 codegraph 통제면 밖(= 이전 Try 문서 결론과 동일: 압축 프록시는 `claude-personal-integrated-workflow`).
- **방향 위험**: codegraph(인덱스, 무손실·결정론) ← 손실성 압축기를 역류 주입 = 단일책임 파괴 + 전역 sync-global 배포본을 손실 컴포넌트로 오염.
- 해석 B는 이 방향 위험이 없음 — codegraph의 *출력 렌더*는 codegraph 책임이고, BLK retain은 무손실 방향(덜 깎음).

---

## 6. 로드맵 정합성 측정 (요구된 측정)

| 로드맵 항 | BLK 무손실 뼈대 *개념* | Headroom codecompressor *편입* |
|---|---|---|
| §3.1 공간맵핑(BLK=좌표계) | ✓ 강 정합 | △ BLK 보존하나 codegraph가 이미 함 |
| §2.3 0-유실 / 환각 0 | ✓ | ✗ 손실성 압축 = 환각 표면 |
| §7 초미세토큰 | ✓ | ✗ 플로우-맹목 시 토큰 증가(실측) |
| §4 candor / §8.3 무결성 훅 | ✓ | ✗ 무결성 역행 |
| 정합 판정 | **부합** | **불합** |

→ **"개념은 부합, 수단(codecompressor)은 불합."** 로드맵-정합 실체화는 해석 B(기존 스켈레톤화기 BLK 무손실 경화)다.

---

## 7. 종합 평가 및 추천

- **해석 A(Headroom codecompressor 편입, BLK 보존이든 아니든): 반대.** 중복(adaptive-explore-sizing이 우월·플로우인지), 회귀 재현 위험(플로우-맹목), 손실 환각 리스크, 레이어 오류(읽기-가로채기=하네스). 사용자 낙관("보험")은 절반만 맞고, 맞는 이유(이미 codegraph가 함)가 곧 기각 사유.
- **해석 B(권장, 조건부): 기존 `adaptive-explore-sizing`에 "본문 elide 시 `// [BLK-XXX]` 라인 절대 제거 금지" 불변식 + 테스트.** LOW 비용, 로드맵 정합, 무손실 방향. 단 — **먼저 실측 1회**: 현 스켈레톤화기가 BLK 주석을 실제로 깎는지(척추 파일은 풀 유지하므로 안 깎을 가능성 큼). 안 깎으면 B조차 **불필요**(테스트만 회귀 가드로 추가).
- **착수 순서(B 진행 시)**: ① 프로브 — BLK 주석 포함 메서드를 강제로 sibling-skeletonize시켜 `// [BLK-XXX]`가 출력에 남는지 확인 → ② 남으면 회귀-가드 테스트만, 사라지면 retain 가드 + 테스트 → ③ adaptive-explore-sizing.md에 "BLK-retention 불변식" 1절.

## 8. 미결 사항 연계

- 이 결론은 이전 [docs/Try_AtomImport_DLC_vs_Workflow.md](Try_AtomImport_DLC_vs_Workflow.md)의 "압축 프록시는 워크플로우 프로젝트" 판정과 일관(Headroom HR1/HR2 P3-보류, HR5/HR6 워크플로우).
- 사용자가 진짜로 원하는 게 "대형 파일 읽기 시 다이어트"라면, 그건 codecompressor가 아니라 **codegraph 검색 채택률↑**(trace/explore/node로 Read 회피)이 정답 — 별도 측정 가능.
- B 착수는 별도 결재 후 producer 경유. 본 문서는 분석만.

---

## 9. 프로브 결과 (2026-06-16) — 실측

Throwaway 프로브로 adaptive-explore 스켈레톤화기에 BLK 주석 3위치(클래스 위·메서드 위·본문 내)를 넣고 off-spine sibling을 강제 skeletonize시켜 출력 잔존을 측정(실행 후 삭제).

**결과: 3위치 모두 유실(false).** 스켈레톤화기는 노드의 **선언 라인만** 라인번호로 슬라이스:

```
#### src/bridge-interceptor.ts — BridgeInterceptor, intercept · skeleton (signatures only — codegraph_explore a name for its full body; do NOT Read)

  4	export class BridgeInterceptor implements Interceptor {
  6	intercept(request: string): string {
```

- `skeletonized: true`, `body content elided (BRIDGE_BODY_MARKER absent): true`
- `[BLK-ABOVE-CLASS] survived: false` · `[BLK-ABOVE-METHOD] survived: false` · `[BLK-IN-BODY] survived: false`
- 라인 4(클래스 선언)·6(메서드 시그니처)만 보존, 라인 3·5(BLK 주석)와 본문 전부 제거.

**판정 갱신**:
- §7의 "안 깎으면 B 불필요" 가설 **기각** — 스켈레톤화는 BLK 주석을 **무조건 제거**한다(주석 인지 로직 없음). 단 **off-spine sibling 스켈레톤에 한정**(척추·비-sibling·named-spared 파일은 풀 유지 → BLK 잔존).
- **그러나 실질 손실은 작다**: BLK는 인덱스 시 `extractBlkReferences`가 `governs` 엣지로 **이미 승격** → 스켈레톤이 주석 텍스트를 빼도 BLK→code 매핑은 그래프에 영속. 잃는 건 "스켈레톤 *소스 출력*에 BLK 텍스트가 안 보임"뿐.
- **권장 실현(해석 B, 갱신)**: 주석 라인을 본문에서 되살리지 말고(서명-only 형태 훼손) — **스켈레톤 헤더에 그 노드의 governing BLK 태그를 그래프(governs 엣지)에서 끌어와 append.** 예: `#### …BridgeInterceptor, intercept · skeleton · governs: BLK-ABOVE-CLASS, …`. 텍스트가 아니라 엣지 기반 → 더 견고하고 "BLK는 주석이 아니라 엣지" 철학과 정합. **LOW 비용, 무손실 방향.**
- codecompressor 편입 반대 결론은 불변(§3·§7). 프로브는 "해석 B의 그 한 줄짜리 보강이 근거 있음"을 확정했을 뿐, codecompressor를 정당화하지 않는다.
