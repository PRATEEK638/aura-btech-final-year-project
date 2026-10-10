import React, { useEffect, useState } from "react";
import "./brain.css";
import {
  Brain,
  Check,
  ChevronRight,
  FileCheck2,
  GitBranch,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
export const brainDefaults = {
  tone: "warm",
  detail: "balanced",
  review: true,
  reviewAll: false,
  reviewer: "sarvam",
  failover: true,
  semanticMemory: true,
  fastMode: false,
};
function Switch({ value, onChange, label }) {
  return (
    <button
      className={`toggle ${value ? "on" : ""}`}
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}
export default function BrainPanel({ config, onChange, call, notify, busy }) {
  const [data, setData] = useState(null),
    [checking, setChecking] = useState(false);
  const update = (key, value) => onChange({ ...config, [key]: value });
  const refresh = () =>
    call("brainStatus")
      .then(setData)
      .catch((e) => notify(e.message));
  useEffect(() => {
    refresh();
  }, []);
  async function diagnose() {
    setChecking(true);
    try {
      setData(await call("brainDiagnose"));
      notify("Provider checks finished. Availability is shown below.");
    } catch (e) {
      notify(e.message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="brain-page">
      <div className="brain-intro">
        <div className="brain-emblem">
          <Brain size={31} />
        </div>
        <div>
          <span className="eyebrow">A PERSONALITY. A PROCESS. A PURPOSE.</span>
          <h2>
            Thoughtful by character.
            <br />
            <span>Grounded by design.</span>
          </h2>
          <p>
            Aura’s personality shapes how it communicates. Evidence and
            permissions shape what it does.
          </p>
        </div>
      </div>
      <div className="brain-pipeline">
        {[
          { icon: Sparkles, label: "Understand" },
          { icon: GitBranch, label: "Plan" },
          { icon: Brain, label: "Review" },
          { icon: Waypoints, label: "Act" },
          { icon: FileCheck2, label: "Verify" },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            <div>
              <s.icon size={18} />
              <span>{s.label}</span>
            </div>
            {i < 4 && <ChevronRight size={12} />}
          </React.Fragment>
        ))}
      </div>
      <section className="settings-section">
        <div className="section-heading">
          <h2>Aura’s character</h2>
          <span className="tag">Consistent across providers</span>
        </div>
        <p className="settings-intro">
          Curious, composed, practical, and honest about uncertainty. A designed
          AI personality, without claims of consciousness or human emotions.
        </p>
        <div className="personality-options">
          {[
            {
              id: "warm",
              name: "Warm & thoughtful",
              desc: "Approachable, natural, and quietly encouraging.",
            },
            {
              id: "professional",
              name: "Calm & professional",
              desc: "Measured, polished, and ready for work.",
            },
            {
              id: "direct",
              name: "Clear & direct",
              desc: "Fewer words. Straight to what matters.",
            },
          ].map((p) => (
            <button
              className={config.tone === p.id ? "chosen" : ""}
              key={p.id}
              onClick={() => update("tone", p.id)}
              aria-pressed={config.tone === p.id}
            >
              <div>
                <strong>{p.name}</strong>
                {config.tone === p.id && <Check size={14} />}
              </div>
              <span>{p.desc}</span>
            </button>
          ))}
        </div>
        <div className="setting-row">
          <div>
            <strong>Response depth</strong>
            <p>
              Adjust the explanation, while keeping the same safety boundaries.
            </p>
          </div>
          <select
            aria-label="Response depth"
            value={config.detail}
            onChange={(e) => update("detail", e.target.value)}
          >
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="thorough">Thorough</option>
          </select>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>Reasoning team</h2>
          <button
            className="button"
            disabled={checking || busy}
            onClick={diagnose}
          >
            {checking ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Test connections
          </button>
        </div>
        <p className="settings-intro">
          Reasoning providers can plan and review. Voice providers specialize in
          listening and speaking. Connection tests make a small API request to
          each configured reasoning provider.
        </p>
        {(
          data?.providers || [
            { id: "nvidia", name: "NVIDIA NIM", model: "openai/gpt-oss-20b" },
            { id: "sarvam", name: "Sarvam AI", model: "sarvam-105b" },
            { id: "openrouter", name: "OpenRouter", model: "openrouter/free" },
            { id: "gemini", name: "Google Gemini", model: "gemini-2.5-flash" },
          ]
        ).map((p) => (
          <div className="provider-row" key={p.id}>
            <span className="provider-logo">
              <Brain size={17} />
            </span>
            <div>
              <strong>{p.name}</strong>
              <span>
                {p.model}
                {p.lastLatency
                  ? ` · ${(p.lastLatency / 1000).toFixed(1)}s last response`
                  : ""}
              </span>
            </div>
            <span
              className={`tag ${p.state === "available" ? "green" : p.state === "unavailable" ? "red" : ""}`}
            >
              {p.state === "available"
                ? "Responded"
                : p.state === "unavailable"
                  ? p.error || "Unavailable"
                  : p.configured
                    ? "Not tested"
                    : "Not configured"}
            </span>
          </div>
        ))}
        <div className="setting-row">
          <div>
            <strong>Provider failover</strong>
            <p>
              If planning fails, try another configured reasoning provider. Your
              request and relevant context may be shared with any of the four
              providers above.
            </p>
          </div>
          <Switch
            label="Provider failover"
            value={config.failover}
            onChange={(v) => update("failover", v)}
          />
        </div>
      </section>
      <section className="settings-section">
        <h2>Checks before action</h2>
        <div className="setting-row">
          <div>
            <strong>Quick response mode</strong>
            <p>
              A smaller response budget and at most two planning providers.
              Human approval and review rules still apply.
            </p>
          </div>
          <Switch
            label="Quick response mode"
            value={config.fastMode}
            onChange={(v) => update("fastMode", v)}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Independent review for changes</strong>
            <p>
              A different provider checks proposed changes. A blocked or
              unavailable review pauses that plan.
            </p>
          </div>
          <Switch
            label="Independent review"
            value={config.review}
            onChange={(v) => update("review", v)}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Review additional file and editor changes</strong>
            <p>
              Review writes, moves, recycling and editor changes. Reads and opening files do not wait for a second model.
            </p>
          </div>
          <Switch
            label="Review additional changes"
            value={config.reviewAll}
            onChange={(v) => update("reviewAll", v)}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Preferred reviewer</strong>
            <p>
              Aura selects another configured provider if this is also the
              planner.
            </p>
          </div>
          <select
            aria-label="Preferred reviewer"
            value={config.reviewer}
            onChange={(e) => update("reviewer", e.target.value)}
          >
            <option value="sarvam">Sarvam AI</option>
            <option value="nvidia">NVIDIA NIM</option>
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <strong>Human approval stays in place</strong>
            <p>A model review never grants permission to change your files.</p>
          </div>
          <LockKeyhole size={17} className="muted" />
        </div>
      </section>
      <section className="settings-section">
        <h2>Memory that stays relevant</h2>
        <div className="setting-row">
          <div>
            <strong>Neural memory retrieval</strong>
            <p>
              NVIDIA’s embedding model ranks your approved memories against the
              request. It shares that request and those memories with NVIDIA. If
              unavailable, local keyword ranking takes over.
            </p>
          </div>
          <Switch
            label="Neural memory retrieval"
            value={config.semanticMemory}
            onChange={(v) => update("semanticMemory", v)}
          />
        </div>
        <div className="brain-small-note">
          <ShieldCheck size={14} /> Only memories you explicitly add. No silent
          profiling or model training.
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>Accountability, in the open</h2>
          <button
            className="icon-button"
            title="Refresh audit trail"
            onClick={refresh}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="audit-summary">
          <div>
            <strong>{data?.audit?.total ?? 0}</strong>
            <span>Recorded events</span>
          </div>
          <div>
            <strong>
              {data?.audit
                ? data.audit.integrity
                  ? "Intact"
                  : "Check failed"
                : "—"}
            </strong>
            <span>Local hash chain</span>
          </div>
        </div>
        <p className="settings-intro">
          Metadata only: provider calls, plan checks, tool outcomes, and stops.
          No prompts, file contents, or keys. A local hash chain can detect some
          edits; it is not a compliance certification or a tamper-proof record.
        </p>
        <div className="audit-list">
          {data?.audit?.events?.slice(0, 12).map((e) => (
            <div className="audit-event" key={e.hash}>
              <span className="audit-dot" />
              <div>
                <strong>{e.type.replaceAll("_", " ")}</strong>
                <span>
                  {e.provider || e.channel || "Aura"} · {e.outcome}
                </span>
              </div>
              <time>
                {new Date(e.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </div>
          ))}
          {!data?.audit?.events?.length && (
            <p className="settings-intro">
              Your first request will start the audit trail.
            </p>
          )}
        </div>
      </section>
      <div className="info-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>
            Built toward business use. Still a desktop foundation.
          </strong>
          <p>
            Organization identity, tenant isolation, administrator policies,
            secure updates, and measured production accuracy require further
            work. This version does not claim AGI or perfect reliability.
          </p>
        </div>
      </div>
    </div>
  );
}
