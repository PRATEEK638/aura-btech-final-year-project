const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');const path=require('node:path');
const {pythonAnalysis}=require('../electron/python.cjs');
const {createDesktop}=require('../electron/desktop.cjs');
(async()=>{
  const name='Aura-control-test-'+Date.now()+'.txt';
  const file=path.resolve('test-results',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'',{flag:'wx'});
  spawn('notepad.exe',[file],{detached:true,stdio:'ignore'}).unref();
  const desktop=createDesktop({run:p=>pythonAnalysis(path.resolve('python/desktop_worker.py'),p)});
  let window;
  for(let i=0;i<12;i++){
    const windows=await desktop.execute({tool:'list_windows'},()=>{});
    window=windows.find(w=>w.title.includes(name));if(window)break;
    await new Promise(r=>setTimeout(r,500));
  }
  if(!window)throw Error('Test Notepad window did not appear');
  const observed=await desktop.execute({tool:'read_window',query:window.id},()=>{});
  const edits=observed.controls.filter(c=>c.editable&&!c.text);
  if(edits.length!==1)throw Error('Expected exactly one empty editor: '+JSON.stringify(observed));
  const result=await desktop.execute({tool:'type_text',query:window.id,path:edits[0].id,content:'Hello World — Aura verified this native control.'},()=>{});
  if(!result.verified)throw Error('Text was not verified');
  console.log('PASS: real Notepad window observation, targeted text insertion and read-back verification. Test document remains open, unsaved.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
