# PLAN: 비-ASCII 파일명 인덱싱 누락 버그 수정

**Branch:** Obsidian-Graph-Vector-DB  
**Date:** 2026-06-11  
**Status:** PLAN

---

## 문제 분석

### 근본 원인

`src/extraction/index.ts`의 `collectGitFiles` 함수(line 205)에서 `git ls-files`를 호출할 때, git의 기본 설정 `core.quotePath=true`가 비-ASCII 파일명을 octal escape 시퀀스로 인코딩한다.

예시:
```
인물_강은휘.md  →  git이 "\354\235\270\353\254\274_\352\260\225\354\235\200\355\234\230.md" 로 출력
```

Node.js가 이 출력을 `encoding: 'utf-8'`으로 받으면 literal 백슬래시+숫자 문자열이 된다. 이후 `isSourceFile()` 검사나 DB 저장 시 실제 파일 시스템 경로와 불일치 → 인덱싱 실패.

### 영향 범위 (codegraph_node 확인 결과)

- **`collectGitFiles`** `src/extraction/index.ts:205` — 직접 수정 대상
  - `git ls-files -c --recurse-submodules` (tracked 파일)
  - `git ls-files -o --exclude-standard` (untracked 파일)
- **`scanDirectoryWalk`** `src/extraction/index.ts:400` — `fs.readdirSync` 기반, Unicode 파일명 정상 처리. 수정 불필요.
- **`isSourceFile`** `src/extraction/grammars.ts:112` — 확장자 기반 필터, 수정 불필요.

### 수정 전략

`git -c core.quotePath=false ls-files ...` 로 호출하면 비-ASCII 파일명이 raw UTF-8 그대로 출력된다. Node.js의 `encoding: 'utf-8'`과 결합하면 올바른 Unicode 문자열을 얻는다. 이 접근이 가장 단순하고 모든 git 버전에서 동작한다.

---

## 구현 스텝

### Step 1: `collectGitFiles` — tracked 파일 git 명령에 `-c core.quotePath=false` 추가

**Symbol:** `collectGitFiles`  
**File:** `src/extraction/index.ts`  
**Scope:** Lines 213 (tracked execFileSync 호출)  
**BLK target:** [인프라 - 파일 스캐너]  
**Action:** replace

```typescript
// Before (line 213):
const tracked = execFileSync('git', ['ls-files', '-c', '--recurse-submodules'], gitOpts);

// After:
const tracked = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-c', '--recurse-submodules'], gitOpts);
```

**Success criterion:** `git ls-files` 출력에 한글 파일명이 octal escape 없이 그대로 포함됨.

---

### Step 2: `collectGitFiles` — untracked 파일 git 명령에 `-c core.quotePath=false` 추가

**Symbol:** `collectGitFiles`  
**File:** `src/extraction/index.ts`  
**Scope:** Lines 224 (untracked execFileSync 호출)  
**BLK target:** [인프라 - 파일 스캐너]  
**Action:** replace

```typescript
// Before (line 224):
const untracked = execFileSync('git', ['ls-files', '-o', '--exclude-standard'], gitOpts);

// After:
const untracked = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-o', '--exclude-standard'], gitOpts);
```

**Success criterion:** untracked 한글 파일도 escape 없이 경로 집합에 추가됨.

---

### Step 3: `getChangedFiles`에서 git diff 명령 확인 및 동일 패치 적용

**File:** `src/extraction/index.ts`  
**Scope:** Lines 1470+ (`getChangedFiles` 함수)  
**BLK target:** [인프라 - 파일 스캐너]  
**Action:** inspect → replace if needed

`getChangedFiles`도 `git diff` 또는 `git status` 계열 명령을 사용할 경우 동일한 quotePath 문제가 발생한다. 해당 함수를 확인하여 `git` 명령 호출 시 동일하게 `-c core.quotePath=false`를 추가한다.

**Success criterion:** 파일 변경 감지(sync) 시에도 한글 파일명이 올바르게 반영됨.

---

### Step 4: 테스트 추가 — `__tests__/extraction.test.ts`

**File:** `__tests__/extraction.test.ts`  
**BLK target:** [테스트]  
**Action:** append

비-ASCII 파일명을 포함한 임시 디렉토리를 생성하고 `scanDirectory`가 해당 파일을 반환하는지 검증하는 테스트를 추가한다.

```typescript
describe('non-ASCII filenames', () => {
  it('indexes files with Korean filenames in a git repo', async () => {
    // 1. fs.mkdtempSync으로 임시 디렉토리 생성
    // 2. git init
    // 3. 한글 파일명 생성: '인물_강은휘.ts', '지명_낙양.md'
    // 4. git add + git commit
    // 5. scanDirectory(tmpDir) 결과에 해당 파일이 포함되는지 assert
    // 6. afterEach에서 임시 디렉토리 삭제
  });

  it('indexes Korean files via filesystem walk (non-git project)', () => {
    // git 없는 디렉토리에서 scanDirectoryWalk 동작 검증
  });
});
```

**Success criterion:** `npm test` 실행 시 새 테스트 통과.

---

### Step 5: CHANGELOG.md `[Unreleased]` 섹션에 항목 추가

**File:** `CHANGELOG.md`  
**BLK target:** [문서]  
**Action:** insert (Unreleased 섹션 상단)

```markdown
### Fixes

- File names containing non-ASCII characters (Korean, Chinese, Japanese, etc.) are now indexed correctly in git-tracked projects.
```

**Success criterion:** CHANGELOG `[Unreleased]` 하위에 해당 항목 존재.

---

## Non-Goals (스코프 제외)

- `scanDirectoryWalk` 수정 — `fs.readdirSync`는 Unicode를 이미 올바르게 처리함
- `isSourceFile` 수정 — 확장자 기반, 파일명 Unicode와 무관
- NFC/NFD 정규화 추가 — git 출력 자체가 올바른 UTF-8이면 불필요; 정규화는 별도 이슈
- Windows 경로 구분자(`\`) 처리 — `normalizePath`가 이미 담당
- docs 서브시스템(`mdast_metadata`) 수정 — 별도 코드 경로, 이번 스코프 아님

---

## 성공 기준

1. `codegraph index -f` 후 한글/한자 파일명 파일이 `mdast_metadata` 또는 `nodes` 테이블에 정상 등록됨
2. `npm test` 전체 통과 (기존 테스트 회귀 없음)
3. Step 4의 새 테스트 통과

---

## 검증 절차 (EXECUTE 완료 후)

```bash
# 1. 빌드
npm run build

# 2. BLADE 프로젝트에서 확인
cd D:/Fork/BLADE
npx @evespimrose/codegraph index -f
# → "인물_강은휘.md" 등이 인덱싱 결과에 포함되는지 확인

# 3. 테스트
cd D:/Fork/codegraph
npm test
```
