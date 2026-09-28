import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const inventoryFile = path.join(root, "docs", "capability-inventory.md");
const matrixFile = path.join(root, "protocol", "d007-capability-acceptance.json");

const STATES = new Set([
  "verified",
  "implemented",
  "planned",
  "blocked-zed-api",
  "blocked-upstream",
  "zed-native-equivalent",
  "not-pursued",
]);

function inventoryRows() {
  const rows = [];
  for (const line of fs.readFileSync(inventoryFile, "utf8").split("\n")) {
    if (!line.startsWith("| ")) continue;
    const columns = line.split("|").slice(1, -1).map((value) => value.trim());
    if (columns.length < 2) continue;
    const state = columns[1].replaceAll("`", "");
    const capability = columns[0];
    if (!STATES.has(state) || STATES.has(capability.replaceAll("`", ""))) continue;
    rows.push({ capability, historicalState: state });
  }
  return rows;
}

test("D007 classifies every tracked capability exactly once", () => {
  const inventory = inventoryRows();
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));

  assert.equal(inventory.length, 59);
  assert.equal(matrix.schemaVersion, 1);
  assert.equal(matrix.decision, "D007");
  assert.equal(matrix.entries.length, inventory.length);

  const expected = new Map(inventory.map((entry) => [entry.capability, entry.historicalState]));
  const seen = new Set();
  for (const entry of matrix.entries) {
    assert.equal(typeof entry.capability, "string");
    assert.equal(seen.has(entry.capability), false, `duplicate D007 capability: ${entry.capability}`);
    seen.add(entry.capability);

    assert.equal(expected.has(entry.capability), true, `unknown D007 capability: ${entry.capability}`);
    assert.equal(entry.historicalState, expected.get(entry.capability));
    assert.match(entry.classification, /^(?:unaffected|existing-blocker|not-pursued|retained-requires-standalone-evidence|redesigned-requires-evidence)$/);
    assert.equal(typeof entry.evidenceGroup, "string");
    assert.notEqual(entry.evidenceGroup.length, 0);
    assert.equal(typeof entry.reason, "string");
    assert.notEqual(entry.reason.length, 0);

    if (
      entry.classification === "retained-requires-standalone-evidence" ||
      entry.classification === "redesigned-requires-evidence"
    ) {
      assert.equal(
        entry.currentClaim,
        "pending-d007",
        `${entry.capability} must not reuse historical evidence as a current standalone claim`,
      );
      assert.equal(
        Array.isArray(entry.requiredEvidence) && entry.requiredEvidence.length > 0,
        true,
        `${entry.capability} must name exact D007 evidence`,
      );
      assert.equal(
        entry.requiredEvidence.some((requirement) =>
          requirement?.source === "unmapped-d007-evidence"
        ),
        false,
        `${entry.capability} must not use an unmapped D007 evidence placeholder`,
      );
    }
    if (entry.classification === "existing-blocker") {
      assert.equal(entry.currentClaim, entry.historicalState);
    }
    if (entry.classification === "not-pursued") {
      assert.equal(entry.currentClaim, "not-pursued");
    }
  }

  assert.deepEqual([...seen].sort(), [...expected.keys()].sort());
});

test("D007 explicitly classifies the private-Java dependent redesigns", () => {
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));
  const byCapability = new Map(matrix.entries.map((entry) => [entry.capability, entry]));

  for (const capability of [
    "Executable Boot projects discovery",
    "Spring XML config support",
    "Embedded Spring Tools MCP server",
    "Start Spring Boot Language Server on demand",
    "Spring Java type/index resolution",
    "Spring project/index synchronization",
    "Spring runtime Java requirement diagnostic",
  ]) {
    assert.equal(
      byCapability.get(capability)?.classification,
      "redesigned-requires-evidence",
      capability,
    );
    assert.equal(byCapability.get(capability)?.currentClaim, "pending-d007");
  }

  assert.equal(
    byCapability.get("References and implementations")?.classification,
    "unaffected",
  );
  assert.equal(
    byCapability.get("References and implementations")?.currentClaim,
    "verified",
  );

  assert.equal(
    byCapability.get("Spring-specific document highlights")?.currentClaim,
    "blocked-zed-api",
  );
  assert.equal(
    byCapability.get("Inlay-hint label commands (pom \"Upgrade to the Latest Patch\")")?.currentClaim,
    "blocked-zed-api",
  );
  assert.equal(
    byCapability.get("Explain SpEL / queries / AOP (AI assistant)")?.currentClaim,
    "blocked-zed-api",
  );
});
