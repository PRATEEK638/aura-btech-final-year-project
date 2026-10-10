![AURA DESKTOP](docs/assets/banner.svg)

# Aura Desktop

A final-year exploration of voice-driven desktop assistance.

**Focus:** SDE / AI Engineer  
**Stack:** Electron · React · Python · LLM APIs

[LinkedIn](https://www.linkedin.com/in/prateek-sharma-97a064296/) · [Portfolio projects](docs/PORTFOLIO.md)

## Project overview

Aura BTech final year project.

## Engineering highlights

- Typed and voice interaction with visible execution plans
- Multiple reasoning-provider adapters and bounded planning
- Windows control observation and verified document operations
- Architecture, voice pipeline, interaction and readiness documentation

## What I learned

I learned a lot by working through this project: reading code, troubleshooting integrations, comparing approaches, and understanding how individual components become a complete application. The main takeaways were:

- Separating UI, planning, native tools and verification into clear modules.
- Handling provider failures, concurrent actions and application state.
- Evaluating voice pipelines and documenting practical automation boundaries.

## Getting started

Run the following from the repository root in PowerShell. Install the required Python/Node.js runtimes first and use your own credentials where required.

```powershell
npm ci
npm run build
npm run desktop
# Existing project tests
npm test
```

## Repository map

| Path | Contents |
|---|---|
| `ARCHITECTURE-ASSESSMENT.md` | Project source, documentation or configuration |
| `artifacts /` | Project modules and assets |
| `build /` | Project modules and assets |
| `electron /` | Desktop runtime and integrations |
| `index.html` | Project source, documentation or configuration |
| `INTERACTION-MODEL.md` | Project source, documentation or configuration |
| `package-lock.json` | Project source, documentation or configuration |
| `package.json` | Project source, documentation or configuration |
| `PERSONALITY.md` | Project source, documentation or configuration |
| `PRODUCT-READINESS.md` | Project source, documentation or configuration |
| `python /` | Native workers and Python dependencies |
| `REFERENCE-REVIEW.md` | Project source, documentation or configuration |
| `scripts /` | Project modules and assets |
| `src /` | Application interface |
| `tests /` | Existing project tests |
| `TRY-AURA.md` | Project source, documentation or configuration |
| `vite.config.js` | Project source, documentation or configuration |
| `VOICE-PIPELINE.md` | Project source, documentation or configuration |

## Downloads

[Open project releases](https://github.com/PRATEEK638/aura-btech-final-year-project/releases/tag/local-import-2026-10-10)

| File | Size | SHA-256 |
|---|---:|---|
| `desktop-app.zip` | 159.7 MiB | `9de374968add39cf5ebc5b58814f9fffbbc67277b466989d4833fa40d8cf704a` |

## Project status

This is a development or study snapshot. Source import and upload checks are separate from runtime validation; the application and model behavior have not been retested as part of preparing this portfolio.

## Existing project documentation

<details>
<summary>Setup details, implementation notes and original documentation</summary>

# Aura Desktop

A Windows desktop application for outcome-based assistance, with typed requests, microphone transcription, natural spoken replies, a visible execution plan, and native capability boundaries.

The full project is delivered to **Desktop/aura - btech final year project**. Double-click the **Aura** Desktop shortcut to launch it. The source, build configuration, tests, icon assets, documentation, and ready-to-run Windows application are included. Development dependencies can be restored with `npm install`.

Home now presents goals and runtime state, with a primary Talk to Aura control, compact optional text input, and a context panel hidden by default. Conversations remains available as history. See [INTERACTION-MODEL.md](INTERACTION-MODEL.md) for scenario behavior and control limitations.

## New in v0.2

- Four reasoning-provider adapters, transparent failover, and constrained output repair.
- Independent review of proposed changes, with one revision attempt and no execution when review fails.
- A consistent, configurable Aura personality and response depth.
- NVIDIA neural embeddings and cosine ranking for approved memories, with a local keyword fallback.
- An intelligence panel showing provider health, reasoning receipts, and a metadata-only audit trail.
- Encrypted preferences and memory, single-instance operation, and protection against concurrent action replay.
- A quick-response option, bounded provider requests, and bounded planning rounds. Actual latency still depends on providers and task complexity.

The initial assessment below predates the expanded tools. See [REFERENCE-REVIEW.md](REFERENCE-REVIEW.md) for the latest comparison and scope. Python 3 is now used for native Windows control observation/text insertion and simple Word document read/write. The standard-library workers are shipped under app/resources/python and use the installed Python executable on PATH. Python is already available on this development computer; other computers need Python 3 installed. The older ML-analysis worker remains experimental.

See [ARCHITECTURE-ASSESSMENT.md](ARCHITECTURE-ASSESSMENT.md) for the inspected component status, Notepad request trace, and runtime separation. See [PRODUCT-READINESS.md](PRODUCT-READINESS.md) for evaluation criteria and remaining enterprise work, and [PERSONALITY.md](PERSONALITY.md) for Aura's behavioral principles.

## Open Aura

Use the Desktop shortcut or `app/Aura.exe` in the delivered project. It launches the ready-to-run application directly, without unpacking a portable archive on each launch. No installer or administrator access is required. Credentials are stored for the current Windows user, separately from the executable. Developer packaging also produces `release/Aura 0.2.0.exe` for portable distribution.

For development:

```powershell
npm install
npm run build
npm run desktop
```

For renderer development, run `npm run dev`, then start Electron in another terminal with `$env:AURA_DEV='1'; npm run desktop`. A browser preview is visual only; it intentionally cannot access files, credentials, or native tools.

## Working capabilities

- Text conversation and goal planning through OpenRouter, Gemini, NVIDIA NIM, or Sarvam.
- NVIDIA NIM is the default reasoning provider. OpenRouter's free model router is an alternative; that service can vary its selected model between requests and proved inconsistent in repeated task tests.
- Voice conversation starts automatically when Aura opens (disable this in Settings if preferred). ElevenLabs Scribe streams recognition over a persistent connection, submits speech after a pause, and keeps listening between replies. Recognized speech can interrupt playback; microphone amplitude alone cannot. Say "stop listening" or use Escape to end the session. If realtime recognition is unavailable, standard recording/transcription remains available. An optional push-to-talk control still supports transcript review. See [VOICE-PIPELINE.md](VOICE-PIPELINE.md) for architecture, measurements, and limitations.
- Natural spoken replies with ElevenLabs, Sarvam, or Fish Audio. Fish Audio requires a voice model ID in Settings. The default is ElevenLabs' George voice.
- Real Windows processor, memory, and uptime inspection. Installed-app discovery and launch requests through Windows Start Apps; launch acceptance alone is not proof of task completion. list_windows and read_window can inspect native Windows controls; type_text writes only to an empty observed Edit/RichEdit control and verifies read-back. Chromium/canvas/custom controls are not supported by this adapter.
- Search accessible local drives, prioritizing user folders; create folders, write new text/Markdown/CSV/JSON and simple Word .docx files, read supported documents, move individual files, and recycle individual files. Delegated file moves run without a per-file prompt; recycling still requires confirmation; writes refuse overwrites and verify content.
- Public HTTPS browser navigation and extraction of visible text, links and tables. Browser content is treated as untrusted. Public search and following exact observed link IDs are supported. No authenticated forms, arbitrary clicks, or downloads yet.
- Listing up to 200 entries in an explicitly selected folder and reading supported text files up to 40 KB inside that folder.
- Creating new Markdown notes in Documents/Aura, with native Windows confirmation and read-back verification. Existing files are never overwritten.
- Multi-round tool planning with a four-round bound, per-step progress, raw verification evidence, cancellation, and clear provider failures.
- User-authored memory that can be removed, saved locally with preferences. Conversation and task history are currently session-only.

Press Escape to cancel pending requests, stop playback, and stop recording. Cancellation cannot undo a write that has already completed. Click a speaker button to hear a reply again. Mute spoken replies in Settings or the companion panel.

## Credentials and data

Use **Settings → Import keys** to choose a local `.txt` or `.env` file. Only recognized credential fields are parsed; prose and instructions in the file are ignored. Supported labels include `gemini_api_key`, `openrouter_api_keys`, `nvidia_api_key`, `elevenlabs_api_key`, `sarvam_api_keys`, and `fish_audio_api_key`.

Keys are encrypted using Electron `safeStorage` (Windows DPAPI) in `%APPDATA%/Aura/providers.vault`. Provider keys are not bundled, written into source files, sent to the renderer, or displayed in logs. Realtime speech receives a short-lived single-use token from the backend. The supplied source file remains wherever you placed it; Aura does not alter it. All keys in a recognized list are stored. ElevenLabs uses the additional user-provided keys first and falls back on invalid-key or credit errors; it does not rotate on rate-limit or anti-abuse errors. Other providers currently use their first key.

Preferences and user-authored memory are encrypted in `%APPDATA%/Aura/preferences.vault`. The previous JSON preferences file is migrated and removed. Requests, relevant conversation context, explicitly shared file content, and memory are sent to the chosen reasoning provider. Recorded microphone audio goes to ElevenLabs for transcription. Spoken response text goes to the selected speech provider. This is not an offline assistant. Audio recordings are held in memory and are not saved by the application.

**Credential verification during this build:** OpenRouter free-model generation, NVIDIA reasoning, Sarvam speech, ElevenLabs speech generation, and ElevenLabs transcription succeeded. The four additional ElevenLabs keys passed authentication and were added to the encrypted store. All supplied Gemini candidates returned `API_KEY_INVALID`; OpenRouter's paid Gemini route returned HTTP 402, so OpenRouter uses the free router instead. NVIDIA passed the final full task test and is selected by default. Imported-key badges are intentionally not labeled as verified connections. Fish Audio needs a user-selected voice model ID before synthesis can be tested.

## Architecture and scope

`src/App.jsx` implements the React interface. `electron/preload.cjs` exposes a narrow IPC bridge. `electron/main.cjs` owns encrypted credentials, provider requests, native permissions, capability execution, and verification. `electron/core.cjs` defines parsing and action validation. `electron/brain.cjs` handles provider routing, schema repair, independent review, personality, and neural memory retrieval. `electron/audit.cjs` maintains a local metadata-only hash-linked log. The renderer has no Node integration; context isolation, sandboxing, navigation restrictions, and a Content Security Policy are enabled.

`electron/runtime.cjs` owns the multi-step execution loop outside React. It receives injected planner/executor functions, retains the original goal and accumulated observations, pauses legacy note plans for approval, while extra tools enforce their own native risk checks, enforces four execution rounds, and emits task-state updates. React presents these updates and submits user intent. Runtime state remains in memory; closing Aura does not preserve resumable tasks.

The original tools are `system_info`, `list_files`, `read_text`, and `create_note`. `electron/capabilities.cjs` adds validated descriptors for `list_apps`, `launch_app`, `search_files`, `open_path`, `create_folder`, `write_file`, `read_document`, `move_file`, `trash_file`, and `browse_page`. `electron/browser.cjs` owns the isolated public browser adapter. The model proposes structured actions; the native process validates them. Actions are attached to opaque plan IDs, expire on cancellation, and cannot be replayed after successful execution. Folder reads use canonical paths to reject traversal and symlink escapes. Some sensitive filename patterns are blocked; this does not constitute complete secret detection, so select shared folders thoughtfully.

### What can be built today

The working capabilities above use available model APIs, Windows filesystem operations, system metadata, and explicit permissions. They are integrated in the application rather than simulated with timers.

### What needs further engineering

Interactive browser actions, Full Windows UI Automation/accessibility, app-specific connectors, email/calendar authorization, rich document formats, semantic indexing, persistent encrypted task checkpoints, persistent undo history, improved acoustic echo handling, streaming model-to-speech generation, screen selection, and skill installation. The interface marks unimplemented skills as not connected.

Add future tools as capability descriptors with input validation, permission scope, risk classification, executor, verifier, and recovery handler. Keep model selection and execution separate. Before adding mutations, add idempotency, transaction logging, and rollback. Require explicit authorization for sending, publishing, financial operations, security changes, or destructive actions.

### What is still unreliable

Arbitrary visual computer operation, recovering from every unexpected UI change, long unattended workflows, and inferring ambiguous intent without clarification. Planning can fail over to another configured provider, repair malformed JSON once, and revise a plan after independent review. Tool execution still stops on failure with the error visible; it does not yet implement checkpoint-based resumption. Provider responses, free-tier availability, latency, quotas, and output schemas can fail.

### Longer-term vision

A profession-independent computer agency platform that observes structured state, plans across applications, selects reliable adapters, checks outcomes, recovers safely, and hands control back to a person when needed. This build is a functional starting point, not a claim of universal autonomous computer operation.

## Validation

```powershell
npm test
node scripts/desktop-smoke.cjs
node scripts/end-to-end.cjs
npm run package
```

Run `powershell -ExecutionPolicy Bypass -File scripts/install-desktop.ps1` after packaging to refresh the Desktop source copy and branded shortcut. Close Aura before running native smoke tests. `scripts/brain-live-smoke.cjs` checks Sarvam reasoning, independent review, and real embedding retrieval; `scripts/native-tools-smoke.cjs` verifies scoped reads, denied approval, verified note writing, and replay rejection in a test folder.

Unit tests check credential parsing and capability boundaries. The desktop smoke check opens actual Electron windows, exercises navigation and memory controls, and verifies the native bridge. The end-to-end check makes real API requests and verifies a goal → plan → native system inspection → verified result → AI summary flow. Live diagnostics consume provider quota. Physical microphone quality and latency require user testing on the target device.

The build is unsigned. Code signing and a secure update mechanism are still needed before public distribution.

Provider references: [Gemini](https://ai.google.dev/api/generate-content), [OpenRouter](https://openrouter.ai/docs/quickstart), [free router](https://openrouter.ai/openrouter/free/apps), [NVIDIA](https://docs.api.nvidia.com/nim/reference/openai-gpt-oss-20b-infer), [ElevenLabs transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [ElevenLabs speech](https://elevenlabs.io/docs/speech-synthesis/voice-settings), [Sarvam](https://docs.sarvam.ai/api-reference/text-to-speech/convert), [Fish Audio](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

## Folder and voice reliability update

Routine reads and opening resources do not require a second model, even with the older review-all preference saved. For bounded extra-tool writes, a reviewer outage is advisory; native validation still applies. Explicit negative review results still block execution, and legacy create_note retains its original review/confirmation flow.

Exact single-resource opening requests can be resolved locally and run through the same native tool/runtime without any model request. In local tests, Windows accepted a Desktop folder-open request in 82–86 ms. This measures request dispatch, not Explorer painting its first frame, and does not represent arbitrary-task or voice latency. Ambiguous and complex requests still use the model.

File tools can access local drives subject to Windows permissions, with system/internal/credential paths excluded. list_directory accepts an exact path without a manual folder picker. Filename search remains bounded to 8000 inspected entries and 50 matches; it is not a complete disk index.

Voice starts automatically with configured transcription credentials, remains active through silence, and can be ended with the visible control or Escape. You can disable automatic voice in Settings. Recognition and ElevenLabs speech output now stream; the conversation model still returns its full text before synthesis begins. Recognition-based interruption uses browser echo cancellation and a text echo filter; room noise and speaker echo need physical-device testing. Set AURA_DISABLE_AUTO_VOICE=1 for non-audio development tests.


</details>
