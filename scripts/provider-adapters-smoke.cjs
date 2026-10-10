const { _electron: electron } = require("@playwright/test");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    const nvidia = await page.evaluate(() =>
      window.aura.plan(
        "Say hello in a short sentence. No actions needed.",
        [],
        [],
        "nvidia",
      ),
    );
    console.log(
      "NVIDIA adapter:",
      nvidia.ok ? "Generated response" : nvidia.error,
    );
    const sarvam = await page.evaluate(() =>
      window.aura.speak(
        "Hello, I am Aura. How can I help you today?",
        "sarvam",
      ),
    );
    console.log(
      "Sarvam adapter:",
      sarvam.ok ? `Audio returned (${sarvam.data.mime})` : sarvam.error,
    );
    const eleven = await page.evaluate(() =>
      window.aura.speak("Hello, I am Aura.", "elevenlabs"),
    );
    console.log(
      "ElevenLabs native adapter:",
      eleven.ok ? `Audio returned (${eleven.data.mime})` : eleven.error,
    );
    const fish = await page.evaluate(() =>
      window.aura.speak("Hello.", "fish_audio", ""),
    );
    console.log(
      "Fish voice requirement:",
      !fish.ok && fish.error.includes("voice model ID") ? "Enforced" : "FAILED",
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
