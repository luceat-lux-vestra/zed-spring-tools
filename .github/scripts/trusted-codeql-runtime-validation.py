#!/usr/bin/env python3
"""Selective read-only CodeQL PR runtime compatibility contract."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
SHA = re.compile(r"[0-9a-f]{40}\Z")
ACTION_LINE = re.compile(
    r"^\s*uses:\s*github/codeql-action/(?P<action>init|analyze)@"
    r"(?P<sha>[0-9a-f]{40})(?:\s+#.*)?\s*$"
)
SIMPLE_STATUSES = frozenset({"added", "modified", "removed"})
MOVE_STATUSES = frozenset({"renamed", "copied"})
RELEVANT_PATHS = frozenset({
    ".github/workflows/codeql.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/release-codeql-preflight.yml",
    ".github/merge-gate-policy.json",
    ".github/codeql-java-config.yml",
    ".github/scripts/trusted-codeql-runtime-validation.py",
    ".github/scripts/release-codeql-verdict.py",
    "tools/ci/release_codeql_preflight.py",
    "scripts/check-workflow-policy.mjs",
    "scripts/test/check-workflow-policy.test.mjs",
    "scripts/test/release-codeql-policy.test.mjs",
})


def reject(message: str) -> None:
    raise ValueError(message)


def safe_path(value: object) -> str:
    if not isinstance(value, str) or not value or value.startswith("/") or "\\" in value:
        reject(f"unsafe repository path: {value!r}")
    parts = PurePosixPath(value).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        reject(f"unsafe repository path: {value!r}")
    return value


def flatten_pages(value: object) -> list[dict]:
    if not isinstance(value, list) or not value:
        reject("changed-file pagination is missing or empty")
    rows: list[dict] = []
    for page in value:
        if not isinstance(page, list):
            reject("changed-file pagination contains a non-list page")
        for row in page:
            if not isinstance(row, dict):
                reject("changed-file pagination contains a malformed record")
            rows.append(row)
    return rows


def validate_codeql_pin_only_patch(row: dict) -> None:
    if row.get("status") != "modified":
        reject("direct codeql.yml change is supported only as an in-place pin replacement")
    patch = row.get("patch")
    if not isinstance(patch, str) or not patch.strip():
        reject("direct codeql.yml change lacks a complete reviewable patch")
    changed: list[tuple[str, str, str]] = []
    for raw in patch.splitlines():
        if not raw or raw.startswith(("+++", "---", "@@")) or raw[0] not in "+-":
            continue
        match = ACTION_LINE.fullmatch(raw[1:])
        if match is None:
            reject("direct codeql.yml mutation is not an immutable init/analyze pin-only change")
        changed.append((raw[0], match.group("action"), match.group("sha")))
    if len(changed) != 4:
        reject("direct codeql.yml pin-only change must replace init and analyze exactly once")
    old = {action: sha for sign, action, sha in changed if sign == "-"}
    new = {action: sha for sign, action, sha in changed if sign == "+"}
    if set(old) != {"init", "analyze"} or set(new) != {"init", "analyze"}:
        reject("direct codeql.yml pin-only change must cover both init and analyze")
    if old["init"] != old["analyze"] or new["init"] != new["analyze"]:
        reject("CodeQL init/analyze pins must move together")
    if old["init"] == new["init"]:
        reject("CodeQL pin-only patch did not change the immutable pin")


def classify(
    pr: dict,
    pages: object,
    *,
    repo: str,
    base: str,
    head: str,
    head_repo: str,
) -> bool:
    if not SHA.fullmatch(base) or not SHA.fullmatch(head):
        reject("invalid immutable PR base/head identity")
    if not isinstance(repo, str) or "/" not in repo or not isinstance(head_repo, str) or "/" not in head_repo:
        reject("invalid repository identity")
    if not isinstance(pr, dict):
        reject("PR metadata is malformed")
    if pr.get("base", {}).get("sha") != base or pr.get("head", {}).get("sha") != head:
        reject("live PR base/head identity mismatch")
    if pr.get("base", {}).get("repo", {}).get("full_name") != repo:
        reject("live PR base repository mismatch")
    if pr.get("head", {}).get("repo", {}).get("full_name") != head_repo:
        reject("live PR head repository mismatch")
    count = pr.get("changed_files")
    if not isinstance(count, int) or count < 1 or count > 3000:
        reject("live PR changed-file count is missing or outside supported bounds")

    rows = flatten_pages(pages)
    if len(rows) != count:
        reject(f"changed-file pagination count mismatch: expected {count}, got {len(rows)}")

    seen: set[tuple[str, str, str | None]] = set()
    required = False
    for row in rows:
        status = row.get("status")
        if status not in SIMPLE_STATUSES | MOVE_STATUSES:
            reject(f"unsupported changed-file status: {status!r}")
        filename = safe_path(row.get("filename"))
        previous = row.get("previous_filename")
        if status in MOVE_STATUSES:
            previous = safe_path(previous)
        elif previous is not None:
            previous = safe_path(previous)
        key = (status, filename, previous)
        if key in seen:
            reject(f"duplicate changed-file record: {filename}")
        seen.add(key)

        touched = {filename}
        if previous:
            touched.add(previous)
        if ".github/workflows/codeql.yml" in touched:
            validate_codeql_pin_only_patch(row)
            required = True
        if touched & RELEVANT_PATHS:
            required = True
    return required


def action_pins(source: str) -> dict[str, str]:
    found: dict[str, list[str]] = {"init": [], "analyze": []}
    for match in re.finditer(
        r"github/codeql-action/(init|analyze)@([0-9a-f]{40})(?:\s+#.*)?",
        source,
    ):
        found[match.group(1)].append(match.group(2))
    if any(len(found[name]) != 1 for name in found):
        reject("expected exactly one CodeQL init and analyze invocation")
    return {name: values[0] for name, values in found.items()}


def job_block(source: str, job: str) -> str:
    match = re.search(
        rf"(?ms)^  {re.escape(job)}:\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\n|\Z)",
        source,
    )
    if match is None:
        reject(f"missing canonical CI job {job}")
    return match.group(0)


def check_contract(root: Path = ROOT) -> None:
    codeql = (root / ".github/workflows/codeql.yml").read_text(encoding="utf-8")
    ci = (root / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    policy = json.loads((root / ".github/merge-gate-policy.json").read_text(encoding="utf-8"))

    if re.search(r"(?m)^  (?:pull_request|pull_request_target|push):", codeql):
        reject("production CodeQL routine PR/push trigger reintroduced")
    for fragment in (
        "workflow_dispatch:",
        "schedule:",
        "language: actions",
        "language: javascript-typescript",
        "language: rust",
        "language: java-kotlin",
        "security-events: write",
        "upload: always",
        "retention-days: 90",
        "Reject unscanned Kotlin sources",
        "persist-credentials: false",
    ):
        if fragment not in codeql:
            reject(f"production CodeQL contract missing {fragment!r}")
    production = action_pins(codeql)
    if production["init"] != production["analyze"]:
        reject("production CodeQL init/analyze pins diverged")

    runtime = job_block(ci, "codeql-runtime")
    for fragment in (
        "name: codeql-runtime",
        "timeout-minutes: 12",
        "contents: read",
        "pull-requests: read",
        "github.event.pull_request.head.repo.full_name",
        "github.event.pull_request.head.sha",
        "persist-credentials: false",
        "trusted-codeql-runtime-validation.py self-test",
        "trusted-codeql-runtime-validation.py check-contract",
        "languages: actions",
        "build-mode: none",
        'category: "/language:actions"',
        "upload: never",
        "runner.temp",
        "trusted-codeql-runtime-validation.py verify",
    ):
        if fragment not in runtime:
            reject(f"PR CodeQL runtime contract missing {fragment!r}")
    if re.search(r"(?m)^    if:", runtime):
        reject("PR CodeQL runtime must remain an always-present merge component")
    for forbidden in (
        "security-events: write",
        "actions: write",
        "id-token: write",
        "packages: write",
        "upload-artifact@",
        "upload: always",
    ):
        if forbidden in runtime:
            reject(f"PR CodeQL runtime contains forbidden authority {forbidden!r}")
    adapter = action_pins(runtime)
    if adapter["init"] != adapter["analyze"] or adapter["init"] != production["init"]:
        reject("PR CodeQL runtime pin does not match production init/analyze pin")

    for fragment in (
        "echo 'required=true'",
        "trusted-codeql-runtime-validation.py?ref=$BASE_SHA",
        "pulls/$PR_NUMBER",
        "files?per_page=100&page=$page",
        "--pr-json",
        "--files-json",
        "--head-repo",
    ):
        if fragment not in runtime:
            reject(f"trusted-base CodeQL classifier contract missing {fragment!r}")

    merge = next(
        (entry for entry in policy.get("contexts", []) if entry.get("context") == "Merge Gate"),
        None,
    )
    if not isinstance(merge, dict):
        reject("Merge Gate policy entry is missing")
    components = [entry.get("job") for entry in merge.get("components", [])]
    if components != [
        "rust",
        "coordinator",
        "review",
        "workflow-security",
        "platform-validation",
        "codeql-runtime",
    ]:
        reject("Merge Gate policy component order/set drifted")
    gate = job_block(ci, "merge-gate")
    if "needs: [rust, coordinator, review, workflow-security, platform-validation, codeql-runtime]" not in gate:
        reject("Merge Gate does not depend on the exact six components")
    if "for name in rust coordinator review workflow-security platform-validation codeql-runtime; do" not in gate:
        reject("Merge Gate local result aggregation does not cover the exact six components")


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        reject(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def prove_no_production_promotion(head: str, root: Path = ROOT) -> None:
    preflight = load_module(root / "tools/ci/release_codeql_preflight.py", "zst_release_codeql_preflight")
    repo = "luceat-lux-vestra/zed-spring-tools"
    run = {
        "workflow_id": 1,
        "path": ".github/workflows/ci.yml",
        "event": "pull_request",
        "head_branch": "feature",
        "head_repository": {"full_name": repo},
        "status": "completed",
        "conclusion": "success",
        "run_attempt": 1,
    }
    try:
        preflight.metadata(
            run,
            {"id": 1},
            {"jobs": [], "total_count": 0},
            {"artifacts": [], "total_count": 0},
            repo,
            head,
        )
    except ValueError as exc:
        if "untrusted or mismatched CodeQL run identity/state/source" not in str(exc):
            raise
    else:
        reject("pull_request CodeQL runtime evidence was accepted as production evidence")


def verify_runtime(directory: Path, head: str, root: Path = ROOT) -> dict:
    verdict = load_module(root / ".github/scripts/release-codeql-verdict.py", "zst_release_codeql_verdict")
    result = verdict.check(directory, "actions", head)
    prove_no_production_promotion(head, root)
    return {
        **result,
        "event": "pull_request",
        "source_sha": head,
        "trust_domain": "untrusted-pr-codeql-runtime",
        "production_evidence": False,
    }


def self_test(root: Path = ROOT) -> None:
    repo = "luceat-lux-vestra/zed-spring-tools"
    base = "1" * 40
    head = "2" * 40

    def pr(count: int) -> dict:
        return {
            "changed_files": count,
            "base": {"sha": base, "repo": {"full_name": repo}},
            "head": {"sha": head, "repo": {"full_name": repo}},
        }

    assert classify(
        pr(1),
        [[{"status": "modified", "filename": ".github/workflows/ci.yml"}]],
        repo=repo, base=base, head=head, head_repo=repo,
    )
    assert not classify(
        pr(1),
        [[{"status": "modified", "filename": "README.md"}]],
        repo=repo, base=base, head=head, head_repo=repo,
    )

    old = "a" * 40
    new = "b" * 40
    patch = (
        "@@ -1,2 +1,2 @@\n"
        f"-        uses: github/codeql-action/init@{old}\n"
        f"+        uses: github/codeql-action/init@{new}\n"
        f"-        uses: github/codeql-action/analyze@{old}\n"
        f"+        uses: github/codeql-action/analyze@{new}\n"
    )
    assert classify(
        pr(1),
        [[{"status": "modified", "filename": ".github/workflows/codeql.yml", "patch": patch}]],
        repo=repo, base=base, head=head, head_repo=repo,
    )

    bad = [
        (pr(2), [[{"status": "modified", "filename": ".github/workflows/ci.yml"}]]),
        (pr(1), [[{"status": "mystery", "filename": ".github/workflows/ci.yml"}]]),
        (pr(1), [[{"status": "modified", "filename": "../ci.yml"}]]),
        (pr(2), [[
            {"status": "modified", "filename": ".github/workflows/ci.yml"},
            {"status": "modified", "filename": ".github/workflows/ci.yml"},
        ]]),
        (pr(1), [[{
            "status": "renamed",
            "filename": ".github/workflows/ci.yml",
            "previous_filename": "../old-ci.yml",
        }]]),
    ]
    for meta, pages in bad:
        try:
            classify(meta, pages, repo=repo, base=base, head=head, head_repo=repo)
        except ValueError:
            pass
        else:
            raise AssertionError("unsafe or incomplete changed-file evidence was accepted")

    try:
        classify(
            pr(1),
            [[{
                "status": "modified",
                "filename": ".github/workflows/codeql.yml",
                "patch": "@@ -1 +1 @@\n-upload: always\n+upload: never\n",
            }]],
            repo=repo, base=base, head=head, head_repo=repo,
        )
    except ValueError:
        pass
    else:
        raise AssertionError("unsupported direct codeql.yml mutation was accepted")

    prove_no_production_promotion(head, root)
    verdict = load_module(
        root / ".github/scripts/release-codeql-verdict.py",
        "zst_release_codeql_verdict_selftest",
    )
    with tempfile.TemporaryDirectory() as tmp:
        try:
            verdict.check(Path(tmp), "actions", head)
        except ValueError as exc:
            if "expected exactly one SARIF file" not in str(exc):
                raise
        else:
            raise AssertionError("missing SARIF was accepted")

    check_contract(root)
    print("trusted CodeQL PR runtime adapter self-tests passed")


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("self-test")
    sub.add_parser("check-contract")

    classify_parser = sub.add_parser("classify")
    classify_parser.add_argument("--pr-json", type=Path, required=True)
    classify_parser.add_argument("--files-json", type=Path, required=True)
    classify_parser.add_argument("--repo", required=True)
    classify_parser.add_argument("--base", required=True)
    classify_parser.add_argument("--head", required=True)
    classify_parser.add_argument("--head-repo", required=True)
    classify_parser.add_argument("--github-output", type=Path, required=True)

    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("--sarif-dir", type=Path, required=True)
    verify_parser.add_argument("--head", required=True)

    args = parser.parse_args()
    if args.command == "self-test":
        self_test()
    elif args.command == "check-contract":
        check_contract()
        print("selective CodeQL PR runtime contract: PASS")
    elif args.command == "classify":
        required = classify(
            json.loads(args.pr_json.read_text(encoding="utf-8")),
            json.loads(args.files_json.read_text(encoding="utf-8")),
            repo=args.repo,
            base=args.base,
            head=args.head,
            head_repo=args.head_repo,
        )
        with args.github_output.open("a", encoding="utf-8") as stream:
            stream.write(f"required={'true' if required else 'false'}\n")
        print(f"CodeQL runtime required: {'true' if required else 'false'}")
    elif args.command == "verify":
        if not SHA.fullmatch(args.head):
            reject("verify requires an exact immutable PR-head SHA")
        print(json.dumps(verify_runtime(args.sarif_dir, args.head), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
