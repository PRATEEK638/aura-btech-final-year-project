# Mark LIV reference review and Aura delivery

Reviewed 18 September 2026. Reference: the supplied Mark-LIV-main.zip. Static inspection only: no reference code was executed, installed, or copied into Aura. README claims are not measured results. The archive identifies FatihMakes as copyright holder and uses CC BY-NC 4.0 with commercial use excluded. Keep this implementation separate from a commercial Aura codebase.

## What the reference contributes

| Area | Evidence inside archive | Implication for Aura |
|---|---|---|
| Voice | `main.py` connects to Gemini Live, sends microphone audio, receives streamed responses, and schedules playback | This is a more direct voice architecture than Aura's current transcription → reasoning → speech pipeline. Aura should eventually adopt a streaming transport behind its existing voice interface. |
| Tools | `core/action_loader.py` discovers action modules with TOOL metadata and handlers | Useful extensibility pattern. Aura now has an additional descriptor registry with argument validation; its original four tools still need consolidation into that registry. |
| Browser | `actions/browser_control.py` has Playwright sessions, navigation, clicks, typing, forms, tabs and DOM reads | Broader implemented surface than Aura. Aura currently supports public-page navigation and DOM extraction only. Neither arbitrary-site reliability nor relative speed was established. |
| Files | `actions/file_controller.py` implements create/read/write/find/move/copy/rename/delete/organize; `core/undo.py` stores ten in-memory undo callbacks | Prefer verified, non-overwriting primitives and durable change records. Reference undo callbacks do not consistently check whether the user changed a file after the original action. Aura refuses overwrite and verifies writes/moves, but lacks durable undo. |
| Desktop | `actions/computer_control.py` uses keyboard/mouse, clipboard, screenshots, window focusing and visual lookup; `actions/open_app.py` launches apps | Aura still lacks general window perception and keyboard/UI Automation. Launching an app is only a dispatch result, not proof that the requested application task completed. |
| Documents | `actions/file_processor.py` contains handlers for PDFs, presentations, spreadsheets and other formats | Reference has broader format coverage. Aura currently reads/writes text, Markdown, CSV and JSON; it must not advertise full Office automation. |
| Human control | `core/confirm.py` binds time-limited confirmations to UI callbacks | Keep confirmation outside model control. Aura enforces confirmation natively for file moves and recycling. |
| Local features | Local LLM/STT/TTS helpers and a wake-word module are present | Presence alone does not establish end-to-end integration or quality. No offline performance was tested. |

The reference combines a large voice/UI coordinator in `main.py` with modular actions and helpers. Aura separates React presentation, IPC, provider planning, execution runtime and native adapters. Separation is useful for replacement and testing, but is not evidence that Aura is already the more capable product. No test suite was found in the archive listing.

## Aura's current path

```text
Home voice session or optional text
  → preload IPC → main controller → brain provider + validated plan
  → AgentRuntime → native tool adapters → verification evidence
  → runtime events → Home goal/actions/result → spoken response
```

The voice session resumes capture after playback. It is half-duplex, requires one initial click, uses simple energy/silence detection and has no wake word or speech interruption during playback. ElevenLabs is the available voice path; supplied Gemini keys failed authentication. The Codex session itself is not installed or authenticated as Aura's brain: Aura calls its separately configured model providers.

Runtime task history is in memory, planning is bounded, and a tool failure can still stop the task. Desktop perception, resilient replanning, persistent checkpoints, typed interaction in arbitrary apps, rich document generation, and durable undo remain missing. The Python worker is experimental and not connected to the packaged runtime.

## Verification and limits

- Native public browser navigation and DOM extraction passed against example.com independently of the model.
- NVIDIA planning successfully created and read back a new Markdown file through the actual runtime, and discovered Notepad through Windows. A later model-planned browser request timed out before tool execution; provider latency remains a real limitation.
- Voice automation test uses a synthetic microphone and stubbed transcription/planning, with real ElevenLabs speech. It verifies listening → automatic submission → speech → listening and session shutdown. It does not prove physical microphone recognition quality.
- Unit coverage includes scoped paths, overwrite refusal, verified moves, cancellation, recycling confirmation using a test double, and blocked private-network URLs. Native Recycle Bin integration has not been exercised by that unit test.
- No head-to-head latency, accuracy, reliability or task-success benchmark against Mark LIV was run. Aura has not demonstrably surpassed it.

## Next architectural priority

Add a Windows accessibility adapter with observed window/element identifiers and post-action verification. This closes the specific gap between launching an application and accomplishing work inside it, using reusable primitives rather than one hardcoded Notepad workflow. Keep it behind the existing tool boundary.

Judge progress using the same task set on both assistants: successful completion, verified result, manual interventions, recovery after failure, and median/p95 completion time. Start with app launch, text-file creation, safe file organization, public-page extraction to Markdown, then Notepad typing. Do not substitute animation, broad API counts, or an AGI label for these results.


## Integration update

The owner subsequently confirmed permission from their friend to use the reference. The work below uses its modular-control pattern while keeping Aura's existing runtime; no wholesale replacement was performed. The earlier table describes the pre-integration assessment, not the new build.

- A Python standard-library Windows adapter now lists real windows, observes native editable controls, and inserts text only into an empty observed editor with read-back verification. IDs expire, belong to one window/process/title, and cannot be replayed after insertion. This is a native Win32 adapter, not complete UI Automation or general visual control.
- Browser search and following IDs from observed links are now registered tools. Private-page restrictions and isolated browser settings still apply.
- A Python Word adapter creates new basic DOCX documents and reads paragraph text. It verifies saved text and refuses overwrites. It does not preserve arbitrary source layouts or render-check typography.
- Voice playback has an Interrupt control; exact spoken session-ending commands are handled locally after transcription. Full streaming voice and hands-free interruption during playback remain unimplemented.
- Planner validation rejects placeholder window/control/link IDs, requiring an observation round before dependent actions.

These are general primitives. Notepad is a verification fixture, not a dedicated task handler. Native direct-control and DOCX tests passed. The Python executable is a runtime prerequisite; the worker source is included in the packaged app.

Final integration checks: 27 automated tests passed. The real provider/runtime Notepad test completed with four observed actions and verified text insertion. A live Python.org browser test verified navigation, following an observed link, stale-link rejection and extracted page content. The voice UI test verified interruption and return to listening with a simulated microphone; physical microphone quality and streaming latency still need user testing.
