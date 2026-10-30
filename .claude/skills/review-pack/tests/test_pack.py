import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import pack  # noqa: E402


def git(root, *args):
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def make_task(root, slug, acceptance, scope_paths):
    plans = root / ".claude" / "memory-bank" / "main" / "plans"
    riper = root / ".claude" / "memory-bank" / "main" / "riper"
    plans.mkdir(parents=True, exist_ok=True)
    riper.mkdir(parents=True, exist_ok=True)

    rows = "\n".join(f"| S1 | E1 | `{p}` | 수정 | 검증 |" for p in scope_paths)
    lines = "\n".join(acceptance)
    plan = (
        f"# plan {slug}\n\n| # | 카드 | 대상 파일 | 동작 | 성공 기준 |\n|---|---|---|---|---|\n"
        f"{rows}\n\n```acceptance\n{lines}\n```\n"
    )
    plan_rel = f".claude/memory-bank/main/plans/{slug}.md"
    (root / plan_rel).write_text(plan, encoding="utf-8")
    (riper / f"{slug}.state").write_text(
        f"MODE=REVIEW\nSTATUS=active\nTASK=test {slug}\nPLAN_FILE={plan_rel}\nBRANCH=main\n"
        f"UPDATED=2026-10-29\nCURRENT=E1:완료\n",
        encoding="utf-8",
    )


def review_text(root, slug):
    return (root / ".claude" / "memory-bank" / "main" / "plans" / f"{slug}-review.md").read_text(encoding="utf-8")


def state_text(root, slug):
    return (root / ".claude" / "memory-bank" / "main" / "riper" / f"{slug}.state").read_text(encoding="utf-8")


@pytest.fixture
def repo(tmp_path, monkeypatch):
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.com")
    git(root, "config", "user.name", "test")
    (root / "tracked.txt").write_text("v1\n", encoding="utf-8")
    git(root, "add", "tracked.txt")
    git(root, "commit", "-q", "-m", "init")
    monkeypatch.chdir(root)
    monkeypatch.setenv("PACK_CMD_TIMEOUT", "300")
    return root


def test_all_pass(repo, capsys):
    make_task(repo, "task-pass", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
        '{"id":"V2","kind":"auto","cmd":"echo ok","expect":"exit0"}',
        '{"id":"V3","kind":"human","how":"화면 확인","expect":"라벨 보임"}',
    ], ["tracked.txt"])
    (repo / "tracked.txt").write_text("v2\n", encoding="utf-8")

    assert pack.main(["build", "task-pass"]) == 0

    out = capsys.readouterr().out
    assert "auto PASS 2/2" in out
    assert "FAIL 0" in out and "human 1" in out and "scope-out 0" in out
    text = review_text(repo, "task-pass")
    assert "| V1 |" in text and "| PASS |" in text
    assert "- [ ] **V3**" in text
    assert "verdict: pending" in text


def test_command_failure_is_fail(repo, capsys):
    make_task(repo, "task-fail", [
        '{"id":"V1","kind":"auto","cmd":"echo broken; exit 3","expect":"exit0"}',
    ], ["tracked.txt"])

    assert pack.main(["build", "task-fail"]) == 0

    out = capsys.readouterr().out
    assert "FAIL 1" in out and "auto PASS 0/1" in out
    text = review_text(repo, "task-fail")
    assert "| 3 | FAIL |" in text
    assert "broken" in text


def test_timeout_is_unverified(repo, monkeypatch, capsys):
    monkeypatch.setenv("PACK_CMD_TIMEOUT", "1")
    make_task(repo, "task-timeout", [
        '{"id":"V1","kind":"auto","cmd":"sleep 3","expect":"exit0"}',
    ], ["tracked.txt"])

    assert pack.main(["build", "task-timeout"]) == 0

    assert "UNVERIFIED 1" in capsys.readouterr().out
    assert "시간 초과" in review_text(repo, "task-timeout")


def test_missing_command_is_unverified(repo, capsys):
    make_task(repo, "task-missing", [
        '{"id":"V1","kind":"auto","cmd":"no_such_command_pack_test_xyz","expect":"exit0"}',
    ], ["tracked.txt"])

    assert pack.main(["build", "task-missing"]) == 0

    assert "UNVERIFIED 1" in capsys.readouterr().out
    assert "명령을 찾을 수 없음" in review_text(repo, "task-missing")


def test_scope_out_detected(repo, capsys):
    make_task(repo, "task-scope", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["tracked.txt"])
    (repo / "stray.txt").write_text("unplanned\n", encoding="utf-8")

    assert pack.main(["build", "task-scope"]) == 0

    assert "scope-out 1" in capsys.readouterr().out
    text = review_text(repo, "task-scope")
    assert "stray.txt | 범위 이탈" in text
    assert "tracked.txt | 플랜 범위" not in text


def test_directory_scope_without_trailing_slash(repo, capsys):
    make_task(repo, "task-dir", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["docs/specs"])
    (repo / "docs" / "specs").mkdir(parents=True)
    (repo / "docs" / "specs" / "guide.md").write_text("x\n", encoding="utf-8")
    (repo / "docs" / "specsx.md").write_text("x\n", encoding="utf-8")

    assert pack.main(["build", "task-dir"]) == 0

    assert "scope-out 1" in capsys.readouterr().out
    text = review_text(repo, "task-dir")
    assert "docs/specs/guide.md | 플랜 범위" in text
    assert "docs/specsx.md | 범위 이탈" in text


def test_memory_bank_changes_are_not_scope_out(repo, capsys):
    make_task(repo, "task-memory", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["tracked.txt"])
    (repo / ".claude" / "memory-bank" / "main" / "plans" / "notes.md").write_text("x", encoding="utf-8")

    assert pack.main(["build", "task-memory"]) == 0

    assert "scope-out 0" in capsys.readouterr().out


def test_rebuild_keeps_confirmation_record(repo):
    make_task(repo, "task-record", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-record"]) == 0
    assert pack.main(["confirm", "task-record", "pass", "--note", "looks good"]) == 0

    assert pack.main(["build", "task-record"]) == 0

    text = review_text(repo, "task-record")
    assert "verdict: pending" in text
    assert "pass looks good" in text
    assert text.count("## 5. 확인 기록") == 1


def test_confirm_pass_updates_state(repo):
    make_task(repo, "task-state", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-state"]) == 0

    assert pack.main(["confirm", "task-state", "pass", "--note", "ok"]) == 0

    state = state_text(repo, "task-state")
    assert "STATUS=done" in state
    assert "CURRENT=G2 통과" in state and "ok" in state
    assert "MODE=REVIEW" in state and "PLAN_FILE=" in state
    assert "verdict: pass" in review_text(repo, "task-state")


def test_confirm_pass_refused_on_auto_fail(repo):
    make_task(repo, "task-refuse", [
        '{"id":"V1","kind":"auto","cmd":"exit 1","expect":"exit0"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-refuse"]) == 0

    assert pack.main(["confirm", "task-refuse", "pass"]) == 1

    assert "verdict: pending" in review_text(repo, "task-refuse")


def test_confirm_force_overrides_auto_fail(repo):
    make_task(repo, "task-force", [
        '{"id":"V1","kind":"auto","cmd":"exit 1","expect":"exit0"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-force"]) == 0

    assert pack.main(["confirm", "task-force", "pass", "--force"]) == 0

    assert "verdict: pass" in review_text(repo, "task-force")


def test_confirm_all_skips_failed_packs(repo, capsys):
    make_task(repo, "task-good", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
    ], ["tracked.txt"])
    make_task(repo, "task-bad", [
        '{"id":"V1","kind":"auto","cmd":"exit 1","expect":"exit0"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-good"]) == 0
    assert pack.main(["build", "task-bad"]) == 0

    assert pack.main(["confirm", "--all", "pass"]) == 0

    out = capsys.readouterr().out
    assert "confirm pass: task-good" in out
    assert "task-bad" in out and "건너뜀" in out
    assert "verdict: pass" in review_text(repo, "task-good")
    assert "verdict: pending" in review_text(repo, "task-bad")


def test_queue_brief_empty_prints_nothing(repo, capsys):
    assert pack.main(["queue", "--brief"]) == 0
    assert capsys.readouterr().out == ""


def test_queue_brief_lists_pending_and_batch_line(repo, capsys):
    make_task(repo, "task-queue", [
        '{"id":"V1","kind":"auto","cmd":"exit 0","expect":"exit0"}',
        '{"id":"V2","kind":"human","how":"확인","expect":"보임"}',
    ], ["tracked.txt"])
    assert pack.main(["build", "task-queue"]) == 0
    capsys.readouterr()

    assert pack.main(["queue", "--brief"]) == 0

    out = capsys.readouterr().out.splitlines()
    assert out[0].startswith("task-queue · 사람 확인 1 · 자동 실패 0 · ")
    assert out[-1] == pack.BATCH_LINE
