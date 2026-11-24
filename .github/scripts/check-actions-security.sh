#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="${RUNNER_TEMP:?runner temp required}/zed-workflow-security"
mkdir -p "$TOOLS_DIR"
(
  cd "$ROOT/.github/tools/actionlint"
  go build -mod=mod -o "$TOOLS_DIR/actionlint" github.com/rhysd/actionlint/cmd/actionlint
)
"$TOOLS_DIR/actionlint" -version
"$TOOLS_DIR/actionlint" "$ROOT"/.github/workflows/*.yml
fixture_dir="$TOOLS_DIR/negative/.github/workflows"
mkdir -p "$fixture_dir"
cat > "$fixture_dir/unsafe.yml" <<'YAML'
name: Deliberately Unsafe
on: push
permissions: write-all
jobs:
  unsafe:
    runs-on: ubuntu-nonexistent-runner
    steps:
      - uses: actions/checkout@v4
YAML
status=0
output="$("$TOOLS_DIR/actionlint" -no-color "$fixture_dir/unsafe.yml" 2>&1)" || status=$?
if [ "$status" -eq 0 ] || ! grep -q runner-label <<<"$output"; then
  printf "%s\n" "$output" >&2
  exit 1
fi
echo "zizmor_fixture=$fixture_dir" >> "${GITHUB_OUTPUT:?GitHub output required}"
echo "actionlint negative control: PASS"
