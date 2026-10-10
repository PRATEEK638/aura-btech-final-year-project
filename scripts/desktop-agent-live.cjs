const {_electron}=require('@playwright/test');const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const name='Aura-agent-test-'+Date.now()+'.txt',file=path.resolve('test-results',name);
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'',{flag:'wx'});
 spawn('notepad.exe',[file],{detached:true,stdio:'ignore'}).unref();
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({args:['.'],env});
 try{
  const page=await app.firstWindow();await page.waitForSelector('h1');
  const result=await page.evaluate(async name=>{
   const plan=await window.aura.plan(`In the already open Notepad document named ${name}, insert Hello World into its empty editor. Use observed native window and control IDs and verify the result. Do not change any other document.`,[],[],'nvidia',{review:false,failover:true,semanticMemory:false});
   if(!plan.ok)throw Error(plan.error);
   const result=await window.aura.runTask(plan.data.id,{autoRead:true});if(!result.ok)throw Error(result.error);
   return result.data;
  },name);
  if(result.status!=='Complete'||!result.outputs.some(o=>o.result?.verified&&o.result?.characters===11))throw Error((result.error||'No verified text insertion: '+result.status)+' Actions: '+JSON.stringify(result.actions.map(a=>({tool:a.tool,query:a.query,path:a.path})))+' Observations: '+JSON.stringify(result.outputs.map(o=>({action:o.action,result:o.result}))));
  console.log('PASS: real provider → runtime → observed Notepad controls → text insertion → verified completion ('+result.outputs.length+' actions).');
 }finally{await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
