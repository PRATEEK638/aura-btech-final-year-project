const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
const {localIntent}=require('../electron/local-intent.cjs');
test('local resource opening resolves exact names and rejects ambiguous or compound goals',async t=>{
 const root=await fs.mkdtemp(path.join(process.cwd(),'test-results/local-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'Kruti'));const locations={desktop:root};
 const p=await localIntent('Open Kruti folder from desktop',locations);assert.equal(p.actions[0].tool,'open_path');assert.equal(p.brain.provider,'local');
 assert.equal(await localIntent('Open Kruti folder and delete files',locations),null);
 assert.equal(await localIntent('Open Spotify',locations),null);
 assert.equal(await localIntent('Open missing folder from desktop',locations),null);
});
