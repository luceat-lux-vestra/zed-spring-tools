import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("D007 capability acceptance summary stays pending when evidence is missing", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "d007-acceptance-summary-"));
  try {
    fs.writeFileSync(
      path.join(scratch, "staged.json"),
      JSON.stringify({ sourceHead: "a".repeat(40) }),
    );
    const output = path.join(scratch, "summary.json");
    const result = spawnSync(
      process.execPath,
      [
        path.resolve("scripts", "d007-capability-acceptance-summary.mjs"),
        scratch,
        output,
      ],
      { encoding: "utf8", shell: false },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(summary.sourceHead, "a".repeat(40));
    assert.equal(summary.totalCapabilities, 59);
    assert.equal(summary.failedCount, 0);
    assert.equal(summary.pendingCount > 0, true);
    assert.equal(summary.terminalCount > 0, true);
    assert.equal(summary.releaseAcceptance, "PENDING_OR_FAIL");
    assert.equal(
      summary.unresolvedCapabilities.includes("References and implementations"),
      false,
      "official-Java-owned references/implementations must not be reopened by D007",
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("D007 capability acceptance summary rejects explicit failing evidence", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "d007-acceptance-fail-"));
  try {
    fs.writeFileSync(
      path.join(scratch, "standalone-capability-regression.json"),
      JSON.stringify({
        sourceHead: "b".repeat(40),
        checks: {
          propertiesCompletion: { status: "fail" },
        },
      }),
    );
    const output = path.join(scratch, "summary.json");
    const result = spawnSync(
      process.execPath,
      [
        path.resolve("scripts", "d007-capability-acceptance-summary.mjs"),
        scratch,
        output,
      ],
      { encoding: "utf8", shell: false },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(summary.failedCount > 0, true);
    const property = summary.entries.find(
      (entry) => entry.capability === "Property key/value completion in `.properties`",
    );
    assert.equal(property?.acceptance, "FAIL");
    assert.equal(property?.effectiveClaim, "pending-d007");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
