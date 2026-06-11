# CodeGraph 아키텍처 분석 보고서

**작성일:** 2026-06-11  
**대상:** D:\Fork\BLADE (Project BLADE — 운명의 진흙탕 칼날)  
**분석 도구:** codegraph v0.9.8 MCP + SQLite 직접 쿼리

---

## 1. 전제 — 이 분석이 답하는 질문

사용자 질문:

> "concept로 감지된 2개 노드의 내용은? 옵시디언 그래프 뷰를 유지하면서 수많은 concept 노드를 가지고 `blade → 인물_강은휘 → 지명_낙양 → 디테일_하오문_향낭냄새` 같은 재귀 심층탐색을 하려면 양식을 어떻게 짜야 하나? codegraph를 바꿔야 하나, 양식을 바꿔야 하나?"

**분석 전 가정(사용자 측):**
- 2개 concept 노드 = 세계관 지식의 시작점
- concept 노드를 더 만들면 재귀 탐색이 가능해질 것
- 문서 양식 개선이 주요 과제

**분석 후 결론(요약):**
- 2개 concept 노드는 세계관과 무관한 **인덱서 false positive**
- concept 노드 경로는 **개념적 오류** — 이미 더 나은 그래프가 존재
- 재귀 탐색이 막힌 진짜 원인은 **비-ASCII 파일명 인덱싱 누락** (도구 버그)
- 양식 재설계보다 **도구 수정 또는 파일명 마이그레이션**이 선행 필수

---

## 2. 실증 — DB 직접 쿼리 결과

### 2.1 DB 스키마 두 개의 분리된 서브시스템

`codegraph index -f` 후 `codegraph.db`를 직접 열어 테이블별 행 수 집계:

| 서브시스템 | 테이블 | 행 수 | 담당 MCP 도구 |
|---|---|---|---|
| **코드 그래프** | `nodes` | **2** | `search`, `context`, `trace`, `callers`, `callees`, `explore`, … |
| | `edges` | **0** | |
| | `files` | **0** | |
| **문서 링크 그래프 (mdast)** | `mdast_metadata` | **15** | **`codegraph_backlinks` (이것 하나)** |
| | `mdast_vectors` | 15 (vec0 필요) | |

두 서브시스템은 **서로 연결돼 있지 않다.** 코드 그래프 도구(`search`, `files`, `context` 등)는 마크다운을 전혀 보지 않는다.

### 2.2 2개 concept 노드의 정체

```json
{"kind":"concept","name":"BLK-001","file":"docs/verification/PURE_DOCS_VERIFICATION_GUIDE.md:107"}
{"kind":"concept","name":"BLK-001","file":"docs/verification/PURE_DOCS_VERIFICATION_REPORT.md:170"}
```

`PURE_DOCS_VERIFICATION_GUIDE.md` 107행 내용:

```
# - [BLK: BLK-001]
```

이 줄은 BLK 태그 *지원 형식을 설명하는 예시 코드블록* 안에 있다.  
codegraph가 **검증 문서의 설명용 예시 문자열을 실제 태그로 오인**해 만든 노드다.  
**세계관 지식과 완전히 무관한 인덱서 노이즈.**

### 2.3 인덱싱된 15개 문서 vs 디스크의 ~40개

인덱스에 있는 15개:

```
character/Character.md        ← ASCII 허브
detail/Detail.md              ← ASCII 허브
power/Power.md                ← ASCII 허브
world/World.md                ← ASCII 허브
root/blade.md
root/AI-SYSTEM-PROTOCOL.md
root/NARRATIVE.md
root/OnBoarding.md
root/SYSTEM ARCHITECTURE.md
root/UNIVERSAL-NOVEL-MACHINE-WORKFLOW.md
docs/conv/conv1.md
docs/verification/PURE_DOCS_HANDOVER.md
docs/verification/PURE_DOCS_TEST_PROCEDURE.md
docs/verification/PURE_DOCS_VERIFICATION_GUIDE.md
docs/verification/PURE_DOCS_VERIFICATION_REPORT.md
```

인덱스에 **없는** ~25개 (전부 한글/한자 파일명):

```
character/인물_강은휘.md
character/인물_비화문_수장.md
character/인물_당가_히로인.md
world/지명_낙양(洛陽).md
world/지명_남만(南蠻).md
world/지명_북해(北海).md
world/지명_비화문_본산(秘花門).md
world/지명_사천(四川).md
world/지명_섬서(陜西).md
power/세력_비화문(秘花門).md
power/세력_사천당가(四川唐家).md
power/세력_구무림_구파일방(舊武林九派一帮).md
detail/디테일_*.md (11개)
root/비화문.md
```

**패턴: ASCII 파일명 → 100% 인덱싱 성공. 한글/한자 파일명 → 100% 누락.**

---

## 3. 원인 규명

### 3.1 비-ASCII 파일명 인덱싱 누락 (도구 버그)

**설정 파일 없음.** `codegraph.json`, `.codegraphignore` 모두 부재 — 사용자가 의도적으로 파일을 제외하지 않았다.  
**강제 재인덱싱 무효.** `codegraph index -f` 후에도 동일하게 15개.  
**디렉토리 자체는 스캔됨.** 각 폴더의 ASCII 허브(Character.md 등)는 인덱싱됨 — 폴더 전체를 skip하는 게 아니라 **파일명 단위로 필터링**.

진단: **codegraph v0.9.8 파일 스캐너의 유니코드 처리 버그** (NFC/NFD 불일치 또는 glob 패턴의 비-ASCII 필터링 실패로 추정).

### 3.2 링크 그래프 오염 (파싱 범위 과대)

`codegraph_backlinks root/blade.md`의 forward link 목록에 실제 존재하지 않는 파일 포함:

```
포맷.md, 문서명.md, 위키링크.md, 유형_이름.md,
인물_아삼.md, 무공_백골유엽도.md, 지명_낙양성.md, 세력_하오문.md ...
```

이들은 모두 `blade.md` 또는 `SYSTEM ARCHITECTURE.md` 안의 **코드블록/양식 예시 안에 적힌 `[[...]]` 문자열**이다. 파서가 코드블록을 구분하지 않고 전체 문서를 스캔해 발생.  
`unresolved_refs` 테이블 행 수: **0** — 깨진 링크 감지·경고 장치 없음.

### 3.3 토폴로지 모순

`SYSTEM ARCHITECTURE.md` Ⅳ.5절:
> "허브 문서는 자신의 하위 문서에만 링크해야 함. **다른 디렉토리의 문서에 직접 링크 금지.**"

그런데 `인물_강은휘.md`의 `related_links`:
```yaml
["[[지명_낙양(洛陽)]]", "[[세력_구무림_구파일방(舊武林九派一帮)]]", "[[디테일_누더기내공]]", ...]
```
인물 파일이 지명·세력·디테일을 직접 링크 → **규칙 위반**. 그리고 `blade.md`는 모든 도메인을 가로지르며 링크한다 — **마스터 문서가 자기 규칙을 위반**하고, 그 위반 덕분에 원하는 체인이 시작된다.

엄격한 허브 사일로 토폴로지와 풍부한 교차 도메인 재귀 탐색은 **동시에 가질 수 없다.** 어느 쪽을 원하는지 명문화하지 않으면 양식이 계속 모순 상태로 남는다.

### 3.4 concept 노드 경로 자체의 구조적 오류

codegraph의 `concept` 노드는 **문서(doc) ↔ 코드 심볼(code) 연결 앵커**다. concept끼리의 엣지(`edges` 테이블)는 생성되지 않는다. 모든 노트에 `[BLK: BLK-NNN]`을 도배해도:
- 이미 가진 `[[wikilink]]`와 기능 중복
- concept↔concept 엣지가 생기지 않으므로 재귀 탐색 불가
- 옵시디언 그래프에 의미 없는 ID 뿌림
- 코드 그래프 쪽 심볼이 없는 이 프로젝트에서는 **순손해**

---

## 4. 결과 — 현재 재귀 탐색은 1홉에서 죽는다

`codegraph_backlinks`는 `depth` 파라미터로 재귀를 지원한다(최대 5). 이론적으로 원하는 체인을 커버한다:

```
blade ──▶ 인물_강은휘 ──▶ 지명_낙양(洛陽) ──▶ 디테일_하오문_향낭냄새
```

그러나 `인물_강은휘.md`가 `mdast_metadata`에 **없다.** `blade.md`의 forward link 목록에 이름만 문자열로 뜰 뿐, 그 문서로 재귀 진입은 불가능하다.

```
blade ──✓──▶ "인물_강은휘" (문자열만)
                  └──✗ 문서가 인덱스에 없어 재귀 불가
```

**depth를 5로 올려도, 양식을 아무리 개선해도, 한글 파일이 인덱스에 없는 한 이 상태는 변하지 않는다.**

---

## 5. 권고 (실행 우선순위)

### ① [최우선] 비-ASCII 인덱싱 누락 진단 및 수정

먼저 확진 테스트:

```bash
# 인물_강은휘.md를 ASCII 이름으로 복사
cp character/인물_강은휘.md character/char_test.md
codegraph index -f
# char_test.md가 인덱싱되면 → 파일명 문제 확정
```

확정 시 선택지:

| 선택지 | 비용 | 방법 |
|---|---|---|
| **A. codegraph 업그레이드/이슈 리포트** | 낮음(단기) | v0.9.8 이슈 트래커에 유니코드 스캐너 버그 보고 |
| **B. 파일명 ASCII 슬러그화** | 중간 | `char_kang-eunhwi.md`, 한글 제목은 `title:` + 옵시디언 `aliases:`로 보존 |

**B를 선택할 경우** 옵시디언에서 Rename 시 링크 자동 업데이트 기능을 켜두면 기존 `[[인물_강은휘]]` 링크가 자동 수정된다. 그래프 뷰는 `Display Text` 기능으로 한글 표시 유지 가능.

### ② concept 노드 노선 폐기, 문서 링크 그래프로 통일

재귀 탐색 = `codegraph_backlinks <file> --depth N` 으로 충분히 커버된다.  
BLK false positive 2개는 `docs/verification/` 폴더를 인덱싱 대상에서 제외해 정리:

```json
// codegraph.json (프로젝트 루트에 생성)
{
  "exclude": ["docs/verification/**", "docs/conv/**"]
}
```

### ③ 토폴로지를 명문화 (모순 해소)

두 가지 선택지 중 하나를 고르고 문서에 반영:

**Option A: 교차 도메인 허용 (현재 실제 운용 방식)**
```
허브(MOC) 문서 → 자기 카테고리 리프만 링크
리프 문서 → 다른 도메인 리프 교차 링크 자유
blade.md → 모든 도메인 허용 (마스터 진입점 예외)
```

**Option B: 엄격한 허브 사일로 유지**
```
모든 교차 참조는 frontmatter related_links에만 기록,
본문 [[링크]]는 같은 카테고리 내로 제한
→ 단, 이 경우 재귀 탐색 깊이가 크게 제한됨
```

*권장: Option A를 명문화. 이미 그렇게 동작 중이고 의도와 부합.*

### ④ 링크 오염 차단

코드블록/예시 안의 위키링크 형식 텍스트를 인라인 코드로 감싸기:

```markdown
# 잘못된 방식 (파서가 진짜 링크로 읽음)
예시: [[인물_아삼]], [[지명_낙양성]]

# 올바른 방식
예시: `[[인물_아삼]]`, `[[지명_낙양성]]`
```

영향 파일: `blade.md`, `SYSTEM ARCHITECTURE.md`, `AI-SYSTEM-PROTOCOL.md` (각 설명 섹션)

### ⑤ 명명 키 정규화

현재 혼재하는 키들:

```
[[지명_낙양(洛陽)]]  ←  파일명
[[지명_낙양성]]       ←  본문 언급
[[지명_낙양_새로운거리]]  ←  예시에서 파생
```

규칙: **파일명 == 링크 텍스트** 하나만 정규 키. 한자 병기는 파일명에만 포함, 링크는 풀 파일명 사용. 동의어는 `search_aliases`에만.

### ⑥ RAG 검색 전략 — 깊은 재귀는 저작/감사용으로 한정

실제 소설 집필 시 컨텍스트 주입 흐름:

```
1차: sqlite-vec 의미 유사도 검색 (이미 15개 임베딩 존재)
     → "낙양 하오문 아삼 향낭 냄새" 질의 → 관련 문서 top-K 반환

2차: 반환된 문서에서 1~2홉 링크 확장 (codegraph_backlinks depth:2)
     → 직접 언급된 인물·세력·디테일만 추가
```

4홉 이상 재귀(`blade → 은휘 → 낙양 → 향낭냄새`)는 *프로젝트 감사*, *새 에디터 온보딩*, *설정 일관성 검증* 등 저작 지원 용도로 분리. 집필 RAG에 넣으면 느슨하게 관련된 문서가 다수 포함돼 **blade.md Ⅸ의 "토큰 절약" 목표와 정반대** 효과.

---

## 6. 요약

| 문제 | 원인 | 해결 위치 |
|---|---|---|
| 2개 concept 노드가 노이즈 | 검증 문서의 예시 문자열을 인덱서가 오인 | docs/verification 인덱스 제외 |
| 재귀 탐색이 1홉에서 끊김 | 한글/한자 파일명 인덱싱 누락 (v0.9.8 버그) | **도구 수정 또는 파일명 ASCII화** |
| concept 노드로 재귀 탐색 불가 | concept는 doc↔code 앵커, concept↔concept 엣지 없음 | concept 노드 노선 폐기 |
| 링크 그래프 오염 | 코드블록 안 예시 `[[...]]`까지 파싱 | 예시를 인라인 코드로 감싸기 |
| 토폴로지 규칙 모순 | 허브 사일로 규칙 vs 교차 도메인 링크 현실 | Option A 명문화 |
| 명명 키 불일치 | 낙양 vs 낙양성 vs 낙양(洛陽) 혼재 | 파일명 == 링크 텍스트 규칙 |

**핵심 한 줄:** 양식을 갈아엎을 필요 없다. 가진 `frontmatter + [[wikilink]]` 구조는 이미 올바른 형태다. `codegraph_backlinks`가 이미 재귀 탐색 원시연산이다. 막힌 건 한글 파일명을 읽지 못하는 인덱서 버그 하나다. 그것부터 고쳐야 나머지 논의가 의미를 가진다.

---

## 7. 확진 테스트 결과

**실행일:** 2026-06-11  
**절차:** `character/인물_강은휘.md`를 `character/char_test.md`로 복사 → `codegraph index -f` → DB 확인 → 테스트 파일 삭제

### 결과

| 파일명 | 인덱싱 여부 |
|---|---|
| `character/char_test.md` (ASCII, 동일 내용) | **✓ 인덱싱됨** |
| `character/인물_강은휘.md` (한글, 원본) | **✗ 누락** |

인덱싱 전후 문서 수: **15개 → 17개** (char_test.md + docs/codegraph-analysis.md 추가, 한글 파일 0개 진입)

### 확정 결론

**가설 확진: codegraph v0.9.8 파일 스캐너는 비-ASCII(한글/한자) 파일명을 인덱싱하지 못한다.**

- 내용이 완전히 동일한 파일이라도 파일명이 ASCII이면 진입, 한글이면 누락
- 디렉토리 스캔 자체는 정상 — 문제는 파일명 단위 필터
- 설정이나 양식의 문제가 아닌 **인덱서 스캐너 레벨 버그**로 확정

### 다음 단계

**즉시 선택해야 할 분기:**

```
A. codegraph 업그레이드 대기 또는 이슈 리포트
   → 단기 비용 낮음, 해결 시점 불확실
   → 그동안 한글 리프 노드 전체가 탐색 불가 상태 유지

B. 파일명 ASCII 슬러그 마이그레이션
   → 작업량 있음 (~25개 파일 rename + 링크 업데이트)
   → 옵시디언 "파일명 변경 시 링크 자동 업데이트" + aliases로 한글 표시 복구
   → 완료 즉시 재귀 탐색 가동
```

A와 B는 병행 가능하다. B를 먼저 실행해 즉시 탐색을 살리고, 추후 codegraph가 유니코드를 지원하면 ASCII 슬러그를 한글로 되돌리면 된다.
