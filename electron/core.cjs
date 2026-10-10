const {validateExtra}=require('./capabilities.cjs');
const path = require("node:path");
function parseKeys(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(gemini_api_keys?|gemini_voice_api_key|openrouter_api_keys?|nvidia_api_key|sarvam_api_keys?|fish_audio_api_key|elevenlabs_api_keys?)\s*[:=]\s*(.+)$/i,
    );
    if (!m) continue;
    const name = m[1].toLowerCase().replace(/_keys$/, "_key");
    const candidates = m[2].match(/[A-Za-z0-9_-]{28,}/g) || [];
    result[name] = [...new Set([...(result[name] || []), ...candidates])];
  }
  return result;
}
function within(root, candidate) {
  const rel = path.relative(root, candidate);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}
function validateAction(action) {
  if (!action || typeof action !== "object") throw new Error("Invalid action");
  if (validateExtra(action)) return action;
  if (
    !["list_files", "read_text", "system_info", "create_note"].includes(
      action.tool,
    )
  )
    throw new Error("This capability is not connected yet.");
  if (
    action.tool === "read_text" &&
    (typeof action.path !== "string" || action.path.length > 1000)
  )
    throw new Error("A valid file path is required.");
  if (
    action.tool === "create_note" &&
    (typeof action.content !== "string" || action.content.length > 100000)
  )
    throw new Error("Invalid note content.");
  return action;
}
async function withCredentialFallback(credentials, perform) {
  if (!credentials?.length)
    throw new Error("Import an ElevenLabs API key in Settings first.");
  let failure;
  for (const key of credentials) {
    try {
      return await perform(key);
    } catch (error) {
      failure = error;
      const eligible =
        error.httpStatus === 402 ||
        (error.httpStatus === 401 &&
          [
            "invalid_api_key",
            "quota_exceeded",
            "insufficient_credits",
          ].includes(error.providerCode));
      if (!eligible) throw error;
    }
  }
  throw failure;
}
module.exports = { parseKeys, within, validateAction, withCredentialFallback };
