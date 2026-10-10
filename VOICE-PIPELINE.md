# Voice conversation repair — 18 September 2026

The previous conversation path recorded a complete turn, uploaded it, ran the full task planner, generated a complete MP3, and only then played it. It also marked Aura as speaking before audio arrived. A second microphone amplitude detector could mistake background noise or speaker output for an interruption. More API keys did not change these delays or that playback bug.

## Current path

1. The Electron main process obtains a single-use ElevenLabs realtime transcription token using a DPAPI-stored key. The provider key stays in the main process.
2. The renderer uses the official ElevenLabs client and a bundled audio worklet. A persistent Scribe v2 realtime connection receives microphone audio with browser echo cancellation and noise suppression. Server voice activity detection commits speech after a pause. Partial words are visible.
3. Recognized words submit automatically. Simple exact resource-opening requests retain the existing local route. Other voice turns first use `electron/dialogue.cjs`: short conversational replies with recent dialogue context, or a handoff to the existing planner for computer actions. Sarvam 105B with extended reasoning disabled is tried first; NVIDIA is the supported alternative. This route does not execute tools or claim computer access.
4. `electron/voice.cjs` requests ElevenLabs Flash v2.5 PCM speech and forwards chunks through narrow IPC. `src/PcmPlayer.js` queues them in Web Audio immediately. The UI enters Speaking when playback is scheduled, rather than when the request is sent.
5. Recognition remains connected between turns. Recognized speech can interrupt playback; raw microphone volume cannot. Short exact stop commands end listening or cancel work. One follow-up can wait while a task is busy.
6. If live recognition fails, the UI reports it and uses the existing batch transcription path. That fallback waits until a reply finishes before recording and does not implement automatic interruption. The manual Interrupt button remains available.

The main files are `src/useVoiceSession.js`, `src/useBatchVoiceSession.js`, `src/PcmPlayer.js`, `electron/voice.cjs`, and `electron/dialogue.cjs`. UI, provider credentials, conversation routing, and tool execution remain separate.

## Verification

- Unit tests cover first-chunk delivery before the response finishes, request validation, cancellation of in-flight speech, malformed conversation results, and delegation of computer requests.
- `node scripts/voice-provider-live.cjs` checks actual token issuance and streaming synthesis, and creates a known speech fixture. A live run received its first audio chunk in 232 ms. That measures speech synthesis only, not total conversation latency.
- `node scripts/realtime-conversation-live.cjs` feeds that known speech into Electron's test microphone, uses real Scribe, the real conversation model, and real streamed playback, and checks return to listening. Development runs measured 4.9–7.0 seconds from recognized transcript to first playback; the final installed Desktop build measured 3.9 seconds. These exclude the utterance and recognition time and are observations, not latency guarantees.
- `node scripts/voice-session-smoke.cjs` forces a realtime-token failure and checks fallback capture, automatic submission, real speech playback, return to listening, and ending the session. Its transcript and model response are fixtures.
- Set `AURA_EXECUTABLE` to the packaged `app/Aura.exe` to run those Electron checks against the delivered app. Live scripts consume provider quota and require configured credentials. Run the speech fixture script first.

An injected microphone waveform tests the actual provider pipeline; it does not certify the physical microphone, loudspeaker echo, accent recognition, or room acoustics. The model still generates its complete reply before speech starts. Provider congestion, network latency, and quotas can cause delays or failures. More work is needed for consistently low-latency, natural conversational turn-taking. This change does not claim human-equivalent conversation or universal computer task completion.

## ChatGPT Plus

A future personal connection can use the official Codex App Server with **Sign in with ChatGPT**, subject to the account's Codex entitlement and limits. It is not implemented in this voice repair. ChatGPT Plus is not a general OpenAI API key or credit for direct Realtime/API requests. Aura must not copy private Codex credentials or treat a subscription as a shared company API account.

References: [official authentication](https://learn.chatgpt.com/docs/auth), [official App Server integration](https://learn.chatgpt.com/docs/app-server), [ElevenLabs realtime client](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming), [streamed speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [Sarvam chat API](https://docs.sarvam.ai/api-reference/chat/chat-completions).
