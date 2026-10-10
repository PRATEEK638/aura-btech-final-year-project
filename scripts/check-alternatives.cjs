const fs = require("node:fs/promises");
const { parseKeys } = require("../electron/core.cjs");
(async () => {
  const keys = parseKeys(
    await fs.readFile(process.env.AURA_IMPORT_KEYS, "utf8"),
  );
  const options = [
    [
      "NVIDIA",
      "https://integrate.api.nvidia.com/v1/chat/completions",
      keys.nvidia_api_key[0],
      "meta/llama-3.1-70b-instruct",
    ],
    ...keys.openrouter_api_key.map((key, i) => [
      "OpenRouter " + (i + 1),
      "https://openrouter.ai/api/v1/chat/completions",
      key,
      "openrouter/free",
    ]),
  ];
  for (const [name, url, key, model] of options) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: 'Respond with only JSON: {"reply":"Hello","actions":[]}',
            },
          ],
          max_tokens: 100,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(35000),
      });
      console.log(name, "HTTP", r.status);
      if (r.ok) {
        const body = await r.json();
        console.log("Has response:", !!body.choices?.[0]?.message?.content);
      }
    } catch (e) {
      console.log(name, e.name);
    }
  }
})();
