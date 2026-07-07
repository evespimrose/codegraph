# claude-personal-integrated-workflow 검증 Handover 문서 — `.codegraphignore` 가산 제외

**날짜**: 2026-06-15
**주제**: 코드+Markdown 하이브리드 프로젝트에서 `.codegraphignore` 가산 제외(git-tracked 차감) 검증

---

## 📋 핸드오버 개요

이 문서는 claude-personal-integrated-workflow(TypeScript + Astro + Markdown)에서
**`.codegraphignore` 가산 제외** — git이 추적하는 경로를 그래프에서 차감 — 검증 워크플로우를 전달한다.
RX_1(포함/`--no-gitignore`)과 **상보적인 차감 방향** 케이스로, 둘을 합치면 코드+문서에서
`.codegraphignore` **양방향 의미론(포함·차감)** 이 범용 검증된다.

---

## 🎯 현재 상태

### 완료된 작업
1. ✅ `.codegraphignore` 가산 제외 — git-tracked `docs/` 를 그래프에서 차감
2. ✅ 루트 앵커링 — 루트 `/docs/` 만 제외, `site/.../docs/**` 는 포함
3. ✅ dotdir 제외 (.claude/.trae/.codex/.cursor/.obsidian/.vscode)
4. ✅ 코드 그래프 215 files 무회귀
5. ✅ 검증 수행 — **5/5 통과** (본 폴더 REPORT 참조)

### 미완료/후속
1. ⏳ watcher 실시간 반영(문서 추가/삭제 시 ignore 재적용) 장기 관찰
2. ⏳ 필요 시 RX_1식 화이트리스트 도입 검토 (현재는 단순 제외로 충분)

---

## 📁 제공된 문서

| 문서 | 용도 |
|------|------|
| `WORKFLOW_VERIFICATION_GUIDE.md` | 검증 절차·명령어 가이드 |
| `WORKFLOW_TEST_PROCEDURE.md` | 상세 테스트 케이스·성공 기준 |
| `WORKFLOW_VERIFICATION_REPORT.md` | 검증 결과 보고서 (실데이터 기입 완료) |

> 참고: RX_1(포함 방향)은 `docs/verification - RX_1/`, 순수 Markdown(WIKI·BLADE)은
> `docs/verification - pure/` 에 별도 세트로 존재. 본 세트는 **차감 방향(가산 제외)** 전담.

---

## 🚀 검증 워크플로우

### 단계 1: 준비
- [x] CodeGraph 0.9.8.x 전역 동기화
- [x] `.codegraphignore`(`/docs/` 등) 배치
- [x] `docs/`가 git-tracked 임을 확인 (ignored 아님)

### 단계 2: 인덱싱
- [x] `codegraph index -f` (가산 제외만으로 충분, `--no-gitignore` 불요)

### 단계 3: 테스트 실행
- [x] T1~T4 + A1 (REPORT 표 참조)
- [x] `git ls-files docs/*.md` vs 인덱스 목록 교집합 0 확인

### 단계 4: 보고서 작성
- [x] 가산 제외/앵커링/동명분리/회귀 판정
- [x] 세 목표(기능·적대·완결성) 결론

### 단계 5: 검토 및 의사결정
- [ ] 기능 종결 승인 (사용자)
- [ ] RX_1과 합산한 양방향 범용성 최종 확인

---

## 🔍 중요 체크포인트

### 1. 기능 동작 확인
- [x] 가산 제외 (git-tracked docs/ 차감) — src/extraction/index.ts
- [x] 루트 앵커링 (`/docs/` vs `site/.../docs/`)
- [x] 4경로(git/walk/watcher/docs) 일관 적용

### 2. 적대적 검증 기준
- [x] 누출 0 (git-tracked docs/ 미등장)
- [x] 과대제외 0 (site/.../docs/** 포함)
- [x] 동명 파일 분리 (root vs docs/)
- [x] 코드 회귀 0

### 3. 종결 의사결정
- [x] 세 목표 충족 + RX_1과 양방향 범용성 → **기능 개발 종결 가능** 판정

---

## 📅 요약

| 항목 | 결과 |
|------|------|
| 검증 케이스 | 5/5 통과 |
| 가산 제외(차감) 증명 | ✅ (git-tracked docs/ 차감됨) |
| 앵커링 | ✅ (루트 제외, site docs 포함) |
| 코드 회귀 | 0건 |
| 종결 판정 | ✅ 가능 |

---

## ✅ 핸드오버 확인
**전달자**: Claude Code · **날짜**: 2026-06-15
**수신자**: _________________________ · **날짜**: _______________
