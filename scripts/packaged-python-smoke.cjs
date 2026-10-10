const {_electron}=require('@playwright/test');const path=require('node:path');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.AURA_EXECUTABLE||path.resolve('release/win-unpacked/Aura.exe');
 const app=await _electron.launch({executablePath,args:[],env});
 try{
  const count=await app.evaluate(async({app})=>{
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
   const {pythonAnalysis}=require('./electron/python.cjs');
   const path=require('node:path');
   const result=await pythonAnalysis(path.join(process.resourcesPath,'python','desktop_worker.py'),{operation:'windows'});
   if(!Array.isArray(result))throw Error('Packaged desktop worker unavailable');
   return result.length;
  });
  console.log('PASS: packaged app invoked its shipped Python desktop worker; observed '+count+' windows.');
 }finally{await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
