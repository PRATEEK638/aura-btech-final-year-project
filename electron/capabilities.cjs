const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const definitions = {
  list_directory: { fields:['path'], description:'List an accessible local folder with file sizes, modification dates and child paths. No manual folder sharing required. Up to 1000 entries.' },
  list_windows: { fields: [], description: 'Observe currently visible Windows application windows; returns opaque window IDs.' },
  read_window: { fields: ['query'], description: 'Read native controls of an observed window. query must be its exact returned window ID. Returns editable control IDs, not a full accessibility tree.' },
  type_text: { fields: ['query','path','content'], description: 'Insert text into an EMPTY observed native Edit/RichEdit control and verify read-back. query=window ID, path=editable control ID from read_window. No keyboard shortcuts, overwrite or terminal execution.' },
  browser_search: { fields: ['query'], description: 'Search the public web in Aura Browser and return real result-page text and links.' },
  browser_follow: { fields: ['query'], description: 'Follow an exact link ID from the most recent Aura Browser page snapshot.' },
  list_apps: { fields: ['query'], description: 'Search Windows Start menu applications by name.' },
  launch_app: { fields: ['query'], description: 'Launch an installed Windows Start menu application by its exact observed name. Verify only OS launch acceptance, not application contents.' },
  search_files: { fields: ['query'], description: 'Find filenames/folders across accessible local drives, prioritizing user folders. query is a name fragment; bounded search, not content search.' },
  open_path: { fields: ['path'], description: 'Open an existing folder in Explorer or a txt/md/csv/pdf/docx/xlsx/pptx/image file in its default application. Use an observed exact path.' },
  create_folder: { fields: ['path'], description: 'Create a folder hierarchy inside an allowed folder and verify it.' },
  write_file: { fields: ['path','content'], description: 'Create a NEW txt/md/csv/json or simple Word .docx document, never overwrite. Include citations in research documents. DOCX supports plain paragraphs, not advanced layouts.' },
  read_document: { fields: ['path'], description: 'Read txt/md/csv/json up to 100 KB or Word .docx text up to 5 MB from an allowed folder. Not a PDF parser.' },
  move_file: { fields: ['path','destination'], description: 'Move one file to an unused path inside allowed folders, with confirmation and SHA-256 verification. No folder moves.' },
  trash_file: { fields: ['path'], description: 'Send one file to Windows Recycle Bin with confirmation. Never permanently delete.' },
  browse_page: { fields: ['url'], description: 'Open a public HTTPS webpage in Aura Browser; return visible text, links and tables from the real DOM. Can follow returned links by another browse_page call. No form submission or arbitrary scripts.' },
};
const toolDescription = Object.entries(definitions).map(([name,d]) => `${name} (${d.fields.join(', ')}): ${d.description}`).join('\n');
function validateExtra(a) {
  const d = definitions[a.tool]; if (!d) return false;
  for (const field of d.fields) if (typeof a[field] !== 'string' || !a[field].trim() || a[field].length > (field === 'content' ? 100000 : 2000)) throw new Error(`Invalid ${field} for ${a.tool}.`);
  if(['read_window','type_text','browser_follow'].includes(a.tool) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(a.query))throw Error('Use an actual observed ID. If an ID is not yet known, request ONLY the discovery tool and wait for its result; never use placeholders.');
  if(a.tool==='type_text' && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(a.path))throw Error('Use an observed editable control ID from a previous read_window result.');
  return true;
}
const inside = (root, target) => { const r=path.relative(root,target);return r==='' || (!r.startsWith('..'+path.sep) && r!=='..' && !path.isAbsolute(r)); };
function createCapabilities({ roots, shell, confirm, check: defaultCheck, browse, apps, launch, desktop, browser, document, autoMove=false }) {
  async function resolve(value, existing=true) {
    if (!path.isAbsolute(value) || /[\x00-\x1f]/.test(value) || value.startsWith('\\\\') || value.slice(2).includes(':')) throw new Error('Use an absolute local path.');
    const target=path.resolve(value);
    const allowed=await Promise.all(roots().map(r=>fs.realpath(r).catch(()=>null)));
    let probe=target, suffix=[];
    while (true) {
      try { probe=await fs.realpath(probe); break; }
      catch(e) { if(existing || e.code!=='ENOENT' || path.dirname(probe)===probe) throw e; suffix.unshift(path.basename(probe));probe=path.dirname(probe); }
    }
    const real=path.join(probe,...suffix);
    if (!allowed.some(r=>r&&inside(r,real))) throw new Error('This path is outside accessible local drives.');
    if (real.split(path.sep).some(p=>/^(\.git|node_modules|appdata|windows|program files(?: \(x86\))?|programdata|system volume information|\$recycle\.bin)$/i.test(p)) || /(?:api.?key|credential|secret|password|\.env)/i.test(path.basename(real))) throw new Error('Sensitive or operating-system paths are excluded.');
    return real;
  }
  return { definitions, async execute(a, check = defaultCheck) {
    validateExtra(a); check();
    if(['list_windows','read_window','type_text'].includes(a.tool)) return desktop.execute(a,check);
    if(a.tool==='browser_search') return browse('https://www.bing.com/search?q='+encodeURIComponent(a.query),check);
    if(a.tool==='browser_follow') return browser.follow(a.query,check);
    if(a.tool==='list_apps') return (await apps()).filter(x=>x.Name.toLowerCase().includes(a.query.toLowerCase())).slice(0,30);
    if(a.tool==='launch_app') {
      const matches=(await apps()).filter(x=>x.Name.toLowerCase()===a.query.toLowerCase());
      if(matches.length!==1)throw new Error('Application name is missing or ambiguous. Search installed applications first.');
      check();await launch(matches[0].AppID);return {application:matches[0].Name,launchAccepted:true,verification:'Launch requested through Windows; window contents are not observed.'};
    }
    if(a.tool==='browse_page') return browse(a.url,check);
    if(a.tool==='search_files') {
      const queue=a.path?[await resolve(a.path)]:[...new Set(roots())], matches=[], visited=new Set();let inspected=0;
      while(queue.length && inspected<8000 && matches.length<50) {
        check(); const folder=queue.shift();const identity=folder.toLowerCase();if(visited.has(identity))continue;visited.add(identity);const entries=await fs.readdir(folder,{withFileTypes:true}).catch(()=>[]);
        for(const e of entries) {
          if(++inspected>8000) break;
          if(e.isSymbolicLink()||/^(node_modules|\.git|appdata|app|release|windows|program files(?: \(x86\))?|programdata|system volume information|\$recycle\.bin)$/i.test(e.name)||/(api.?key|credential|secret|password|\.env)/i.test(e.name)) continue;
          const p=path.join(folder,e.name);
          if(e.name.toLowerCase().includes(a.query.toLowerCase())) matches.push({path:p,directory:e.isDirectory()});
          if(e.isDirectory()) queue.push(p);
          if(matches.length>=50) break;
        }
      }
      return { matches, inspected, limited:queue.length>0 || matches.length>=50 };
    }
    if(['move_file','trash_file'].includes(a.tool) && (await fs.lstat(a.path)).isSymbolicLink())throw new Error('Move/recycle of symbolic links is not supported.');
    const target=await resolve(a.path,!['create_folder','write_file'].includes(a.tool));check();
    if(a.tool==='list_directory') {
      const entries=await fs.readdir(target,{withFileTypes:true});
      const items=await Promise.all(entries.slice(0,1000).map(async e=>{check();const child=path.join(target,e.name);const stat=await fs.lstat(child).catch(()=>null);return {name:e.name,path:child,directory:e.isDirectory(),symlink:e.isSymbolicLink(),size:stat?.size,modified:stat?.mtime.toISOString()};}));
      return {path:target,items,limited:entries.length>1000};
    }
    if(a.tool==='read_document') {
      if(/\.docx$/i.test(target))return document({operation:'read',path:target},check);
      if(!/\.(txt|md|csv|json)$/i.test(target) || (await fs.stat(target)).size>100000)throw new Error('Use a text/Markdown/CSV/JSON file under 100 KB.');
      return {path:target,text:await fs.readFile(target,'utf8')};
    }
    if(a.tool==='open_path') {
      const stat=await fs.stat(target);
      if(!stat.isDirectory()&&!/\.(txt|md|csv|pdf|docx|xlsx|pptx|png|jpg|jpeg)$/i.test(target))throw new Error('This file type cannot be launched.');
      const error=await shell.openPath(target); if(error)throw new Error(error);
      return {path:target,opened:true,verification:'Windows accepted the open request; application contents are not observed.'};
    }
    if(a.tool==='create_folder') { await fs.mkdir(target,{recursive:true});return {path:target,verified:(await fs.stat(target)).isDirectory()}; }
    if(a.tool==='write_file') {
      if(/\.docx$/i.test(target))return document({operation:'write',path:target,content:a.content},check);
      if(!/\.(txt|md|csv|json)$/i.test(target))throw new Error('New documents must be txt, md, csv or json.');
      await fs.writeFile(target,a.content,{flag:'wx'});
      const verified=await fs.readFile(target,'utf8')===a.content;
      if(!verified)throw new Error('Document could not be verified.');return {path:target,verified};
    }
    if(!(await fs.lstat(target)).isFile())throw new Error('Only individual files can be moved or recycled.');
    if(a.tool==='trash_file') {
      await confirm('Move this file to Recycle Bin?',target);check();await shell.trashItem(target);
      if(await fs.stat(target).then(()=>true,()=>false))throw new Error('File still exists at original path.');
      return {path:target,recycled:true,verification:'Windows Recycle Bin API succeeded; original path is absent.'};
    }
    if(a.tool==='move_file') {
      const destination=await resolve(a.destination,false);
      const stat=await fs.stat(target);if(stat.size>100000000)throw new Error('Move verification currently supports files up to 100 MB.');
      if(!autoMove)await confirm('Move this file?',target+'\n→ '+destination);check();
      const hash=b=>createHash('sha256').update(b).digest('hex');
      const before=hash(await fs.readFile(target));check();
      await fs.copyFile(target,destination,require('node:fs').constants.COPYFILE_EXCL);
      if(hash(await fs.readFile(destination))!==before || hash(await fs.readFile(target))!==before)throw new Error('File changed during move. Both copies retained.');
      try { check(); } catch { return {path:target,destination,copied:true,moved:false,sourceRetained:true,verified:true}; }
      await fs.unlink(target);
      return {path:target,destination,verified:true,sha256:before};
    }
    throw new Error('Unknown capability.');
  }};
}
module.exports={definitions,validateExtra,toolDescription,createCapabilities};
