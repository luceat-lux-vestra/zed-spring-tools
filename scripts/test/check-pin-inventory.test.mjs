#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPOSITORY=join(dirname(fileURLToPath(import.meta.url)),"../..");
const CHECK=join(REPOSITORY,"scripts/check-pin-inventory.mjs");
const PIN=JSON.parse(readFileSync(join(REPOSITORY,"protocol/spring-artifacts.json"),"utf8")).springTools;
const SURFACES=["protocol/spring-artifacts.json","src/artifacts.rs","extension.toml","coordinator/src/main.mjs","coordinator/test/coordinator.test.mjs","THIRD_PARTY_NOTICES.md","COMPATIBILITY.md","docs/pinned-release-refresh-gate.md","docs/decisions/007-standalone-spring-publishing-boundary.md","docs/platform-validation.md","README.md","LIMITATIONS.md","docs/capability-inventory.md","docs/implementation-plan.md"];
function fixture(){const root=mkdtempSync(join(tmpdir(),"pin-inventory-"));for(const f of SURFACES){mkdirSync(join(root,dirname(f)),{recursive:true});cpSync(join(REPOSITORY,f),join(root,f));}return root;}
function edit(root,file,from,to){const p=join(root,file);const before=readFileSync(p,"utf8");assert.ok(before.includes(from));writeFileSync(p,before.replace(from,to));}
function run(root){const r=spawnSync(process.execPath,[CHECK,"--root",root],{encoding:"utf8"});return{code:r.status,out:r.stdout+r.stderr};}
test("untouched standalone pin surfaces reconcile",()=>{const r=run(fixture());assert.equal(r.code,0,r.out);});
test("stale standalone digest fails",()=>{const root=fixture();edit(root,"src/artifacts.rs",PIN.sha256,PIN.sha256.slice(0,-1)+"0");const r=run(root);assert.equal(r.code,1,r.out);assert.match(r.out,/src\/artifacts\.rs/);});
test("stale CDN capability fails",()=>{const root=fixture();edit(root,"extension.toml","2.3.0","2.2.0");const r=run(root);assert.equal(r.code,1,r.out);assert.match(r.out,/download capability/);});
test("undeclared pin surface fails",()=>{const root=fixture();mkdirSync(join(root,"packaging"),{recursive:true});writeFileSync(join(root,"packaging","x.txt"),PIN.sha256);const r=run(root);assert.equal(r.code,1,r.out);assert.match(r.out,/packaging\/x\.txt/);});
