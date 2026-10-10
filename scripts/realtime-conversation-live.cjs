const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const original = await fs.readFile("test-results/live-voice-input.wav");
  const fixture = Buffer.concat([original, Buffer.alloc(48000 * 35)]);
  fixture.writeUInt32LE(fixture.length - 8, 4);
  fixture.writeUInt32LE(fixture.length - 44, 40);
  const file = path.resolve("test-results/conversation-input.wav");
  await fs.writeFile(file, fixture);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.AURA_DISABLE_AUTO_VOICE;
  const executablePath = process.env.AURA_EXECUTABLE;
  const app = await _electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      ...(executablePath ? [] : ["."]),
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-audio-capture=" + file,
    ],
    env,
  });
  try {
    const page = await app.firstWindow();
    const started = Date.now();
    page.on("pageerror", (e) => console.log("Renderer error:", e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("token="))
        console.log("Renderer:", m.text().slice(0, 500));
    });
    try {
      await page
        .getByText("Live conversation · Esc to stop", { exact: true })
        .waitFor({ timeout: 20000 });
    } catch (e) {
      console.log(
        "Voice UI:",
        await page
          .locator("h1,.toast,.voice-session-note,.voice-session-button")
          .allTextContents(),
      );
      await page.screenshot({ path: "artifacts/voice-connect-error.png" });
      throw e;
    }
    console.log(
      "Live microphone/WebSocket connected:",
      Date.now() - started,
      "ms",
    );
    await page
      .locator(".goal-surface h2")
      .filter({ hasText: /recursion/i })
      .waitFor({ timeout: 25000 });
    const recognized = Date.now();
    console.log("Real Scribe transcript received:", recognized - started, "ms");
    await page.waitForSelector(".state-speaking", { timeout: 45000 });
    console.log(
      "Real model answer + first streamed playback:",
      Date.now() - recognized,
      "ms after transcript",
    );
    await page.waitForSelector(".state-listening", { timeout: 30000 });
    if (!(await page.locator(".goal-result").innerText()))
      throw Error("No response shown");
    await page
      .getByRole("button", { name: "End voice conversation", exact: true })
      .click();
    console.log(
      "PASS: real live transcription → real conversational model → streaming playback → listening, without clicking to send.",
    );
    await page.screenshot({ path: "artifacts/live-conversation.png" });
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
