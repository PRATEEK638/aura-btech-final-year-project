import { useEffect, useRef, useState } from "react";
import { Scribe, CommitStrategy, RealtimeEvents } from "@elevenlabs/client";
import worklet from "@elevenlabs/client/worklets/scribeAudioProcessor.js?url";
import useBatchVoiceSession from "./useBatchVoiceSession";
const words = (t) =>
  String(t || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
function echo(text, spoken) {
  const a = words(text),
    b = new Set(words(spoken));
  return a.length > 0 && a.every((w) => b.has(w));
}
export default function useVoiceSession(options) {
  const { phase, busy, waiting, setPhase, notify } = options;
  const fallback = useBatchVoiceSession(options);
  const [active, setActive] = useState(false),
    [partial, setPartial] = useState(""),
    [mode, setMode] = useState("connecting");
  const latest = useRef(options);
  latest.current = options;
  const state = useRef({
    epoch: 0,
    active: false,
    connection: null,
    submitting: false,
    pending: "",
  });
  function end() {
    const s = state.current;
    s.active = false;
    s.epoch++;
    s.connection?.close();
    s.connection = null;
    s.pending = "";
    clearTimeout(s.timer);
    setActive(false);
    setPartial("");
    fallback.end();
  }
  async function deliver(text) {
    const s = state.current,
      o = latest.current;
    if (!s.active) return;
    if (
      /^(?:aura[, ]+)?(?:stop listening|end (?:the )?(?:voice )?conversation|goodbye aura)[.!?]*$/i.test(
        text,
      )
    ) {
      end();
      o.setPhase("idle");
      return;
    }
    if (/^(?:aura[, ]+)?(?:stop|cancel|stop the task)[.!?]*$/i.test(text)) {
      o.cancel?.();
      return;
    }
    if (s.submitting || o.busy || o.waiting) {
      s.pending = text;
      setPartial("Next: " + text);
      return;
    }
    s.submitting = true;
    setPartial("");
    o.interrupt();
    o.setPhase("thinking");
    try {
      await o.submit(text);
    } finally {
      s.submitting = false;
    }
  }
  async function start() {
    if (state.current.active || fallback.active) return;
    const s = state.current,
      epoch = ++s.epoch;
    s.active = true;
    setActive(true);
    setMode("connecting");
    setPhase("connecting");
    try {
      const result = await window.aura.voiceToken();
      if (!result.ok) throw Error(result.error);
      if (!s.active || s.epoch !== epoch) return;
      const connection = Scribe.connect({
        token: result.data.token,
        modelId: "scribe_v2_realtime",
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: 0.7,
        minSpeechDurationMs: 150,
        minSilenceDurationMs: 150,
        filterBackgroundAudio: true,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          workletPaths: { scribeAudioProcessor: worklet },
        },
      });
      s.connection = connection;
      const current = () => s.active && s.epoch === epoch;
      function fallbackStart(reason) {
        if (!current()) return;
        clearTimeout(s.timer);
        s.active = false;
        s.epoch++;
        connection.close();
        setActive(false);
        setMode("standard");
        notify(reason + " Using standard voice.");
        fallback.start();
      }
      s.timer = setTimeout(
        () => fallbackStart("Live speech connection timed out."),
        12000,
      );
      connection.on(RealtimeEvents.SESSION_STARTED, () => {
        if (!current()) return;
        clearTimeout(s.timer);
        setMode("live");
        setPhase("listening");
      });
      connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        if (!current() || !data.text?.trim()) return;
        const o = latest.current;
        if (o.phase === "speaking" && echo(data.text, o.getSpokenText?.()))
          return;
        setPartial(data.text);
        if (o.phase === "speaking" && words(data.text).length >= 2)
          o.interrupt();
      });
      connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        if (!current() || !data.text?.trim()) return;
        const o = latest.current;
        if (o.phase === "speaking" && echo(data.text, o.getSpokenText?.()))
          return;
        deliver(data.text.trim());
      });
      connection.on(RealtimeEvents.ERROR, (data) =>
        fallbackStart(
          "Live speech unavailable: " +
            (data.error || data.message || "provider error"),
        ),
      );
      connection.on(RealtimeEvents.CLOSE, () => {
        if (current()) fallbackStart("Live speech disconnected.");
      });
    } catch (e) {
      if (s.epoch === epoch) {
        s.active = false;
        setActive(false);
        setMode("standard");
        notify(e.message + " Using standard voice.");
        fallback.start();
      }
    }
  }
  useEffect(() => {
    if (!active || busy || waiting || phase !== "idle") return;
    if (state.current.pending) {
      const next = state.current.pending;
      state.current.pending = "";
      deliver(next);
    } else setPhase("listening");
  }, [active, busy, waiting, phase]);
  useEffect(
    () => () => {
      state.current.active = false;
      state.current.epoch++;
      clearTimeout(state.current.timer);
      state.current.connection?.close();
    },
    [],
  );
  return {
    active: active || fallback.active,
    start,
    end,
    partial,
    mode: fallback.active ? "standard" : mode,
  };
}
