const {_electron}=require('@playwright/test');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const created=[];
 const env={...process.env,AURA_DISABLE_AUTO_VOICE:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.AURA_EXECUTABLE;const app=await _electron.launch({...(executablePath?{executablePath}:{}),args:executablePath?[]:['.'],env});
 try{
  const page=await app.firstWindow();await page.waitForSelector('h1');
  const desktop=await app.evaluate(({app})=>app.getPath('desktop'));
  const name='Aura folder test '+Date.now();await fs.mkdir(path.join(desktop,name));created.push(path.join(desktop,name));
  const start=Date.now();
  const result=await page.evaluate(async name=>{
   const p=await window.aura.plan('Open '+name+' folder from desktop',[],[],'nvidia',{review:true,reviewAll:true});
   if(!p.ok)throw Error(p.error);if(p.data.brain.provider!=='local')throw Error('Did not use local resolution');
   const r=await window.aura.runTask(p.data.id,{autoRead:true});if(!r.ok)throw Error(r.error);return r.data;
  },name);
  if(result.status!=='Complete'||!result.outputs[0]?.result?.opened)throw Error(result.error||'Open not confirmed');
  console.log('PASS: actual Windows folder-open request through local planner/runtime in '+(Date.now()-start)+' ms; no model/reviewer call.');
  const music=await app.evaluate(({app})=>app.getPath('music'));const outside=path.join(music,name);await fs.mkdir(outside,{recursive:true});created.push(outside);
  const external=await page.evaluate(async target=>{const p=await window.aura.plan('Open '+target,[],[],'nvidia',{review:true,reviewAll:true});if(!p.ok)throw Error(p.error);const r=await window.aura.runTask(p.data.id,{autoRead:true});if(!r.ok)throw Error(r.error);return r.data;},outside);
  if(external.status!=='Complete'||!external.outputs[0]?.result?.opened)throw Error(external.error||'Outside-folder open failed');
  console.log('PASS: real opening outside Desktop/Documents/Downloads, without selecting a shared folder.');
 }finally{await app.close();for(const folder of created)await fs.rmdir(folder).catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
