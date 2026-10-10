# Aura: architecture and status assessment

Assessment scope: the repository and installed Windows desktop build, followed by a focused extraction of the execution loop. This is an assessment of implemented behavior, not the original product vision. No new automation capability was added during this change.

## Architecture found before changes

```text
Frontend: React
  src/App.jsx
    text conversation, microphone recording, audio playback
    selected-folder UI, task cards, settings, memory editor
    send → plan → executePlan → plan again (up to four rounds)
    approval routing, continuation and completion decisions
  src/BrainPanel.jsx
    model settings, personality settings, diagnostics and audit display

Desktop boundary: Electron
  electron/preload.cjs
    narrow IPC bridge; no Node access in renderer
  electron/main.cjs
    trusted-caller checks, credential vault, preferences
    folder selection, native confirmation, one-use planned steps
    direct implementations of four native tools
    speech/transcription API adapters

Agent planning
  electron/brain.cjs
    hosted model adapters and failover
    strict plan schema, bounded schema repair
    independent review for proposed changes
    user-approved memory retrieval
  electron/core.cjs
    action allowlist, path boundary helper, credential parser

State
  Windows-encrypted credential and preference vaults
  hash-linked metadata audit log (electron/audit.cjs)
  in-memory plans in main; conversations/tasks in React
```

There is no separate network backend, task worker, organization service, Python ML service, browser driver, or desktop accessibility adapter. Electron's main process is the local backend. Intelligence uses hosted models, not a model trained by this project.

## Component inventory

WORKING means a bounded implemented capability with automated or prior live evidence. PARTIAL means useful functionality exists but a major part of the expected capability is absent. PLACEHOLDER means presentation without an executor. MISSING means no implementation. BROKEN is reserved for observed failures, not unsupported requirements.

| Component | Status before change | Evidence and boundary |
|---|---|---|
| Text input, chat, native bridge | WORKING | `send()` calls `plan` through preload; main validates callers and returns structured results |
| Voice | PARTIAL | ElevenLabs transcription and speech, Sarvam speech, configurable Fish adapter; push-to-talk, no continuous interruptible conversation; physical microphone quality not established by automated tests |
| Task status/results | WORKING | Actual action outputs are displayed; session-only |
| Stop/cancel | WORKING | Generation/epoch invalidation, request abort, plan invalidation; cannot undo an already completed write |
| Pause/human takeover | MISSING | No desktop workflow checkpoint or resume after a human operates another app |
| Planner | WORKING | Model-selected four-tool vocabulary, JSON validation and repair; not arbitrary computer agency |
| Unsupported-goal handling | BROKEN in live probe; targeted correction tested | Notepad request initially scheduled an unrelated note; revised instructions produced a limitation response with no actions in the subsequent live test |
| Provider availability | PARTIAL | NVIDIA and ElevenLabs recently verified live; imported credentials alone do not prove availability; Gemini credentials previously failed, OpenRouter availability varied, Fish voice requires a reference ID |
| Personality | WORKING | Constrained tone and response detail; behavior configuration, not cognition or consciousness |
| Tool registry | MISSING | Tool vocabulary duplicated between prompt/validation and conditional executor |
| File tooling | PARTIAL | Selected-folder listing, small supported text reads, new Markdown notes; no PDF parsing, semantic file index, recursive organization, undo or file conversion |
| System perception | PARTIAL | OS/CPU/memory/uptime and selected-file metadata; no active window, screenshots, accessibility tree, browser DOM, processes, cursor, clipboard or notifications |
| Application, browser, shell, mouse, keyboard tools | MISSING | No action implementations or postcondition checks |
| Integration cards | PLACEHOLDER | Future/disconnected capabilities are described in UI; they do not operate those services |
| Execution engine | PARTIAL | Real bounded observe/plan/action continuation existed inside React; tool exceptions ended the task |
| Verification | PARTIAL | Note read-back and real read/system results; no general verifier proving the entire user objective is met |
| Failure recovery | PARTIAL | Provider failover and schema repair; no general tool retry policy or checkpoint recovery |
| User memory/preferences | WORKING | Editable/deletable user-provided memories, encrypted preferences, embedding or keyword retrieval |
| Durable task/application context | MISSING | No persistent conversations, application state or resumable task journal |
| Safety | PARTIAL | Narrow allowlist, path checks, sensitive-name filtering, confirmation, replay protection, cancellation; not a general permissions/policy engine |
| Audit | PARTIAL | Metadata-only hash chain; locally replaceable, not externally anchored or a complete compliance system |
| Customer account/control plane | MISSING | Local test product, not a hosted multi-tenant service |

A live Notepad probe exposed one BROKEN planning behavior: the model explained that app control was unavailable but scheduled a substitute Markdown note while asking whether the user wanted it. No write executed. The planner instructions now require an empty action list for unsupported goals or unaccepted alternatives. This is a model-behavior correction, not a deterministic proof against every possible goal substitution. Native write confirmation remains necessary.

The confirmed architectural defect is that the UI owns the orchestration loop. It also makes recovery/replacement of the UI harder. Successful tool calls and a model's final answer are not general proof of goal completion.

## Connections and disconnected parts

Connected: text → planner → validated native tools → observed results → follow-up model answer; voice → transcription → reviewed text → same text pipeline; reply → speech API → audio playback; memory/settings → encrypted storage and planner configuration; audit → intelligence panel.

Disconnected: browser/application integration descriptions have no executors; the task planner has no screen/window perception; voice has no realtime turn-taking; task state has no durable recovery; the desktop application has no company/customer service backend.

## Trace: “Open Notepad and type Hello World.”

1. The request enters the text box in `src/App.jsx`; `send()` gathers the request, conversation, selected provider and preferences.
2. `call("plan", ...)` invokes `window.aura.plan` from `electron/preload.cjs`.
3. The main-process `plan` handler calls `ai()`, then `brain.plan()`.
4. The selected model handles planning. The default is NVIDIA NIM `openai/gpt-oss-20b`; preferences/failover can select a different configured provider. Actual provider metadata is returned with the answer.
5. The model is explicitly limited to `system_info`, `list_files`, `read_text`, and `create_note`. It is told application automation is disconnected.
6. **The requested action flow stops here.** There is no `open_application` or `type_text`. Invented actions fail validation, with one schema-repair opportunity. No Notepad process is launched and no text is entered.
7. After the targeted instruction correction, a valid limitation response with no actions returns through IPC and appears in chat (with optional speech). If validation still fails, the UI displays the error.

This remains unsupported after the runtime extraction. The change does not claim otherwise.

## Single next architectural piece, now implemented

The dependency to implement first was a **UI-independent agent runtime**, before adding desktop actions. Adding more executors while React owns orchestration would deepen the coupling.

`electron/runtime.cjs` now owns plan execution, accumulated observations, explicit original-goal context, continuation, plan-specific approval pauses, cancellation state, round limits, and failure outcomes. The runtime takes injected planner, executor and progress callbacks. It has no React or Electron dependency.

```text
React input and presentation
  → IPC plan / runTask / taskStatus
    → AgentRuntime
      → brain.plan (model reasoning and review)
      → native executor (existing four tools and native confirmation)
      → observation → continuation or terminal state
    → taskUpdate events
  → React task cards and responses
```

The interface still initiates requests, sends explicit approval intent and plays audio. It no longer runs an action loop, constructs continuation prompts or chooses when to stop iterating. Native confirmation still gates every note write. Approval of one plan never approves a later write plan. Tool failure stops with “Needs attention”; the runtime does not retry potentially completed side effects automatically.

The runtime records a completed executor result even when cancellation arrives during the action, then stops before the next action. A changed shared folder fails closed instead of silently applying an old plan to a new folder. Requests are still session-only; runtime extraction does not implement persistence, automatic retry, goal-level verification or the future tool registry.

## Verification

All 21 automated tests passed, including headless runtime tests for multi-plan execution with accumulated observations, repeated approval boundaries, concurrent execution rejection, cancellation during execution/planning, preserved side-effect evidence, tool failure, unavailable review and a model that keeps requesting actions past the limit. Live tests passed for the React-to-runtime system-information workflow, scoped text reading, declined note approval, verified note creation, concurrent replay rejection, packaged speech, and packaged native execution with continuation. The corrected live Notepad probe returned no executable actions and explicitly acknowledged the unavailable capability. A source/artifact scan found no plaintext provider keys.

The next capability milestone can be implemented through a registered desktop adapter with observation and verification. It should use reusable application/window primitives. A task-specific Notepad demo is not a substitute for that interface.
