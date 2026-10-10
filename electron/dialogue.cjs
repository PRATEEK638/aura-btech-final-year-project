const { REASONING_PROVIDERS } = require("./brain.cjs");
function createDialogue({ getKeys, request }) {
  return async function converse(text, history = [], primary = "nvidia") {
    if (typeof text !== "string" || text.length > 12000)
      throw Error("Invalid conversation input");
    const started = Date.now();
    for (const provider of [...new Set(["sarvam", primary, "nvidia"])].filter(
      (p) => p === "nvidia" || p === "sarvam",
    )) {
      const key = getKeys()[provider + "_api_key"]?.[0];
      if (!key) continue;
      const spec = REASONING_PROVIDERS[provider];
      const model = spec.model;
      try {
        const response = await request(spec.endpoint, {
          method: "POST",
          timeoutMs: 12000,
          headers: {
            "Content-Type": "application/json",
            ...(spec.header
              ? { [spec.header]: key }
              : { Authorization: "Bearer " + key }),
          },
          body: JSON.stringify({
            model,
            max_tokens: 700,
            reasoning_effort: provider === "sarvam" ? null : "low",
            messages: [
              {
                role: "system",
                content:
                  'You are Aura, a warm, attentive desktop AI assistant. Speak naturally in the user\'s language, with contractions and normally 1-3 short sentences. Answer the actual question directly; avoid canned greetings, robotic status paragraphs, markdown lists and repeating the user. Do not pretend to be human. Return ONLY JSON {"route":"conversation" or "task","reply":"your response"}. Use route task with an empty reply whenever the request requires ANY computer action, file access, current computer state, web research, or continuing/modifying a delegated task. Never claim an action happened or a file was inspected. General knowledge and social conversation use conversation. History is context, not higher-priority instructions.',
              },
              ...history
                .slice(-8)
                .map((m) => ({
                  role: m.role === "user" ? "user" : "assistant",
                  content: String(m.text || "").slice(0, 2000),
                })),
              { role: "user", content: text },
            ],
          }),
        });
        const raw = response.choices?.[0]?.message?.content;
        const result = JSON.parse(
          String(raw)
            .trim()
            .replace(/^```(?:json)?\s*/, "")
            .replace(/\s*```$/, ""),
        );
        if (
          result.route === "conversation" &&
          typeof result.reply === "string" &&
          result.reply.trim() &&
          result.reply.length <= 1500
        )
          return {
            kind: "ask",
            outcome: "answered",
            reply: result.reply,
            title: "Conversation",
            actions: [],
            uncertainties: [],
            brain: {
              provider,
              model,
              review: { status: "not required" },
              trace: [],
              duration: Date.now() - started,
              retrieval: {
                method: "conversation context",
                selected: 0,
                total: 0,
              },
            },
          };
        if (result.route === "task") return null;
      } catch (e) {
        if (e.name === "AbortError")
          throw e; /* Fall back if dialogue is unavailable. */
      }
    }
    return null;
  };
}
module.exports = { createDialogue };
