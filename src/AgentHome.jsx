import React from "react";
import {
  Mic,
  Square,
  ArrowUp,
  Check,
  LoaderCircle,
  Paperclip,
} from "lucide-react";
import "./agent-home.css";

export function agentState(phase, busy, request, task) {
  if (phase === "connecting") return "connecting";
  if (phase === "responding") return "responding";
  if (phase === "speaking") return "speaking";
  if (phase === "listening") return "listening";
  if (phase === "transcribing") return "understanding";
  if (task?.status === "Needs approval") return "waiting";
  if (task?.status === "Needs attention" || request?.status === "blocked")
    return "blocked";
  if (request?.status === "error") return "error";
  if (task?.status === "Stopped" || request?.status === "stopped")
    return "idle";
  if (busy) return phase === "working" ? "acting" : "planning";
  if (task?.status === "Complete" || request?.status === "answered")
    return "completed";
  return "idle";
}
const labels = {
  connecting: "Connecting your voice",
  responding: "Preparing my reply",
  speaking: "Speaking with you.",
  idle: "Here when you need me.",
  listening: "I’m listening.",
  understanding: "Understanding your request",
  planning: "Preparing the task",
  acting: "I’m taking care of it.",
  waiting: "I need one thing from you.",
  blocked: "This needs your attention.",
  completed: "Ready.",
  error: "Something interrupted the task.",
};

export default function AgentHome({
  voice,
  interruptSpeech,
  Orb,
  phase,
  busy,
  request,
  task,
  input,
  setInput,
  send,
  microphone,
  stop,
  approve,
  chooseFolder,
  openTranscript,
  level,
  reset,
}) {
  const state = agentState(phase, busy, request, task);
  const activity =
    state === "acting"
      ? task?.actions?.[task.step]?.label
      : state === "completed"
        ? request?.kind === "ask"
          ? "Here’s what I found."
          : "Done."
        : request?.status === "stopped"
          ? "Stopped. You’re in control."
          : labels[state];
  return (
    <div
      className={`agent-home state-${state}`}
      style={{ "--voice-level": level }}
    >
      <div className="presence" aria-live="polite">
        <Orb state={state} small={!!request} />
        <span className="presence-label">
          AURA · {state === "waiting" ? "WAITING FOR YOU" : state.toUpperCase()}
        </span>
        <h1>{request || voice.active ? activity : "Aura is ready"}</h1>
        {!request && <p>{voice.active ? "Speak naturally. I’ll handle the next step." : "Start a conversation. Tell me what to take care of."}</p>}
        <button className="voice-session-button" onClick={() => voice.active ? stop() : voice.start()} disabled={busy && !voice.active}>
          {voice.active ? <Square size={18}/> : <Mic size={22}/>}{voice.active ? "End voice conversation" : "Talk to Aura"}
        </button>
        {voice.active && <p className="voice-session-note">{voice.mode==='live'?'Live conversation':'Voice conversation'} · Esc to stop</p>}
        {voice.partial && <p className="voice-session-note" aria-live="polite">{voice.partial}</p>}
        {voice.active && phase === 'speaking' && <button className="button" onClick={interruptSpeech}>Interrupt · I want to speak</button>}
      </div>
      {request && (
        <section className="goal-surface">
          <div className="goal-heading">
            <span>
              {request.kind === "ask" ? "YOUR QUESTION" : "YOUR GOAL"}
            </span>
            <button onClick={openTranscript}>View transcript ↗</button>
          </div>
          <h2>{request.goal}</h2>
          {(request.kind !== "ask" || busy) && (
            <div className="goal-timeline" aria-live="polite">
              <div>
                <Check size={15} />
                <span>Request received</span>
              </div>
              <div>
                {busy && !task ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}
                <span>
                  {busy && !task
                    ? "Preparing your request"
                    : "Request assessed"}
                </span>
              </div>
              {task?.actions?.map((a, i) => (
                <div key={i} className={i < task.completed ? "finished" : ""}>
                  {i < task.completed ? (
                    <Check size={15} />
                  ) : busy && i === task.step && phase === "working" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <span className="pending-dot" />
                  )}
                  <span>{a.label}</span>
                </div>
              ))}
              {task?.completed > 0 && phase === "thinking" && busy && (
                <div>
                  <LoaderCircle className="spin" size={15} />
                  <span>Assessing tool results</span>
                </div>
              )}
            </div>
          )}
          {(request.reply || task?.messages?.length) && !busy && (
            <div className="goal-result">
              <span>
                {state === "blocked"
                  ? "CAPABILITY LIMIT"
                  : request.kind === "ask"
                    ? "ANSWER"
                    : "RESULT"}
              </span>
              <p>{task?.messages?.at(-1)?.text || request.reply}</p>
            </div>
          )}
          {(task?.error || request.error) && (
            <p role="alert" className="error-text">
              {task?.error || request.error}
            </p>
          )}
          {!!task?.outputs?.length && (
            <details>
              <summary>Observed results · {task.outputs.length}</summary>
              <pre>{JSON.stringify(task.outputs, null, 2)}</pre>
            </details>
          )}
          {task?.status === "Needs approval" && (
            <>
              <p>
                Review this plan. Creating a note also requires Windows
                confirmation.
              </p>
              {task.actions
                .filter((a) => a.tool === "create_note")
                .map((a, i) => (
                  <details key={i}>
                    <summary>Preview note</summary>
                    <pre>{a.content}</pre>
                  </details>
                ))}
              <button className="button primary" onClick={() => approve(task)}>
                Review & run
              </button>
            </>
          )}
          {(busy || task?.status === "Needs approval") && (
            <div className="operator-controls">
              <button
                className="button"
                disabled
                title="Resumable pause is not implemented"
              >
                Pause unavailable
              </button>
              <button className="button" onClick={stop}>
                Stop for manual control
              </button>
              <button className="button" onClick={stop}>
                Cancel
              </button>
            </div>
          )}
          {!busy && task?.status !== "Needs approval" && (
            <button className="quiet-action" onClick={reset}>
              New goal
            </button>
          )}
        </section>
      )}
      <form
        className="goal-command"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button
          type="button"
          aria-label="Share a folder"
          onClick={chooseFolder}
        >
          <Paperclip size={18} />
        </button>
        <input
          aria-label="Tell Aura what you need"
          disabled={voice.active}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "Add a change to this goal…" : "Tell Aura…"}
        />
        <button
          type="button"
          aria-label={
            phase === "listening" ? "Finish recording" : "Start voice input"
          }
          disabled={busy || voice.active}
          onClick={microphone}
        >
          {phase === "listening" ? <Square size={18} /> : <Mic size={20} />}
        </button>
        <button
          type="submit"
          aria-label="Send message"
          disabled={!input.trim() || voice.active}
        >
          <ArrowUp size={19} />
        </button>
      </form>
      <p className="command-hint">
        {voice.active
          ? "Speak naturally. Aura sends your words after a pause, replies aloud, then listens again. End voice to type."
          : busy
          ? "Sending a change stops the current run and replans with its observed results."
          : phase === "listening"
            ? "Tap the microphone again to finish. Review the transcript before sending."
            : "Speak or type a goal. Actions stay visible. Esc to stop."}
      </p>
      {!request && (
        <div className="goal-examples">
          {[
            "Check my computer’s memory",
            "What is recursion?",
            "Open Spotify",
            "Open Notepad and type Hello World",
          ].map((text) => (
            <button key={text} onClick={() => setInput(text)}>
              {text} ↗
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentContext({ request, task, phase, folder, system }) {
  return (
    <aside className="context-panel agent-context">
      <span className="presence-label">
        {request ? "AURA’S CONTEXT" : "AT A GLANCE"}
      </span>
      <h3>{request ? "Working context" : "Ready when you are"}</h3>
      <dl>
        <dt>Current goal</dt>
        <dd>{request?.goal || "No active goal"}</dd>
        <dt>Computer</dt>
        <dd>
          {system
            ? `Windows · ${system.memory} GB memory`
            : "Not yet inspected"}
        </dd>
        <dt>Application / active window</dt>
        <dd>{task?.outputs?.findLast(o=>o.result?.title)?.result.title || "Not yet observed in this task"}</dd>
        <dt>Tool in use</dt>
        <dd>
          {phase === "working"
            ? task?.actions?.[task.step]?.tool || "None"
            : "None"}
        </dd>
        <dt>Allowed files</dt>
        <dd>{folder || "Accessible local drives and user folders"}</dd>
        <dt>Permission state</dt>
        <dd>
          {task?.status === "Needs approval"
            ? "Waiting for your approval"
            : "Local files; system and credential paths excluded; confirm moves and recycling"}
        </dd>
      </dl>
      <h3>Observed actions</h3>
      {task?.outputs?.length ? (
        task.outputs.map((o, i) => (
          <p className="context-observation" key={i}>
            <Check size={13} /> {o.action}
          </p>
        ))
      ) : (
        <p>No tool actions completed.</p>
      )}
      <p className="context-footnote">
        Only observed context. Native window controls and public browser pages are available; some applications do not expose readable controls.
      </p>
    </aside>
  );
}
