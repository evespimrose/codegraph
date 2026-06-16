# claude-personal-integrated-workflow 검증 보고서 — `.codegraphignore` 가산 제외 (코드+문서)

**프로젝트**: claude-personal-integrated-workflow (TypeScript + Astro 사이트 + Markdown)
**검증 일자**: 2026-06-15
**검증자**: Claude Code
**CodeGraph 버전**: 0.9.8.1 (전역 동기화, node:sqlite WAL + FTS5)
**대상 기능**: `.codegraphignore` **가산(additive) 제외** — git이 **추적(tracked)** 하는 경로를 그래프에서 차감
**검증 목표**: ① 기능 작동 · ② 적대적 검증(누출/앵커링/회귀) · ③ 기능개발 종결 성과

---

## 1. 개요 — RX_1과 상보적인 "반대 방향" 케이스

이 프로젝트는 RX_1과 **같은 코드+문서 하이브리드**지만 `.codegraphignore`의 **반대 방향**을 검증한다.

| | RX_1 | **claude-personal-integrated-workflow (본 보고서)** |
|---|------|------|
| `docs/` git 상태 | **git-ignored** | **git-tracked** (추적됨) |
| 사용 기능 | `.codegraphignore` 화이트리스트 + **`--no-gitignore`** | `.codegraphignore` **가산 제외** (플래그 불요) |
| 방향 | git이 **숨긴** 문서를 **포함** (re-include) | git이 **추적하는** 문서를 **차감** (subtract-more) |
| 의미 | 독립 스펙(합집합) | 가산 레이어(차집합) |

→ 두 프로젝트를 합치면 `.codegraphignore`의 **양방향(포함·차감) 의미론 전체**가 코드+문서에서 검증된다.
이 보고서는 **"git이 버전관리하는 `docs/`를, 코드그래프에서만 선언적으로 제외"** 하는 가산 제외를 다룬다.

### 실측 `.codegraphignore` (디스크 현재 내용 — 단순 제외, 화이트리스트 없음)
```gitignore
/docs/        # git-tracked 이지만 코드그래프에서 제외
/.vscode/
/.git/
/.vs/
**/[Ll]egacy/   **/[Dd]eprecated/   **/Old*/   **/Archive*/
node_modules/   dist/   .idea/   .vscode/
*.swp *.swo *~ .DS_Store Thumbs.db
/coverage/   .nyc_output/   .env*   *.log   *.tsbuildinfo   *.db-wal *.db-shm
.claude/settings.local.json      # ← .claude 전체가 아니라 특정 파일만
.claude/scheduled_tasks.lock
.parallels   .codegraph/   test_frameworks   test-languages/   nul   release/   .antigravitycli/
```

> ⚠️ **중요**: 실측 `.codegraphignore`에는 **`/.claude/`·`/.codex/`·`/.trae/`·`/.cursor/`·`/.obsidian/` 같은 에이전트 dotdir 통째 제외 규칙이 없다.**
> (이전 보고서 초안이 적었던 `/.claude/` … `/.cursor/` 블록은 **디스크 실파일과 불일치**였음 → 본 보고서에서 실측으로 교정.)
> `.claude/`는 위 두 개 파일(`settings.local.json`, `scheduled_tasks.lock`)만 제외된다. 이 차이가 T3 결과를 가른다(§4 T3).

---

## 2. 인덱스 현황 (실측 — `codegraph status` + DB 직접 조회)

| 지표 | 값 |
|------|------|
| Files (code) | **215** (typescript 196 · javascript 19) |
| Nodes (code) | 3,358 |
| Edges (code) | 9,282 |
| Markdown docs (mdast_metadata) | **30** |
| Concept 노드 | 2 |
| Governs 엣지 | 0 |
| DB 크기 | 9.39 MB |
| Backend | node:sqlite (full WAL) · Journal: wal |
| git 저장소 | ✅ · `docs/` = **tracked** (recursive 46 files) |

**Edge kind 분포**: `calls 3,548 · contains 3,143 · references 1,610 · imports 889 · instantiates 74 · implements 10 · extends 8`
**Node kind 분포**: `import 889 · function 807 · method 692 · constant 518 · file 215 · interface 111 · variable 52 · class 50 · type_alias 22 · property 2`

---

## 3. 테스트 결과 요약

| # | 분류 | 테스트 | 결과 | 핵심 증거 |
|---|------|--------|------|-----------|
| T1 | 기능 | **가산 제외** — git-tracked `docs/` 차감 | ✅ 통과 | `git ls-files docs/**` 46건 존재, 인덱스(md 30 + code 215)엔 `docs/` 0건 |
| T2 | 기능 | 앵커링 — 루트 `/docs/`만 제외 | ✅ 통과 | `site/src/content/docs/**` **18건 포함**, 루트 `docs/` 0건 |
| T3 | 기능 | dotdir 제외 | ⚠️ **부분 (1건 누출)** | `.claude/skills/visualize-graph/scripts/generate-graph.mjs` 1건 인덱싱됨 |
| T4 | 적대 | 코드 그래프 무회귀 | ✅ 통과 | 215 files · calls 3,548 · `query "indexAll"` 정상 해석 |
| A1 | 적대 | **docs 누출 0** + 동명파일 분리 | ✅ 통과 | root `CHANGELOG.md` 포함 / `docs/CHANGELOG.md` 제외, docs/∩index=0 |

**전체**: [ ] 🟢 5/5 [x] 🟡 **4/5 통과 + T3 부분 누출 1건** [ ] 🔴 실패

---

## 4. 상세 결과 + 증거

### T1 — 가산 제외 (git-tracked 문서 차감, **결정적**) — ✅
`docs/`는 git이 **추적**한다(무시 아님):
```
$ git rev-parse --is-inside-work-tree        → true
$ git check-ignore -v docs/work.md           → (출력 없음, exit=1 = NOT ignored)
$ git ls-files docs/*.md                      → docs/CHANGELOG.md, docs/ExternalHandOver.md,
                                                docs/InputArm_Rename_Inventory.md, docs/OnBoarding.md,
                                                docs/SEARCH_QUALITY_LOOP.md, docs/Workflow-Design-Philosophy.md, …
$ git ls-files "docs/**"  → 46건 (recursive)
```
git 빠른경로(`git ls-files`)만 탔다면 `docs/**`가 그래프에 포함됐어야 한다. 그러나 DB 직접 조회 결과
**markdown 30건·code 215건 어디에도 루트 `docs/` 경로가 0건**.
**판정**: `.codegraphignore`가 git이 추적하는 파일까지 그래프에서 차감(가산 제외)함을 증명. RX_1의
`--no-gitignore`(포함 방향)와 상보적인 **차감 방향** 의미론.

### T2 — 앵커링 정확성 (루트 `/docs/` vs 중첩 `docs/`) — ✅
인덱싱된 30 md 중 `site/src/content/docs/**` 가 **정확히 18건 포함** (DB 실측):
```
core-concepts/* (3) · getting-started/* (6) · guides/* (3) · reference/* (5) · troubleshooting.md (1)
```
**판정**: `/docs/`의 선행 슬래시 = 루트 앵커. 루트 `docs/`만 제외하고 중첩 `site/src/content/docs/`는
**오제외하지 않음**. 과대 제외 0.

### T3 — dotdir 제외 — ⚠️ **부분 통과 (1건 누출)**
DB의 `files`/`mdast_metadata` 전수 검사 결과:

| dotdir | 디스크 존재 | `.codegraphignore` 규칙 | 인덱스 누출 |
|--------|:---:|:---:|:---:|
| `.vscode/` | ✗ 없음 | ✅ `/​.vscode/` | 0 |
| `.vs/` | ✗ 없음 | ✅ `/​.vs/` | 0 |
| `.git/` | ✓ | ✅ `/​.git/` | 0 (추출 대상 코드 없음) |
| `.trae/` | ✓ | ✗ 규칙 없음 | 0 (추출 대상 코드 없음) |
| `.codex/` | ✓ | ✗ 규칙 없음 | 0 (추출 대상 코드 없음) |
| `.cursor/` | ✓ | ✗ 규칙 없음 | 0 (추출 대상 코드 없음) |
| `.obsidian/` | ✓ | ✗ 규칙 없음 | 0 (추출 대상 코드 없음) |
| **`.claude/`** | ✓ | ✗ **통째 규칙 없음** (특정 파일 2개만) | **1건 누출** |

**누출 파일**: `.claude/skills/visualize-graph/scripts/generate-graph.mjs` (javascript, code 215건에 포함됨)

**원인**: 실측 `.codegraphignore`에는 `/.claude/` 통째 제외 규칙이 없고 `settings.local.json`·`scheduled_tasks.lock`
두 파일만 제외한다. `.claude/` 하위 유일한 tree-sitter 추출 가능 코드 파일인 위 `.mjs`가 규칙에 안 걸려 인덱싱됨.
`.trae/.codex/.cursor/.obsidian`이 0건인 것은 **규칙 때문이 아니라 추출 가능한 코드 파일이 없어서**(md/json/sh만 존재)
발생한 우연적 0이다 → 동일 위치에 `.ts/.js/.mjs`가 생기면 똑같이 누출될 잠재 리스크.

**판정**: T3 성공 기준(`.claude/` 등 dotdir 하위 0건)을 **충족하지 못함**(1건). 단, 이는 가산 제외 *메커니즘*의 결함이
아니라 **`.codegraphignore`에 dotdir 규칙이 누락**된 결과 — 선언된 규칙(`/.vscode/ /.git/ /.vs/`)은 전부 정상 작동.
→ §6 권고대로 규칙 추가 시 즉시 해소.

### T4 — 코드 그래프 무회귀 — ✅
215 files (ts 196 · js 19) · 3,358 nodes · 9,282 edges. `calls 3,548 · references 1,610 · imports 889 · contains 3,143`
등 7종 코드 엣지 정상. 심볼 검색 회귀 없음:
```
$ codegraph query "indexAll"
  method indexAll  src/extraction/index.ts:624   (onProgress?, signal?, verbose?) => Promise<IndexResult>
  method indexAll  src/index.ts:341              (options: IndexOptions = {}) => Promise<IndexResult>
```
Markdown 제외 규칙이 코드(.ts) 그래프에 영향 없음.

### A1 — 누출 0 + 동명 파일 분리 (적대) — ✅
1. **docs 교집합**: `git ls-files "docs/**"`(46건) ∩ 인덱스 = **0** (markdown·code 양쪽 모두 루트 `docs/` 0건).
2. **동명 파일 분리** (루트본 vs `docs/`본):

| 파일명 | 루트(`/X.md`) | `docs/X.md` (git-tracked) |
|--------|:---:|:---:|
| CHANGELOG.md | ✅ 인덱싱됨 | ❌ 제외됨 |
| ExternalHandOver.md | ✅ 인덱싱됨 | ❌ 제외됨 |
| OnBoarding.md | ✅ 인덱싱됨 | ❌ 제외됨 |

**판정**: 동일 파일명이라도 경로 앵커로 정확히 분기 — 루트본 포함, `docs/`본 차감. git-tracked docs 누출 0.
(이 검증 문서 자신도 `docs/verification - workflow/`에 있어 인덱스에서 제외됨 → 자기참조 노이즈 0.)

---

## 5. 목표별 판정

### ① 기능 작동 — ✅ 달성 (핵심 기능)
가산 제외(git-tracked 차감)·루트 앵커링·코드 그래프 모두 정상. 선언된 ignore 규칙은 100% 의도대로 작동.

### ② 적대적 검증 — 🟡 대체로 통과 (T3 1건 예외)
- **docs 누출 0**: git이 추적하는 `docs/**`(46건)가 그래프에 전혀 침투하지 않음. ✅
- **앵커링 정확**: 루트 `/docs/`만 제외, `site/.../docs/**`(18) 포함(과대제외 0). ✅
- **동명 분리**: `CHANGELOG.md`/`ExternalHandOver.md`/`OnBoarding.md` 루트 포함·`docs/` 차감. ✅
- **코드 회귀 0**: 215 files 코드 그래프 무영향. ✅
- **dotdir 누출**: `.claude/…/generate-graph.mjs` **1건 누출** → 적대 기준 미충족(부분). ⚠️

### ③ 기능개발 종결 성과 — ✅ 달성 (조건부)
- 215 파일 규모 실제 코드+문서 프로젝트에서 `.codegraphignore` 한 파일로 그래프 스코프를 선언적 통제.
- RX_1(포함/`--no-gitignore`)과 본 프로젝트(차감/가산 제외)가 함께 `.codegraphignore` 양방향 의미론을
  코드+문서 환경에서 검증 → 범용성 입증.
- 단, **dotdir 완전 제외를 의도한다면** §6 권고(`/.claude/` 등 추가)가 선행되어야 "누출 0" 완결.

---

## 6. 발견된 이슈 / 한계 / 권고

1. **[결함 · T3] `.claude/` 코드 파일 1건 누출** — `.claude/skills/visualize-graph/scripts/generate-graph.mjs`가
   인덱싱됨. 원인: `.codegraphignore`에 `/.claude/` 통째 규칙 없음(특정 파일 2개만 제외).
   **권고**: dotdir 완전 제외가 목표라면 `.codegraphignore`에 아래 추가 후 `codegraph index -f` 재실행:
   ```gitignore
   /.claude/
   /.codex/
   /.trae/
   /.cursor/
   /.obsidian/
   ```
   (추가 시 code files 215 → 214, javascript 19 → 18로 줄며 누출 0 달성 예상.)
2. **[문서 정합성] 초안 `.codegraphignore` 블록이 디스크와 불일치** — 이전 보고서가 인용한 `/.claude/ … /.cursor/`
   블록은 실파일에 없었음. 본 보고서에서 실측 내용으로 교정. (이후 보고서는 디스크 실측만 인용 권고.)
3. **[정보] `.trae/.codex/.cursor/.obsidian` 0건은 규칙이 아니라 추출 대상 코드 부재 때문** — 우연적 0이므로
   해당 dir에 `.ts/.js`가 생기면 누출 가능. 1번 권고로 근본 차단됨.
4. **[정보] concept 2 / governs 0** — BLK 정본 컨벤션을 거의 안 써 concept이 적음. ignore 기능과 무관한 참고 지표.
5. **[정보] `--no-gitignore` 불요** — `docs/`가 tracked이므로 가산 제외만으로 충분. 플래그는 RX_1 케이스용.

---

## 7. 결론

**claude-personal-integrated-workflow — 4/5 통과 + T3 부분 누출 1건.**
`.codegraphignore`가 **git이 추적하는 `docs/`(46건)를 정확히 차감**(가산 제외)하고, 루트 앵커링(`site/.../docs/**`
18건 포함)·동명 파일 분리·코드 무회귀(215 files)를 입증. **선언된 모든 ignore 규칙은 의도대로 100% 작동**하며,
RX_1의 포함(`--no-gitignore`) 방향과 합쳐 `.codegraphignore` 양방향 의미론의 범용성을 확인.

유일한 미충족은 **T3 dotdir 제외**로, `.claude/` 하위 `.mjs` 1건이 인덱싱됐다. 이는 메커니즘 결함이 아니라
**`.codegraphignore`에 dotdir 통째 규칙이 누락**된 데서 비롯되며, §6-1 권고(`/.claude/` 등 5줄 추가) 한 번으로
해소된다. 권고 반영 시 **누출 0의 완전한 5/5**로 종결 가능 — 현 상태는 **핵심 기능 종결 + 1개 설정 보강 권고** 판정.

**검증자**: Claude Code · **일자**: 2026-06-15 · **버전**: codegraph 0.9.8.1
**핵심 결론**: git-tracked `docs/` 차감 ✅ / 루트 앵커링 정확(18) ✅ / 동명 파일 분리 ✅ / 코드 회귀 0 ✅ / **dotdir 1건 누출(.claude mjs) ⚠️ → ignore 규칙 추가 권고**
