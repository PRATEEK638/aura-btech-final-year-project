const fs=require('node:fs/promises');const path=require('node:path');
// Conservative intent grammar for opening existing local resources. Complex or
// ambiguous requests continue through the model and the same tool registry.
async function localIntent(prompt,locations){
 if(typeof prompt!=='string'||prompt.length>1500)return null;
 const m=prompt.trim().match(/^(?:please\s+)?open\s+(?:the\s+)?(.+?)[.!]?$/i);if(!m)return null;
 let text=m[1];if(/\b(and|then|also)\b|[\r\n;&|]/i.test(text))return null;
 let candidates=[];
 if(/^[A-Z]:\\/i.test(text.replace(/^"|"$/g,''))){candidates=[text.replace(/^"|"$/g,'')];}
 else {
  const scope=text.match(/\s+(?:from|on|in)\s+(?:my\s+|the\s+)?(desktop|downloads|documents)$/i);
  if(scope)text=text.slice(0,scope.index);
  if(!/\b(folder|file)\b/i.test(text))return null;
  const name=text.replace(/\s+(?:folder|file)$/i,'').replace(/^(?:folder|file)\s+/i,'').replace(/^["']|["']$/g,'').trim();
  if(!name||/[\\/]/.test(name))return null;
  const roots=scope?[locations[scope[1].toLowerCase()]]:[locations.desktop,locations.documents,locations.downloads];
  for(const root of roots.filter(Boolean)){
   const entries=await fs.readdir(root).catch(()=>[]);
   for(const entry of entries)if(entry.toLowerCase()===name.toLowerCase())candidates.push(path.join(root,entry));
  }
 }
 candidates=[...new Set(candidates)];if(candidates.length!==1)return null;
 const target=candidates[0];if(!await fs.stat(target).then(()=>true,()=>false))return null;
 return {kind:'do',outcome:'working',title:'Open '+path.basename(target),reply:'Opening '+path.basename(target)+'.',uncertainties:[],actions:[{tool:'open_path',label:'Open '+path.basename(target),path:target}],brain:{provider:'local',model:'Local resource resolver',review:{status:'not required',reason:'Opening an existing resource uses native validation.'},trace:[],duration:0,retrieval:{method:'none',selected:0,total:0}}};
}
module.exports={localIntent};
