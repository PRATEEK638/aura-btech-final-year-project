// Reads credentials only from an environment variable; never prints them.
const { _electron: electron } = require("@playwright/test");
(async () => {
  const additional = (process.env.AURA_EXTRA_ELEVEN_KEYS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    !additional.length ||
    additional.some((x) => !/^sk_[a-zA-Z0-9]{32,100}$/.test(x))
  )
    throw new Error(
      "Supply valid ElevenLabs keys through AURA_EXTRA_ELEVEN_KEYS.",
    );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.AURA_EXTRA_ELEVEN_KEYS;
  const app = await electron.launch({ args: ["."], env });
  try {
    await app.firstWindow();
    const count = await app.evaluate(async ({ app, safeStorage }, incoming) => {
      const fs = process.getBuiltinModule("fs").promises,
        path = process.getBuiltinModule("path");
      const file = path.join(app.getPath("userData"), "providers.vault");
      const data = JSON.parse(
        safeStorage.decryptString(await fs.readFile(file)),
      );
      data.elevenlabs_api_key = [
        ...new Set([...incoming, ...(data.elevenlabs_api_key || [])]),
      ];
      await fs.writeFile(file, safeStorage.encryptString(JSON.stringify(data)));
      return data.elevenlabs_api_key.length;
    }, additional);
    console.log("ElevenLabs credentials encrypted. Total configured:", count);
    for (let i = 0; i < additional.length; i++) {
      try {
        const r = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": additional[i] },
          signal: AbortSignal.timeout(20000),
        });
        console.log(
          "Additional credential",
          i + 1,
          "validation HTTP",
          r.status,
        );
      } catch (e) {
        console.log("Additional credential", i + 1, e.name);
      }
    }
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
