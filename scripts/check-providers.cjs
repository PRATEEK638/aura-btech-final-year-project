// Explicit local diagnostic. Never prints credentials or provider response bodies.
const fs = require("node:fs/promises");
const { parseKeys } = require("../electron/core.cjs");
(async () => {
  const file = process.env.AURA_IMPORT_KEYS;
  if (!file)
    throw new Error("Set AURA_IMPORT_KEYS to the local credential file.");
  const keys = parseKeys(await fs.readFile(file, "utf8"));
  console.log(
    "Imported fields:",
    Object.fromEntries(
      Object.entries(keys).map(([name, values]) => [name, values.length]),
    ),
  );
  for (const [name, url, options] of [
    [
      "Gemini",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": keys.gemini_api_key?.[0],
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with only: Hello." }] }],
        }),
      },
    ],
    [
      "OpenRouter",
      "https://openrouter.ai/api/v1/auth/key",
      { headers: { Authorization: `Bearer ${keys.openrouter_api_key?.[0]}` } },
    ],
    [
      "ElevenLabs",
      "https://api.elevenlabs.io/v1/voices",
      { headers: { "xi-api-key": keys.elevenlabs_api_key?.[0] } },
    ],
  ]) {
    try {
      const r = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(25000),
      });
      console.log(`${name}: HTTP ${r.status}`);
    } catch (e) {
      console.log(`${name}: ${e.name}`);
    }
  }
})();
