#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { springArguments } from "../coordinator/src/main.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MANIFEST=path.join(ROOT,"protocol","spring-artifacts.json");
const REQUEST_TIMEOUT_MS=30_000;
const DISCOVERY_TIMEOUT_MS=120_000;
const DOWNLOAD_TIMEOUT_MS=180_000;
const FORBIDDEN_PRIVATE_CALLBACKS=new Set([
  "sts/addClasspathListener","sts/removeClasspathListener","sts/javaType","sts/javadoc",
  "sts/javadocHoverLink","sts/javaLocation","sts/javaSearchTypes","sts/javaSearchPackages",
  "sts/javaSubTypes","sts/javaSuperTypes",
]);

class LspClient {
  constructor(child,workspaceFolders){
    this.child=child;this.workspaceFolders=workspaceFolders;this.buffer=Buffer.alloc(0);
    this.pending=new Map();this.nextId=1;this.serverRequests=[];this.fatalError=null;
    child.stdout.on("data",chunk=>{try{this.onData(chunk);}catch(e){this.fail(e);}});
    child.on("exit",(code,signal)=>this.fail(new Error(`Spring LS exited early: code=${code} signal=${signal}`)));
  }
  onData(chunk){
    this.buffer=Buffer.concat([this.buffer,chunk]);
    for(;;){
      const header=this.buffer.indexOf("Content-Length:");
      if(header<0)return;
      if(header>0)this.buffer=this.buffer.subarray(header);
      const sep=this.buffer.indexOf("\r\n\r\n"); if(sep<0)return;
      const match=/^Content-Length:\s*(\d+)$/im.exec(this.buffer.subarray(0,sep).toString("ascii"));
      if(!match)throw new Error("invalid LSP header");
      const len=Number(match[1]), frame=sep+4+len; if(this.buffer.length<frame)return;
      const msg=JSON.parse(this.buffer.subarray(sep+4,frame).toString("utf8"));
      this.buffer=this.buffer.subarray(frame); this.handle(msg);
    }
  }
  handle(message){
    if(message.id!==undefined && message.method===undefined){
      const key=String(message.id), pending=this.pending.get(key); if(!pending)return;
      this.pending.delete(key);clearTimeout(pending.timer);
      if(message.error)pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result); return;
    }
    if(message.id!==undefined && typeof message.method==="string"){
      this.serverRequests.push(message.method);
      let result;
      if(message.method==="workspace/configuration") result=(message.params?.items??[]).map(()=>({}));
      else if(message.method==="workspace/workspaceFolders") result=this.workspaceFolders;
      else if(message.method==="workspace/applyEdit") result={applied:false};
      else if(message.method==="window/workDoneProgress/create") result=null;
      else if(message.method==="client/registerCapability"||message.method==="client/unregisterCapability") result=null;
      else if(message.method==="sts/project/gav"){
        const uris=message.params?.projectUris;
        assert.ok(Array.isArray(uris),"standalone project GAV callback must contain projectUris");
        result=uris.map(()=>null);
      } else if(message.method==="sts/javaCodeComplete"){
        result=[];
      } else if(FORBIDDEN_PRIVATE_CALLBACKS.has(message.method)){
        throw new Error(`standalone Spring LS attempted forbidden private Java callback: ${message.method}`);
      } else result=null;
      this.send({jsonrpc:"2.0",id:message.id,result}); return;
    }
  }
  request(method,params,timeoutMs=REQUEST_TIMEOUT_MS){
    if(this.fatalError)return Promise.reject(this.fatalError);
    const id=this.nextId++;
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{if(this.pending.delete(String(id)))reject(new Error(`${method} timed out`));},timeoutMs);
      this.pending.set(String(id),{method,resolve,reject,timer});
    });
    this.send({jsonrpc:"2.0",id,method,params});return promise;
  }
  notify(method,params){this.send({jsonrpc:"2.0",method,params});}
  send(message){const body=Buffer.from(JSON.stringify(message));this.child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),body]));}
  fail(error){if(this.fatalError)return;this.fatalError=error;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
}

async function main(){
  const evidencePath=requiredEnv("SPRING_RUNTIME_EVIDENCE");
  const sourceHead=requiredEnv("SOURCE_HEAD_SHA");
  const testedCommit=requiredEnv("GITHUB_SHA");
  const manifest=JSON.parse(fs.readFileSync(MANIFEST,"utf8"));
  assert.equal(manifest.schemaVersion,2); const pin=manifest.springTools;
  assert.equal(pin.mode,"standalone"); assert.match(pin.sha256,/^[0-9a-f]{64}$/);
  assert.match(pin.url,/^https:\/\/cdn\.spring\.io\/spring-tools\/release\/language-server\/spring-boot\//);

  const runRoot=fs.mkdtempSync(path.join(os.tmpdir(),"zed-spring-standalone-"));
  const jar=path.join(runRoot,pin.asset), worktree=path.join(runRoot,"workspace space 한글");
  const javaSource=path.join(worktree,"src","main","java","dev","zed","StandaloneSmokeApplication.java");
  const properties=path.join(worktree,"src","main","resources","application.properties");
  fs.mkdirSync(path.dirname(javaSource),{recursive:true}); fs.mkdirSync(path.dirname(properties),{recursive:true});
  fs.writeFileSync(path.join(worktree,"pom.xml"),`<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion><groupId>dev.zed</groupId><artifactId>standalone-smoke</artifactId><version>0.0.1</version>
  <properties><maven.compiler.release>21</maven.compiler.release></properties>
  <dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId><version>3.5.5</version></dependency></dependencies>
</project>\n`);
  fs.writeFileSync(javaSource,`package dev.zed;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class StandaloneSmokeApplication {}
`);
  fs.writeFileSync(properties,"server.port=0\n");

  const evidence={schemaVersion:2,sourceHead,testedCommit,platform:{os:process.platform,arch:process.arch,release:os.release()},springTools:{tag:pin.tag,sourceCommit:pin.sourceCommit,asset:pin.asset,sha256:pin.sha256,mode:pin.mode},lsp:{serverRequests:[],executableProject:null,completion:null},status:"running"};
  let child,stderr="";
  try{
    const response=await fetch(pin.url,{redirect:"follow",signal:AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),headers:{"user-agent":"zed-spring-tools-platform-validation"}});
    if(!response.ok)throw new Error(`download failed: HTTP ${response.status}`);
    fs.writeFileSync(jar,Buffer.from(await response.arrayBuffer()));
    assert.equal(fs.statSync(jar).size,pin.size,"standalone JAR size");
    assert.equal(sha256(jar),pin.sha256,"standalone JAR SHA-256");

    const args=springArguments(jar,worktree,null);
    assert.ok(args.includes(`-Dspring.boot.ls.project.dir=${worktree}`),"production launch vector carries standalone project root");
    child=spawn(javaTool("java"),args,{cwd:worktree,env:process.env,shell:false,windowsHide:true,stdio:["pipe","pipe","pipe"]});
    child.stderr.on("data",c=>{stderr=(stderr+c.toString("utf8")).slice(-256*1024);});
    const workspaceUri=directoryUri(worktree);
    const client=new LspClient(child,[{uri:workspaceUri,name:"standalone-smoke"}]);
    const init=await client.request("initialize",{processId:process.pid,clientInfo:{name:"zed-spring-tools-ci",version:"1"},rootUri:workspaceUri,workspaceFolders:[{uri:workspaceUri,name:"standalone-smoke"}],capabilities:{workspace:{configuration:true,applyEdit:true,workspaceFolders:true,executeCommand:{dynamicRegistration:true}},textDocument:{synchronization:{dynamicRegistration:true},publishDiagnostics:{},completion:{dynamicRegistration:true},hover:{dynamicRegistration:true}},window:{showMessage:{},workDoneProgress:true}},initializationOptions:{}});
    assert.ok(init?.capabilities,"initialize capabilities");
    client.notify("initialized",{});
    client.notify("textDocument/didOpen",{textDocument:{uri:pathToFileURL(javaSource).href,languageId:"java",version:1,text:fs.readFileSync(javaSource,"utf8")}});
    client.notify("textDocument/didOpen",{textDocument:{uri:pathToFileURL(properties).href,languageId:"spring-boot-properties",version:1,text:fs.readFileSync(properties,"utf8")}});

    const deadline=Date.now()+DISCOVERY_TIMEOUT_MS;
    let projects=[];
    while(Date.now()<deadline){
      try{
        const result=await client.request("workspace/executeCommand",{command:"sts/spring-boot/executableBootProjects",arguments:[]});
        if(Array.isArray(result))projects=result;
        const found=projects.find(p=>p?.mainClass==="dev.zed.StandaloneSmokeApplication");
        if(found){evidence.lsp.executableProject={name:found.name,mainClass:found.mainClass,uri:found.uri,gav:found.gav??null};break;}
      }catch(error){if(Date.now()+1000>=deadline)throw error;}
      await new Promise(r=>setTimeout(r,1000));
    }
    assert.ok(evidence.lsp.executableProject,"standalone Spring LS must discover the Maven Boot project without JDT LS");

    const completion=await client.request("textDocument/completion",{textDocument:{uri:pathToFileURL(properties).href},position:{line:0,character:6}});
    evidence.lsp.completion=Array.isArray(completion)?{kind:"array",count:completion.length}:{kind:typeof completion,count:Array.isArray(completion?.items)?completion.items.length:null};
    evidence.lsp.serverRequests=client.serverRequests;
    assert.ok(client.serverRequests.includes("sts/project/gav"),"Boot project discovery must exercise the local GAV fallback");
    assert.equal(client.serverRequests.some(m=>FORBIDDEN_PRIVATE_CALLBACKS.has(m)),false,"standalone runtime must not request the removed private Java bridge");

    await client.request("shutdown",null); client.notify("exit",null);
    evidence.status="pass";evidence.finishedAt=new Date().toISOString();evidence.stderrTail=stderr.split(/\r?\n/).slice(-50);
    writeEvidence(evidencePath,evidence);
    process.stdout.write(JSON.stringify(evidence,null,2)+"\n");
  }catch(error){
    if(child&&child.exitCode===null)child.kill();
    evidence.status="fail";evidence.error=error instanceof Error?`${error.name}: ${error.message}`:String(error);evidence.stderrTail=stderr.split(/\r?\n/).slice(-100);evidence.finishedAt=new Date().toISOString();writeEvidence(evidencePath,evidence);throw error;
  }finally{fs.rmSync(runRoot,{recursive:true,force:true});}
}
function sha256(file){return createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function directoryUri(dir){return pathToFileURL(dir.endsWith(path.sep)?dir:dir+path.sep).href;}
function javaTool(name){const exe=process.platform==="win32"?name+".exe":name;const candidate=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,"bin",exe):exe;return process.env.JAVA_HOME&&fs.existsSync(candidate)?candidate:exe;}
function requiredEnv(name){const v=process.env[name];if(!v)throw new Error(`${name} is required`);return v;}
function writeEvidence(dest,value){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(value,null,2)+"\n");}

await main();
