const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
(async () => {
  const env = { ...process.env, AURA_DISABLE_AUTO_VOICE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    const token = await page.evaluate(async () => {
      const r = await window.aura.voiceToken();
      return { ok: r.ok, error: r.error, issued: !!r.data?.token };
    });
    console.log(
      "Realtime transcription token:",
      token.issued ? "PASS" : token.error,
    );
    const result = await page.evaluate(async () => {
      const id = crypto.randomUUID(),
        chunks = [];
      const off = window.aura.onSpeechChunk((e) => {
        if (e.id === id && e.bytes) chunks.push(...e.bytes);
      });
      try {
        const r = await window.aura.speakStream(
          "Hello Aura. Can you explain recursion in one short sentence?",
          id,
        );
        if (!r.ok) throw Error(r.error);
        return { metrics: r.data, pcm: chunks };
      } finally {
        off();
      }
    });
    await fs.mkdir("test-results", { recursive: true });
    const pcm = Buffer.from(result.pcm),
      h = Buffer.alloc(44);
    h.write("RIFF");
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write("WAVE", 8);
    h.write("fmt ", 12);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24000, 24);
    h.writeUInt32LE(48000, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write("data", 36);
    h.writeUInt32LE(pcm.length, 40);
    await fs.writeFile(
      "test-results/live-voice-input.wav",
      Buffer.concat([h, pcm, Buffer.alloc(48000 * 2)]),
    );
    console.log("Live streamed speech: PASS", JSON.stringify(result.metrics));
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
