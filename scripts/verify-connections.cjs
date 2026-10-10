const fs = require("node:fs/promises");
const { parseKeys } = require("../electron/core.cjs");
(async () => {
  const keys = parseKeys(
    await fs.readFile(process.env.AURA_IMPORT_KEYS, "utf8"),
  );
  for (let i = 0; i < keys.gemini_api_key.length; i++) {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": keys.gemini_api_key[i],
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in two words." }] }],
        }),
        signal: AbortSignal.timeout(25000),
      },
    );
    const body = await r.json();
    console.log(
      "Gemini candidate",
      i + 1,
      "HTTP",
      r.status,
      "reason",
      body.error?.details?.[0]?.reason || body.error?.status || "OK",
    );
  }
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.openrouter_api_key[0]}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: 'Respond with only JSON: {"reply":"Hello","actions":[]}',
        },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(40000),
  });
  console.log("OpenRouter generation HTTP", r.status);
  const voice = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": keys.elevenlabs_api_key[0],
      },
      body: JSON.stringify({
        text: "Hey, I’m Aura. What can I take off your hands?",
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(40000),
    },
  );
  console.log("ElevenLabs speech HTTP", voice.status);
  if (voice.ok) {
    await fs.mkdir("artifacts", { recursive: true });
    const data = await voice.arrayBuffer();
    await fs.writeFile("artifacts/aura-voice-sample.mp3", Buffer.from(data));
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("file", new Blob([data], { type: "audio/mpeg" }), "voice.mp3");
    const transcript = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": keys.elevenlabs_api_key[0] },
        body: form,
        signal: AbortSignal.timeout(40000),
      },
    );
    console.log("ElevenLabs transcription HTTP", transcript.status);
    if (transcript.ok) {
      const t = await transcript.json();
      console.log("Transcription returned text:", !!t.text);
    }
  }
})().catch((e) => {
  console.error(e.name);
  process.exitCode = 1;
});
