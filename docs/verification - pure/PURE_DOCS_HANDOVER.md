# 순수 문서/Obsidian Vault 검증 워크플로우 Handover 문서

**날짜**: 2026-06-10  
**주제**: CodeGraph Markdown-AST 통합 기능 - 순수 문서 프로젝트 검증

---

## 📋 핸드오버 개요

이 문서는 CodeGraph Markdown-AST 통합 기능을 **순수 문서 프로젝트(Obsidian vault)**에서 검증하는 워크플로우를 관리자에게 전달하기 위해 작성되었습니다.

---

## 🎯 현재 상태

### 완료된 작업:
1. ✅ BLK → concept 노드 인덱싱 기반 구현
2. ✅ 문서 간 링크 추적 (Zettelkasten 링크)
3. ✅ recursive backlinks 기능 확장 (depth 파라미터)
4. ✅ concept 노드 검색 랭킹 보강
5. ✅ 문서 frontmatter 파싱 기반 구현

### 미완료된 작업:
1. ⏳ 순수 문서 프로젝트 실데이터 검증
2. ⏳ Tree-sitter Markdown 전환 여부 결정

---

## 📁 제공된 문서들

| 문서명 | 용도 | 위치 |
|-------|------|------|
| `PURE_DOCS_VERIFICATION_GUIDE.md` | 검증 절차 및 bash 명령어 가이드 | docs/verification/ |
| `PURE_DOCS_TEST_PROCEDURE.md` | 상세 테스트 케이스 및 성공 기준 | docs/verification/ |
| `PURE_DOCS_VERIFICATION_REPORT.md` | 검증 결과 보고서 양식 (빈칸 채우기용) | docs/verification/ |

---

## 🚀 검증 워크플로우

### 단계 1: 준비 (담당자: [이름 입력])
- [ ] CodeGraph 최신 버전 빌드
- [ ] 대상 문서 프로젝트(예: D:\Fork\BLADE) 준비
- [ ] 문서들을 대상 프로젝트 루트에 복사
- [ ] 환경 변수 `CODEGRAPH_DOCS=1` 설정

### 단계 2: 인덱싱 (담당자: [이름 입력])
- [ ] `codegraph index --with-docs` 실행
- [ ] 인덱싱 로그 확인
- [ ] concept 노드가 정상적으로 생성되었는지 확인
- [ ] 문서 간 링크가 정상적으로 추적되었는지 확인

### 단계 3: 테스트 실행 (담당자: [이름 입력])
- [ ] `PURE_DOCS_TEST_PROCEDURE.md`의 테스트 케이스 1~5 순서대로 실행
- [ ] 각 테스트 결과를 `PURE_DOCS_VERIFICATION_REPORT.md`에 기록
- [ ] 로그 첨부

### 단계 4: 보고서 작성 (담당자: [이름 입력])
- [ ] Tree-sitter Markdown 전환 여부 판단
- [ ] 발견된 이슈 기록
- [ ] 제안 사항 정리
- [ ] 최종 결론 작성

### 단계 5: 검토 및 의사결정 (담당자: [이름 입력])
- [ ] 보고서 검토
- [ ] Tree-sitter 전환 여부 최종 결정
- [ ] 다음 단계 계획 수립

---

## 🔍 중요한 체크포인트

### 1. 순수 문서 프로젝트 특성
- [ ] 코드 파일이 없고 Markdown 문서만 존재
- [ ] Obsidian vault로 사용될 수 있음
- [ ] Zettelkasten 링크(`[[...]]`)가 주요 링크 방식
- [ ] frontmatter(YAML/TOML) 사용 가능

### 2. MCP 툴 수정 확인
- [ ] `codegraph_backlinks`에 depth 파라미터가 있는지 (src/mcp/tools.ts)
- [ ] concept 노드 검색 랭킹이 보강되었는지 (src/search/query-utils.ts)
- [ ] 문서 간 링크 추적이 정상 작동하는지 (src/docs/parse.ts)

### 3. 검증 성공 기준
- [ ] 모든 테스트 케이스 통과
- [ ] concept 노드가 정상적으로 검색됨
- [ ] 문서 간 링크가 정상적으로 추적됨
- [ ] 재귀적 백링크 탐색이 정상 작동함

### 4. Tree-sitter 전환 의사결정
- [ ] 현재 regex 구현으로 충분한가?
- [ ] 향후 확장성이 필요한가?
- [ ] 유지보수성 측면에서 이점이 있는가?

---

## 📞 연락처 및 지원

- 기술 질문: [담당자 이름/연락처]
- 워크플로우 질문: [워크플로우 관리자 연락처]
- CodeGraph 리포지토리: https://github.com/[repo]/codegraph

---

## 📅 예상 일정

| 단계 | 예상 기간 | 담당자 |
|-----|---------|-------|
| 준비 | 0.5일 | |
| 인덱싱 | 0.5일 | |
| 테스트 실행 | 1일 | |
| 보고서 작성 | 0.5일 | |
| 검토 및 의사결정 | 0.5일 | |

**총 예상 기간**: 3일

---

## ✅ 핸드오버 확인

**전달자**: _________________________  
**날짜**: _______________

**수신자**: _________________________  
**날짜**: _______________
