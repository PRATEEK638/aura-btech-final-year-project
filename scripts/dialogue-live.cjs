const { _electron } = require("@playwright/test");
(async () => {
  const env = { ...process.env, AURA_DISABLE_AUTO_VOICE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    const start = Date.now();
    const result = await page.evaluate(() =>
      window.aura.plan(
        "Hi Aura, can you explain recursion in one short sentence?",
        [],
        [],
        "sarvam",
        {
          voiceMode: true,
          fastMode: true,
          semanticMemory: false,
          review: false,
        },
      ),
    );
    if (!result.ok) throw Error(result.error);
    console.log(
      JSON.stringify({
        elapsed: Date.now() - start,
        provider: result.data.brain.provider,
        model: result.data.brain.model,
        reply: result.data.reply,
        kind: result.data.kind,
        actions: result.data.actions.length,
        method: result.data.brain.retrieval.method,
      }),
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
