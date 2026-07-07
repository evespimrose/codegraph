/compile-wiki D:\Unity\WIKI\raw\caveman_입국심사.md : atom 1, 2, 3, 4, 5, 6 only.

I'll compile atoms 1–6 from caveman_입국심사.md into the obsidian vault. First, let me check the CodeGraph index freshness and load the note inventory (per the skill, I query the index rather than scanning the vault).


실행됨 명령 2개
실행됨
Check CodeGraph DB freshness
Bash
codegraph status -j -p "D:\Unity\WIKI"
Exit code 1
error: unknown option '-p'
실행됨
List all obsidian doc nodes from index
CodeGraph index is current (the inventory loaded). Note: Cave_Man_Protocol still exists as the canonical node — the Sonar rename is still pending in the vault SSOT, so I'll link to the actual existing node. Let me query for each atom concept to find link targets and detect any duplicates/conflicts.


실행됨 명령 6개
실행됨
Check CodeGraph DB freshness (no -p flag)
Bash
codegraph status -j
{"initialized":true,"projectPath":"D:\\Unity\\WIKI","fileCount":0,"nodeCount":146,"edgeCount":666,"dbSizeBytes":2379776,"backend":"node-sqlite","journalMode":"wal","docsIndexed":146,"nodesByKind":{"doc":146},"languages":[],"pendingChanges":{"added":0,"modified":0,"removed":0},"worktreeMismatch":null}
(node:36304) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
실행됨
Query: subagent output compression
실행됨
Query: compression safety boundary
실행됨
Query: deterministic validation gate
실행됨
Query: output expression compression
Bash
codegraph query "출력 표현 압축 토큰 절감 caveman" -j -l 8
[]
(node:31664) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
실행됨
Query: external API transmission safeguards
Bash
codegraph query "외부 API 전송 민감정보 차단 안전장치" -j -l 8
[]
(node:33148) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
The status shows 146 docs, 666 edges, no pending changes — index is fresh. But my multi-word queries all returned empty. Let me test the query engine with shorter, higher-signal terms to find the right matching behavior.


실행됨 명령 4개
실행됨
Test query with single keyword 토큰
실행됨
Test query: agent context sharing
실행됨
Test query: compression
실행됨
Test query: context pollution
Bash
codegraph query "맥락 오염" -j -l 8
[]
(node:6356) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
The content query returns empty even for single keywords — that subcommand isn't matching in this index build. Let me test the graph-traversal commands (callees/callers/impact), which operate on node names, since those are what I actually need for link discovery.


실행됨 명령 4개
실행됨
Outlinks from 맥락_오염_방지
실행됨
Backlinks into Token_허브
Bash
codegraph callers "Token_허브" -j
{
  "symbol": "Token_허브",
  "callers": [
    {
      "name": "Architecture_허브",
      "kind": "doc",
      "filePath": "obsidian/Architecture_허브.md",
      "startLine": 1
    },
    {
      "name": "LLM_워크플로우_생태계",
      "kind": "doc",
      "filePath": "obsidian/LLM_워크플로우_생태계.md",
      "startLine": 1
    },
    {
      "name": "RX_1_허브",
      "kind": "doc",
      "filePath": "obsidian/RX_1_허브.md",
      "startLine": 1
    },
    {
      "name": "Wiki_허브",
      "kind": "doc",
      "filePath": "obsidian/Wiki_허브.md",
      "startLine": 1
    }
  ]
}
(node:3228) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
실행됨
Test query with exact node name
실행됨
Impact cluster for Cave_Man_Protocol
Now I understand the index: query matches node names (not free-text concepts), while callees/callers/impact do real graph traversal. I have the full inventory and the graph structure.

My plan: compile atoms 1–6 into 5 new atomic notes (Atom 1+4 merge into one note per the review's own pairing recommendation), each linked into existing real nodes. Let me read the 4 notes I'll add backlinks to (edit targets).


읽기 파일 4개
읽기
Token_허브.md
읽기
맥락_오염_방지.md
읽기
Producer_QualitySentinel_Reporter_게이트.md
읽기
AI_네이티브_멀티에이전트_운영.md
Now I have the vault's tone and structure. Key finding: Token_허브 and 맥락_오염_방지 already reference [[Sonar_Protocol]] (rename in progress), but the actual node is still Cave_Man_Protocol — so I'll link to the real node [[Cave_Man_Protocol]] for guaranteed connectivity (the pending rename's bulk reconciliation will catch it).

Let me write the 5 new atomic notes (Atom 1+4 merged per the review's pairing).


생성됨 파일 5개
All 5 new notes are written. Now I'll add backlinks to the existing notes for bidirectional linking, starting with the Token_허브 catalog.

수정됨
Token_허브.md
+9
-2
Now backlinks into the other three notes (each gets a last_modified bump plus a reverse reference at the most relevant section).


편집됨 파일 3개
All notes and backlinks are written. Let me sync the CodeGraph index so the new notes and edges are registered, then verify none are orphaned.


실행됨 명령 2개
The sync reports "up to date" but didn't register the new files — this build's change-detection isn't picking up the working-tree writes. Let me check the available reindex options.


실행됨 명령 2개
The index command does a full re-index (vs sync which only catches "changes since last index"). Let me force a full re-index to register the new notes and edges.

실행됨
Force full re-index of the vault
Re-index ran (156 docs scanned, 45 re-indexed). Let me verify the new notes are now in the graph and properly connected — no orphans.


실행됨 명령 3개
Index updated cleanly (158 nodes, 733 edges; +12 nodes, +67 edges). The two spot-checks confirm bidirectional linking. Let me verify the remaining three new notes also have backlinks (zero orphans).


실행됨 명령 3개
컴파일 완료. 모든 신규 노트가 양방향 링크로 연결되었고 고립 노드는 0입니다.

🛠 compile-wiki 결과 — caveman_입국심사.md (atom 1–6)