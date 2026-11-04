# 로컬 RAG 라이브러리 조사 (GeekNews 25854)

- 작성: 2026-11-03, RIPER RESEARCH
- 짝 문서: [codegraph 구조 조사](main-2026-11-03-codegraph-structure-research.md)
- 대상 글: [Ask HN: 로컬에서 RAG를 어떻게 구현하고 있나요?](https://news.hada.io/topic?id=25854) (GeekNews 요약, 원문은 Hacker News 질문 글. 페이지 표기 "9달전")
- 조사 목적(사용자 지정): 두 쓰임새에 맞는 요소를 고르기 위한 사실 수집. 고르기는 INNOVATE 에서 함.
  - 쓰임새 1: 코드베이스를 로컬 벡터 DB + BM25 하이브리드로 검색
  - 쓰임새 2: 마크다운 문서를 시맨틱 벡터 DB 로 검색
  - 개선 축: 임베딩 속도, 질의 속도, 질의 품질
- 근거 수준: 웹 검색 요약에 기댐. 대부분 제작사 자료나 목록 사이트임. 직접 설치하거나 재지 않음. 각 항목의 "근거" 열에 출처 성격을 적음.

## 1. 글의 요지

- 로컬 RAG 에 벡터 DB 가 꼭 필요하지 않다는 의견이 많음. SQLite FTS5, BM25, grep 같은 텍스트 검색으로 시작하는 사례가 많음.
- 코드 검색에서는 임베딩이 느리고 잡음이 많다는 경험담이 많음. BM25 + 트라이그램(3글자 단위 색인) 조합을 권하는 의견이 있음.
- 코드에 임베딩을 쓸 때는 파일 경로와 시그니처에만 임베딩을 걸고 BM25 와 합치면 좋았다는 사례가 있음.
- 벡터가 필요하면 pgvector, SQLite BLOB 저장, FAISS 메모리 적재처럼 가벼운 구성을 씀.
- 품질을 올리는 조합으로 하이브리드 검색, RRF, 리랭킹, 멀티쿼리 확장(질의를 여러 변형으로 늘려 검색)이 자주 나옴.
- 입력과 문서 양쪽에 태그를 달아 85% 경우를 태그 일치만으로 해결했다는 사례가 있음.
- 작은 모델에서는 상위 5개 정도가 한계이고, 파일·폴더를 미리 요약해 두면 나아진다는 의견이 있음.
- 댓글에 "한글이 잘 되는지 의문" 이라는 반응이 있음. 글 안에 한국어 측정 사례는 없음.

## 2. codegraph 현재 구성 (대응 기준)

| 요소 | codegraph 현재 (KIT HEAD) |
|---|---|
| 실행 환경 | 내장 Node 24, `node:sqlite`, transformers.js(ONNX), 오프라인 고정 모델 |
| 어휘 검색 | SQLite FTS5 `bm25()`. 코드는 `nodes_fts`, 문서는 `document_fts`(기본 `unicode61` 토크나이저) |
| 벡터 저장·검색 | sqlite-vec `vec0`, float[384], 전수 비교 |
| 임베딩 | `dragonkue/multilingual-e5-small-ko` q8, 문서당 벡터 1개, 앞 512토큰. 코드 심볼은 임베딩 없음 |
| 결합 | RRF (상수 60) |
| 리랭커 | `nlpai-lab/KURE-Reranker-nano` q8 cross-encoder, 기본 꺼짐 |
| 코드 구조 | tree-sitter WASM 파싱, 참조 해석, 그래프 순회 |

## 3. 라이브러리별 특징

### 3.1 임베딩 모델

| 이름 | 특징 | 장점(출처 주장) | 실행 환경 | 근거 |
|---|---|---|---|---|
| MongoDB `mdbr-leaf-ir` | 검색 전용 소형 모델, 2,300만 매개변수, Apache 2.0. `snowflake-arctic-embed-m-v1.5` 에서 증류 | BEIR nDCG@10 53.55(비대칭 54.03). 1억 매개변수 이하에서 BEIR·RTEB 1위라고 주장. CPU 전용 배포에 맞음. 글 기준 2vCPU 에서 초당 문서 약 22개, 질의 약 120개 | sentence-transformers, Transformers.js, Transformers | MongoDB 블로그, HF 모델 카드 |
| model2vec (MinishLab, potion 계열) | 문장 트랜스포머를 정적 토큰 임베딩으로 증류. 추론은 토큰 임베딩 평균 | 최대 50배 작고 500배 빠르다고 주장. potion-base-32M 은 MTEB 평균 52.13(all-MiniLM-L6-v2 의 93.21%). 검색용 potion-retrieval-32M 은 81.69% | Python 패키지. 다른 런타임 지원은 이 조사에서 확인 안 함 | 제작사 결과 페이지, PyPI |
| `nomic-embed-text` v1.5 | Matryoshka 학습(차원을 줄여 써도 성능이 조금만 떨어짐). 768 → 512, 256, 128, 64 | 입력 8,192토큰. 차원을 질의 때 고를 수 있음 | Ollama, HF | HF 모델 카드. Ollama 쪽 수치는 목록 사이트 |
| Meta-Llama-3-8B 임베딩 | 글 작성자가 LLM 으로 청크 벡터를 만듦. 4,096차원 fp16, 청크당 8KB | 500만 청크 약 40GB 메모리. A6000 GPU 에서 빠름 | Python, GPU | 글 본문(개인 사례) |

### 3.2 SQLite 기반 저장·검색

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| sqlite-vec (`vec0`) | 순수 C, 의존성 없음. float, int8, binary(1비트) 벡터. 메타데이터 열, 보조 열, `rowid IN (...)` 사전 필터 | SQLite 가 도는 곳이면 어디서나 돔. 고정 크기 청크를 SIMD 로 훑음 | v1 이전이라 호환이 깨질 수 있음. ANN 색인 없음(전수 비교). float16 등은 로드맵 | GitHub README, wiki |
| sqlite-vector (sqliteai) | 일반 테이블의 BLOB 에 벡터 저장. 사전 색인 없음 | Float32, Float16, BFloat16, Int8, UInt8, 1비트, TurboQuant 2·3·4비트 양자화. 양자화 데이터를 메모리에 미리 올리는 옵션 | 운영·관리형 서비스 사용은 상용 라이선스 필요 | 공식 저장소, 미러 |
| SQLite FTS5 + `bm25()` | SQLite 내장 전문 검색 | 마크다운 문서에 충분하다는 사례(파일마다 짧은 설명 필드를 두고 키워드 검색). 글에서 "SQLite 가 놀랄 만큼 잘 됨" | `bm25()` 는 값이 작을수록 좋음 | 글 본문, 문서 요약 사이트 |
| FTS5 trigram 토크나이저 | 3글자 단위로 색인 | `LIKE`, `GLOB` 같은 부분 문자열 검색을 색인으로 처리. BM25 순위는 그대로 씀 | 3글자 미만 질의는 맞지 않음. 한 사례에서 색인이 원본의 약 2.6배 | 블로그 2편 |
| fp16 BLOB + 메모리 행렬곱 | 벡터를 fp16 BLOB 로 저장. 날짜·위치 필터로 줄인 뒤 numpy·torch 로 유사도 계산 | 필터로 대상이 크게 줄면 빠름. 백엔드를 인터페이스 뒤에 숨김 | Python | 글 본문(개인 사례) |

### 3.3 내장형 벡터 DB와 라이브러리

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| LanceDB | Lance 열 형식 위의 내장(in-process) 벡터 DB. Apache 2.0 | 별도 서버 없음. 벡터 + BM25 전문 검색 + SQL 필터를 한 질의로. RRF 결합. Rust, Python, Node/TS, Java SDK | 일부 연동(NVIDIA NeMo)에서 미리 계산한 벡터로는 하이브리드 불가 | NVIDIA 문서, 2차 자료 |
| DuckDB `vss` | DuckDB 확장. HNSW 색인 | 거리 함수 l2sq, cosine, inner product. 글은 3GB 이하 소규모에 맞다고 함 | 실험 기능. HNSW 영속화는 옵션이고 WAL 복구 미구현이라 운영 비권장. 체크포인트마다 색인 전체를 다시 씀. 삭제는 표시만 함 | DuckDB 공식 문서 |
| ChromaDB | 내장 모드와 클라우드가 같은 API | 2025-11 에 희소 벡터(BM25, SPLADE) 추가. 밀집 + 희소 + 전문 + 정규식 + 메타데이터를 한 질의로, RRF | GPU 가속 없음. 하이브리드 지원 범위를 두고 자료가 엇갈림 | Chroma 문서, 2차 자료 |
| FAISS | Meta 의 벡터 검색 라이브러리. Flat, IVF, HNSW, PQ 와 조합 | PQ 로 메모리 크게 절감. GPU(CUDA) 백엔드 | HNSW 는 삭제 불가. GPU 는 NVIDIA 만. 속도 배수는 자료마다 다름 | FAISS wiki, 2차 자료 |

### 3.4 서버형 DB와 검색 엔진

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| PostgreSQL + pgvector | Postgres 확장. 정확 검색 기본, HNSW·IVFFlat 근사 색인 | HNSW 는 속도-재현율이 좋음. IVFFlat 은 빌드가 빠르고 메모리가 적음. `halfvec` 4,000차원, `sparsevec` 지원. 기존 Postgres 운영 지식 활용 | `vector` 2,000차원 한도. `sparsevec` 은 HNSW 만 | 공식 문서 미러 |
| plpgsql_bm25 | PL/pgSQL 로 쓴 BM25 | 여러 BM25 변형. pgvector 와 RRF 로 합치는 함수와 노트북 포함 | 순수 PL/pgSQL. 마지막 푸시 2024-12 | 저장소 요약 |
| pg_trgm (트라이그램) | Postgres 트라이그램 색인 | 글의 Q&A DB 사례에서 pgvector 와 함께 씀 | 이 조사에서 따로 확인 안 함 | 글 댓글 |
| llmemory | PostgreSQL + pgvector 라이브러리 | 하이브리드 BM25, 멀티쿼리 확장(의미·키워드 변형 생성 후 RRF), cross-encoder 리랭킹, HNSW 설정 프리셋 | Python 3.10+, PostgreSQL 14+. 제작자가 처음 공개해 버그가 있을 수 있다고 함 | PyPI |
| SurrealDB | 다중 모델 DB(문서, 그래프, 벡터, 시계열) | HNSW(cosine, Euclidean, Manhattan)와 BM25 전문 검색, `search::rrf()` 결합(v3) | 서버. 제작사 자료 위주 | SurrealDB 문서·블로그 |
| Qdrant | 벡터 DB | 밀집 + 희소 벡터 하이브리드, RRF·DBSF 결합. 양자화로 RAM 최대 97% 절감 주장 | 서버 | 저장소 미러, 목록 사이트 |
| Meilisearch, Typesense, Manticore | 검색 엔진. Elasticsearch 보다 운영이 단순하다는 글 의견 | Meilisearch 는 하이브리드 검색 홍보. Typesense 는 필터·패싯. Manticore 는 Sphinx 후계, 자체 측정에서 Meilisearch 보다 하이브리드 RRF 0.515 대 0.475 | 서버. 비교 자료는 서로 상대 제작사가 씀. Typesense 는 유니코드 토큰화라 띄어쓰기 없는 언어에 약하다는 Meilisearch 주장 | 각 제작사 블로그 |
| Turbopuffer | 객체 저장소를 원본으로 두고 NVMe·메모리 캐시를 얹은 서버리스 검색 | 벡터 + BM25(자체 구현), 순위 결합. 캐시된 문서 10ms 미만, 콜드 0.5초 미만. Cursor 가 저장·검색 비용 95% 절감 | 클라우드 서비스 | Google Cloud 사례, 2차 자료 |

### 3.5 코드 검색 도구

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| ripgrep | 줄 단위 재귀 검색 | 기본으로 `.gitignore`, 숨김, 이진 파일을 건너뜀. 공식 측정에서 GNU grep 보다 빠름(6.9초 대 15.2초). 글은 Claude Code, Codex 가 내부에서 쓴다고 함 | 순위 없음 | 공식 저장소 |
| 에이전트 + ripgrep 루프 | gpt-oss 20B 가 ripgrep 을 반복 호출 | 글 작성자는 하이브리드보다 빠르고 정확했다고 함. 재색인 부담이 없음 | 측정 수치 없음 | 글 댓글 |
| shebe | BM25 코드 검색 CLI 와 MCP 서버(Rust 바이너리 2개, 각 약 8MB) | 임베딩·GPU·클라우드 없음. 검색 2ms 주장. 1천 파일 이상, 다언어, 불리언 질의. 리팩토링 대상 열거에 유용했다는 글 사례 | 내용 정규식 검색 없음. macOS, Linux | 목록 사이트, README 발췌 |
| ck | Rust "시맨틱 grep" | 정규식, 로컬 임베딩 시맨틱, 하이브리드(RRF) 세 모드. 색인을 자동으로 만들고 갱신. MCP 도구(`hybrid_search`, `reindex` 등) | 버전별 자료 차이 | docs.rs, README |
| tree-sitter, LSP | 구문 트리 파서와 언어 서버 | 글 댓글: 심볼 이름으로 정의·사용 위치를 찾는 데 tree-sitter 가 더 유용할 수 있음. LSP 는 Claude Code 에 들어갔지만 버그가 있다고 함 | 의견 수준 | 글 본문 |

### 3.6 마크다운·RAG 도구

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| qmd (tobi) | 마크다운 로컬 검색 CLI | `search`(BM25), `vsearch`(벡터), `query`(하이브리드 RRF + LLM 리랭크 + 질의 확장). GGUF 모델 3개(임베딩 약 300MB, 리랭커 약 640MB, 질의 확장 약 640MB). MCP 연동 | Bun 필요. 첫 `vsearch` 가 약 1분 걸릴 수 있고 리랭크가 대화형으로는 느리다는 목록 사이트 의견 | README, 목록 사이트 |
| libragen | 문서를 단일 SQLite 파일 라이브러리로 만드는 CLI 와 MCP 서버 | API 키·클라우드 없음. 라이브러리 파일을 팀과 공유. git 저장소에서 빌드. 라이브러리 버전과 콘텐츠 버전을 따로 관리하는 설계 | 초기 단계(0.4.0) | npm, 설계 문서 |
| piragi | Python RAG 래퍼 | `Ragi(...).ask()` 한 줄 사용. 로컬 파일, URL, S3, API. 기본 로컬(Ollama) | 버전 정보 엇갈림 | PyPI |
| Kiln | RAG 구성 비교 앱 | 추출기, 임베딩 모델, 청크 방식, 검색 방식(벡터, BM25, 하이브리드, LanceDB 기반) 비교. 평가 데이터셋 자동 생성 | Kiln 자체 비교 수치는 공개 자료 없음 | LanceDB 연동 문서 |
| ragtune | 검색 단계 디버깅 CLI(Go) | 질의 하나 설명(`explain`), 일괄 평가(`simulate`), CI 기준(`--min-recall`). LLM 호출 없음 | 사용자 적음 | GitHub README |
| nori (usenori.ai) | 글 설명: SQLite + vec0 + FTS5 로 시맨틱과 단어 검색 결합 | | 웹 검색에서 찾지 못함. 같은 구성의 다른 사례(scrydb 논문, gnosis-mcp, sqlite.ai RAG)는 FTS5 + 벡터 + RRF 를 씀 | 검색 결과 없음 |

### 3.7 문서 처리와 앱

| 이름 | 특징 | 장점(출처 주장) | 제약 | 근거 |
|---|---|---|---|---|
| docling (IBM) | 문서 변환. RT-DETR 레이아웃 모델, TableFormer 표 복원 | PDF, DOCX, XLSX, HTML, 이미지를 Markdown·JSON 으로. MIT. MCP 서버 | 글: 표, 다단, 페이지를 넘는 표가 어렵다고 함 | arXiv 보고서, GitHub |
| Mistral OCR | 비공개 OCR 모델 | 글에서 가장 좋은 결과라는 의견. 표를 HTML 로 출력(OCR 3) | API 전용. 독립 측정에서 PaddleOCR-VL 보다 낮음 | Mistral 발표, CodeSOTA |
| AnythingLLM | 문서 RAG 앱 | 기본 LanceDB 내장, 설정 없음 | | AnythingLLM 문서 |
| LibreChat | 채팅 앱의 RAG API | LangChain + PostgreSQL/pgvector + FastAPI | | LibreChat 문서 |
| Nextcloud MCP Server | Nextcloud 데이터 MCP 서버 | Qdrant + Ollama 로 시맨틱 검색. ETag 비교로 바뀐 항목만 재임베딩 | 실험 기능, 기본 꺼짐, 주로 Notes 앱 | PyPI, 설계 문서 |

## 4. 두 쓰임새별 사실 정리

판단 없이 글과 자료에 나온 사실만 모음.

### 4.1 쓰임새 1: 코드베이스 로컬 벡터 + BM25 하이브리드

- 글의 코드 검색 의견: 임베딩은 느리고 코드에 맞지 않으며 리랭커 없이는 잡음이 큼. 파일 재색인 부담도 큼. BM25 + 트라이그램이 빠르고 결과가 좋다고 함.
- 반대 사례: 파일 경로와 시그니처에 임베딩을 걸고 BM25 와 합치면 좋았다는 의견. ck 는 코드에 로컬 임베딩 시맨틱 검색과 RRF 하이브리드를 둠.
- 재색인 부담을 줄이는 방법이 자료에 나옴: 내용 해시 기반 캐시(codegraph 문서 캐시와 같은 방식), Nextcloud MCP 의 ETag 비교, ck 의 자동 증분 색인.
- 트라이그램: SQLite FTS5 trigram 토크나이저와 Postgres `pg_trgm` 이 있음. FTS5 trigram 은 3글자 미만 질의가 맞지 않고 색인이 커짐.
- codegraph 대응: 코드 심볼은 지금 FTS5 BM25(가중치 name 20 등)와 LIKE, Levenshtein 만 씀. 코드 쪽 벡터와 트라이그램은 없음. tree-sitter 시그니처는 `nodes.signature` 에 이미 있음.
- 속도 수치: shebe 2ms 주장(검증 안 됨). codegraph `query --no-sync` 는 프로세스 전체 1.8초(Arcyn).

### 4.2 쓰임새 2: 마크다운 시맨틱 벡터 DB

- 글의 마크다운 의견: 문서 대부분이 작은 마크다운이면 FTS5 만으로도 됨. 짧은 설명 필드, 태그 일치, 미리 요약이 품질을 올림.
- 하이브리드 구성은 여러 도구가 같음: BM25 + 벡터 + RRF(LanceDB, ChromaDB, SurrealDB, qmd, ck, scrydb, gnosis-mcp). qmd 와 llmemory 는 여기에 리랭커와 질의 확장을 더함.
- 임베딩 속도 축: model2vec 은 정적 임베딩이라 빠르지만 검색 성능은 MiniLM 의 약 82%(retrieval 모델 기준). mdbr-leaf-ir 은 2,300만 매개변수 CPU 모델이고 Transformers.js 로 쓸 수 있다고 함. 둘 다 한국어 측정 자료는 이 조사에서 찾지 못함.
- 입력 길이 축: nomic-embed-text v1.5 는 8,192토큰. codegraph 의 e5-small-ko 는 512토큰이고 문서당 벡터 1개임.
- 저장 크기·속도 축: sqlite-vector 는 Float16, Int8, 1비트, 2~4비트 양자화를 둠(상용 라이선스 조건). sqlite-vec 은 int8, binary 를 둠. FAISS 는 PQ 로 압축함.
- 질의 속도 축: sqlite-vec, sqlite-vector 는 색인 없이 전수 비교함. HNSW 색인은 pgvector, DuckDB vss(실험), SurrealDB, Qdrant, FAISS 에 있음. codegraph Zyxel 9,929개에서 연속 질의는 질의당 약 164ms 였음(모델 로딩 포함 평균).
- 품질 축: 글과 자료에 한국어 마크다운 측정은 없음. codegraph 의 한국어 측정은 짝 문서 4.5절에 있음.

### 4.3 공통 기법

| 기법 | 자료에 나온 내용 | codegraph 현재 |
|---|---|---|
| RRF | 점수 = 합계 1/(k+순위), k 보통 60. 점수 척도가 다른 BM25 와 벡터를 합칠 때 씀 | 있음(상수 60, 같은 비중) |
| 리랭킹(cross-encoder) | llmemory, qmd 가 씀. 글: 리랭커 없으면 코드 검색 잡음이 큼 | 있음, 기본 꺼짐 |
| 멀티쿼리 확장 | llmemory 는 의미·키워드 변형을 만들어 RRF. qmd 는 질의 확장 모델 | 없음. KIT 에 한영 확장 스크립트(`ko_en_query_expand.py`)만 있음 |
| 태그·메타데이터 일치 | 85% 경우 태그 일치로 충분했다는 사례 | BLK 태그, frontmatter 코드 참조를 저장함 |
| 미리 요약 | 파일·폴더 요약으로 개선 | 문서 앞 600자를 요약으로 씀 |
| 상위 k 제한 | 작은 모델은 상위 5개 정도가 한계라는 의견 | 기본 topk 8, 최대 50 |
| 양자화 | int8, fp16, 1비트, PQ | 모델 q8. 저장 벡터는 float32 |

## 5. 조사하지 못한 항목

- 글에 이름만 나오고 이 조사에서 찾지 않음: discovery(Qwen-3-VL-8B OCR + ChromaDB), mastra agent, search-sensei 데모, local-LLM-with-RAG, lance-context, KAG, OData 질의 인터페이스.
- nori(usenori.ai)는 검색 결과가 없었음.
- model2vec, FAISS 의 Node 실행 지원은 확인하지 않음.
- 라이브러리 수치는 대부분 제작사 주장임. 이 조사에서 재현하지 않음.

## 6. 출처

- 글: <https://news.hada.io/topic?id=25854>
- mdbr-leaf-ir: <https://mongodb.com/company/blog/engineering/leaf-distillation-state-of-the-art-text-embedding-models>, <https://huggingface.co/MongoDB/mdbr-leaf-ir/blob/4f88d67f7c376c1e453661515e392ff17fb0fde1/README.md>
- model2vec: <https://minish.ai/packages/model2vec/results/>, <https://www.pypi.org/project/model2vec/0.4.0>, <https://huggingface.co/MinishLab/potion-base-2M>
- sqlite-vec: <https://github.com/asg017/sqlite-vec>, <https://github.com/asg017/sqlite-vec/wiki>, <https://cdn.jsdelivr.net/npm/@photostructure/sqlite-vec@1.2.0/README.md>
- sqlite-vector: <https://github.com/sqliteai/sqlite-vector>, <https://www.sourcepulse.org/projects/15740720>
- plpgsql_bm25, RRF: <https://awesome.ecosyste.ms/projects/github.com%2Fjankovicsandras%2Fplpgsql_bm25>, <https://paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual>, <https://www.pgedge.com/blog/hybrid-search-in-postgresql-bm25-sparse-vectors-and-reciprocal-rank-fusion>
- llmemory: <https://pypi.org/project/llmemory/>, <https://pypi.org/project/llmemory/0.4.0/>
- LanceDB: <https://nvidia.github.io/NeMo-Retriever/extraction/vdbs/>, <https://openapps.pro/packages/lancedb>, <https://www.promptlayer.com/glossary/lancedb>
- DuckDB vss: <https://duckdb.org/docs/current/core_extensions/vss>
- Meilisearch, Typesense, Manticore: <https://github.com/manticoresoftware/manticoresearch/discussions/4951>, <https://www.meilisearch.com/blog/meilisearch-vs-typesense>, <https://www.meilisearch.com/docs/resources/comparisons/typesense.md>, <https://stackshare.io/meilisearch/vs/typesense>
- Turbopuffer: <https://cloud.google.com/customers/turbopuffer>, <https://www.morphllm.com/comparisons/turbopuffer-vs-pinecone>, <https://infrabase.ai/vector-databases/turbopuffer>
- shebe: <https://mcpmarket.com/server/shebe>, <https://hn.jakechampion.name/reader/https://github.com/rhobimd-oss/shebe>, <https://www.itechguides.com/products/shebe/>
- qmd: <https://github.com/tobi/qmd>, <https://github.com/tobi/qmd/wiki>, <https://skillselion.com/skills/alsk1992/cloddsbot/qmd>
- ck: <https://docs.rs/crate/ck-search/0.3.9/source/README.md>, <https://docsearch.algolia.com/mcp/docs/repo/beaconbay/ck>
- Kiln: <https://docs.lancedb.com/integrations/ai/kiln>
- libragen: <https://glama.ai/mcp/servers/@libragen/libragen/blob/66c1edda2c820aebb91a45b4646358912cabbe44/specs/library-versioning-design.md>, <https://www.pkgstats.com/pkg:@libragen/mcp>, <https://mcpservers.org/id/servers/libragen/libragen>
- piragi: <https://pypi.org/project/piragi/>, <https://pypi.org/project/piragi/1.1.0/>
- ragtune: <https://github.com/metawake/ragtune>
- docling: <https://arxiv.org/html/2408.09869v1>, <https://github.com/DS4SD/docling>
- ChromaDB: <https://docsearch.algolia.com/mcp/docs/repo/chroma-core/chroma>, <https://aicoolies.com/reviews/chroma-review>, <https://mcp.directory/blog/chroma-vs-pinecone-vs-qdrant-vs-weaviate-vs-pgvector-mcp-2026>
- Qdrant: <https://www.sourcepulse.org/projects/427681>, <https://dev.co/ai/vector-databases/qdrant>
- SurrealDB: <https://surrealdb.com/blog/a-real-world-example-of-hybrid-fusion-search-using-the-surrealdb-docs-search>, <https://dev.to/kreuzberg/bm25-vector-search-in-one-query-kreuzberg-surrealdb-surrealdb-v3-5abi>
- nomic-embed-text: <https://huggingface.co/nomic-ai/nomic-embed-text-v1.5>
- FAISS: <https://www.github.com/facebookresearch/faiss/wiki/Faiss-indexes>
- pgvector: <https://docs.tantorlabs.ru/tdb/en/17_10/se/vector.html>, <https://support.huaweicloud.com/intl/en-us/devg-911-dws/dws_04_1462.html>
- SQLite 하이브리드 사례: <https://arxiv.org/pdf/2608.24060>, <https://glama.ai/mcp/servers/@nicholasglazer/gnosis-mcp/blob/c98bf9ef8f3067a6a63b78e3c3ff9c126d52042c/src/gnosis_mcp/sqlite_backend.py>
- FTS5 trigram: <https://dev.to/omochi_dev/why-sqlite-fts5s-default-tokenizer-drops-your-japanese-substrings-and-the-one-line-fix-1k2d>, <https://www.issoh.co.jp/tech/details/9314/>
- AnythingLLM, LibreChat: <https://docs.anythingllm.com/setup/vector-database-configuration/local/lancedb>, <https://librechat.ai/docs/features/rag_api>
- Nextcloud MCP: <https://pypi.org/project/nextcloud-mcp-server>, <https://glama.ai/mcp/servers/@cbcoutinho/nextcloud-mcp-server/blob/4712235390bdd57a53bc7d6336a217765478c464/docs/semantic-search-architecture.md>
- Mistral OCR: <https://mistral.ai/fr/news/mistral-ocr/>, <https://codesota.com/ocr/mistral-ocr-3-benchmark>
- ripgrep: <https://github.com/BurntSushi/ripgrep>
