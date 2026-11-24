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

// Derive the live companion fixture from the actual registry; the test must
// remain valid when independent evidence modules are added or retired.
const companionPattern = /(?:^|\/)(Cargo\.lock|settings\.gradle(?:\.kts)?|gradle\.lockfile|go\.sum|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/;
const registry = JSON.parse(read(policy));
const companionOwner = registry.entries.find(e=>e.strategy==="REVIEWED_FREEZE" && e.source_paths.some(p=>companionPattern.test(p)));
assert.ok(companionOwner, "expected a reviewed companion path to exercise");
const companion = companionOwner.source_paths.find(p=>companionPattern.test(p));
const mutateRegistry = change => evaluate(policy, source=>{
  const data=JSON.parse(source);
  change(data.entries);
  return JSON.stringify(data);
});
test("each exact declaration path belongs to its root owner",()=>{
  assert.match(mutateRegistry(entries=>{
    const entry=entries.find(e=>e.id===companionOwner.id);
    entry.source_paths=entry.source_paths.filter(p=>p!==companion);
  }).join("\n"),/missing exact dependency source path/);
  assert.match(mutateRegistry(entries=>{
    const other=entries.find(e=>e.id!==companionOwner.id && e.provenance?.ecosystem);
    other.source_paths.push(companion);
  }).join("\n"),/ambiguous dependency path ownership/);
  assert.match(mutateRegistry(entries=>{
    const entry=entries.find(e=>e.id===companionOwner.id);
    entries.push({...entry,id:entry.id+"-duplicate",source_paths:[companion]});
  }).join("\n"),/ambiguous dependency root/);
});
test("new companion declarations fail closed without exact ownership",()=>{
  const example=paths.find(p=>p.endsWith("/go.mod")||p==="go.mod");
  assert.ok(example, "expected a managed Go module");
  const sum=example.replace(/go\.mod$/,"go.sum");
  if (!paths.includes(sum)) assert.match(validateLifecycle([...paths,sum],read).join("\n"),/missing exact dependency source path/);
  else assert.match(mutateRegistry(entries=>{
    const owner=entries.find(e=>e.source_paths.includes(sum));
    assert.ok(owner);
    owner.source_paths=owner.source_paths.filter(p=>p!==sum);
  }).join("\n"),/missing exact dependency source path/);
  for (const path of ["unowned-module/Cargo.lock","unowned-module/package-lock.json","unowned-module/go.sum"]) {
    const errors=validateLifecycle([...paths,path],read).join("\n");
    assert.match(errors,/orphan dependency companion without manifest/);
    assert.match(errors,/missing or ambiguous dependency root/);
  }
  for (const path of ["new-module/settings.gradle.kts","new-module/build.gradle.kts","new-module/package.json",".gitmodules"]) {
    if (!paths.includes(path)) assert.match(validateLifecycle([...paths,path],read).join("\n"),/missing or ambiguous dependency root/);
  }
});
test("a registry owner cannot outlive its root or change freeze into silent native coverage",()=>{
  assert.match(mutateRegistry(entries=>{
    const entry=entries.find(e=>e.id===companionOwner.id);
    entry.provenance.directory+="-missing";
  }).join("\n"),/orphan dependency root owner/);
  assert.match(evaluate(".github/dependabot.yml",source=>source+"\n  - package-ecosystem: "+companionOwner.provenance.ecosystem+"\n    directory: "+companionOwner.provenance.directory+"\n").join("\n"),/dependency root strategy mismatch/);
});
