import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLifecycle } from "../check-dependency-lifecycle.mjs";
const root=join(dirname(fileURLToPath(import.meta.url)),"../..");
const paths=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(Boolean);
const read=p=>readFileSync(join(root,p),"utf8");
const policy=".github/dependency-update-policy.json",ci=".github/workflows/ci.yml",drift=".github/workflows/repository-drift.yml";
const evaluate=(p,change)=>validateLifecycle(paths,name=>name===p?change(read(name)):read(name));
test("actual registry covers tracked manifests and workflow selectors",()=>assert.deepEqual(validateLifecycle(paths,read),[]));
test("unregistered new manifest fails closed",()=>assert.match(validateLifecycle([...paths,"new-module/pom.xml"],read).join("\n"),/missing or ambiguous dependency root/));
test("expired evidence freeze fails",()=>{
  const problems=evaluate(policy,source=>{const data=JSON.parse(source);data.entries.find(e=>e.strategy==="REVIEWED_FREEZE").revisit.review_by="2000-01-01";return JSON.stringify(data);});
  assert.match(problems.join("\n"),/expired or incomplete freeze/);
});
test("loss of native updater fails",()=>assert.match(evaluate(".github/dependabot.yml",s=>s.replace("directory: /.github/tools/actionlint","directory: /missing")).join("\n"),/strategy mismatch/));
test("stale Node selector and disabled freshness fail",()=>{
  assert.match(evaluate(drift,s=>s.replace("node-version: 'lts/*'","node-version: 20")).join("\n"),/non-LTS Node/);
  assert.match(evaluate(drift,s=>s.replace("check-latest: true","check-latest: false")).join("\n"),/missing fresh resolution/);
});
test("unowned matrix runner and missing negative verifier fail",()=>{
  assert.match(evaluate(".github/workflows/platform-validation.yml",s=>s.replace("runner: ubuntu-latest","runner: ubuntu-24.04")).join("\n"),/explicit runner ownership/);
  assert.match(evaluate(ci,s=>s.replace("test \"$ZIZMOR_NEGATIVE_OUTCOME\" = failure","echo unchecked")).join("\n"),/negative outcome verifier/);
});
test("native-managed fixture requires compile evidence",()=>assert.match(evaluate(ci,s=>s.replace("run: mvn -B -ntp -f tests/fixtures/spring-codelens-showcase/pom.xml compile","run: echo unchecked")).join("\n"),/active fixture compile gate missing/));

test("zizmor requires official job token and strict offline scan contract",()=>{
  const token = "token: " + String.fromCharCode(36,123,123) + " github.token }}";
  const mutants = [
    [token, "token: ''", /zizmor trust contract/],
    [token, "token: " + String.fromCharCode(36,123,123) + " secrets.PAT }}", /zizmor trust contract/],
    ["online-audits: false", "online-audits: true", /zizmor trust contract/],
    ["advanced-security: false", "advanced-security: true", /zizmor trust contract/],
    ["fail-on-no-inputs: true", "fail-on-no-inputs: false", /zizmor trust contract/],
    ["annotations: false", "annotations: false\n          min-severity: high", /zizmor unreviewed filtering/],
    ['run: rm -f "$RUNNER_TEMP/zizmor"', "run: echo unchecked", /negative control output reset missing/],
    ["    permissions:\n      contents: read\n    steps:", "    permissions:\n      contents: write\n    steps:", /token scope/],
    ["    permissions:\n      contents: read\n    steps:", "    permissions:\n      contents: read\n      pull-requests: read\n    steps:", /token scope/],
  ];
  for (const [from,to,expected] of mutants) {
    assert.ok(read(ci).includes(from), "stale negative fixture: "+from);
    assert.match(evaluate(ci,s=>s.replace(from,to)).join("\n"),expected);
  }
});
