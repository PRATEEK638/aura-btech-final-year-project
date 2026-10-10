import { useEffect, useRef, useState } from "react";

// Half-duplex conversation: capture -> silence boundary -> STT -> agent -> TTS.
// Fallback only; playback is never interrupted by raw microphone amplitude.
export default function useVoiceSession({
  phase,
  busy,
  waiting,
  setPhase,
  setLevel,
  submit,
  notify,
  interrupt,
}) {
  const [active, setActive] = useState(false);
  const latest = useRef({});
  latest.current = { phase, busy, waiting, setPhase, setLevel, submit, notify };
  const state = useRef({ active: false, epoch: 0, capturing: false });
  function cleanup() {
    const s = state.current;
    clearInterval(s.timer);
    if (s.recorder?.state === "recording") s.recorder.stop();
    s.stream?.getTracks().forEach((t) => t.stop());
    s.context?.close().catch(() => {});
    s.capturing = false;
    latest.current.setLevel(0);
  }
  function end() {
    state.current.active = false;
    state.current.epoch++;
    cleanup();
    setActive(false);
  }
  async function capture() {
    const s = state.current;
    if (!s.active || s.capturing) return;
    const epoch = s.epoch;
    s.capturing = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!s.active || epoch !== s.epoch) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      s.stream = stream;
      const context = new AudioContext();
      s.context = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize),
        chunks = [];
      const recorder = new MediaRecorder(stream);
      s.recorder = recorder;
      let voiced = 0,
        lastVoice = Date.now(),
        started = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        clearInterval(s.timer);
        stream.getTracks().forEach((t) => t.stop());
        context.close().catch(() => {});
        latest.current.setLevel(0);
        if (!s.active || epoch !== s.epoch) return;
        if (voiced < 300) {
          s.capturing = false;
          latest.current.setPhase("idle");
          return;
        }
        latest.current.setPhase("transcribing");
        try {
          const bytes = Array.from(
            new Uint8Array(
              await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer(),
            ),
          );
          const result = await window.aura.transcribe(bytes);
          if (!s.active || epoch !== s.epoch) return;
          if (!result.ok) throw new Error(result.error);
          if (!result.data?.trim())
            throw new Error("No words were recognized.");
          if (
            /^(?:aura[, ]+)?(?:stop listening|end (?:the )?(?:voice )?conversation|goodbye aura)[.!?]*$/i.test(
              result.data.trim(),
            )
          ) {
            end();
            latest.current.setPhase("idle");
            latest.current.notify("Voice conversation ended.");
            return;
          }
          latest.current.setPhase("thinking");
          await latest.current.submit(result.data);
        } catch (e) {
          if (epoch === s.epoch) {
            end();
            latest.current.setPhase("idle");
            latest.current.notify(e.message);
          }
        } finally {
          s.capturing = false;
        }
      };
      recorder.start();
      latest.current.setPhase("listening");
      s.timer = setInterval(() => {
        if (!s.active || epoch !== s.epoch) return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, x) => sum + x * x, 0) / samples.length,
        );
        latest.current.setLevel(Math.min(1, rms * 8));
        if (rms > 0.018) {
          voiced += 50;
          lastVoice = Date.now();
        }
        if (
          (voiced >= 300 && Date.now() - lastVoice > 1100) ||
          Date.now() - started > 30000
        ) {
          if (recorder.state === "recording") recorder.stop();
        }
      }, 50);
    } catch (e) {
      if (epoch === s.epoch) {
        end();
        latest.current.setPhase("idle");
        latest.current.notify("Voice could not start: " + e.message);
      }
    }
  }
  function start() {
    state.current.active = true;
    state.current.epoch++;
    setActive(true);
    // If live recognition disconnects during a reply, wait for playback to end.
    // Starting a second capture here would record Aura's own voice.
    const current = latest.current;
    if (
      !current.busy &&
      !current.waiting &&
      ["idle", "connecting", "listening"].includes(current.phase)
    )
      capture();
  }
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const l = latest.current;
      if (
        state.current.active &&
        !state.current.capturing &&
        !l.busy &&
        !l.waiting &&
        l.phase === "idle"
      )
        capture();
    }, 500);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(
    () => () => {
      state.current.active = false;
      state.current.epoch++;
      cleanup();
    },
    [],
  );
  return { active, start, end };
}
