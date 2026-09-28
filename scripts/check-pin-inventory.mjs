#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf("--root");
const ROOT = rootFlag === -1 ? join(dirname(fileURLToPath(import.meta.url)), "..") : argv[rootFlag + 1];
const CANONICAL = "protocol/spring-artifacts.json";
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const manifest = JSON.parse(read(CANONICAL));
const pin = manifest.springTools;
const problems = [];
const fail = (m) => problems.push(m);

if (manifest.schemaVersion !== 2 || pin.mode !== "standalone") fail(`${CANONICAL}: standalone schema v2 is required.`);
if (!/^[0-9a-f]{64}$/.test(pin.sha256)) fail(`${CANONICAL}: invalid SHA-256.`);
if (!/^[0-9a-f]{40}$/.test(pin.sourceCommit)) fail(`${CANONICAL}: invalid source commit.`);
if (!Number.isSafeInteger(pin.size) || pin.size <= 0) fail(`${CANONICAL}: invalid byte size.`);
if (pin.url.includes("latest") || !pin.url.endsWith(pin.asset)) fail(`${CANONICAL}: URL is moving or does not end in the pinned asset.`);

const surfaces = [
  {file:"src/artifacts.rs", states:[pin.tag,pin.asset,pin.url,pin.sha256,String(pin.size).replace(/(?=(\d{3})+$)/g,"_")]},
  {file:"extension.toml", states:["cdn.spring.io",pin.asset]},
  {file:"coordinator/src/main.mjs", states:[pin.tag,pin.asset]},
  {file:"coordinator/test/coordinator.test.mjs", states:[pin.asset]},
  {file:"THIRD_PARTY_NOTICES.md", states:[pin.tag,pin.asset]},
  {file:"COMPATIBILITY.md", states:[pin.tag,pin.asset,pin.sourceCommit]},
  {file:"docs/pinned-release-refresh-gate.md", states:[pin.tag,pin.asset]},
  {file:"docs/decisions/007-standalone-spring-publishing-boundary.md", states:[pin.tag,pin.asset,pin.sourceCommit]},
  {file:"docs/platform-validation.md", states:[pin.tag,pin.asset]},
  {file:"README.md", states:[pin.tag]},
  {file:"LIMITATIONS.md", states:[pin.tag]},
  {file:"docs/capability-inventory.md", states:[pin.tag]},
  {file:"docs/implementation-plan.md", states:[pin.tag]},
];
for (const surface of surfaces) {
  let text;
  try { text=read(surface.file); } catch { fail(`${surface.file} is missing.`); continue; }
  for (const state of surface.states) if (!text.includes(state)) fail(`${surface.file} does not state \`${state}\`.`);
}
const cap=read("extension.toml").match(/\[\[capabilities\]\]\s+kind = "download_file"([\s\S]*?)\]/)?.[0];
if (!cap) fail("extension.toml declares no download_file capability.");
else {
  const host=cap.match(/host = "([^"]+)"/)?.[1];
  const segments=[...cap.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map(m=>m[1]);
  if (`https://${host}/${segments.join("/")}`!==pin.url) fail("extension.toml download capability does not equal the canonical standalone URL.");
}
const identities=[pin.asset,pin.sourceCommit,pin.sha256];
const declared=new Set([CANONICAL,...surfaces.map(s=>s.file)]);
const skip=new Set([".git",".worktrees","target","node_modules","tmp","docs/research","docs/spikes","spikes"]);
function* walk(dir){
  for(const name of readdirSync(dir).sort()){
    const full=join(dir,name); const rel=relative(ROOT,full).split(sep).join("/");
    if([...skip].some(s=>rel===s||rel.startsWith(s+"/"))) continue;
    if(statSync(full).isDirectory()) yield* walk(full); else yield {full,rel};
  }
}
for(const {full,rel} of walk(ROOT)){
  if(declared.has(rel)) continue;
  let text; try{text=readFileSync(full,"utf8");}catch{continue;}
  const found=identities.find(v=>text.includes(v));
  if(found) fail(`${rel} states pinned identity \`${found}\` but is not a declared surface.`);
}
if(problems.length){
  process.stderr.write("Spring Tools standalone pin inventory failed:\n"+problems.map(p=>`  - ${p}\n`).join(""));
  process.exit(1);
}
process.stdout.write(`Spring Tools standalone pin reconciles: ${pin.tag} (${pin.asset}).\n`);
