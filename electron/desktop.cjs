const {randomUUID}=require('node:crypto');
function createDesktop({run, now=Date.now}) {
  const windows=new Map(),controls=new Map();
  function lookup(map,id){const value=map.get(id);if(!value||now()-value.at>60000)throw Error('Desktop observation expired. Observe again.');return value;}
  return {clear(){windows.clear();controls.clear();},async execute(a,check){
    check();
    if(a.tool==='list_windows'){
      const result=await run({operation:'windows'},check);check();windows.clear();controls.clear();
      return result.map(w=>{const id=randomUUID();windows.set(id,{...w,at:now()});return {id,title:w.title};});
    }
    const window=lookup(windows,a.query);
    if(a.tool==='read_window'){
      const result=await run({operation:'read',handle:window.handle,pid:window.pid,expectedTitle:window.title},check);check();
      controls.clear();
      return {...result,controls:result.controls.map(c=>{const id=randomUUID();if(c.editable)controls.set(id,{...c,window:a.query,at:now()});return {id,className:c.className,text:c.text,editable:c.editable};})};
    }
    if(a.tool==='type_text'){
      const control=lookup(controls,a.path);
      if(control.window!==a.query)throw Error('Control belongs to another window.');
      check(); controls.delete(a.path);
      return run({operation:'type',handle:window.handle,pid:window.pid,expectedTitle:window.title,control:control.handle,content:a.content},check);
    }
    throw Error('Unknown desktop tool');
  }};
}
module.exports={createDesktop};
