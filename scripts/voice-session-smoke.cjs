// Synthetic microphone + stub transcript/answer tests the standard voice fallback.
// Speech synthesis uses the real configured provider. No production handlers change.
const { _electron } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
(async () => {
  const rate = 48000,
    count = rate * 4,
    pcm = Buffer.alloc(count * 2),
    header = Buffer.alloc(44);
  for (let i = 0; i < count; i++)
    pcm.writeInt16LE(
      i < rate * 1.5
        ? Math.round(Math.sin((i * 2 * Math.PI * 220) / rate) * 9000)
        : 0,
      i * 2,
    );
  header.write("RIFF");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  await fs.mkdir("test-results", { recursive: true });
  const fixture = path.resolve("test-results/voice-input.wav");
  await fs.writeFile(fixture, Buffer.concat([header, pcm]));
  const env = { ...process.env, AURA_DISABLE_AUTO_VOICE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.AURA_EXECUTABLE;
  const app = await _electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      ...(executablePath ? [] : ["."]),
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-audio-capture=" + fixture,
    ],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector(".voice-session-button");
    if (await page.locator(".context-panel").count())
      throw Error("Context panel should start hidden.");
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("aura:voiceToken");
      ipcMain.handle("aura:voiceToken", () => ({
        ok: false,
        error: "Test forces standard fallback.",
      }));
      ipcMain.removeHandler("aura:transcribe");
      ipcMain.handle("aura:transcribe", (_e, bytes) => {
        if (bytes.length < 100) throw Error("No microphone data");
        return { ok: true, data: "Hello Aura" };
      });
      ipcMain.removeHandler("aura:plan");
      ipcMain.handle("aura:plan", () => ({
        ok: true,
        data: {
          id: "voice-fixture",
          kind: "ask",
          outcome: "answered",
          title: "Greeting",
          reply: "Hello. I am ready to help.",
          actions: [],
        },
      }));
    });
    await page
      .getByRole("button", { name: "Talk to Aura", exact: true })
      .click();
    await page.waitForSelector(".state-listening");
    await page.waitForSelector(".state-speaking", { timeout: 45000 });
    await page.waitForSelector(".state-listening", { timeout: 45000 });
    await page
      .getByRole("button", { name: "End voice conversation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Talk to Aura", exact: true })
      .waitFor();
    console.log(
      "PASS: unavailable realtime service → standard microphone fallback → automatic submission → streamed speech → listening again → stop.",
    );
    await page.screenshot({ path: "artifacts/voice-home.png" });
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
