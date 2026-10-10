const dns = require('node:dns/promises');
function publicAddress(address) {
  if(address.includes(':')) return /^2[0-9a-f]{3}:/i.test(address);
  const p=address.split('.').map(Number);
  return p.length===4 && p.every(x=>Number.isInteger(x)&&x>=0&&x<256) && ![0,10,127].includes(p[0]) && !(p[0]===169&&p[1]===254) && !(p[0]===172&&p[1]>=16&&p[1]<=31) && !(p[0]===192&&p[1]===168) && !(p[0]===100&&p[1]>=64&&p[1]<=127) && p[0]<224;
}
async function publicURL(value) {
  const url=new URL(value);
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443')) throw new Error('Only public HTTPS pages are supported.');
  const addresses=await dns.lookup(url.hostname,{all:true});
  if(!addresses.length || addresses.some(x=>!publicAddress(x.address)))throw new Error('Local/private network pages are unavailable.');
  return url.href;
}
function createBrowser({BrowserWindow,session}) {
  let window;
  let links=new Map();
  const browserSession=session.fromPartition('aura-browser');
  browserSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  browserSession.on('will-download',event=>event.preventDefault());
  browserSession.webRequest.onBeforeRequest((details,cb)=>{
    if(details.url==='about:blank' || details.url.startsWith('data:'))return cb({cancel:false});
    publicURL(details.url).then(()=>cb({cancel:false}),()=>cb({cancel:true}));
  });
  const api = { stop(){links.clear();if(window&&!window.isDestroyed())window.webContents.stop();}, async follow(id,check=()=>{}) {
    const link=links.get(id);if(!link)throw Error('Link observation expired. Read the page again.');
    return api.browse(link,check);
  }, async browse(url,check=()=>{}) {
    links.clear();
    const target=await publicURL(url);
    check();
    if(!window || window.isDestroyed()) {
      window=new BrowserWindow({width:1150,height:800,title:'Aura Browser',webPreferences:{session:browserSession,nodeIntegration:false,contextIsolation:true,sandbox:true}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    }
    window.show();
    let timer;
    try { await Promise.race([window.loadURL(target),new Promise((_,reject)=>{timer=setTimeout(()=>{window.webContents.stop();reject(new Error('Page loading timed out.'));},25000);})]); }
    finally { clearTimeout(timer); }
    check();
    const result=await window.webContents.executeJavaScript(`(() => ({title:document.title,url:location.href,text:document.body.innerText.slice(0,20000),links:Array.from(document.querySelectorAll('a[href]')).filter(a=>a.innerText.trim()).slice(0,60).map(a=>({text:a.innerText.slice(0,120),url:a.href})),tables:Array.from(document.querySelectorAll('table')).slice(0,5).map(t=>Array.from(t.rows).slice(0,100).map(r=>Array.from(r.cells).slice(0,20).map(c=>c.innerText.slice(0,300))))}))()`);
    check();
    result.links=result.links.map(link=>{const id=require('node:crypto').randomUUID();links.set(id,link.url);return {...link,id};});
    return {...result,untrusted:true,verification:'Content extracted from the loaded page DOM.'};
  }};
  return api;
}
module.exports={createBrowser,publicAddress,publicURL};
