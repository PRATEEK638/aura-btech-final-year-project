const { _electron: electron } = require("@playwright/test");
const path = require("node:path");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: path.resolve("release/win-unpacked/Aura.exe"),
    args: [],
    env,
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await page.waitForSelector("h1");
    const result = await page.evaluate(() => window.aura.status());
    if (!result.ok) throw new Error("Packaged bridge failed");
    const voice = result.data.providers.find((p) => p.id === "elevenlabs");
    console.log(
      "Packaged app: native bridge ready; ElevenLabs keys:",
      voice.keyCount,
    );
    const speech = await page.evaluate(() =>
      window.aura.speak("Hey, I’m Aura. I’m ready when you are.", "elevenlabs"),
    );
    if (!speech.ok) throw new Error(speech.error);
    console.log("New ElevenLabs credential: generated audio successfully.");
    const unsupported = await page.evaluate(() =>
      window.aura.plan("Open Notepad and type Hello World.", [], [], "nvidia", {
        failover: false, review: false, semanticMemory: false,
      }),
    );
    if (!unsupported.ok) throw new Error(unsupported.error);
    if (unsupported.data.actions.length)
      throw new Error("Unsupported Notepad request was converted into unrelated actions.");
    console.log("Notepad trace: no executable actions; model response:", unsupported.data.reply);
    const task = await page.evaluate(async () => {
      const plan = await window.aura.plan("Use system_info to inspect my actual total memory and summarize it.", [], [], "nvidia", {
        failover: false, review: false, semanticMemory: false,
      });
      if (!plan.ok || !plan.data.actions.length) throw new Error("No system plan returned.");
      return window.aura.runTask(plan.data.id, { autoRead: true });
    });
    if (!task.ok || task.data.status !== "Complete" || !task.data.outputs.some(o => o.result.platform === "win32"))
      throw new Error("Packaged runtime failed its observed-system test.");
    console.log("Packaged runtime: native execution, observation and continuation passed.");
    const leaks = await app.evaluate(async ({ app, safeStorage }, root) => {
      const fs = process.getBuiltinModule("fs").promises,
        path = process.getBuiltinModule("path");
      const credentials = JSON.parse(
        safeStorage.decryptString(
          await fs.readFile(
            path.join(app.getPath("userData"), "providers.vault"),
          ),
        ),
      );
      const values = Object.values(credentials).flat();
      let leaks = 0;
      async function scan(folder) {
        for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
          const file = path.join(folder, entry.name);
          if (entry.isDirectory()) {
            if (!["node_modules", ".git", "release"].includes(entry.name))
              await scan(file);
          } else {
            const data = await fs.readFile(file);
            if (values.some((key) => data.includes(Buffer.from(key)))) leaks++;
          }
        }
      }
      await scan(root);
      return leaks;
    }, process.cwd());
    if (leaks) throw new Error("Credential leakage check failed");
    console.log("Source/artifact credential scan: zero exposed keys.");
    await page.screenshot({ path: "artifacts/aura-home.png", scale: "css" });
    console.log("Packaged app validation passed.");
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
