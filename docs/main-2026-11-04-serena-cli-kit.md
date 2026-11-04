# 플랜: serena-cli KIT 런타임 (읽기 전용 CLI, Claude·Codex MCP 등록 해제, shim, 테스트)

## 목표
KIT Serena 번들에 MCP 등록 없이 쓰는 읽기 전용 `serena-cli` 를 넣고, 설치기가 Claude·Codex MCP 등록 대신 CLI shim 을 설치하게 한다.

## 결정
- 전송: KIT 공유 데몬(`shared_runtime.connect`)을 재사용한다. 내부 통신은 loopback HTTP 위 MCP JSON-RPC 이고, Claude·Codex 에는 등록하지 않는다.
- 입력: 필수 인자는 위치 인자, 선택 인자는 `--kebab-case` 플래그. 파서는 도구의 `inputSchema` 에서 만든다.
- 출력: 기본은 도구 결과 텍스트. `-j` 는 JSON-RPC 2.0 응답 한 줄(`result.status`, `result.data`, 실패는 `error`).
- 스키마는 온디맨드: `tools`(한 줄 목록), `schema <tool>`(한 도구 상세). 목록은 릴리스·컨텍스트별 캐시 파일에서 읽고, 없을 때만 데몬에 `tools/list` 를 묻는다.
- `readOnlyHint` 가 참인 도구만 연다. 편집은 호스트 편집 도구로 한다.
- 등록 해제는 KIT 가 만든 항목(`shared_client.py` 또는 `start-client.ps1` 을 부르는 항목)만 지운다.
- Pester 는 Windows PowerShell 5.1 로 돌린다. pwsh 7 에서는 기존 테스트 하나가 `System.Web` 로딩으로 실패한다(조사 문서 6절).
- 코드 블록은 0열에서 시작한다. 블록 안 텍스트를 한 글자도 바꾸지 않고 쓴다.

## 바뀔 파일
| 파일 | 변경 |
|---|---|
| `D:/Fork/KIT/tools/serena/serena_cli.py` | 새 CLI |
| `D:/Fork/KIT/test/test_serena_cli.py` | CLI 단위 테스트 |
| `D:/Fork/KIT/tools/serena/install.ps1` | `-BinRoot`, MCP 등록 해제 함수, shim 설치 |
| `D:/Fork/KIT/test/Serena-Installer.Tests.ps1` | 등록 테스트를 해제·shim 테스트 4개로 교체 |
| `D:/Fork/KIT/test/Export-Dist.Tests.ps1` | 배포 필수 목록에 `serena_cli.py` 추가 |
| `D:/Fork/KIT/tools/serena/README.md` | 등록 문단 갱신, serena-cli 절 추가 |

## 단계

### 단계 1: serena-cli 만들기
- 파일: `D:\Fork\KIT\tools\serena\serena_cli.py`
- 위치: 새 파일
- 동작: create
- 변경 전:
```
없음
```
- 변경 후:
```python
import argparse
import json
import os
import sys

from shared_client import undelivered
from shared_runtime import configuration, connect, request, state_path


CONTEXT = os.environ.get("SERENA_CLI_CONTEXT", "claude-code")
PROTOCOL_VERSION = "2025-06-18"
EXIT_USAGE, EXIT_TOOL, EXIT_RUNTIME = 1, 2, 3
USAGE = """usage:
  serena-cli tools [-j] [--refresh]
  serena-cli schema TOOL [-j] [--refresh]
  serena-cli TOOL [ARG ...] [--OPTION VALUE ...] [-j]

Runs read-only Serena tools through the shared KIT Serena server.
Required arguments are positional. Optional arguments use --kebab-case flags.
Default output is the tool text. -j prints one JSON-RPC 2.0 response line.
Line numbers in results are 0-based (LSP). Add 1 for a 1-based editor or Read offset.
Exit codes: 0 ok, 1 usage error, 2 tool error, 3 Serena runtime unavailable."""
CONVERTERS = {"integer": int, "number": float, "string": str, "object": json.loads}


class UsageError(Exception):
    pass


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise UsageError(f"{self.prog}: {message}")


class Session:
    def __init__(self, config):
        self.config = config
        self.endpoint = None
        self.session = None
        self.sequence = 0

    def open(self):
        self.endpoint, self.session = connect(self.config), None
        _, self.session = request(self.endpoint, "POST", "/mcp", {
            "jsonrpc": "2.0", "id": 0, "method": "initialize",
            "params": {"protocolVersion": PROTOCOL_VERSION, "capabilities": {},
                       "clientInfo": {"name": "serena-cli", "version": "1"}}})
        request(self.endpoint, "POST", "/mcp", {"jsonrpc": "2.0", "method": "notifications/initialized"}, self.session)

    def call(self, method, params=None):
        self.sequence += 1
        message = {"jsonrpc": "2.0", "id": self.sequence, "method": method}
        if params is not None:
            message["params"] = params
        for attempt in range(2):
            try:
                if self.endpoint is None:
                    self.open()
                result, self.session = request(self.endpoint, "POST", "/mcp", message, self.session)
                return result or {}
            except OSError as error:
                self.endpoint = self.session = None
                if attempt or not undelivered(error):
                    raise
        return {}

    def close(self):
        if self.endpoint and self.session:
            try:
                request(self.endpoint, "DELETE", "/mcp", session=self.session, timeout=2)
            except OSError:
                pass
        self.endpoint = self.session = None


def cache_path():
    return state_path({"project": None, "context": CONTEXT, "arguments": ["serena-cli"]}).with_suffix(".tools.json")


def load_tools(session, refresh=False):
    path = cache_path()
    if not refresh and path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            pass
    response = session.call("tools/list")
    if response.get("error"):
        raise RuntimeError(response["error"].get("message", "tools/list failed"))
    tools = {tool["name"]: tool for tool in (response.get("result") or {}).get("tools", [])}
    if not tools:
        raise RuntimeError("Serena returned no tools")
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(tools, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)
    return tools


def read_only(tool):
    return bool((tool.get("annotations") or {}).get("readOnlyHint"))


def pick(tools, name):
    tool = tools.get(name)
    if tool is None:
        raise UsageError(f"unknown tool '{name}'. Run: serena-cli tools")
    if not read_only(tool):
        raise UsageError(f"'{name}' edits files and is not exposed. Edit with your own edit tool.")
    return tool


def summary(tool):
    text = " ".join((tool.get("description") or "").split())
    return text.split(". ")[0].rstrip(".")[:120]


def value_type(spec):
    if spec.get("type"):
        return spec["type"]
    for option in spec.get("anyOf") or spec.get("oneOf") or []:
        if option.get("type") not in (None, "null"):
            return option["type"]
    return "string"


def parse_bool(value):
    lowered = value.lower()
    if lowered in ("true", "1", "yes"):
        return True
    if lowered in ("false", "0", "no"):
        return False
    raise argparse.ArgumentTypeError(f"expected true or false, got {value!r}")


def converter(spec):
    kind = value_type(spec)
    if kind == "boolean":
        return parse_bool
    return CONVERTERS.get(kind, str)


def build_parser(tool):
    parser = Parser(prog=f"serena-cli {tool['name']}", description=tool.get("description"),
                    formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-j", "--json", action="store_true", dest="_json", help="print one JSON-RPC 2.0 response line")
    schema = tool.get("inputSchema") or {}
    required = set(schema.get("required") or [])
    for name, spec in (schema.get("properties") or {}).items():
        kind = value_type(spec)
        # argparse 가 help 를 % 포맷하므로 설명 속 % 를 이스케이프함
        help_text = " ".join((spec.get("description") or "").split()).replace("%", "%%")
        if kind == "array":
            item = converter(spec.get("items") or {})
            if name in required:
                parser.add_argument(name, metavar=name.upper(), nargs="+", type=item, help=help_text)
            else:
                parser.add_argument("--" + name.replace("_", "-"), dest=name, nargs="+", type=item,
                                    default=argparse.SUPPRESS, help=help_text)
        elif name in required:
            parser.add_argument(name, metavar=name.upper(), type=converter(spec), help=help_text)
        elif kind == "boolean":
            parser.add_argument("--" + name.replace("_", "-"), dest=name, action=argparse.BooleanOptionalAction,
                                default=argparse.SUPPRESS, help=help_text)
        else:
            parser.add_argument("--" + name.replace("_", "-"), dest=name, type=converter(spec),
                                default=argparse.SUPPRESS, help=help_text)
    return parser


def decode(text):
    try:
        return json.loads(text)
    except ValueError:
        return text


def respond(identifier, as_json, data=None, text=None):
    if as_json:
        print(json.dumps({"jsonrpc": "2.0", "id": identifier,
                          "result": {"status": "ok", "tool": identifier, "data": data}}, ensure_ascii=False))
    else:
        print(text)
    return 0


def fail(identifier, as_json, exit_code, message, code):
    if as_json:
        print(json.dumps({"jsonrpc": "2.0", "id": identifier,
                          "error": {"code": code, "message": message,
                                    "data": {"status": "error", "tool": identifier}}}, ensure_ascii=False))
    else:
        print(f"serena-cli: {message}", file=sys.stderr)
    return exit_code


def run_tool(session, tool, arguments, as_json):
    response = session.call("tools/call", {"name": tool["name"], "arguments": arguments})
    if response.get("error"):
        error = response["error"]
        return fail(tool["name"], as_json, EXIT_TOOL, error.get("message", "tool call failed"), error.get("code", -32000))
    result = response.get("result") or {}
    text = "\n".join(item.get("text", "") for item in result.get("content") or [] if item.get("type") == "text")
    if result.get("isError"):
        return fail(tool["name"], as_json, EXIT_TOOL, text or "tool call failed", -32000)
    return respond(tool["name"], as_json, decode(text), text)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in ("-h", "--help"):
        print(USAGE)
        return 0 if argv else EXIT_USAGE
    command, rest = argv[0], argv[1:]
    as_json = "-j" in rest or "--json" in rest
    session = Session(configuration(["start-mcp-server", f"--context={CONTEXT}", "--project-from-cwd"]))
    try:
        if command in ("tools", "schema"):
            parser = Parser(prog=f"serena-cli {command}")
            if command == "schema":
                parser.add_argument("tool")
            parser.add_argument("-j", "--json", action="store_true")
            parser.add_argument("--refresh", action="store_true")
            options = parser.parse_args(rest)
            tools = load_tools(session, options.refresh)
            if command == "tools":
                listed = sorted((name, tool) for name, tool in tools.items() if read_only(tool))
                if options.json:
                    return respond("tools", True, [{"name": name, "summary": summary(tool)} for name, tool in listed])
                return respond("tools", False, text="\n".join(f"{name:<26} {summary(tool)}" for name, tool in listed))
            tool = pick(tools, options.tool)
            if options.json:
                return respond(tool["name"], True, {key: tool.get(key) for key in ("name", "description", "inputSchema")})
            return respond(tool["name"], False, text=build_parser(tool).format_help().rstrip())
        tool = pick(load_tools(session), command)
        arguments = vars(build_parser(tool).parse_args(rest))
        as_json = arguments.pop("_json", False)
        return run_tool(session, tool, arguments, as_json)
    except UsageError as error:
        return fail(command, as_json, EXIT_USAGE, str(error), -32602)
    except (OSError, RuntimeError, ValueError, KeyError) as error:
        return fail(command, as_json, EXIT_RUNTIME, f"Serena runtime unavailable: {error}", -32603)
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
```
- 검증: `python3 -c "import ast,pathlib; ast.parse(pathlib.Path('D:/Fork/KIT/tools/serena/serena_cli.py').read_text(encoding='utf-8')); print('ok')"`
- 기대 출력: `ok`

### 단계 2: CLI 단위 테스트 만들기
- 파일: `D:\Fork\KIT\test\test_serena_cli.py`
- 위치: 새 파일
- 동작: create
- 변경 전:
```
없음
```
- 변경 후:
```python
from contextlib import redirect_stderr, redirect_stdout
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, os.environ.get("KIT_SERENA_RUNTIME", str(ROOT / "tools" / "serena")))
import serena_cli  # noqa: E402


FIND_SYMBOL = {
    "name": "find_symbol",
    "description": "Finds symbols by name path. Longer guidance follows.",
    "annotations": {"readOnlyHint": True},
    "inputSchema": {"type": "object", "required": ["name_path_pattern"], "properties": {
        "name_path_pattern": {"type": "string", "description": "Name path pattern."},
        "relative_path": {"type": "string", "default": ""},
        "depth": {"type": "integer", "default": 0},
        "include_body": {"type": "boolean", "default": False},
        "include_kinds": {"type": "array", "items": {"type": "integer"}, "default": []},
        "containing": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": None,
                       "description": "Matches 100% of the name."},
    }},
}
REPLACE = {"name": "replace_symbol_body", "description": "Replaces a body.",
           "annotations": {"readOnlyHint": False}, "inputSchema": {"type": "object", "properties": {}}}
TOOLS = {"find_symbol": FIND_SYMBOL, "replace_symbol_body": REPLACE}


def text_result(text, is_error=False):
    return {"result": {"content": [{"type": "text", "text": text}], "isError": is_error}}


class SerenaCliTests(unittest.TestCase):
    def setUp(self):
        self.fixture = tempfile.TemporaryDirectory(prefix="serena-cli-")
        self.cache = Path(self.fixture.name) / "tools.json"

    def tearDown(self):
        self.fixture.cleanup()

    def run_cli(self, argv, responses=None, cached=True):
        if cached:
            self.cache.write_text(json.dumps(TOOLS), encoding="utf-8")
        calls = []
        replies = responses or {}

        class FakeSession:
            def __init__(self, config):
                self.config = config

            def call(self, method, params=None):
                calls.append((method, params))
                reply = replies[method]
                if isinstance(reply, Exception):
                    raise reply
                return reply

            def close(self):
                pass

        out, err = io.StringIO(), io.StringIO()
        with patch.object(serena_cli, "Session", FakeSession), \
                patch.object(serena_cli, "cache_path", lambda: self.cache), \
                redirect_stdout(out), redirect_stderr(err):
            code = serena_cli.main(argv)
        return code, out.getvalue(), err.getvalue(), calls

    def test_no_arguments_prints_usage(self):
        code, out, _, _ = self.run_cli([], cached=False)
        self.assertEqual(code, serena_cli.EXIT_USAGE)
        self.assertIn("serena-cli tools", out)

    def test_tools_lists_read_only_tools_and_fills_cache(self):
        code, out, _, calls = self.run_cli(
            ["tools"], {"tools/list": {"result": {"tools": [FIND_SYMBOL, REPLACE]}}}, cached=False)
        self.assertEqual(code, 0)
        self.assertIn("find_symbol", out)
        self.assertNotIn("replace_symbol_body", out)
        self.assertEqual(calls, [("tools/list", None)])
        self.assertEqual(set(json.loads(self.cache.read_text(encoding="utf-8"))), {"find_symbol", "replace_symbol_body"})

    def test_cached_tools_do_not_contact_the_server(self):
        code, _, _, calls = self.run_cli(["tools"])
        self.assertEqual(code, 0)
        self.assertEqual(calls, [])

    def test_refresh_reloads_the_tool_list(self):
        code, _, _, calls = self.run_cli(["tools", "--refresh"], {"tools/list": {"result": {"tools": [FIND_SYMBOL]}}})
        self.assertEqual(code, 0)
        self.assertEqual(calls, [("tools/list", None)])

    def test_schema_prints_flags_for_one_tool(self):
        code, out, _, calls = self.run_cli(["schema", "find_symbol"])
        self.assertEqual(code, 0)
        self.assertIn("NAME_PATH_PATTERN", out)
        self.assertIn("--relative-path", out)
        self.assertIn("--include-body", out)
        self.assertEqual(calls, [])

    def test_schema_json_returns_the_input_schema(self):
        code, out, _, _ = self.run_cli(["schema", "find_symbol", "-j"])
        self.assertEqual(code, 0)
        response = json.loads(out)
        self.assertEqual(response["result"]["data"]["inputSchema"], FIND_SYMBOL["inputSchema"])

    def test_flags_become_tool_arguments(self):
        code, _, _, calls = self.run_cli(
            ["find_symbol", "Foo/bar", "--relative-path", "src/a.py", "--depth", "1",
             "--include-body", "--include-kinds", "5", "12", "--containing", "Foo"],
            {"tools/call": text_result("[]")})
        self.assertEqual(code, 0)
        self.assertEqual(calls, [("tools/call", {"name": "find_symbol", "arguments": {
            "name_path_pattern": "Foo/bar", "relative_path": "src/a.py", "depth": 1,
            "include_body": True, "include_kinds": [5, 12], "containing": "Foo"}})])

    def test_omitted_options_are_not_sent(self):
        _, _, _, calls = self.run_cli(["find_symbol", "Foo"], {"tools/call": text_result("[]")})
        self.assertEqual(calls[0][1]["arguments"], {"name_path_pattern": "Foo"})

    def test_plain_output_is_the_tool_text(self):
        text = '[{"name_path": "Foo", "relative_path": "a.py"}]'
        code, out, _, _ = self.run_cli(["find_symbol", "Foo"], {"tools/call": text_result(text)})
        self.assertEqual(code, 0)
        self.assertEqual(out.strip(), text)

    def test_json_output_is_a_json_rpc_response(self):
        text = '[{"name_path": "Foo", "relative_path": "a.py"}]'
        code, out, _, _ = self.run_cli(["find_symbol", "Foo", "-j"], {"tools/call": text_result(text)})
        self.assertEqual(code, 0)
        response = json.loads(out)
        self.assertEqual(response["jsonrpc"], "2.0")
        self.assertEqual(response["result"]["status"], "ok")
        self.assertEqual(response["result"]["data"][0]["relative_path"], "a.py")

    def test_tool_error_exits_2(self):
        code, out, _, _ = self.run_cli(["find_symbol", "Foo", "-j"], {"tools/call": text_result("boom", True)})
        self.assertEqual(code, serena_cli.EXIT_TOOL)
        response = json.loads(out)
        self.assertEqual(response["error"]["message"], "boom")
        self.assertEqual(response["error"]["data"]["status"], "error")

    def test_edit_tools_are_not_exposed(self):
        code, _, err, calls = self.run_cli(["replace_symbol_body", "x"])
        self.assertEqual(code, serena_cli.EXIT_USAGE)
        self.assertIn("not exposed", err)
        self.assertEqual(calls, [])

    def test_unknown_tool_exits_1(self):
        code, _, err, _ = self.run_cli(["no_such_tool"])
        self.assertEqual(code, serena_cli.EXIT_USAGE)
        self.assertIn("serena-cli tools", err)

    def test_missing_required_argument_exits_1(self):
        code, out, _, calls = self.run_cli(["find_symbol", "-j"])
        self.assertEqual(code, serena_cli.EXIT_USAGE)
        self.assertEqual(json.loads(out)["error"]["code"], -32602)
        self.assertEqual(calls, [])

    def test_runtime_failure_exits_3(self):
        code, _, err, _ = self.run_cli(["find_symbol", "Foo"], {"tools/call": OSError("connection refused")})
        self.assertEqual(code, serena_cli.EXIT_RUNTIME)
        self.assertIn("Serena runtime unavailable", err)


if __name__ == "__main__":
    unittest.main()
```
- 검증: `python3 -m pytest D:/Fork/KIT/test/test_serena_cli.py -q -p no:cacheprovider`
- 기대 출력: `15 passed` 가 들어간 마지막 줄

### 단계 3: 설치기에 -BinRoot 인자 추가
- 파일: `D:\Fork\KIT\tools\serena\install.ps1`
- 위치: 8-10행 (param 블록 끝)
- 동작: replace
- 변경 전:
```powershell
    [string[]]$CodexConfigPath,
    [string]$ClaudeConfigPath
)
```
- 변경 후:
```powershell
    [string[]]$CodexConfigPath,
    [string]$ClaudeConfigPath,
    [string]$BinRoot
)
```
- 검증: `python3 -c "print(open('D:/Fork/KIT/tools/serena/install.ps1', encoding='utf-8').read().count('[string]\$BinRoot'))"`
- 기대 출력: `1`

### 단계 4: Codex 등록 함수를 해제 함수로 바꾸기
- 파일: `D:\Fork\KIT\tools\serena\install.ps1`
- 위치: `ConvertTo-TomlString`, `Set-CodexSerena` (27-96행)
- 동작: replace
- 변경 전:
```powershell
function ConvertTo-TomlString([string]$Value) {
    '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Set-CodexSerena([string]$Path, [string]$Launcher) {
    $existing = if (Test-Path -LiteralPath $Path -PathType Leaf) { [IO.File]::ReadAllText($Path) } else { '' }
    $newline = Get-Newline $existing
    $lines = [regex]::Split($existing, '\r\n|\n')
    $updated = New-Object 'Collections.Generic.List[string]'
    $header = '^\s*\[\s*mcp_servers\s*\.\s*(?:"serena"|''serena''|serena)\s*\]\s*(?:#.*)?$'
    $table = '^\s*\['
    $command = '^\s*command\s*='
    $args = '^\s*args\s*='
    $inside = $false
    $found = $false
    $wroteCommand = $false
    $wroteArgs = $false
    $releaseRoot = Split-Path $Launcher -Parent
    $python = Join-Path $releaseRoot 't\serena-agent\Scripts\python.exe'
    $client = Join-Path $releaseRoot 'shared_client.py'
    $commandLine = 'command = ' + (ConvertTo-TomlString $python)
    $argumentValues = @(
        '-B', '-X', 'utf8', $client,
        'start-mcp-server', '--project-from-cwd', '--context=codex'
    )
    $argsLine = 'args = [' + (($argumentValues | ForEach-Object { ConvertTo-TomlString $_ }) -join ', ') + ']'
    foreach ($line in $lines) {
        if ($line -match $header) {
            $inside = $true
            $found = $true
            $wroteCommand = $false
            $wroteArgs = $false
            $updated.Add($line)
            continue
        }
        if ($inside -and $line -match $table) {
            if (-not $wroteCommand) { $updated.Add($commandLine) }
            if (-not $wroteArgs) { $updated.Add($argsLine) }
            $inside = $false
        }
        if ($inside -and $line -match $command) {
            if (-not $wroteCommand) { $updated.Add($commandLine) }
            $wroteCommand = $true
            continue
        }
        if ($inside -and $line -match $args) {
            if (-not $wroteArgs) { $updated.Add($argsLine) }
            $wroteArgs = $true
            continue
        }
        $updated.Add($line)
    }
    if ($inside -and -not $wroteCommand) { $updated.Add($commandLine) }
    if ($inside -and -not $wroteArgs) { $updated.Add($argsLine) }
    if (-not $found) {
        while ($updated.Count -gt 0 -and [string]::IsNullOrWhiteSpace($updated[$updated.Count - 1])) { $updated.RemoveAt($updated.Count - 1) }
        if ($updated.Count -gt 0) { $updated.Add('') }
        $updated.Add('[mcp_servers."serena"]')
        $updated.Add('startup_timeout_sec = 30')
        $updated.Add($commandLine)
        $updated.Add($argsLine)
    }
    $content = ($updated -join $newline).TrimEnd("`r", "`n") + $newline
    if ($content -ceq $existing) { return }
    if ($PSCmdlet.ShouldProcess($Path, 'register bundled Serena for Codex')) {
        $directory = Split-Path $Path -Parent
        if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
        [IO.File]::WriteAllText($Path, $content, $utf8NoBom)
    }
}
```
- 변경 후:
```powershell
function Test-KitSerenaLaunch([string]$Text) {
    $Text -match '(?i)shared_client\.py|start-client\.ps1'
}

function Remove-CodexSerena([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $existing = [IO.File]::ReadAllText($Path)
    $newline = Get-Newline $existing
    $lines = [regex]::Split($existing, '\r\n|\n')
    $header = '^\s*\[\s*mcp_servers\s*\.\s*(?:"serena"|''serena''|serena)\s*(?:\.[^\]]*)?\]\s*(?:#.*)?$'
    $table = '^\s*\['
    $spans = New-Object 'Collections.Generic.List[object]'
    $span = $null
    $inside = $false
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]
        if ($line -match $header) {
            if (-not $inside) {
                $span = [pscustomobject]@{ Start = $index; End = $lines.Count - 1; Managed = $false }
                $spans.Add($span)
                $inside = $true
            }
            continue
        }
        if (-not $inside) { continue }
        if ($line -match $table) {
            $span.End = $index - 1
            $inside = $false
            continue
        }
        if ($line -match '^\s*(?:command|args)\s*=' -and (Test-KitSerenaLaunch $line)) { $span.Managed = $true }
    }
    $drop = New-Object 'Collections.Generic.HashSet[int]'
    foreach ($item in $spans) {
        if (-not $item.Managed) { continue }
        $end = $item.End
        while ($end -gt $item.Start -and [string]::IsNullOrWhiteSpace($lines[$end])) { $end-- }
        for ($index = $item.Start; $index -le $end; $index++) { [void]$drop.Add($index) }
        if ($item.Start -gt 0 -and [string]::IsNullOrWhiteSpace($lines[$item.Start - 1])) { [void]$drop.Add($item.Start - 1) }
    }
    if ($drop.Count -eq 0) { return }
    $kept = for ($index = 0; $index -lt $lines.Count; $index++) { if (-not $drop.Contains($index)) { $lines[$index] } }
    $content = (@($kept) -join $newline).TrimEnd("`r", "`n") + $newline
    if ($content -ceq $existing) { return }
    if ($PSCmdlet.ShouldProcess($Path, 'remove the bundled Serena MCP registration for Codex')) {
        [IO.File]::WriteAllText($Path, $content, $utf8NoBom)
    }
}
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/tools/serena/install.ps1', encoding='utf-8').read(); print(t.count('function Remove-CodexSerena'), t.count('function Set-CodexSerena'), t.count('ConvertTo-TomlString'))"`
- 기대 출력: `1 0 0`

### 단계 5: Claude 등록 함수를 해제 함수로 바꾸고 shim 함수 추가
- 파일: `D:\Fork\KIT\tools\serena\install.ps1`
- 위치: `Set-ClaudeSerena` (116-154행)
- 동작: replace
- 변경 전:
```powershell
function Set-ClaudeSerena([string]$Path, [string]$Launcher) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        try { $document = ConvertFrom-CaseSensitiveJson ([IO.File]::ReadAllText($Path)) }
        catch { throw "$Path is not valid JSON. Fix or move it, then re-run." }
    } else {
        $document = [ordered]@{}
    }
    if ($document -isnot [Collections.IDictionary]) { throw "$Path must contain a JSON object." }
    if (-not ($document.Keys -ccontains 'mcpServers')) { $document['mcpServers'] = [ordered]@{} }
    $servers = $document['mcpServers']
    if ($servers -isnot [Collections.IDictionary]) { throw "$Path mcpServers must be a JSON object." }
    $releaseRoot = Split-Path $Launcher -Parent
    $python = Join-Path $releaseRoot 't\serena-agent\Scripts\python.exe'
    $client = Join-Path $releaseRoot 'shared_client.py'
    $arguments = @(
        '-B', '-X', 'utf8', $client,
        'start-mcp-server', '--context=claude-code', '--project-from-cwd'
    )
    if (-not ($servers.Keys -ccontains 'serena')) { $servers['serena'] = [ordered]@{} }
    $server = $servers['serena']
    if ($server -isnot [Collections.IDictionary]) { throw "$Path mcpServers.serena must be a JSON object." }
    $registered = ($server.Keys -ccontains 'command') -and ([string]$server['command'] -ceq $python) -and
        ($server.Keys -ccontains 'args') -and ((@($server['args']) -join "`n") -ceq ($arguments -join "`n"))
    if ($registered) { return }
    $server['command'] = [string]$python
    $server['args'] = [string[]]$arguments
    $content = (ConvertTo-JsonText $document) + [Environment]::NewLine
    if ($PSCmdlet.ShouldProcess($Path, 'register bundled Serena for Claude')) {
        $directory = Split-Path $Path -Parent
        if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
        $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
        try {
            [IO.File]::WriteAllText($stage, $content, $utf8NoBom)
            Move-Item -LiteralPath $stage -Destination $Path -Force
        } finally {
            if (Test-Path -LiteralPath $stage -PathType Leaf) { [IO.File]::Delete($stage) }
        }
    }
}
```
- 변경 후:
```powershell
function Remove-ClaudeSerena([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    try { $document = ConvertFrom-CaseSensitiveJson ([IO.File]::ReadAllText($Path)) }
    catch { throw "$Path is not valid JSON. Fix or move it, then re-run." }
    if ($document -isnot [Collections.IDictionary]) { throw "$Path must contain a JSON object." }
    if (-not ($document.Keys -ccontains 'mcpServers')) { return }
    $servers = $document['mcpServers']
    if ($servers -isnot [Collections.IDictionary]) { throw "$Path mcpServers must be a JSON object." }
    if (-not ($servers.Keys -ccontains 'serena')) { return }
    $server = $servers['serena']
    if ($server -isnot [Collections.IDictionary]) { return }
    $launch = (@($server['command']) + @($server['args'])) -join ' '
    if (-not (Test-KitSerenaLaunch $launch)) { return }
    [void]$servers.Remove('serena')
    $content = (ConvertTo-JsonText $document) + [Environment]::NewLine
    if ($PSCmdlet.ShouldProcess($Path, 'remove the bundled Serena MCP registration for Claude')) {
        $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
        try {
            [IO.File]::WriteAllText($stage, $content, $utf8NoBom)
            Move-Item -LiteralPath $stage -Destination $Path -Force
        } finally {
            if (Test-Path -LiteralPath $stage -PathType Leaf) { [IO.File]::Delete($stage) }
        }
    }
}

function Write-SerenaShim([string]$Path, [string]$Text, [string]$OwnerPattern) {
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path) -ceq $Text) { return }
    if (-not $PSCmdlet.ShouldProcess($Path, 'write the serena-cli shim')) { return }
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    $backup = $null
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path) -notmatch $OwnerPattern) {
        $backup = "$Path.backup-$(Get-Date -Format 'yyyyMMdd-HHmmssfff')"
        Move-Item -LiteralPath $Path -Destination $backup
    }
    $stage = "$Path.stage-$([guid]::NewGuid().ToString('N'))"
    [IO.File]::WriteAllText($stage, $Text, $utf8NoBom)
    try { Move-Item -LiteralPath $stage -Destination $Path -Force }
    catch {
        if ($backup -and -not (Test-Path -LiteralPath $Path) -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $Path }
        throw
    }
}

function ConvertTo-ShellLiteral([string]$Value) {
    "'" + $Value.Replace("'", "'\''") + "'"
}
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/tools/serena/install.ps1', encoding='utf-8').read(); print(t.count('function Remove-ClaudeSerena'), t.count('function Set-ClaudeSerena'), t.count('function Write-SerenaShim'))"`
- 기대 출력: `1 0 1`

### 단계 6: 런타임 파일 복사, shim 설치, 등록 해제 호출
- 파일: `D:\Fork\KIT\tools\serena\install.ps1`
- 위치: 파일 끝 (`if (-not $WhatIfPreference -and ...` 부터 `Write-Output $executable` 까지)
- 동작: replace
- 변경 전:
```powershell
if (-not $WhatIfPreference -and -not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Bundled Serena is not installed at $executable" }
$runtimeFiles = @('start-client.ps1', 'shared_client.py', 'shared_runtime.py', 'shared_server.py')
foreach ($name in $runtimeFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $BundleRoot $name) -PathType Leaf)) {
        throw "Bundled Serena runtime file is missing: $name"
    }
}
if ($PSCmdlet.ShouldProcess($launcher, 'install the shared Serena client launcher')) {
    foreach ($name in $runtimeFiles) {
        Copy-Item -LiteralPath (Join-Path $BundleRoot $name) -Destination (Join-Path $releaseRoot $name) -Force
    }
}
if ($Agent -eq 'codex') {
    if (-not $CodexConfigPath) { $CodexConfigPath = @(Join-Path $userHome '.codex\config.toml') }
    foreach ($configPath in $CodexConfigPath) { Set-CodexSerena ([IO.Path]::GetFullPath($configPath)) $launcher }
} elseif ($Agent -eq 'claude') {
    if (-not $ClaudeConfigPath) { $ClaudeConfigPath = Join-Path $userHome '.claude.json' }
    Set-ClaudeSerena ([IO.Path]::GetFullPath($ClaudeConfigPath)) $launcher
}

Write-Output $executable
```
- 변경 후:
```powershell
if (-not $WhatIfPreference -and -not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Bundled Serena is not installed at $executable" }
$runtimeFiles = @('start-client.ps1', 'shared_client.py', 'shared_runtime.py', 'shared_server.py', 'serena_cli.py')
foreach ($name in $runtimeFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $BundleRoot $name) -PathType Leaf)) {
        throw "Bundled Serena runtime file is missing: $name"
    }
}
if ($PSCmdlet.ShouldProcess($launcher, 'install the shared Serena client launcher')) {
    foreach ($name in $runtimeFiles) {
        Copy-Item -LiteralPath (Join-Path $BundleRoot $name) -Destination (Join-Path $releaseRoot $name) -Force
    }
}
if (-not $BinRoot) { $BinRoot = Join-Path $userHome '.local\bin' }
$BinRoot = [IO.Path]::GetFullPath($BinRoot)
$cliPython = Join-Path $toolRoot 'serena-agent\Scripts\python.exe'
$cliScript = Join-Path $releaseRoot 'serena_cli.py'
Write-SerenaShim (Join-Path $BinRoot 'serena-cli.cmd') "@set `"TEAM_HARNESS_SERENA_CLI=1`"`r`n@`"$cliPython`" -B -X utf8 `"$cliScript`" %*`r`n" '(?m)^@set "TEAM_HARNESS_SERENA_CLI=1"\r?$'
# Git Bash 는 .cmd 를 이름만으로 못 부르므로 python 을 직접 부르는 sh shim 을 따로 둠
$posixShim = "#!/bin/sh`nexport TEAM_HARNESS_SERENA_CLI=1`nexec " + (ConvertTo-ShellLiteral $cliPython.Replace('\', '/')) + ' -B -X utf8 ' + (ConvertTo-ShellLiteral $cliScript.Replace('\', '/')) + " `"`$@`"`n"
Write-SerenaShim (Join-Path $BinRoot 'serena-cli') $posixShim '(?m)^export TEAM_HARNESS_SERENA_CLI=1$'
if ($Agent -eq 'codex') {
    if (-not $CodexConfigPath) { $CodexConfigPath = @(Join-Path $userHome '.codex\config.toml') }
    foreach ($configPath in $CodexConfigPath) { Remove-CodexSerena ([IO.Path]::GetFullPath($configPath)) }
} elseif ($Agent -eq 'claude') {
    if (-not $ClaudeConfigPath) { $ClaudeConfigPath = Join-Path $userHome '.claude.json' }
    Remove-ClaudeSerena ([IO.Path]::GetFullPath($ClaudeConfigPath))
}

Write-Output $executable
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/tools/serena/install.ps1', encoding='utf-8').read(); print(t.count('Set-CodexSerena'), t.count('Set-ClaudeSerena'), t.count('Write-SerenaShim (Join-Path \$BinRoot'))"`
- 기대 출력: `0 0 2`

### 단계 7: 설치기 테스트를 해제·shim 테스트로 교체
- 파일: `D:\Fork\KIT\test\Serena-Installer.Tests.ps1`
- 위치: `It 'registers Claude without losing project keys that differ only in case'` 블록 (55-82행)
- 동작: replace
- 변경 전:
```powershell
    It 'registers Claude without losing project keys that differ only in case' {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $bundleRoot 'install.ps1'), [ref]$null, [ref]$null)
        $names = @('New-JsonSerializer', 'ConvertFrom-CaseSensitiveJson', 'ConvertTo-JsonText', 'Set-ClaudeSerena')
        foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            if ($names -contains $definition.Name) { . ([scriptblock]::Create($definition.Extent.Text)) }
        }
        function Invoke-Registration {
            [CmdletBinding(SupportsShouldProcess = $true)]
            param([string]$Path, [string]$Launcher)
            $utf8NoBom = New-Object Text.UTF8Encoding($false)
            Set-ClaudeSerena $Path $Launcher
        }
        $configPath = Join-Path $TestDrive 'claude-case.json'
        [IO.File]::WriteAllText($configPath, '{"projects":{"C:/Work/App":{"n":1},"C:/work/App":{"n":2}},"mcpServers":{"serena":{"type":"stdio","command":"uvx","args":["serena"],"env":{}},"other":{"command":"x"}}}')
        $launcher = Join-Path $TestDrive 'release\start-client.ps1'
        Invoke-Registration $configPath $launcher
        $document = (New-JsonSerializer).DeserializeObject([IO.File]::ReadAllText($configPath))
        $document['projects'].Keys.Count | Should Be 2
        $document['projects']['C:/work/App']['n'] | Should Be 2
        $serena = $document['mcpServers']['serena']
        $serena['command'] | Should Be (Join-Path $TestDrive 'release\t\serena-agent\Scripts\python.exe')
        ($serena['args'] -join ' ') | Should Match '--context=claude-code --project-from-cwd$'
        $serena['type'] | Should Be 'stdio'
        $document['mcpServers']['other']['command'] | Should Be 'x'
        $written = [IO.File]::ReadAllText($configPath)
        Invoke-Registration $configPath $launcher
        [IO.File]::ReadAllText($configPath) | Should BeExactly $written
    }
```
- 변경 후:
```powershell
    It 'removes only the bundled Claude registration and keeps case-distinct project keys' {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $bundleRoot 'install.ps1'), [ref]$null, [ref]$null)
        $names = @('New-JsonSerializer', 'ConvertFrom-CaseSensitiveJson', 'ConvertTo-JsonText', 'Test-KitSerenaLaunch', 'Remove-ClaudeSerena')
        foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            if ($names -contains $definition.Name) { . ([scriptblock]::Create($definition.Extent.Text)) }
        }
        function Invoke-Removal {
            [CmdletBinding(SupportsShouldProcess = $true)]
            param([string]$Path)
            $utf8NoBom = New-Object Text.UTF8Encoding($false)
            Remove-ClaudeSerena $Path
        }
        $configPath = Join-Path $TestDrive 'claude-case.json'
        [IO.File]::WriteAllText($configPath, '{"projects":{"C:/Work/App":{"n":1},"C:/work/App":{"n":2}},"mcpServers":{"serena":{"type":"stdio","command":"C:/r/t/serena-agent/Scripts/python.exe","args":["-B","-X","utf8","C:/r/shared_client.py","start-mcp-server","--context=claude-code","--project-from-cwd"]},"other":{"command":"x"}}}')
        Invoke-Removal $configPath
        $document = ConvertFrom-CaseSensitiveJson ([IO.File]::ReadAllText($configPath))
        $document['projects'].Keys.Count | Should Be 2
        $document['projects']['C:/work/App']['n'] | Should Be 2
        ($document['mcpServers'].Keys -ccontains 'serena') | Should Be $false
        $document['mcpServers']['other']['command'] | Should Be 'x'
        $written = [IO.File]::ReadAllText($configPath)
        Invoke-Removal $configPath
        [IO.File]::ReadAllText($configPath) | Should BeExactly $written
    }

    It 'keeps a Claude Serena registration that the bundle did not create' {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $bundleRoot 'install.ps1'), [ref]$null, [ref]$null)
        $names = @('New-JsonSerializer', 'ConvertFrom-CaseSensitiveJson', 'ConvertTo-JsonText', 'Test-KitSerenaLaunch', 'Remove-ClaudeSerena')
        foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            if ($names -contains $definition.Name) { . ([scriptblock]::Create($definition.Extent.Text)) }
        }
        function Invoke-Removal {
            [CmdletBinding(SupportsShouldProcess = $true)]
            param([string]$Path)
            $utf8NoBom = New-Object Text.UTF8Encoding($false)
            Remove-ClaudeSerena $Path
        }
        $configPath = Join-Path $TestDrive 'claude-user.json'
        $original = '{"mcpServers":{"serena":{"type":"stdio","command":"uvx","args":["serena"]}}}'
        [IO.File]::WriteAllText($configPath, $original)
        Invoke-Removal $configPath
        [IO.File]::ReadAllText($configPath) | Should BeExactly $original
    }

    It 'removes only the bundled Codex registration' {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $bundleRoot 'install.ps1'), [ref]$null, [ref]$null)
        $names = @('Get-Newline', 'Test-KitSerenaLaunch', 'Remove-CodexSerena')
        foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            if ($names -contains $definition.Name) { . ([scriptblock]::Create($definition.Extent.Text)) }
        }
        function Invoke-CodexRemoval {
            [CmdletBinding(SupportsShouldProcess = $true)]
            param([string]$Path)
            $utf8NoBom = New-Object Text.UTF8Encoding($false)
            Remove-CodexSerena $Path
        }
        $configPath = Join-Path $TestDrive 'codex.toml'
        [IO.File]::WriteAllText($configPath, "model = `"x`"`n`n[mcp_servers.`"serena`"]`nstartup_timeout_sec = 30`ncommand = `"C:\\r\\python.exe`"`nargs = [`"-B`", `"C:\\r\\shared_client.py`", `"start-mcp-server`"]`n`n[mcp_servers.other]`ncommand = `"y`"`n")
        Invoke-CodexRemoval $configPath
        [IO.File]::ReadAllText($configPath) | Should BeExactly "model = `"x`"`n`n[mcp_servers.other]`ncommand = `"y`"`n"
        $userPath = Join-Path $TestDrive 'codex-user.toml'
        $userText = "[mcp_servers.serena]`ncommand = `"uvx`"`nargs = [`"serena`"]`n"
        [IO.File]::WriteAllText($userPath, $userText)
        Invoke-CodexRemoval $userPath
        [IO.File]::ReadAllText($userPath) | Should BeExactly $userText
    }

    It 'writes the serena-cli shim and keeps a foreign file as a backup' {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $bundleRoot 'install.ps1'), [ref]$null, [ref]$null)
        foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
            if ($definition.Name -eq 'Write-SerenaShim') { . ([scriptblock]::Create($definition.Extent.Text)) }
        }
        function Invoke-Shim {
            [CmdletBinding(SupportsShouldProcess = $true)]
            param([string]$Path, [string]$Text, [string]$Owner)
            $utf8NoBom = New-Object Text.UTF8Encoding($false)
            Write-SerenaShim $Path $Text $Owner
        }
        $binRoot = Join-Path $TestDrive 'bin'
        New-Item -ItemType Directory -Path $binRoot -Force | Out-Null
        $shim = Join-Path $binRoot 'serena-cli.cmd'
        [IO.File]::WriteAllText($shim, 'foreign')
        $text = "@set `"TEAM_HARNESS_SERENA_CLI=1`"`r`n@`"python.exe`" %*`r`n"
        $owner = '(?m)^@set "TEAM_HARNESS_SERENA_CLI=1"\r?$'
        Invoke-Shim $shim $text $owner
        [IO.File]::ReadAllText($shim) | Should BeExactly $text
        @(Get-ChildItem -LiteralPath $binRoot -Filter 'serena-cli.cmd.backup-*').Count | Should Be 1
        Invoke-Shim $shim $text $owner
        @(Get-ChildItem -LiteralPath $binRoot -Filter 'serena-cli.cmd.backup-*').Count | Should Be 1
    }
```
- 검증: `powershell.exe -NoProfile -Command '$r = Invoke-Pester -Script D:\Fork\KIT\test\Serena-Installer.Tests.ps1 -PassThru -Quiet; "total=$($r.TotalCount) failed=$($r.FailedCount)"'`
- 기대 출력: `total=12 failed=0`

### 단계 8: 배포 필수 목록에 serena_cli.py 추가
- 파일: `D:\Fork\KIT\test\Export-Dist.Tests.ps1`
- 위치: 19행
- 동작: replace
- 변경 전:
```powershell
            'tools\serena\shared_client.py', 'tools\serena\shared_runtime.py', 'tools\serena\shared_server.py',
```
- 변경 후:
```powershell
            'tools\serena\shared_client.py', 'tools\serena\shared_runtime.py', 'tools\serena\shared_server.py', 'tools\serena\serena_cli.py',
```
- 검증: `python3 -c "print(open('D:/Fork/KIT/test/Export-Dist.Tests.ps1', encoding='utf-8').read().count('serena_cli.py'))"`
- 기대 출력: `1`

### 단계 9: README 등록 문단 갱신과 serena-cli 절 추가
- 파일: `D:\Fork\KIT\tools\serena\README.md`
- 위치: "The Windows KIT installers ..." 문단과 "Codex and Claude launch ..." 문단
- 동작: replace
- 변경 전:
```text
The Windows KIT installers install each wheel hash into an immutable private
release directory and point the Claude or Codex Serena MCP registration at that
release. Existing Serena processes can finish on the previous release; restart
the client to use the newly registered release.

Codex and Claude launch the bundled Python stdio client directly, avoiding a
PowerShell process per connection. `start-client.ps1` supports existing client
registrations and manual launches. Connections with the same project, context, and launch options
reuse one Serena instance and its language servers. Each connection retains
its own MCP session. `activate_project` routes only the calling connection to
the requested project's server; other connections retain their project.
```
- 변경 후:
```text
The Windows KIT installers install each wheel hash into an immutable private
release directory and write the `serena-cli` shims to `~/.local/bin` (override
with `-BinRoot`). Serena is not registered as a Claude or Codex MCP server.
`-Agent claude` and `-Agent codex` remove a Serena MCP registration that an
earlier KIT installer created. They keep a registration that the user created.

## serena-cli

`serena-cli` calls the shared Serena server through its loopback endpoint. No
MCP client registration is necessary, and tool schemas load on demand:

- `serena-cli tools` prints one line for each read-only tool.
- `serena-cli schema <tool>` prints the flags of one tool. Add `-j` for the
  JSON Schema.
- `serena-cli <tool> ARG... --option VALUE` runs one read-only tool. Required
  arguments are positional. Optional arguments use `--kebab-case` flags.

The tool list is cached in the descriptor directory for each release and
context. `--refresh` reloads it. The default output is the tool text. `-j`
prints one JSON-RPC 2.0 response line with `result.status` and `result.data`,
or with `error` when the call fails. Result line numbers are 0-based. Edit
tools are not exposed. The exit code is 0 for success, 1 for a usage error,
2 for a tool error, and 3 when the Serena runtime is unavailable.
`SERENA_CLI_CONTEXT` overrides the `claude-code` context.

`serena-cli` and the optional stdio client (`shared_client.py`, which
`start-client.ps1` launches for manual registrations) share one Serena
instance for each project, context, and set of launch options, including its
language servers. Each connection retains its own MCP session.
`activate_project` routes only the calling connection to the requested
project's server. Other connections retain their project.
```
- 검증: `python3 -c "t=open('D:/Fork/KIT/tools/serena/README.md', encoding='utf-8').read(); print(t.count('## serena-cli'), t.count('point the Claude or Codex Serena MCP registration'))"`
- 기대 출력: `1 0`

## 수락 기준
A4 부터는 H1(KIT 배포) 뒤에 실행된다. REVIEW 의 `pack.py build` 는 H1 이 끝난 뒤 돌린다.

```acceptance
{"id":"A1","kind":"auto","cmd":"python3 -m pytest D:/Fork/KIT/test/test_serena_cli.py -q -p no:cacheprovider","expect":"exit0"}
{"id":"A2","kind":"auto","cmd":"powershell.exe -NoProfile -Command '$r = Invoke-Pester -Script D:\\Fork\\KIT\\test\\Serena-Installer.Tests.ps1 -PassThru -Quiet; if ($r.TotalCount -eq 0 -or $r.FailedCount -gt 0) { exit 1 }'","expect":"exit0"}
{"id":"A3","kind":"auto","cmd":"powershell.exe -NoProfile -Command '$r = Invoke-Pester -Script D:\\Fork\\KIT\\test\\Export-Dist.Tests.ps1 -PassThru -Quiet; if ($r.TotalCount -eq 0 -or $r.FailedCount -gt 0) { exit 1 }'","expect":"exit0"}
{"id":"H1","kind":"human","how":"KIT 를 배포한다: powershell -NoProfile -ExecutionPolicy Bypass -File D:\\Fork\\KIT\\install.ps1 (Codex 를 쓰면 install-codex.ps1 도 실행)","expect":"설치가 오류 없이 끝나고 ~/.local/bin 에 serena-cli 와 serena-cli.cmd 가 생김"}
{"id":"A4","kind":"auto","cmd":"serena-cli tools","expect":"exit0"}
{"id":"A5","kind":"auto","cmd":"serena-cli find_symbol check_codegraph_recent --relative-path .claude/hooks/codegraph-gate.sh -j","expect":"exit0"}
{"id":"A6","kind":"auto","cmd":"python3 -c \"import json,os; servers=json.load(open(os.path.expanduser('~/.claude.json'),encoding='utf-8')).get('mcpServers') or {}; raise SystemExit(1 if 'serena' in servers else 0)\"","expect":"exit0"}
{"id":"H2","kind":"human","how":"이 저장소에서 새 Claude Code 세션을 연다","expect":"지연 도구 목록과 MCP 서버 지침에 serena 가 없음"}
```

## 범위 밖
- KIT 최상위 `install.ps1:556-557`, `install-codex.ps1:765-766` 의 "MCP registration" 안내 문구. 동작에는 영향이 없다.
- `test/test_serena_shared.py` 의 기존 실패 9건(system python3 로 공유 서버를 못 띄움).
- pwsh 7 에서 `New-JsonSerializer` 를 쓰는 다른 테스트. 이번 교체로 이 파일의 해당 테스트는 사라진다.
- Serena 판 올림(1.7.1 → 2.x), 편집 도구 노출, PowerShell 도구로 부른 `serena-cli` 의 기록.

## 미결 질문
- 없음

## 승인 기록
- G1: 2026-11-04 사용자 승인(플랜과 `acceptance` 블록). Haiku 5.5 실행 카드 한 장이 실행한다. 훅 플랜 카드와 동시에 돌 수 있다(파일이 겹치지 않음).
