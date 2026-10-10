const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {createCapabilities}=require('../electron/capabilities.cjs');
const {publicAddress}=require('../electron/browser.cjs');
test('file operations verify results, refuse overwrite/escape and preserve sources on cancelled moves',async t=>{
  const root=await fs.mkdtemp(path.join(await fs.mkdir(path.join(process.cwd(),'test-results'),{recursive:true}).then(()=>path.join(process.cwd(),'test-results')),'aura-cap-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  let cancelled=false;let confirms=0;
  const engine=createCapabilities({roots:()=>[root],check:()=>{if(cancelled)throw Error('stopped');},confirm:async()=>{confirms++;},shell:{},browse:async()=>({})});
  const execute=a=>engine.execute(a);
  const folder=path.join(root,'research');await execute({tool:'create_folder',path:folder});
  const file=path.join(folder,'report.md');await execute({tool:'write_file',path:file,content:'# Research\nSource: https://example.com'});
  assert.match((await execute({tool:'read_document',path:file})).text,/Research/);
  await assert.rejects(execute({tool:'write_file',path:file,content:'replace'}),/EEXIST/);
  await assert.rejects(execute({tool:'write_file',path:path.join(root,'..','escape.txt'),content:'bad'}),/outside/);
  await assert.rejects(execute({tool:'write_file',path:path.join(root,'run.ps1'),content:'bad'}),/documents must/);
  assert.equal((await execute({tool:'search_files',query:'report'})).matches.length,1);
  const destination=path.join(root,'moved.md');const moved=await execute({tool:'move_file',path:file,destination});assert.equal(moved.verified,true);assert.equal(confirms,1);
  assert.equal(await fs.stat(file).then(()=>true,()=>false),false);
  cancelled=true;await assert.rejects(execute({tool:'move_file',path:destination,destination:file}),/stopped/);
  assert.equal(await fs.stat(destination).then(()=>true),true);
});
test('recycle refusal preserves file and only a confirmed native recycle is reported',async t=>{
  const root=await fs.mkdtemp(path.join(await fs.mkdir(path.join(process.cwd(),'test-results'),{recursive:true}).then(()=>path.join(process.cwd(),'test-results')),'aura-trash-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const file=path.join(root,'sample.txt');await fs.writeFile(file,'fixture');let allowed=false;
  const e=createCapabilities({roots:()=>[root],check:()=>{},confirm:async()=>{if(!allowed)throw Error('declined');},shell:{trashItem:async p=>fs.rename(p,p+'.recycled')},browse:async()=>({})});
  await assert.rejects(e.execute({tool:'trash_file',path:file}),/declined/);assert.equal(await fs.readFile(file,'utf8'),'fixture');
  allowed=true;assert.equal((await e.execute({tool:'trash_file',path:file})).recycled,true);
});
test('browser address policy excludes local and private networks',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','172.16.0.1','::1','fc00::1'])assert.equal(publicAddress(ip),false);
  assert.equal(publicAddress('93.184.216.34'),true);
});
test('delegated moves and directory listing work without per-file confirmation',async t=>{
 const root=await fs.mkdtemp(path.join(process.cwd(),'test-results/organize-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'source.txt'),destination=path.join(root,'destination.txt');await fs.writeFile(source,'real content');
 const e=createCapabilities({roots:()=>[root],autoMove:true,check:()=>{},confirm:async()=>{throw Error('Unexpected confirmation');},shell:{}});
 const listing=await e.execute({tool:'list_directory',path:root});assert.equal(listing.items[0].size,12);
 const moved=await e.execute({tool:'move_file',path:source,destination});assert.equal(moved.verified,true);assert.equal(await fs.readFile(destination,'utf8'),'real content');
 await assert.rejects(fs.stat(source),/ENOENT/);
});
