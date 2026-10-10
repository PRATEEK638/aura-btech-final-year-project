const { withCredentialFallback } = require("./core.cjs");
function createVoice({ getKeys, request, publish, fetchImpl = fetch }) {
  const active = new Map();
  return {
    cancel(id) {
      if (id) active.get(id)?.abort();
      else for (const c of active.values()) c.abort();
    },
    async token() {
      return withCredentialFallback(getKeys(), (key) =>
        request(
          "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
          { method: "POST", headers: { "xi-api-key": key }, timeoutMs: 12000 },
        ),
      );
    },
    async stream(text, id) {
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 5000 ||
        typeof id !== "string" ||
        !/^[-a-z0-9]{10,80}$/i.test(id)
      )
        throw Error("Invalid speech request");
      for (const c of active.values()) c.abort();
      const controller = new AbortController();
      active.set(id, controller);
      const started = Date.now();
      let bytes = 0,
        firstAudioMs;
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await withCredentialFallback(
          getKeys(),
          async (key) => {
            const r = await fetchImpl(
              "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream?output_format=pcm_24000",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "xi-api-key": key,
                },
                body: JSON.stringify({
                  text,
                  model_id: "eleven_flash_v2_5",
                  voice_settings: {
                    stability: 0.4,
                    similarity_boost: 0.75,
                    style: 0,
                    use_speaker_boost: false,
                  },
                }),
                signal: controller.signal,
              },
            );
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              const e = new Error("Speech provider returned HTTP " + r.status);
              e.httpStatus = r.status;
              e.providerCode = body.detail?.status;
              throw e;
            }
            return r;
          },
        );
        for await (const chunk of response.body) {
          if (controller.signal.aborted) throw Error("Speech stopped");
          bytes += chunk.length;
          if (bytes > 12000000) throw Error("Speech exceeded size limit");
          if (firstAudioMs === undefined) firstAudioMs = Date.now() - started;
          publish({ id, bytes: Array.from(chunk), sampleRate: 24000 });
        }
        if (!bytes) throw Error("Speech provider returned no audio");
        publish({ id, done: true });
        return { firstAudioMs, durationMs: Date.now() - started, bytes };
      } catch (e) {
        publish({
          id,
          error: controller.signal.aborted ? "Speech stopped" : e.message,
        });
        throw e;
      } finally {
        clearTimeout(timer);
        active.delete(id);
      }
    },
  };
}
module.exports = { createVoice };
