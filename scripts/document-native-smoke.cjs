const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const {pythonAnalysis}=require('../electron/python.cjs');
(async()=>{
  const file=path.resolve('test-results','Aura-document-'+Date.now()+'.docx');await fs.mkdir(path.dirname(file),{recursive:true});
  const worker=path.resolve('python/document_worker.py');const text='# Aura report\nNative document creation.\nUnicode: नमस्ते — hello.\n';
  assert.equal((await pythonAnalysis(worker,{operation:'write',path:file,content:text})).verified,true);
  assert.equal((await pythonAnalysis(worker,{operation:'read',path:file})).text,text);
  await assert.rejects(pythonAnalysis(worker,{operation:'write',path:file,content:'overwrite'}),/exists/);
  console.log('PASS: real Word document creation, Unicode paragraph read-back, overwrite refusal.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
