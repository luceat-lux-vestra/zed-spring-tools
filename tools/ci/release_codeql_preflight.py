#!/usr/bin/env python3
"""Nonpublishing exact-SHA CodeQL reuse/join/auto-dispatch gate for Zed Registry candidates."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from unittest import mock

LANGUAGES = ("actions", "javascript-typescript", "rust", "java-kotlin")
SHA = re.compile(r"[0-9a-f]{40}\Z")
REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")
WORKFLOW = ".github/workflows/codeql.yml"


def reject(message: str) -> None:
    raise ValueError(message)


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def api(repo: str, path: str) -> dict:
    value = json.loads(gh("api", f"repos/{repo}/{path}"))
    if not isinstance(value, dict):
        reject(f"GitHub API returned non-object for {path}")
    return value


def ancestry(repo: str, sha: str) -> str:
    if not REPO.fullmatch(repo) or not SHA.fullmatch(sha):
        reject("invalid repository or candidate SHA")
    main = api(repo, "git/ref/heads/main").get("object", {}).get("sha")
    if not isinstance(main, str) or not SHA.fullmatch(main):
        reject("protected main identity is missing or malformed")
    compare = api(repo, f"compare/{sha}...{main}")
    if compare.get("status") not in ("ahead", "identical") or compare.get("base_commit", {}).get("sha") != sha or compare.get("merge_base_commit", {}).get("sha") != sha:
        reject("candidate is not proven reachable from protected main")
    return main


def workflow(repo: str) -> dict:
    value = api(repo, "actions/workflows/codeql.yml")
    if not isinstance(value.get("id"), int) or value.get("path") != WORKFLOW or value.get("state") != "active":
        reject("CodeQL workflow identity missing or inactive")
    return value


def candidates(repo: str, wf: dict) -> list[dict]:
    result: list[dict] = []
    for event in ("workflow_dispatch", "schedule"):
        rows = api(repo, f"actions/workflows/codeql.yml/runs?event={event}&branch=main&per_page=100").get("workflow_runs")
        if not isinstance(rows, list):
            reject("CodeQL discovery returned invalid run array")
        result.extend(row for row in rows if isinstance(row, dict) and row.get("workflow_id") == wf["id"] and row.get("path") == WORKFLOW and row.get("head_branch") == "main" and (row.get("head_repository") or {}).get("full_name") == repo)
    return sorted(result, key=lambda row: row.get("created_at", ""), reverse=True)


def exact(run: dict, sha: str) -> bool:
    if run.get("event") == "workflow_dispatch":
        return run.get("display_title") == f"CodeQL source {sha}"
    return run.get("event") == "schedule" and run.get("head_sha") == sha


def metadata(run: dict, wf: dict, jobs: dict, artifacts: dict, repo: str, sha: str) -> None:
    if run.get("workflow_id") != wf["id"] or run.get("path") != WORKFLOW or run.get("event") not in ("workflow_dispatch", "schedule") or run.get("head_branch") != "main" or (run.get("head_repository") or {}).get("full_name") != repo or run.get("status") != "completed" or run.get("conclusion") != "success" or run.get("run_attempt") != 1:
        reject("untrusted or mismatched CodeQL run identity/state/source")
    try:
        created = dt.datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
    except (KeyError, AttributeError, ValueError) as exc:
        raise ValueError("invalid scan creation time") from exc
    if created.tzinfo is None or created > dt.datetime.now(dt.timezone.utc):
        reject("scan has invalid or future timestamp")
    expected_jobs = {f"Analyze {language}" for language in LANGUAGES}
    rows = jobs.get("jobs")
    if jobs.get("total_count") != len(LANGUAGES) or not isinstance(rows, list) or len(rows) != len(LANGUAGES) or {row.get("name") for row in rows if isinstance(row, dict)} != expected_jobs or any(row.get("status") != "completed" or row.get("conclusion") != "success" for row in rows):
        reject("missing, extra, incomplete or unsuccessful CodeQL language jobs")
    expected_artifacts = {*(f"codeql-{sha}-{language}" for language in LANGUAGES), *(f"codeql-source-{sha}-{language}" for language in LANGUAGES)}
    rows = artifacts.get("artifacts")
    if artifacts.get("total_count") != 2 * len(LANGUAGES) or not isinstance(rows, list) or len(rows) != 2 * len(LANGUAGES) or {row.get("name") for row in rows if isinstance(row, dict)} != expected_artifacts:
        reject("expected all four SARIF plus four source-provenance artifacts")
    for row in rows:
        if row.get("expired") is not False or not isinstance(row.get("id"), int) or not isinstance(row.get("size_in_bytes"), int) or row["size_in_bytes"] <= 0 or row.get("workflow_run", {}).get("head_sha") not in (None, run.get("head_sha")):
            reject("expired, empty or wrong-source CodeQL artifact")


def tree(repo: str, sha: str) -> str:
    value = api(repo, f"git/commits/{sha}")
    found = value.get("tree", {}).get("sha")
    if value.get("sha") != sha or not isinstance(found, str) or not SHA.fullmatch(found):
        reject("candidate tree identity is missing or malformed")
    return found


def manifest(directory: Path, repo: str, run: dict, sha: str, candidate_tree: str, language: str) -> None:
    files = list(directory.rglob("source-identity.json"))
    if len(files) != 1:
        reject("missing or ambiguous source identity manifest")
    doc = json.loads(files[0].read_text(encoding="utf-8"))
    expected = {
        "schema": 1,
        "repository": repo,
        "workflow_path": WORKFLOW,
        "workflow_ref": f"{repo}/{WORKFLOW}@refs/heads/main",
        "workflow_sha": run.get("head_sha"),
        "event_name": run.get("event"),
        "event_sha": run.get("head_sha"),
        "candidate_sha": sha,
        "checkout_sha": sha,
        "candidate_tree": candidate_tree,
        "run_id": run.get("id"),
        "run_attempt": 1,
        "language": language,
    }
    if not isinstance(doc, dict) or any(doc.get(key) != value for key, value in expected.items()):
        reject("CodeQL source provenance mismatch")


def inspect(repo: str, sha: str, wf: dict, run_id: int, verdict: Path) -> None:
    run = api(repo, f"actions/runs/{run_id}")
    metadata(run, wf, api(repo, f"actions/runs/{run_id}/jobs?per_page=100"), api(repo, f"actions/runs/{run_id}/artifacts?per_page=100"), repo, sha)
    candidate_tree = tree(repo, sha)
    with tempfile.TemporaryDirectory(prefix="zed-codeql-") as tmp:
        root = Path(tmp)
        for language in LANGUAGES:
            for prefix, kind in (("codeql-", "sarif"), ("codeql-source-", "source")):
                destination = root / language / kind
                destination.mkdir(parents=True)
                subprocess.run(["gh", "run", "download", str(run_id), "-R", repo, "-n", f"{prefix}{sha}-{language}", "-D", str(destination)], check=True)
                if kind == "source":
                    manifest(destination, repo, run, sha, candidate_tree, language)
                else:
                    subprocess.run([sys.executable, str(verdict), "--sarif-dir", str(destination), "--language", language, "--candidate-sha", sha], check=True)
    ancestry(repo, sha)
    print(f"Exact-source CodeQL PASS {repo}@{sha} run={run_id} Actions+JS/TS+Rust+Java")


def verify_live(repo: str, sha: str, verdict: Path, timeout_seconds: int = 4200, poll_seconds: int = 15) -> None:
    if timeout_seconds < 1 or poll_seconds < 1:
        reject("nonpositive timeout or poll interval")
    if not os.environ.get("GH_TOKEN"):
        reject("missing GitHub API credential")
    ancestry(repo, sha)
    wf = workflow(repo)
    all_runs = candidates(repo, wf)
    exact_runs = [row for row in all_runs if exact(row, sha)]
    active = [row for row in exact_runs if row.get("status") != "completed"]
    if any(row.get("run_attempt") != 1 for row in exact_runs):
        reject("ambiguous rerun attempt for exact candidate")
    if len(active) > 1:
        reject("ambiguous active exact-source CodeQL scans")
    completed = [row for row in exact_runs if row.get("status") == "completed"]
    if any(row.get("conclusion") != "success" for row in completed):
        reject("failed existing exact-source CodeQL scan cannot be replaced")
    if len(completed) > 1:
        reject("ambiguous duplicate completed exact-source CodeQL scans")
    if active and any(row.get("status") == "completed" and row.get("conclusion") != "success" for row in exact_runs):
        reject("active scan conflicts with failed existing scan")

    selected: int | None = None
    if active:
        selected = active[0]["id"]
        print(f"Joining active exact-source CodeQL {selected}", flush=True)
    else:
        if completed:
            newest = completed[0]
            if newest.get("conclusion") != "success":
                reject(f"existing exact candidate CodeQL run {newest.get('id')} ended {newest.get('conclusion')}")
            try:
                inspect(repo, sha, wf, newest["id"], verdict)
            except (ValueError, subprocess.CalledProcessError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
                raise ValueError(f"invalid completed exact candidate scan {newest.get('id')}: {exc}") from exc
            return
        before = {row.get("id") for row in all_runs if isinstance(row.get("id"), int)}
        gh("api", "-X", "POST", f"repos/{repo}/actions/workflows/codeql.yml/dispatches", "-f", "ref=main", "-f", f"inputs[candidate_sha]={sha}")
        print(f"Dispatched trusted full CodeQL for candidate {sha}", flush=True)
        newly = [row for row in candidates(repo, wf) if row.get("id") not in before and row.get("event") == "workflow_dispatch" and exact(row, sha) and row.get("run_attempt") == 1]
        if len(newly) > 1:
            reject("ambiguous auto-dispatched CodeQL runs")
        if newly:
            selected = newly[0]["id"]

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        ancestry(repo, sha)
        if selected is None:
            newly = [row for row in candidates(repo, wf) if row.get("id") not in before and row.get("event") == "workflow_dispatch" and exact(row, sha) and row.get("run_attempt") == 1]
            if len(newly) > 1:
                reject("ambiguous auto-dispatched CodeQL runs")
            if newly:
                selected = newly[0]["id"]
        if selected is not None:
            try:
                state = api(repo, f"actions/runs/{selected}")
            except (ValueError, subprocess.CalledProcessError, OSError, json.JSONDecodeError) as exc:
                raise ValueError(f"failed polling selected CodeQL run {selected}: {exc}") from exc
            if not exact(state, sha):
                reject(f"selected CodeQL run {selected} changed candidate identity")
            if state.get("run_attempt") != 1:
                reject(f"ambiguous rerun attempt for exact candidate {selected}")
            if state.get("status") == "completed":
                if state.get("conclusion") != "success":
                    reject(f"CodeQL run {selected} ended {state.get('conclusion')}")
                inspect(repo, sha, wf, selected, verdict)
                return
        time.sleep(poll_seconds)
    reject(f"timed out waiting for exact-source CodeQL run {selected}" if selected else "timed out discovering auto-dispatched CodeQL run")


def self_test() -> None:
    repo, sha = "owner/repo", "a" * 40
    wf = {"id": 42, "path": WORKFLOW, "state": "active"}
    run = {"id": 7, "workflow_id": 42, "path": WORKFLOW, "event": "workflow_dispatch", "head_repository": {"full_name": repo}, "head_branch": "main", "head_sha": "b" * 40, "display_title": f"CodeQL source {sha}", "status": "completed", "conclusion": "success", "run_attempt": 1, "created_at": "2026-10-15T00:00:00Z"}
    jobs = {"total_count": len(LANGUAGES), "jobs": [{"name": f"Analyze {language}", "status": "completed", "conclusion": "success"} for language in LANGUAGES]}
    artifacts = {"total_count": 2 * len(LANGUAGES), "artifacts": [{"name": f"{prefix}{sha}-{language}", "id": index + 1, "size_in_bytes": 100, "expired": False, "workflow_run": {"head_sha": run["head_sha"]}} for index, (prefix, language) in enumerate((prefix, language) for prefix in ("codeql-", "codeql-source-") for language in LANGUAGES)]}
    metadata(run, wf, jobs, artifacts, repo, sha)
    for label, mutate in (
        ("failed", lambda r, j, a: r.update(conclusion="failure")),
        ("rerun", lambda r, j, a: r.update(run_attempt=2)),
        ("language", lambda r, j, a: j["jobs"].pop()),
        ("expired", lambda r, j, a: a["artifacts"][0].update(expired=True)),
        ("missing artifact", lambda r, j, a: a["artifacts"].pop()),
        ("wrong source", lambda r, j, a: r["head_repository"].update(full_name="other/repo")),
    ):
        r, j, a = json.loads(json.dumps(run)), json.loads(json.dumps(jobs)), json.loads(json.dumps(artifacts))
        mutate(r, j, a)
        try:
            metadata(r, wf, j, a, repo, sha)
        except ValueError:
            pass
        else:
            raise AssertionError(f"fail-open metadata case: {label}")

    with mock.patch.object(sys.modules[__name__], "api") as patched:
        patched.side_effect = [
            {"object": {"sha": "b" * 40}},
            {"status": "diverged", "base_commit": {"sha": sha}, "merge_base_commit": {"sha": "b" * 40}},
        ]
        try:
            ancestry(repo, sha)
        except ValueError as exc:
            assert "not proven reachable" in str(exc)
        else:
            raise AssertionError("source-drift candidate was accepted")

    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "source-identity.json"
        doc = {
            "schema": 1, "repository": repo, "workflow_path": WORKFLOW,
            "workflow_ref": f"{repo}/{WORKFLOW}@refs/heads/main",
            "workflow_sha": run["head_sha"], "event_name": run["event"],
            "event_sha": run["head_sha"], "candidate_sha": sha,
            "checkout_sha": sha, "candidate_tree": "c" * 40,
            "run_id": run["id"], "run_attempt": 1, "language": "rust",
        }
        source.write_text(json.dumps(doc), encoding="utf-8")
        manifest(Path(tmp), repo, run, sha, "c" * 40, "rust")
        source.write_text(json.dumps({**doc, "candidate_sha": "d" * 40}), encoding="utf-8")
        try:
            manifest(Path(tmp), repo, run, sha, "c" * 40, "rust")
        except ValueError as exc:
            assert "provenance mismatch" in str(exc)
        else:
            raise AssertionError("wrong-SHA source manifest was accepted")
        source.write_text("{bad", encoding="utf-8")
        try:
            manifest(Path(tmp), repo, run, sha, "c" * 40, "rust")
        except json.JSONDecodeError:
            pass
        else:
            raise AssertionError("malformed source manifest was accepted")

    def candidate(status: str, conclusion=None, run_id=71, attempt=1):
        return {**run, "id": run_id, "status": status, "conclusion": conclusion, "run_attempt": attempt}

    def exercise(initial, polled, dispatch_expected: bool, error: str | None = None):
        calls = [initial if isinstance(initial, list) else ([] if initial is None else [initial])]
        if initial is None:
            calls.append([candidate("queued")])
        with (
            mock.patch.dict(os.environ, {"GH_TOKEN": "fixture"}),
            mock.patch.object(sys.modules[__name__], "ancestry", return_value=sha),
            mock.patch.object(sys.modules[__name__], "workflow", return_value=wf),
            mock.patch.object(sys.modules[__name__], "candidates", side_effect=calls),
            mock.patch.object(sys.modules[__name__], "api", return_value=polled or {}),
            mock.patch.object(sys.modules[__name__], "inspect", return_value=None) as inspected,
            mock.patch.object(sys.modules[__name__], "gh", return_value="") as dispatched,
            mock.patch.object(time, "monotonic", side_effect=[0, 0, 1]),
            mock.patch.object(time, "sleep", return_value=None),
        ):
            try:
                verify_live(repo, sha, Path("verdict.py"), 10, 1)
            except ValueError as exc:
                if not error or error not in str(exc):
                    raise
            else:
                if error:
                    raise AssertionError(f"expected error {error}")
                assert inspected.call_count == 1
            assert dispatched.called is dispatch_expected

    exercise(candidate("completed", "success"), None, False)
    exercise(candidate("completed", "success", attempt=2), None, False, "ambiguous rerun")
    exercise(candidate("in_progress"), candidate("completed", "success"), False)
    exercise(None, candidate("completed", "success"), True)
    exercise(candidate("completed", "failure"), None, False, "failed existing")
    exercise(candidate("in_progress", attempt=2), None, False, "ambiguous rerun")
    exercise([candidate("in_progress", run_id=71), candidate("queued", run_id=72)], None, False, "ambiguous active")
    exercise([candidate("completed", "success", run_id=71),
              candidate("completed", "success", run_id=72)], None, False, "ambiguous duplicate")
    exercise([candidate("completed", "success", run_id=71),
              candidate("completed", "failure", run_id=72)], None, False, "failed existing")

    with mock.patch.dict(os.environ, {"GH_TOKEN": "fixture"}), mock.patch.object(sys.modules[__name__], "ancestry", return_value=sha), mock.patch.object(sys.modules[__name__], "workflow", return_value=wf), mock.patch.object(sys.modules[__name__], "candidates", return_value=[]), mock.patch.object(sys.modules[__name__], "gh", side_effect=subprocess.CalledProcessError(1, ["gh"])):
        try:
            verify_live(repo, sha, Path("verdict.py"), 1, 1)
        except subprocess.CalledProcessError:
            pass
        else:
            raise AssertionError("dispatch failure did not fail closed")
    with mock.patch.dict(os.environ, {"GH_TOKEN": "fixture"}), mock.patch.object(sys.modules[__name__], "ancestry", return_value=sha), mock.patch.object(sys.modules[__name__], "workflow", return_value=wf), mock.patch.object(sys.modules[__name__], "candidates", return_value=[candidate("in_progress")]), mock.patch.object(sys.modules[__name__], "api", side_effect=OSError("poll unavailable")), mock.patch.object(time, "monotonic", side_effect=[0, 0]):
        try:
            verify_live(repo, sha, Path("verdict.py"), 1, 1)
        except ValueError as exc:
            assert "failed polling" in str(exc)
        else:
            raise AssertionError("poll API failure did not fail closed")
    with mock.patch.dict(os.environ, {"GH_TOKEN": "fixture"}), mock.patch.object(sys.modules[__name__], "ancestry", return_value=sha), mock.patch.object(sys.modules[__name__], "workflow", return_value=wf), mock.patch.object(sys.modules[__name__], "candidates", return_value=[]), mock.patch.object(sys.modules[__name__], "gh", return_value=""), mock.patch.object(time, "monotonic", side_effect=[0, 2]):
        try:
            verify_live(repo, sha, Path("verdict.py"), 1, 1)
        except ValueError as exc:
            assert "timed out" in str(exc)
        else:
            raise AssertionError("timeout did not fail closed")
    print("four-language exact-SHA CodeQL reuse/dispatch/join negative controls passed")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--repo")
    parser.add_argument("--sha")
    parser.add_argument("--timeout-seconds", type=int, default=4200)
    parser.add_argument("--poll-seconds", type=int, default=15)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    repo = args.repo or os.environ.get("GITHUB_REPOSITORY", "")
    if not repo or not args.sha:
        parser.error("--repo/GITHUB_REPOSITORY and --sha are required")
    verdict = Path(__file__).resolve().parents[2] / ".github/scripts/release-codeql-verdict.py"
    try:
        verify_live(repo, args.sha, verdict, args.timeout_seconds, args.poll_seconds)
    except (ValueError, subprocess.CalledProcessError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"::error::Release-candidate CodeQL preflight rejected: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
