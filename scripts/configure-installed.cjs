// Configure the installed app without copying credentials into this project.
const { _electron } = require('@playwright/test');
const path = require('node:path');
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  if (!env.AURA_IMPORT_KEYS || !env.AURA_INSTALLED_EXE)
    throw new Error('Supply the credential file and installed executable paths.');
  const app = await _electron.launch({ executablePath: env.AURA_INSTALLED_EXE, env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('h1');
    const status = await page.evaluate(() => window.aura.status());
    if (!status.ok) throw new Error(status.error);
    console.log('Credential state:', status.data.providers.map(p => `${p.id}: ${p.configured ? 'configured' : 'missing'} (${p.keyCount})`).join(', '));
    if (status.data.providers.some(p => !p.configured)) throw new Error('A provider is missing credentials.');
    await page.locator('.settings-nav').click();
    await page.getByText('Provider connections', { exact: true }).scrollIntoViewIfNeeded();
    const missing = await page.getByText('Not configured', { exact: true }).count();
    if (missing) throw new Error('Settings still displays unconfigured providers.');
    await page.screenshot({ path: path.resolve('artifacts/providers-configured.png') });
    const result = await page.evaluate(() => window.aura.plan('Say hello in one sentence. No tools.', [], [], 'nvidia', { failover: false, review: false, semanticMemory: false }));
    if (!result.ok) throw new Error(result.error);
    console.log('NVIDIA reasoning: verified');
    const voice = await page.evaluate(() => window.aura.speak('Hi, I am Aura. I am ready to help.', 'elevenlabs'));
    if (!voice.ok) throw new Error(voice.error);
    console.log('ElevenLabs speech: verified');
  } finally { await app.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
