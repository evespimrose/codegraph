# Docker + emscripten + tree-sitter CLI 설치/설정 가이드 (SL 문법 wasm 빌드용)

> 작성일: 2026-06-23 · 대상: 이 머신(Lenovo i7-12700H, Windows 11 Pro)
> 목적: tree-sitter SL 문법을 wasm으로 빌드하는 툴체인 구축 ([SL 파서 준비문서](2026-06-23-sl-treesitter-parser-prep.md) §2-4의 하드 블로커 해소)
> 빌드 방식: **Docker로 emscripten 실행** (사용자 선택)

---

## 0. 진단 결과 (이 머신 실측)

| 항목 | 값 | 의미 |
|---|---|---|
| 기종 | LENOVO 21D8 / i7-12700H (20 logical) | **물리 머신**(VM 아님) → BIOS는 이 PC에서 직접 |
| `HypervisorPresent` | **True** | 하이퍼바이저 가동 중 |
| VBS / Memory Integrity | **실행 중** (`VBSStatus=2`, `Services={2}`=HVCI) | **VT-x가 켜져 있다는 결정적 증거** (VBS는 VT-x 없이는 못 돎) |
| `wsl --status` | **"WSL이 설치되어 있지 않습니다"** | ⚠️ **Docker 에러의 진짜 원인** |
| Docker CLI | 29.5.3 (엔진 stopped) | CLI만 있고 백엔드 없음 |
| tree-sitter | 0.26.9 @ `D:\Fork\treesittercli\node_modules\tree-sitter-cli\tree-sitter.exe` | 설치됨(로컬 npm, PATH 미등록). wasm ABI 기본 15 |

### 결론
> **"Virtualization support not detected"는 BIOS 문제가 아니다.** VT-x는 이미 켜져 있다(VBS가 그 증거).
> Docker Desktop 4.79는 기본이 **WSL2 백엔드**인데 **WSL2가 미설치**라 시동 못 함. → **WSL2만 깔면 해결.**
> Memory Integrity는 WSL2/Docker와 **호환**되니 끄지 말 것.

---

## Phase 0 — VT-x 확인 (30초, 건너뛰어도 됨)

작업표시줄 우클릭 → **작업 관리자 → 성능 → CPU** → 우하단 **"가상화: 사용"** 확인.
- "사용"이면 통과(이 머신은 VBS 가동 중이라 사실상 확정).
- 만약 "사용 안 함"이면 → 재부팅 → BIOS(Lenovo: 부팅 시 **F1/F2**) → **Configuration/Security → Intel Virtual Technology(VT-x) = Enabled**(+ VT-d) → 저장 후 종료. (이 머신은 해당 없음)

---

## Phase 1 — WSL2 설치 (★ 핵심 수정) — **관리자 권한 필요 + 재부팅**

1. **시작 → "PowerShell" 우클릭 → 관리자 권한으로 실행.**
2. 설치 (VirtualMachinePlatform·WSL 기능 자동 활성 + 커널 설치):
   ```powershell
   wsl --install --no-distribution
   ```
   - `--no-distribution` = Docker 전용이면 리눅스 배포판 불필요(Docker가 자체 `docker-desktop` 배포판 생성). 우분투도 쓰고 싶으면 플래그 빼고 `wsl --install`.
3. **재부팅.**
4. 재부팅 후(일반 PowerShell 가능):
   ```powershell
   wsl --update            # WSL 커널 최신화
   wsl --set-default-version 2
   wsl --status            # "기본 버전: 2" 확인 (더 이상 '미설치' 안 뜸)
   ```

### Phase 1 실패 시 — 수동 기능 활성 (관리자 PowerShell)
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart
# 재부팅 후:
wsl --set-default-version 2
wsl --update
```

---

## Phase 2 — Docker를 WSL2 백엔드로 + 검증

1. **Docker Desktop 실행** → 우상단 **⚙(설정) → General** → **"Use the WSL 2 based engine"** 체크 → **Apply & Restart**.
2. 좌하단 상태가 **"Engine running"(초록)** 으로 바뀌는지 확인. (스샷의 빨간 에러 사라짐)
3. 검증 (일반 PowerShell):
   ```powershell
   wsl -l -v               # docker-desktop 가 VERSION 2 로 보임
   docker version          # Client + Server(엔진) 둘 다 채워짐
   docker run --rm hello-world
   ```
   `hello-world`가 "Hello from Docker!" 출력하면 **Docker 정상.**

### Phase 2 대안 — Hyper-V 백엔드 (WSL2가 끝내 안 되면)
이 머신은 Windows **Pro**라 Hyper-V 가능. 관리자 PowerShell:
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName Containers -All -NoRestart
```
재부팅 → Docker 설정에서 WSL2 체크 **해제**(Hyper-V 사용) → Apply & Restart. (WSL2 경로를 우선 시도할 것)

---

## Phase 3 — emscripten 이미지 (Docker)

Docker 정상화 후, emscripten 이미지를 미리 받아둔다(없으면 첫 빌드 때 tree-sitter가 자동 pull):
```powershell
docker pull emscripten/emsdk
```
> tree-sitter `build --wasm`는 **PATH의 `emcc`를 먼저 찾고, 없으면 Docker의 `emscripten/emsdk`를 자동 사용**한다. 우리는 Docker 경로이므로 emcc 네이티브 설치 불필요 — **빌드 직전 Docker Desktop이 떠 있기만 하면 됨.**

---

## Phase 4 — tree-sitter PATH + wasm 빌드 스모크 테스트

SL 문법을 만들기 **전에**, 알려진 작은 문법으로 "generate→build --wasm" 전 과정을 검증한다.

1. tree-sitter를 PATH에 (셋 중 택1):
   ```powershell
   # (a) 이번 세션만
   $env:Path += ';D:\Fork\treesittercli\node_modules\.bin'
   tree-sitter --version          # tree-sitter 0.26.9
   # (b) 전역 설치
   npm install -g tree-sitter-cli
   # (c) 풀경로 사용: & 'D:\Fork\treesittercli\node_modules\tree-sitter-cli\tree-sitter.exe' ...
   ```
2. 작은 문법으로 검증 (tree-sitter-json):
   ```powershell
   cd D:\Fork
   git clone https://github.com/tree-sitter/tree-sitter-json
   cd tree-sitter-json
   tree-sitter generate           # grammar.js → src/parser.c (node 필요, 이미 있음)
   tree-sitter build --wasm -o tree-sitter-json.wasm   # ← Docker emscripten 사용
   Get-ChildItem *.wasm           # tree-sitter-json.wasm 생성 확인
   ```
   `.wasm` 파일이 나오면 **툴체인 완성.** (첫 빌드는 이미지 pull로 수 분 소요)

> Docker가 D: 경로를 못 읽는다는 에러가 나면: WSL2 백엔드는 보통 자동 처리하지만, 안 되면 작업 폴더를 `C:\` 하위로 옮기거나 Docker Desktop → Settings → Resources → File Sharing 확인.

---

## Phase 5 — codegraph ABI 호환 확인

codegraph는 `web-tree-sitter ^0.25.3` 런타임을 쓴다. tree-sitter 0.26.9는 wasm을 **ABI 15**(기본)로 굽고, 0.25.3 런타임은 ABI 15까지 지원 → **호환**. (Lua가 깨졌던 건 옛 **ABI 13** prebuilt였기 때문 — 새로 구우면 무관.)

빌드한 wasm이 codegraph 런타임에 실제로 로드되는지 1줄로 검증:
```powershell
cd D:\Fork\codegraph
node -e "const {Parser,Language}=require('web-tree-sitter');(async()=>{await Parser.init();const l=await Language.load('D:/Fork/tree-sitter-json/tree-sitter-json.wasm');console.log('ABI version:',l.version);})()"
```
- `ABI version: 15`(또는 14) 출력되면 OK.
- 혹시 *"Unsupported language version"* 에러면 ABI를 낮춰 재생성:
  ```powershell
  tree-sitter generate --abi 14
  tree-sitter build --wasm -o tree-sitter-json.wasm
  ```

---

## 완료 기준 (이 가이드의 Definition of Done)

- [ ] `docker run --rm hello-world` 성공 (Docker 엔진 정상)
- [ ] `docker pull emscripten/emsdk` 완료
- [ ] `tree-sitter --version` = 0.26.9 (PATH)
- [ ] `tree-sitter build --wasm`로 `tree-sitter-json.wasm` 생성
- [ ] 위 node 1줄 로더가 ABI 버전 출력 (codegraph 런타임 로드 확인)

→ 5개 통과 시 **SL 문법 저작(스파이크) 착수 가능** = [SL 파서 준비문서](2026-06-23-sl-treesitter-parser-prep.md) §6 단계 1.

---

## 부록 — Docker 없이 가는 대안 (참고, 비채택)
emsdk를 네이티브 설치하면 Docker 불필요(가상화 이슈 완전 회피):
```powershell
cd D:\Fork
git clone https://github.com/emscripten-core/emsdk
cd emsdk; .\emsdk install latest; .\emsdk activate latest
.\emsdk_env.ps1          # emcc 를 PATH에 — 이후 tree-sitter build --wasm 이 emcc 직접 사용
```
사용자가 Docker를 택했으므로 본 가이드는 Docker 경로를 기준으로 함. WSL2 활성화가 끝내 막히면 이 대안이 가장 빠른 우회로.
