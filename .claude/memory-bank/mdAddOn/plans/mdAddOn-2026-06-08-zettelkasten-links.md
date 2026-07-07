[MODE: PLAN]

# Zettelkasten 구조적 링크 탐색 (Obsidian Bridge) 플랜

## 1. 목적 및 범위
**목표**: `codegraph`의 기존 `mdAddOn`을 손상시키지 않고, Obsidian 방식의 문서 간 참조망(백링크, WikiLinks 등)을 추출하여 그래프 DB의 엣지(Edge) 형태로 저장하고 탐색할 수 있도록 지원하는 브릿지 기능 개발.

**성공 기준**:
- `parse.ts`가 `[[문서명]]` 및 `[텍스트](문서.md)` 형태의 링크를 정상적으로 추출할 것.
- `mdast_metadata` 테이블에 `doc_links` 컬럼이 추가되고 마이그레이션이 성공할 것.
- `indexer.ts`가 추출된 링크를 DB에 반영할 것.
- 새로운 MCP 도구(`codegraph_backlinks`)를 통해 특정 마크다운 문서의 앞/뒤(Forward/Backlink) 참조 관계를 조회할 수 있을 것.

**비목표 (Non-goals)**:
- 코드 `nodes` 테이블과 강제 통합 (기존 코드 분석 기능의 오염 방지를 위해 분리 유지).
- 옵시디언의 플러그인 전용 특수 구문 완벽 지원 (기본적인 링크만 우선 지원).

## 2. 세부 구현 단계 (Numbered Steps)

### Step 1: 스키마 및 마이그레이션 업데이트
1. `src/db/schema.sql`의 `mdast_metadata` 테이블에 `doc_links TEXT` 컬럼 추가.
2. `src/db/migrations.ts`에 버전을 6으로 상향하고, `ALTER TABLE mdast_metadata ADD COLUMN doc_links TEXT` 마이그레이션 로직 추가.

### Step 2: Markdown 파서 개선 (`src/docs/parse.ts`)
1. `ParsedDoc` 인터페이스에 `docLinks: string[] | null` 필드 추가.
2. 텍스트에서 구두점(punctuation)을 제거하기 **직전**에 정규식을 이용하여 다음의 링크 포맷 추출:
   - WikiLinks 포맷: `\[\[(.*?)\]\]`
   - Markdown 링크 포맷: `\[.*?\]\((.*?\.md)\)`
3. 추출된 경로의 확장자가 생략된 경우 `.md`를 붙이고, 상대경로를 정규화하여 `docLinks` 배열로 반환.

### Step 3: 인덱서 업데이트 (`src/docs/indexer.ts`)
1. `upMeta` SQL 구문 수정: `doc_links` 필드를 `INSERT` 및 `ON CONFLICT DO UPDATE SET` 절에 포함.
2. `parsed.docLinks`가 존재할 경우 `JSON.stringify(parsed.docLinks)`로 변환하여 DB에 저장, 없으면 `null` 처리.

### Step 4: 백링크 탐색 비즈니스 로직 추가 (`src/docs/search.ts`)
1. `findBacklinks(db: SqliteDatabase, filePath: string)` 함수 추가.
2. SQLite의 `LIKE '%"filepath"%'` 조건 및 `JSON.parse` 검증을 통해 타겟 `filePath`를 `doc_links`에 포함하고 있는 문서(Backlink) 조회.
3. 주어진 `filePath` 자체의 `doc_links`를 조회하여 대상 문서가 참조하는 문서(Forward Link) 반환.

### Step 5: 새로운 MCP 도구 등록 (`src/mcp/tools.ts`)
1. `tools` 배열에 `codegraph_backlinks` 추가.
   - 입력: `filePath: string` (대상 마크다운 문서 경로)
2. `ToolHandler`의 핸들러 부분에 `codegraph_backlinks` 호출 시 `findBacklinks`를 실행하고 결과를 포맷팅하여 반환하는 로직 추가. (Forward 링크와 Backlink 목록을 구분하여 제공)

## 3. Mandatory Save Checklist
- [x] Plan file saved to `.claude/memory-bank/mdAddOn/plans/` with correct naming
- [x] `.riper-state` updated with `MODE=PLAN` and `PLAN_FILE=<path>`
- [x] Plan contains numbered steps
- [x] Success criteria defined
- [x] Non-goals listed
- [x] `/memory:save` recommended to user (사용자에게 권고 예정)

> **사용자 권고 사항**: 이 플랜이 확정되고 구현이 완료된 후, 압축 보존을 위해 `/memory:save` 명령어 실행을 권장합니다.
