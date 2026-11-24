#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function validateLifecycle(paths, read, now = new Date().toISOString().slice(0, 10)) {
  const failures = [];
  const fail = message => failures.push(message);
  const {entries} = JSON.parse(read(".github/dependency-update-policy.json"));
  const tracked = new Set(paths);
  const deps = read(".github/dependabot.yml");
  const managed = new Set([...deps.matchAll(/^[ \t]*-[ \t]*package-ecosystem:[ \t]*["']?([a-z-]+)["']?[ \t]*\r?\n[ \t]*directory:[ \t]*["']?(\/[^"'\s]*)["']?/gm)].map(m=>m[1]+":"+m[2]));
  const ids = new Set();
  for (const e of entries) {
    if (ids.has(e.id)) fail("duplicate policy id "+e.id);
    ids.add(e.id);
    if (!["DEPENDABOT","CHANNEL","UPDATE_PR","REVIEWED_FREEZE"].includes(e.strategy) || !e.owner || !e.authority || !e.mechanism || !e.validation || !Array.isArray(e.source_paths) || !e.source_paths.length) fail("incomplete entry "+e.id);
    for (const p of e.source_paths ?? []) if (!tracked.has(p)) fail("missing policy source "+p);
    if (e.strategy === "REVIEWED_FREEZE") {
      const r = e.revisit ?? {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.review_by ?? "") || r.review_by <= now || !r.rationale || !r.evidence || !r.trigger) fail("expired or incomplete freeze "+e.id);
    }
  }
  for (const p of paths.filter(p=>/(?:^|\/)(Cargo\.toml|pom\.xml|build\.gradle|go\.mod)$/.test(p))) {
    const eco = p.endsWith("Cargo.toml")?"cargo":p.endsWith("pom.xml")?"maven":p.endsWith("build.gradle")?"gradle":"gomod";
    const dir = p.includes("/")?"/"+p.slice(0,p.lastIndexOf("/")):"/";
    const owners = entries.filter(e=>e.source_paths.includes(p) && e.provenance?.ecosystem===eco && e.provenance?.directory===dir);
    if (owners.length!==1) {fail("missing or ambiguous dependency root "+p);continue;}
    const active = managed.has(eco+":"+dir);
    if (owners[0].strategy==="DEPENDABOT"?!active:owners[0].strategy!=="REVIEWED_FREEZE"||active) fail("dependency root strategy mismatch "+p);
  }
  if (!managed.has("github-actions:/")) fail("missing native Actions coverage");
  const expression = String.fromCharCode(36,123,123);
  for (const p of paths.filter(p=>/^\.github\/workflows\/[^/]+\.ya?ml$/.test(p))) {
    const w=read(p);
    for(const m of w.matchAll(/^[ \t]*(?:runs-on|runner):[ \t]*([^\n#]+?)[ \t]*(?:#.*)?$/gm)) {
      const label=m[1].trim().replace(/^["']|["']$/g,"");
      if(label===expression+" matrix.runner }}") continue;
      if(/^(?:ubuntu|macos|windows)-/.test(label) && !label.endsWith("-latest")) {
        const owners=entries.filter(e=>e.strategy==="REVIEWED_FREEZE" && e.provenance?.label===label && e.source_paths.includes(p));
        if(owners.length!==1) fail("missing or ambiguous explicit runner ownership "+p+": "+label);
      }
    }
    const selectors=[...w.matchAll(/^[ \t]*node-version:[^\n]*$/gm)];
    const fresh=[...w.matchAll(/^([ \t]*)node-version:[ \t]*([^\n]+)\r?\n([ \t]*)check-latest:[ \t]*true[ \t]*$/gm)];
    if(selectors.length!==fresh.length) fail("Node channel missing fresh resolution "+p);
    for(const m of fresh){
      const selector=m[2].trim().replace(/^["']|["']$/g,"");
      const lts=selector==="lts/*" || (selector===expression+" env.NODE_LTS }}" && /^[ \t]*NODE_LTS:[ \t]*["']lts\/\*["'][ \t]*$/m.test(w));
      if(!lts||m[1]!==m[3]) fail("non-LTS Node maintenance selector "+p);
    }
    if(/\b(?:ACTIONLINT_REV|ACTIONLINT_VERSION|ZIZMOR_VERSION|ZIZMOR_WHEEL_SHA256)\b/.test(w)) fail("manual security tool pin "+p);
  }
  const ci=read(".github/workflows/ci.yml");
  const drift=read(".github/workflows/repository-drift.yml");
  if(!/go-version:\s*['"]stable['"]\s*\n\s*check-latest: true/.test(ci)||!ci.includes("bash .github/scripts/check-actions-security.sh")) fail("managed actionlint channel absent");
  const zizmor=[...ci.matchAll(/uses: zizmorcore\/zizmor-action@([0-9a-f]{40})/g)].map(m=>m[1]);
  if(zizmor.length!==2||new Set(zizmor).size!==1) fail("zizmor positive/negative immutable pins differ");
  for(const name of ["Validate workflows with managed zizmor","Prove zizmor negative control"]){
    const section=ci.split("- name: "+name+"\n")[1]?.split("\n      - name: ")[0]??"";
    for(const input of ["strict-collection: true","online-audits: false","advanced-security: false","token: ''"]) if(!section.includes(input)) fail("zizmor trust contract "+name+": "+input);
    if(section.includes("continue-on-error: true")!==(name==="Prove zizmor negative control")) fail("zizmor failure gate drift "+name);
  }
  if(!ci.includes("test \"$ZIZMOR_NEGATIVE_OUTCOME\" = failure")||!ci.includes("grep -q 'unpinned-uses' \"$RUNNER_TEMP/zizmor\"")) fail("zizmor negative outcome verifier missing");
  if(!ci.includes("run: mvn -B -ntp -f tests/fixtures/spring-codelens-showcase/pom.xml compile")) fail("active fixture compile gate missing");
  if(!drift.includes("run: node scripts/check-dependency-lifecycle.mjs")) fail("scheduled lifecycle check missing");
  return failures;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const root=join(dirname(fileURLToPath(import.meta.url)),"..");
  const paths=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(Boolean);
  const failures=validateLifecycle(paths,p=>readFileSync(join(root,p),"utf8"));
  if(failures.length){console.error(failures.join("\n"));process.exitCode=1;}
  else console.log("Dependency lifecycle ownership: PASS");
}
