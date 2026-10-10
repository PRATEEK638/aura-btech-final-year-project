# Aura goal-first Home

Home presents the current request and runtime state. Conversations retains the transcript; sending a request no longer navigates there. New goal preserves the transcript.

| Scenario | Home and orb | Command | Context and controls | Result |
|---|---|---|---|---|
| Idle | Aura is ready; restrained orb | Compact text/voice command | Actual system summary and allowed folder; no invented app context | Remains idle until input |
| What is recursion? | Preparing, then an answer card | Available for another question | Question and actual available context | Knowledge answer; transcript remains accessible |
| Open Spotify | Preparing, then blocked when the backend reports missing capabilities | Available to revise the request | Application/window explicitly not observed; no execution actions | Capability limit, not a fake launch |
| Open Notepad and type Hello World | Preparing, then blocked for the same reason | Available to revise | No fabricated multi-step timeline | Explains unavailable application control |
| Check computer memory | Preparing, native action label, assessment of results | Can submit a correction | Tool in use and actual completed observations | Tool result and summary |

The requested application scenarios cannot truthfully show completed app actions because the backend has no such tools. A supported system-inspection task demonstrates the real execution timeline.

## State sources

- Listening: actual MediaRecorder capture. Orb scale uses Web Audio RMS measurements, not a decorative waveform.
- Understanding: transcription request in progress.
- Planning: planning/continuation IPC request in progress.
- Acting: runtime tool execution events and current action label.
- Waiting: runtime Needs approval.
- Blocked: backend outcome or runtime Needs attention.
- Completed: answer delivered or runtime Complete; general goal verification remains limited by the existing backend.
- Error: failed request.
- Idle/stopped: no work or explicit cancellation.

The planner now returns validated ask/do and blocked/working/answered metadata. A blocked request cannot schedule actions. This is response metadata for the interface, not a new computer capability.

## Control boundaries

Cancel and Stop for manual control cancel backend work. Resumable pause is explicitly unavailable. Existing native note confirmation remains enforced. Voice transcripts are reviewed before sending; continuous voice conversation is not implemented.

A correction submitted while work is running cancels the current run and creates a revised request containing the prior goal, user update and observations retrieved after cancellation settles. This is explicit stop-and-replan, not durable task editing or rollback. An action already in progress can finish; Aura waits for the previous run before reading its runtime evidence. Inspect that evidence before retrying changes. Constraints are carried as request text rather than a formal constraint database.

Task progress is session-only. The right panel never claims to know an active window or application. General application perception, persistent recovery, seamless takeover and richer automation remain outside this UI change.
