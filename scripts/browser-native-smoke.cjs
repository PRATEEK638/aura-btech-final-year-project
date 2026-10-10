const { _electron } = require('@playwright/test');
(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ['.'], env });
  try {
    const result = await app.evaluate(async ({ app, BrowserWindow, session }) => {
      const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
      const browser = require('./electron/browser.cjs').createBrowser({ BrowserWindow, session });
      const first=await browser.browse('https://www.python.org');
      const link=first.links.find(l=>l.url==='https://www.python.org/downloads/');
      if(!first.text.includes('Python')||!link?.id)throw Error('Missing initial page evidence');
      const followed=await browser.follow(link.id);
      let staleRejected=false;try{await browser.follow(link.id);}catch{staleRejected=true;}
      if(!staleRejected)throw Error('Stale link accepted');
      return followed;
    });
    if (!result.text || !result.untrusted || !result.url.includes('python.org/downloads')) throw Error('Missing followed-page evidence');
    console.log('Native public browser navigation, observed link following, stale-link rejection and DOM extraction: PASS');
  } finally { await app.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
