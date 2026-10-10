const {_electron}=require('@playwright/test');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({args:['.'],env});
 try {
  const page=await app.firstWindow();await page.waitForSelector('h1');
  const folder=path.resolve('test-results/live-capabilities');await fs.mkdir(folder,{recursive:true});
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  await page.evaluate(()=>window.aura.chooseFolder());
  const target=path.join(folder,'report-'+Date.now()+'.md');
  const run=async prompt=>page.evaluate(async prompt=>{
    const p=await window.aura.plan(prompt,[],[],'nvidia',{review:false,failover:false,semanticMemory:false});
    if(!p.ok)throw Error(p.error);if(!p.data.actions.length)throw Error('No tools scheduled: '+p.data.reply);
    const r=await window.aura.runTask(p.data.id,{autoRead:true});if(!r.ok)throw Error(r.error);
    if(r.data.status!=='Complete')throw Error(r.data.error||r.data.status);return r.data.outputs;
  },prompt);
  const written=await run(`Create exactly this new Markdown document at ${target} using write_file. Content: # Aura research\nThis is a local integration test. Do not use create_note. Verify the write.`);
  if(!(await fs.readFile(target,'utf8')).includes('Aura research'))throw Error('Document missing');
  console.log('NVIDIA authentication + real planned document creation: PASS',written.length,'actions');
  const apps=await run('Use list_apps with query Notepad to find the installed app. Do not launch it.');
  if(!apps.some(o=>Array.isArray(o.result)))throw Error('No application catalog returned');console.log('Native Windows application discovery: PASS');
  const web=await run('Use browse_page to read https://example.com and tell me its title.');
  if(!web.some(o=>o.result.text?.includes('Example Domain')))throw Error('Webpage content missing');console.log('Real browser DOM extraction: PASS');
 }finally{await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
