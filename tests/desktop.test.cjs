const {test}=require('node:test');const assert=require('node:assert/strict');
const {createDesktop}=require('../electron/desktop.cjs');
test('desktop actions require fresh observed IDs, matching windows, and single-use controls',async()=>{
  let time=0,writes=0;
  const d=createDesktop({now:()=>time,run:async p=>{
    if(p.operation==='windows')return [{handle:'123',pid:42,title:'Editor'},{handle:'456',pid:43,title:'Other'}];
    if(p.operation==='read')return {controls:[{handle:'789',text:'',editable:true,className:'Edit'}]};
    writes++;return {verified:true};
  }});
  const [a,b]=await d.execute({tool:'list_windows'},()=>{});
  await assert.rejects(d.execute({tool:'read_window',query:'guessed'},()=>{}),/expired/);
  const r=await d.execute({tool:'read_window',query:a.id},()=>{});const control=r.controls[0].id;
  await assert.rejects(d.execute({tool:'type_text',query:b.id,path:control,content:'hi'},()=>{}),/another window/);
  assert.equal((await d.execute({tool:'type_text',query:a.id,path:control,content:'hi'},()=>{})).verified,true);
  await assert.rejects(d.execute({tool:'type_text',query:a.id,path:control,content:'again'},()=>{}),/expired/);
  assert.equal(writes,1);time=61000;
  await assert.rejects(d.execute({tool:'read_window',query:a.id},()=>{}),/expired/);
});
test('desktop cancellation prevents native dispatch',async()=>{
  let called=false;const d=createDesktop({run:async()=>{called=true;}});
  await assert.rejects(d.execute({tool:'list_windows'},()=>{throw Error('cancelled');}),/cancelled/);
  assert.equal(called,false);
});
