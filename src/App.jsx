import useVoiceSession from "./useVoiceSession";
import {PcmPlayer} from './PcmPlayer';
import AgentHome, { AgentContext } from "./AgentHome";
import React, { useEffect, useRef, useState } from "react";
import BrainPanel, { brainDefaults } from "./BrainPanel";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Bell,
  Brain,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Cpu,
  File,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Grip,
  Home,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  MessageSquare,
  Mic,
  Minus,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

const desktop = !!window.aura;
async function call(method, ...args) {
  if (!desktop)
    throw new Error(
      "Open the Aura desktop app to use this capability. This browser is a visual preview.",
    );
  const result = await window.aura[method](...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
const nav = [
  { name: "Home", icon: Home },
  { name: "Conversations", icon: MessageSquare },
  { name: "My tasks", icon: CheckCheck },
  { name: "Files & context", icon: Folder },
  { name: "Skills & connections", icon: Grip },
  { name: "Memory", icon: Brain },
  { name: "Aura intelligence", icon: Sparkles },
];
const suggestions = [
  {
    icon: FolderOpen,
    category: "A LITTLE LESS CLUTTER",
    title: "Make sense of my files",
    text: "Find what matters in a folder.",
    prompt:
      "Inspect the folder I selected and help me understand what is in it. Suggest a clear organization plan without moving or deleting anything.",
    color: "purple",
  },
  {
    icon: FileText,
    category: "FROM THOUGHT TO SOMETHING",
    title: "Put my ideas into words",
    text: "A first draft, without the blank page.",
    prompt:
      "Help me turn an idea into a clear, well-written note. Ask me what I want to write about.",
    color: "blue",
  },
  {
    icon: Monitor,
    category: "A HAPPIER COMPUTER",
    title: "Check on my computer",
    text: "A quick look under the hood.",
    prompt:
      "Check my computer’s memory, processor, and uptime. Explain what you find in simple language, and distinguish facts from possible causes.",
    color: "green",
  },
];
function Orb({ small = false, state = "idle" }) {
  return (
    <div
      className={`orb-scene ${small ? "small" : ""} ${state}`}
      aria-hidden="true"
    >
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orb">
        <div className="orb-flow flow-one" />
        <div className="orb-flow flow-two" />
        <div className="orb-flow flow-three" />
        <div className="orb-shine" />
      </div>
      <div className="orb-floor" />
    </div>
  );
}
function Toggle({ value, onChange, label }) {
  return (
    <button
      className={`toggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-label={label}
    >
      <span />
    </button>
  );
}
function App() {
  const [page, setPage] = useState("Home"),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState([]),
    [tasks, setTasks] = useState([]),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("idle"),
    [spoken, setSpoken] = useState(true),
    [autoVoice, setAutoVoice] = useState(true),
    [preferencesReady, setPreferencesReady] = useState(false),
    [voiceProvider, setVoiceProvider] = useState("elevenlabs"),
    [fishVoice, setFishVoice] = useState(""),
    [provider, setProvider] = useState("nvidia"),
    [status, setStatus] = useState({ providers: [], folder: null }),
    [toast, setToast] = useState(""),
    [files, setFiles] = useState([]),
    [query, setQuery] = useState(""),
    [memory, setMemory] = useState([]),
    [memoryInput, setMemoryInput] = useState(""),
    [modal, setModal] = useState(null),
    [system, setSystem] = useState(null),
    [activeTask, setActiveTask] = useState(null),
    [autoRead, setAutoRead] = useState(true),
    [showContext, setShowContext] = useState(false);
  const [homeRequest, setHomeRequest] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [brainConfig, setBrainConfig] = useState(brainDefaults);
  const spokenText=useRef('');
  const runPromise = useRef(null);
  const recorder = useRef(null),
    stream = useRef(null),
    audio = useRef(null),
    speechRequest = useRef(0),
    end = useRef(null),
    inputRef = useRef(null),
    generation = useRef(0),
    recordTimer = useRef(null),
    preferencesLoaded = useRef(false);
  const notify = (t) => {
    setToast(t);
  };
  useEffect(() => {
    if (!desktop) return;
    call("status")
      .then(setStatus)
      .catch((e) => notify(e.message));
    call("system")
      .then(setSystem)
      .catch(() => {});
    call("loadPreferences")
      .then((p) => {
        setMemory(p.memory || []);
        setSpoken(p.spoken ?? true);
        setAutoVoice(p.autoVoice ?? true);
        setVoiceProvider(p.voiceProvider || "elevenlabs");
        setFishVoice(p.fishVoice || "");
        setProvider(p.provider || "nvidia");
        setAutoRead(p.autoRead ?? true);
        setBrainConfig({ ...brainDefaults, ...p.brainConfig });
        preferencesLoaded.current = true;
        setPreferencesReady(true);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (preferencesLoaded.current)
      call("savePreferences", {
        memory,
        spoken,
        autoVoice,
        provider,
        autoRead,
        voiceProvider,
        fishVoice,
        brainConfig,
      }).catch(() => {});
  }, [
    memory,
    spoken,
    autoVoice,
    provider,
    autoRead,
    voiceProvider,
    fishVoice,
    brainConfig,
  ]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPage("Home");
        inputRef.current?.focus();
      }
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const voice = useVoiceSession({ phase, busy,
    waiting: tasks.some(t => t.id === activeTask && t.status === "Needs approval"),
    setPhase, setLevel: setMicLevel, submit: text => send(text, true), notify, interrupt:()=>interruptSpeech(),getSpokenText:()=>spokenText.current,cancel:()=>stop() });
  const voiceBooted=useRef(false);
  useEffect(()=>{
    if(voice.active){voiceBooted.current=true;return;}
    if(!desktop || !autoVoice || status.autoVoiceAllowed===false || voiceBooted.current || !preferencesLoaded.current || !status.providers.some(p=>p.id==='elevenlabs'&&p.configured))return;
    const timer=setTimeout(()=>{if(voiceBooted.current)return;voiceBooted.current=true;voice.start();},1500);
    return ()=>clearTimeout(timer);
  },[autoVoice,status,provider,preferencesReady,voice.active]);
  function interruptSpeech() {
    speechRequest.current++;
    audio.current?.pause();
    window.aura?.stopSpeech().catch(()=>{});
    audio.current = null;
    setPhase('idle');
  }
  function stop() {
    voiceBooted.current=true;
    voice.end();
    setHomeRequest((r) => (r ? { ...r, status: "stopped" } : r));
    generation.current++;
    audio.current?.pause();
    window.aura?.stopSpeech().catch(()=>{});
    audio.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    clearTimeout(recordTimer.current);
    window.speechSynthesis?.cancel();
    if (desktop) call("cancel").catch(() => {});
    setBusy(false);
    setPhase("idle");
    setTasks((ts) =>
      ts.map((t) =>
        ["Working", "Needs approval"].includes(t.status)
          ? { ...t, status: "Stopped" }
          : t,
      ),
    );
  }
  async function speak(text, token = generation.current, force = false) {
    if (!spoken && !force && !voice.active) return;
    const requestId = ++speechRequest.current;
    spokenText.current=text;
    try {
      setPhase("responding");
      if(voiceProvider==='elevenlabs'&&window.aura?.speakStream){
        const id=crypto.randomUUID();let unsubscribe=()=>{};
        const current=()=>token===generation.current&&requestId===speechRequest.current;
        audio.current?.pause();
        const player=new PcmPlayer({onStart:()=>{if(current())setPhase('speaking');},onEnd:()=>{if(current())setPhase('idle');},onError:e=>{if(current()){setPhase('idle');notify(e.message);}},cleanup:()=>unsubscribe()});
        audio.current=player;
        unsubscribe=window.aura.onSpeechChunk(event=>{if(event.id!==id||!current())return;if(event.bytes)player.push(event.bytes);if(event.done)player.done();if(event.error){player.pause();setPhase('idle');notify(event.error);}});
        const result=await window.aura.speakStream(String(text).slice(0,5000),id);
        if(!result.ok){player.pause();throw Error(result.error);}return;
      }
      const data = await call("speak", text, voiceProvider, fishVoice);
      if (token !== generation.current || requestId !== speechRequest.current)
        return;
      audio.current?.pause();
      audio.current = new Audio(`data:${data.mime};base64,` + data.base64);
      audio.current.onended = () => {
        if (token === generation.current && requestId === speechRequest.current)
          setPhase("idle");
      };
      audio.current.onerror = () => {
        if (token !== generation.current || requestId !== speechRequest.current) return;
        setPhase("idle");
        notify("Audio playback failed. Your reply is available as text.");
      };
      await audio.current.play();
      setPhase('speaking');
    } catch (e) {
      if (token !== generation.current || requestId !== speechRequest.current)
        return;
      setPhase("idle");
      notify(
        "Voice unavailable. Your reply is still here as text. " + e.message,
      );
    }
  }
  async function microphone() {
    if (phase === "listening") {
      recorder.current?.stop();
      return;
    }
    if (busy) return;
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    if (!desktop) {
      notify("Microphone input is available in the Aura desktop app.");
      return;
    }
    if (!status.providers.some((p) => p.id === "elevenlabs" && p.configured)) {
      notify("Import an ElevenLabs key in Settings to enable voice input.");
      return;
    }
    const token = ++generation.current;
    try {
      setBusy(true);
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (token !== generation.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream.current).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const meter = () => {
        if (
          !stream.current?.getAudioTracks().some((t) => t.readyState === "live")
        ) {
          setMicLevel(0);
          audioContext.close();
          return;
        }
        analyser.getFloatTimeDomainData(samples);
        setMicLevel(
          Math.min(
            1,
            Math.sqrt(samples.reduce((n, x) => n + x * x, 0) / samples.length) *
              8,
          ),
        );
        requestAnimationFrame(meter);
      };
      meter();
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      const chunks = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        clearTimeout(recordTimer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (token !== generation.current) return;
        setPhase("transcribing");
        setBusy(true);
        try {
          const bytes = Array.from(
            new Uint8Array(
              await new Blob(chunks, { type: r.mimeType }).arrayBuffer(),
            ),
          );
          const text = await call("transcribe", bytes);
          if (token !== generation.current) return;
          setInput(text);
          setPhase("idle");
          notify("Transcribed. Review your words, then send.");
        } catch (e) {
          if (token === generation.current) {
            notify(e.message);
            setPhase("idle");
          }
        } finally {
          if (token === generation.current) setBusy(false);
        }
      };
      r.start();
      setBusy(false);
      setPhase("listening");
      recordTimer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 60000);
    } catch (e) {
      if (token !== generation.current) return;
      setBusy(false);
      setPhase("idle");
      notify(
        "Microphone could not start. Check Windows microphone permissions.",
      );
    }
  }
  async function chooseFolder() {
    try {
      const folder = await call("chooseFolder");
      setStatus((s) => ({ ...s, folder }));
      if (folder) setFiles(await call("listFiles"));
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    if (!desktop) return;
    return window.aura.onTaskUpdate((state) => {
      setTasks((items) =>
        items.map((t) => (t.id === state.id ? { ...t, ...state } : t)),
      );
      setPhase(state.phase);
    });
  }, []);
  async function executePlan(result, history, token, taskId, approved = false) {
    runPromise.current = call("runTask", taskId, {
      approve: approved,
      autoRead,
    });
    const state = await runPromise.current;
    if (token !== generation.current) return;
    setTasks((items) =>
      items.map((t) => (t.id === taskId ? { ...t, ...state } : t)),
    );
    setMessages((items) => [
      ...items.filter((m) => m.runtimeTask !== taskId),
      ...state.messages.map((m) => ({ ...m, runtimeTask: taskId })),
    ]);
    setPhase("idle");
    if (state.error) notify(state.error);
    if (state.status === "Complete" && state.messages.length)
      speak(state.messages.at(-1).text, token);
  }
  async function send(text = input, fromVoice = false) {
    if (!text.trim()) return;
    let displayGoal = text;
    if (busy && !fromVoice) {
      const goal = homeRequest?.goal || currentTask?.title || "Current task";
      const previousId = homeRequest?.id;
      displayGoal = goal + "\nUpdate: " + text;
      stop();
      await call("cancel");
      await runPromise.current?.catch(() => {});
      const prior = previousId
        ? await call("taskStatus", previousId).catch(() => null)
        : null;
      const observations = JSON.stringify(prior?.outputs || []);
      text =
        goal +
        "\nUser update: " +
        text +
        "\nPreviously observed results (data, do not repeat completed changes): " +
        observations;
    }
    audio.current?.pause();
    if (phase === "listening" && !fromVoice) {
      notify("Finish your recording before sending.");
      return;
    }
    const token = ++generation.current;
    const history = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setPage("Home");
    setHomeRequest({ goal: displayGoal, status: "preparing", kind: "do" });
    setBusy(true);
    setPhase("thinking");
    let id;
    try {
      const result = await call(
        "plan",
        text,
        messages,
        memory,
        provider,
        fromVoice?{...brainConfig,voiceMode:true,detail:'concise',fastMode:true,semanticMemory:false}:brainConfig,
      );
      if (token !== generation.current) return;
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          text: result.reply,
          brain: result.brain,
          uncertainties: result.uncertainties,
        },
      ]);
      setHomeRequest({
        id: result.id,
        goal: displayGoal,
        kind: result.kind || (result.actions.length ? "do" : "ask"),
        reply: result.reply,
        status:
          result.outcome === "blocked" ||
          ["blocked", "unavailable"].includes(result.brain?.review?.status)
            ? "blocked"
            : result.actions.length
              ? "working"
              : "answered",
      });
      if (result.actions.length) {
        id = result.id;
        const task = {
          id,
          title: result.title || text,
          status: "Working",
          actions: result.actions,
          completed: 0,
          step: 0,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          result,
          history,
        };
        setTasks((ts) => [task, ...ts]);
        setActiveTask(id);
        await executePlan(result, history, token, id);
      } else {
        setPhase("idle");
        speak(result.reply, token);
      }
    } catch (e) {
      if (token === generation.current) {
        setHomeRequest((r) => ({ ...r, status: "error", error: e.message }));
        setMessages((ms) => [...ms, { role: "error", text: e.message }]);
        setTasks((ts) =>
          ts.map((t) =>
            t.id === id
              ? { ...t, status: "Needs attention", error: e.message }
              : t,
          ),
        );
        setPhase("idle");
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function approve(t) {
    if (busy) return;
    const token = ++generation.current;
    setBusy(true);
    setPage("Home");
    setTasks((ts) =>
      ts.map((x) => (x.id === t.id ? { ...x, status: "Working" } : x)),
    );
    try {
      await executePlan(t.result, t.history, token, t.id, true);
    } catch (e) {
      if (token === generation.current) {
        notify(e.message);
        setTasks((ts) =>
          ts.map((x) =>
            x.id === t.id
              ? { ...x, status: "Needs attention", error: e.message }
              : x,
          ),
        );
        setPhase("idle");
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  const currentTask = tasks.find((t) => t.id === activeTask) || tasks[0];
  const pageTitle = page === "Home" ? "Your space" : page;
  const subtitle = {
    Home: "A little more possibility. A lot less effort.",
    Conversations: "Start with what you need. We’ll work from there.",
    "My tasks": "The work, the progress, and the proof.",
    "Files & context": "You choose what Aura can see.",
    "Skills & connections": "One assistant. An expanding set of possibilities.",
    Memory: "Useful context, remembered on your terms.",
    "Aura intelligence":
      "A personality you recognize. Decisions you can inspect.",
    Settings: "Make Aura feel like yours.",
  };
  function taskCard(t) {
    return (
      <div className="task-card" key={t.id}>
        <div className="task-card-top">
          <span className="task-glyph">
            <CheckCheck size={19} />
          </span>
          <div>
            <h3>{t.title}</h3>
            <span className="muted">Today · {t.time}</span>
          </div>
          <span className={`tag ${t.status === "Complete" ? "green" : ""}`}>
            {t.status}
          </span>
        </div>
        <div className="task-steps">
          {t.actions.map((a, i) => (
            <div className={i < t.completed ? "done" : ""} key={i}>
              <span>{i < t.completed ? <Check size={13} /> : i + 1}</span>
              {a.label}
              {t.status === "Working" && i === t.step && (
                <LoaderCircle className="spin" size={14} />
              )}
            </div>
          ))}
        </div>
        {t.error && <p className="error-text">{t.error}</p>}
        {t.status === "Needs approval" &&
          t.actions
            .filter((a) => a.tool === "create_note")
            .map((a, i) => (
              <details key={i}>
                <summary>Preview note before creating</summary>
                <pre>{a.content}</pre>
              </details>
            ))}
        {t.status === "Needs approval" && (
          <div className="task-actions">
            <button className="button primary" onClick={() => approve(t)}>
              Review & run <ArrowRight size={14} />
            </button>
            <button className="button" onClick={stop}>
              Cancel
            </button>
          </div>
        )}
        {t.outputs?.length > 0 && (
          <details>
            <summary>Verified results</summary>
            <pre>{JSON.stringify(t.outputs, null, 2)}</pre>
          </details>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <span>
            aura<span className="brand-dot">.</span>
          </span>
          <span className="beta">BETA</span>
        </div>
        <button
          className="new-task"
          onClick={() => {
            stop();
            setHomeRequest(null);
            setActiveTask(null);
            setPage("Home");
            setInput("");
            inputRef.current?.focus();
          }}
        >
          <Plus size={17} /> New task <kbd>Ctrl K</kbd>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "selected" : ""}
              onClick={() => {
                setPage(n.name);
                setQuery("");
              }}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.name === "My tasks" && tasks.length > 0 && (
                <span className="count">{tasks.length}</span>
              )}
              {n.name === "Home" && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <div className="local-icon">
              <ShieldCheck size={17} />
            </div>
            <strong>Your computer. Your control.</strong>
            <p>
              Permissions you choose.
              <br />
              Actions you can see.
            </p>
            <button
              onClick={() => {
                setPage("Settings");
              }}
            >
              Manage access <ArrowRight size={13} />
            </button>
          </div>
          <button
            className={`settings-nav ${page === "Settings" ? "selected" : ""}`}
            onClick={() => setPage("Settings")}
          >
            <Settings2 size={18} /> Settings <span>⌘</span>
          </button>
          <button className="profile" onClick={() => setModal("about")}>
            <div className="avatar">H</div>
            <div>
              <strong>My workspace</strong>
              <span>Personal account</span>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="titlebar">
          <span>
            <span className="tiny-logo">✧</span> AURA / PERSONAL WORKSPACE
          </span>
          <div className="window-buttons">
            <button
              title="Minimize"
              onClick={() => desktop && call("window", "minimize")}
            >
              <Minus size={13} />
            </button>
            <button
              title="Maximize"
              onClick={() => desktop && call("window", "maximize")}
            >
              <Maximize2 size={11} />
            </button>
            <button
              title="Close"
              onClick={() => desktop && call("window", "close")}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <header className="page-header">
          <div className="breadcrumb">
            <span>{pageTitle}</span>
            {page === "Home" && <span className="home-chip">Home</span>}
          </div>
          <div className="header-actions">
            <span className="connection-status">
              <i />
              {desktop ? "Desktop connected" : "Desktop preview"}
            </span>
            <span className="header-divider" />
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={17} />
              {tasks.some((t) => t.status === "Needs approval") && (
                <i className="notification-dot" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </header>
        <div className={`body-grid ${!showContext ? "context-hidden" : ""}`}>
          <main
            className={`main-content ${page === "Home" ? "home-content" : ""}`}
          >
            {page === "Home" ? (
              <AgentHome
                voice={voice}
                interruptSpeech={interruptSpeech}
                Orb={Orb}
                phase={phase}
                busy={busy}
                request={homeRequest}
                task={currentTask?.id === homeRequest?.id ? currentTask : null}
                input={input}
                setInput={setInput}
                send={send}
                microphone={microphone}
                stop={stop}
                approve={approve}
                chooseFolder={chooseFolder}
                level={micLevel}
                openTranscript={() => setPage("Conversations")}
                reset={() => {
                  stop();
                  setHomeRequest(null);
                  setActiveTask(null);
                  setInput("");
                }}
              />
            ) : (
              <>
                <div className="view-heading">
                  <div>
                    <span className="eyebrow">YOUR AURA WORKSPACE</span>
                    <h1>{page}</h1>
                    <p>{subtitle[page]}</p>
                  </div>
                  {page === "Files & context" && (
                    <button className="button primary" onClick={chooseFolder}>
                      <Plus size={15} /> Choose folder
                    </button>
                  )}
                </div>
                {page === "Conversations" && (
                  <div className="conversation-layout">
                    <div className="messages">
                      {!messages.length && (
                        <div className="empty-state">
                          <Orb small />
                          <h2>What’s on your mind?</h2>
                          <p>
                            Give me a goal, a question, or a place to start.
                          </p>
                        </div>
                      )}
                      {messages.map((m, i) => (
                        <div key={i} className={`message ${m.role}`}>
                          <span className="message-avatar">
                            {m.role === "user" ? "H" : <Sparkles size={17} />}
                          </span>
                          <div>
                            <div className="message-name">
                              {m.role === "user"
                                ? "You"
                                : m.role === "error"
                                  ? "Let’s try another way"
                                  : "Aura"}
                            </div>
                            <div className="message-text">{m.text}</div>
                            {m.brain && (
                              <details className="reasoning-receipt">
                                <summary>
                                  <ShieldCheck size={12} /> {m.brain.provider} ·{" "}
                                  {m.brain.review.status === "approved"
                                    ? "Independently reviewed"
                                    : "Validated response"}
                                </summary>
                                <div className="receipt-stages">
                                  {m.brain.trace.map((s, j) => (
                                    <span key={j}>
                                      {s.stage} · {s.provider} · {s.outcome}
                                    </span>
                                  ))}
                                </div>
                                <p>
                                  Memory: {m.brain.retrieval.method} ·{" "}
                                  {m.brain.retrieval.selected} selected
                                </p>
                                <p>
                                  Review: {m.brain.review.status}.{" "}
                                  {m.brain.review.reason}
                                </p>
                                {m.uncertainties?.length > 0 && (
                                  <p>Unresolved: {m.uncertainties.join(" ")}</p>
                                )}
                              </details>
                            )}
                            {m.role === "assistant" && (
                              <button
                                className="read-aloud"
                                onClick={() =>
                                  speak(m.text, generation.current, true)
                                }
                              >
                                <Volume2 size={13} /> Read aloud
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {busy && (
                        <div className="working-line">
                          <LoaderCircle size={16} className="spin" />
                          {phase === "working"
                            ? "Working with your computer…"
                            : phase === "transcribing"
                              ? "Putting your voice into words…"
                              : "Thinking it through…"}
                          <button onClick={stop}>Stop</button>
                        </div>
                      )}
                      {currentTask && taskCard(currentTask)}
                      <div ref={end} />
                    </div>
                    <div className="conversation-composer">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                          phase === "listening"
                            ? "Listening… tap the microphone to finish"
                            : "Tell me what you need…"
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <button
                        className="icon-button"
                        onClick={microphone}
                        aria-label="Voice input"
                      >
                        {phase === "listening" ? (
                          <Square size={19} />
                        ) : (
                          <Mic size={19} />
                        )}
                      </button>
                      {busy ? (
                        <button
                          className="send-button"
                          onClick={stop}
                          aria-label="Stop"
                        >
                          <Square size={16} />
                        </button>
                      ) : (
                        <button
                          className="send-button"
                          disabled={!input.trim()}
                          onClick={() => send()}
                          aria-label="Send"
                        >
                          <ArrowUp size={18} />
                        </button>
                      )}
                    </div>
                    <p className="input-note">
                      {phase === "listening"
                        ? "Recording · tap again to transcribe · Esc to cancel"
                        : "Voice is transcribed for review before sending. Shift + Enter for a new line."}
                    </p>
                  </div>
                )}
                {page === "My tasks" && (
                  <>
                    <div className="metric-grid">
                      {[
                        ["All tasks", tasks.length],
                        [
                          "Completed",
                          tasks.filter((t) => t.status === "Complete").length,
                        ],
                        [
                          "Need you",
                          tasks.filter((t) => t.status === "Needs approval")
                            .length,
                        ],
                      ].map(([label, n]) => (
                        <div className="metric" key={label}>
                          <span>{label}</span>
                          <strong>{n.toString().padStart(2, "0")}</strong>
                        </div>
                      ))}
                    </div>
                    {tasks.length ? (
                      tasks.map(taskCard)
                    ) : (
                      <div className="empty-state">
                        <CheckCheck size={34} />
                        <h2>A little room for getting things done.</h2>
                        <p>
                          Your real tasks and verified results will appear here.
                        </p>
                        <button
                          className="button"
                          onClick={() => {
                            setPage("Home");
                            setInput(
                              "Check my computer’s current system resources.",
                            );
                          }}
                        >
                          Start your first task <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {page === "Files & context" && (
                  <>
                    <div className="info-banner">
                      <ShieldCheck size={18} />
                      <div>
                        <strong>Access starts with you.</strong>
                        <p>
                          Aura can list and read supported text files only in
                          the folder you select. File contents go to your
                          selected AI provider when used in a task.
                        </p>
                      </div>
                    </div>
                    <div className="file-toolbar">
                      <span>
                        <FolderOpen size={17} />
                        {status.folder || "No folder connected"}
                      </span>
                      <div className="search-field">
                        <Search size={15} />
                        <input
                          placeholder="Find a file…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    {files.length ? (
                      <div className="file-list">
                        <div className="file-row file-table-head">
                          <span>NAME</span>
                          <span>SIZE</span>
                          <span>MODIFIED</span>
                        </div>
                        {files
                          .filter((f) =>
                            f.name.toLowerCase().includes(query.toLowerCase()),
                          )
                          .map((f) => (
                            <div className="file-row" key={f.path}>
                              <span>
                                {f.directory ? (
                                  <Folder size={19} className="folder-color" />
                                ) : (
                                  <FileText size={19} />
                                )}{" "}
                                {f.name}
                              </span>
                              <span>
                                {f.directory
                                  ? "Folder"
                                  : `${(f.size / 1024).toFixed(1)} KB`}
                              </span>
                              <span>
                                {new Date(f.modified).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <FolderOpen size={36} />
                        <h2>Bring a little context.</h2>
                        <p>
                          Connect a folder to see its files and let Aura help
                          you understand them.
                        </p>
                        <button className="button" onClick={chooseFolder}>
                          Choose a folder <Plus size={15} />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {page === "Skills & connections" && (
                  <>
                    <div className="info-banner">
                      <Zap size={19} />
                      <div>
                        <strong>Built to grow with you.</strong>
                        <p>
                          Capabilities are separate from the intelligence that
                          plans your work. Connected skills run real tools;
                          upcoming skills need further integration.
                        </p>
                      </div>
                    </div>
                    <div className="skill-grid">
                      {[
                        {
                          icon: Folder,
                          name: "File intelligence",
                          desc: "Find, read, create, move and recycle files in allowed folders.",
                          live: true,
                        },
                        {
                          icon: Cpu,
                          name: "Computer insights",
                          desc: "Understand your processor, memory, and uptime.",
                          live: true,
                        },
                        {
                          icon: FileText,
                          name: "Writing & notes",
                          desc: "Think, draft, and save new Markdown documents.",
                          live: true,
                        },
                        {
                          icon: AudioLines,
                          name: "Natural conversation",
                          desc: "Speak your request. Hear a natural, expressive reply.",
                          live: status.providers.some(
                            (p) => p.id === "elevenlabs" && p.configured,
                          ),
                        },
                        {
                          icon: Globe,
                          name: "Browser operator",
                          desc: "Read public pages, follow links and extract tables.",
                          live: true,
                        },
                        {
                          icon: Link2,
                          name: "Connected work",
                          desc: "Email, calendar, and the apps you use every day.",
                          live: false,
                        },
                      ].map((s) => (
                        <div className="skill-card" key={s.name}>
                          <div className="skill-top">
                            <s.icon size={24} />
                            <span className={`tag ${s.live ? "green" : ""}`}>
                              {s.live ? "Available" : "Not connected"}
                            </span>
                          </div>
                          <h3>{s.name}</h3>
                          <p>{s.desc}</p>
                          <button
                            onClick={() =>
                              s.live
                                ? setModal("capabilities")
                                : notify(
                                    `${s.name} requires additional integration. No actions are enabled for this skill yet.`,
                                  )
                            }
                          >
                            {s.live ? "View capability" : "About this skill"}
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {page === "Memory" && (
                  <>
                    <div className="info-banner">
                      <Brain size={19} />
                      <div>
                        <strong>
                          Remember the useful things. Only the useful things.
                        </strong>
                        <p>
                          Nothing is learned silently. Add preferences below;
                          edit by removing and adding them again. These are
                          shared with your chosen AI provider during requests.
                        </p>
                      </div>
                    </div>
                    <form
                      className="memory-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (memoryInput.trim()) {
                          setMemory((m) => [...m, memoryInput.trim()]);
                          setMemoryInput("");
                        }
                      }}
                    >
                      <input
                        placeholder="e.g. I prefer concise replies and Markdown documents"
                        value={memoryInput}
                        onChange={(e) => setMemoryInput(e.target.value)}
                        maxLength={500}
                      />
                      <button
                        className="button primary"
                        disabled={!memoryInput.trim()}
                      >
                        <Plus size={16} /> Remember
                      </button>
                    </form>
                    {memory.length ? (
                      memory.map((m, i) => (
                        <div className="memory-row" key={i}>
                          <span className="memory-icon">
                            <Brain size={18} />
                          </span>
                          <p>{m}</p>
                          <button
                            className="icon-button"
                            aria-label="Delete memory"
                            onClick={() =>
                              setMemory((ms) => ms.filter((_, j) => j !== i))
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <Brain size={34} />
                        <h2>A fresh start.</h2>
                        <p>
                          Your preferences belong here when you’re ready to
                          share them.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {page === "Aura intelligence" && (
                  <BrainPanel
                    config={brainConfig}
                    onChange={setBrainConfig}
                    call={call}
                    notify={notify}
                    busy={busy}
                  />
                )}
                {page === "Settings" && (
                  <>
                    <div className="settings-section">
                      <h2>Conversation & voice</h2>
                      <div className="setting-row">
                        <div><strong>Start voice when Aura opens</strong><p>Microphone stays active until you end the conversation. Speech is sent to ElevenLabs for transcription.</p></div>
                        <Toggle label="Start voice automatically" value={autoVoice} onChange={v=>{setAutoVoice(v);if(!v)voice.end();}} />
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Spoken replies</strong>
                          <p>
                            Natural speech from your selected provider, with
                            text always available.
                          </p>
                        </div>
                        <Toggle
                          label="Spoken replies"
                          value={spoken}
                          onChange={(v) => {
                            setSpoken(v);
                            if (!v) {
                              speechRequest.current++;
                              audio.current?.pause();
                              if (phase === "speaking") setPhase("idle");
                            }
                          }}
                        />
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Thinking provider</strong>
                          <p>
                            Requests and shared context go to this provider.
                          </p>
                        </div>
                        <select
                          aria-label="Thinking provider"
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="openrouter">OpenRouter · free</option>
                          <option value="nvidia">NVIDIA NIM</option>
                          <option value="sarvam">Sarvam AI</option>
                        </select>
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Voice provider</strong>
                          <p>
                            ElevenLabs: George. Sarvam: Shubh in Indian English.
                          </p>
                        </div>
                        <select
                          aria-label="Voice provider"
                          value={voiceProvider}
                          onChange={(e) => setVoiceProvider(e.target.value)}
                        >
                          <option value="elevenlabs">ElevenLabs</option>
                          <option value="sarvam">Sarvam AI</option>
                          <option value="fish_audio">Fish Audio</option>
                        </select>
                      </div>
                      {voiceProvider === "fish_audio" && (
                        <div className="setting-row">
                          <div>
                            <strong>Fish Audio voice model ID</strong>
                            <p>
                              Paste the model ID of your selected Fish Audio
                              voice.
                            </p>
                          </div>
                          <input
                            className="settings-input"
                            aria-label="Fish Audio voice model ID"
                            value={fishVoice}
                            onChange={(e) => setFishVoice(e.target.value)}
                            placeholder="Voice model ID"
                          />
                        </div>
                      )}
                      <div className="setting-row">
                        <div>
                          <strong>Voice style</strong>
                          <p>Warm, expressive, and conversational.</p>
                        </div>
                        <button
                          className="button"
                          onClick={() =>
                            speak(
                              "Hey, I’m Aura. Tell me what you have in mind, and we’ll take it from there.",
                              generation.current,
                              true,
                            )
                          }
                        >
                          <Volume2 size={15} /> Preview voice
                        </button>
                      </div>
                    </div>
                    <div className="settings-section">
                      <h2>Permissions & control</h2>
                      <div className="setting-row">
                        <div>
                          <strong>Run read-only steps automatically</strong>
                          <p>
                            Read the chosen folder and inspect system
                            information.
                          </p>
                        </div>
                        <Toggle
                          label="Automatic read-only actions"
                          value={autoRead}
                          onChange={setAutoRead}
                        />
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Changes always need your approval</strong>
                          <p>
                            New notes require a Windows confirmation.
                            Destructive tools are unavailable.
                          </p>
                        </div>
                        <LockKeyhole size={18} className="muted" />
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Microphone</strong>
                          <p>
                            Voice sessions remain active through pauses. End voice or press Esc to stop the microphone.
                            Audio is sent to ElevenLabs for transcription.
                          </p>
                        </div>
                        <span className="tag">Voice conversation</span>
                      </div>
                    </div>
                    <div className="settings-section">
                      <div className="section-heading">
                        <h2>Provider connections</h2>
                        <button
                          className="button"
                          onClick={async () => {
                            try {
                              const providers = await call("importKeys");
                              setStatus((s) => ({ ...s, providers }));
                              notify(
                                "Credentials imported into the encrypted local store.",
                              );
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        >
                          <Plus size={15} /> Import keys
                        </button>
                      </div>
                      <p className="settings-intro">
                        Credentials are encrypted by Windows and never exposed
                        to the interface. Configured means imported, not a
                        successful connection test.
                      </p>
                      {[
                        "gemini",
                        "openrouter",
                        "elevenlabs",
                        "nvidia",
                        "sarvam",
                        "fish_audio",
                      ].map((id) => {
                        const p = status.providers.find((p) => p.id === id);
                        return (
                          <div className="provider-row" key={id}>
                            <div className={`provider-logo ${id}`}>
                              <Sparkles size={17} />
                            </div>
                            <div>
                              <strong>
                                {
                                  {
                                    gemini: "Google Gemini",
                                    openrouter: "OpenRouter",
                                    elevenlabs: "ElevenLabs",
                                    nvidia: "NVIDIA",
                                    sarvam: "Sarvam AI",
                                    fish_audio: "Fish Audio",
                                  }[id]
                                }
                              </strong>
                              <span>
                                {[
                                  "gemini",
                                  "openrouter",
                                  "nvidia",
                                  "sarvam",
                                ].includes(id)
                                  ? "Reasoning & planning"
                                  : id === "elevenlabs"
                                    ? "Transcription & natural speech"
                                    : id === "fish_audio"
                                      ? "Natural speech · voice model ID required"
                                      : "Natural speech · Indian English"}
                              </span>
                            </div>
                            <span
                              className={`tag ${p?.configured ? "green" : ""}`}
                            >
                              {p?.configured
                                ? `${p.keyCount || 1} ${p.keyCount > 1 ? "keys" : "key"} imported`
                                : "Not configured"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </main>
          {showContext && page === "Home" ? (
            <AgentContext
              request={homeRequest}
              task={currentTask?.id === homeRequest?.id ? currentTask : null}
              phase={phase}
              folder={status.folder}
              system={system}
            />
          ) : (
            showContext && (
              <aside className="context-panel">
                <div className="context-heading">
                  <span>AT A GLANCE</span>
                  <button
                    className="icon-button"
                    aria-label="Hide context panel"
                    onClick={() => setShowContext(false)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                <div className="companion-card">
                  <div className="companion-heading">
                    <div className="mini-orb" />
                    <div>
                      <strong>
                        Aura is {phase === "idle" ? "ready" : phase}
                      </strong>
                      <span>
                        {phase === "idle"
                          ? "A little help is a moment away."
                          : "Right here with you."}
                      </span>
                    </div>
                    <i />
                  </div>
                  <div className="waveform">
                    {Array.from({ length: 39 }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          height: `${6 + Math.sin(i * 0.72) ** 2 * 19 + Math.sin(i * 0.29) ** 2 * 15}px`,
                          animationDelay: `${i * 0.06}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="companion-bottom">
                    <span>
                      <span className="status-dot" />
                      {phase === "listening"
                        ? "Microphone on"
                        : "Listening only when you ask"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Toggle spoken replies"
                      onClick={() => {
                        setSpoken(!spoken);
                        speechRequest.current++;
                        audio.current?.pause();
                        if (phase === "speaking") setPhase("idle");
                      }}
                    >
                      {spoken ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                  </div>
                </div>
                <section className="context-section">
                  <div className="section-heading">
                    <h2>Your context</h2>
                    <ShieldCheck size={14} />
                  </div>
                  <div className="context-item">
                    <span className="context-item-icon">
                      <Monitor size={16} />
                    </span>
                    <div>
                      <strong>This computer</strong>
                      <span>
                        {system
                          ? `Windows · ${system.memory} GB memory`
                          : "Native desktop workspace"}
                      </span>
                    </div>
                    <span className={`dot ${desktop ? "green-dot" : ""}`} />
                  </div>
                  <button
                    className="context-item context-link"
                    onClick={() => setPage("Files & context")}
                  >
                    <span className="context-item-icon">
                      <Folder size={16} />
                    </span>
                    <div>
                      <strong>
                        {status.folder ? "Folder connected" : "Files & folders"}
                      </strong>
                      <span>
                        {status.folder
                          ? status.folder.split(/[\\/]/).at(-1)
                          : "Choose what to share"}
                      </span>
                    </div>
                    <Plus size={14} />
                  </button>
                  <button
                    className="context-item context-link"
                    onClick={() => setPage("Skills & connections")}
                  >
                    <span className="context-item-icon">
                      <Globe size={16} />
                    </span>
                    <div>
                      <strong>Apps & connections</strong>
                      <span>Bring your tools together</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                  <div className="context-note">
                    <LockKeyhole size={12} />
                    <span>Only the context you allow.</span>
                  </div>
                </section>
                <section className="context-section activity-section">
                  <div className="section-heading">
                    <h2>Recent activity</h2>
                    <button onClick={() => setPage("My tasks")}>
                      View all <ArrowRight size={12} />
                    </button>
                  </div>
                  {tasks.length ? (
                    tasks.slice(0, 3).map((t) => (
                      <button
                        className="activity-item"
                        key={t.id}
                        onClick={() => {
                          setActiveTask(t.id);
                          setPage("My tasks");
                        }}
                      >
                        <span className="activity-icon">
                          <Check size={14} />
                        </span>
                        <div>
                          <strong>{t.title}</strong>
                          <span>
                            {t.status} · {t.time}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="quiet-activity">
                      <div className="activity-symbol">
                        <Activity size={20} />
                      </div>
                      <strong>A fresh page.</strong>
                      <p>
                        Your work will find its place here.
                        <br />
                        Let’s start with something small.
                      </p>
                    </div>
                  )}
                </section>
                <div className="tip-card">
                  <span className="tip-star">✧</span>
                  <span className="eyebrow">LESS DOING. MORE LIVING.</span>
                  <p>
                    You don’t need the steps.
                    <br />
                    <strong>Just the destination.</strong>
                  </p>
                  <button
                    onClick={() => {
                      setInput(
                        "I have a goal in mind. Help me work out how to accomplish it.",
                      );
                      setPage("Home");
                    }}
                  >
                    Tell Aura what you need <ArrowRight size={13} />
                  </button>
                  <div className="tip-ring" />
                </div>
                <div className="context-footer">
                  <span className="status-dot" /> Private by design{" "}
                  <span>v0.2</span>
                </div>
              </aside>
            )
          )}
        </div>
        <footer className="statusbar">
          <span>
            <span className="status-dot" />
            {desktop ? "Aura Desktop" : "Interface preview"}
            <span className="statusbar-separator">/</span>
            {phase === "idle"
              ? "Ready when you are"
              : phase.charAt(0).toUpperCase() + phase.slice(1)}
          </span>
          <div>
            {!showContext && (
              <button onClick={() => setShowContext(true)}>Show context</button>
            )}
            {(busy || phase === "speaking" || phase === "listening") && (
              <button onClick={stop}>
                <Square size={10} /> Stop <kbd>Esc</kbd>
              </button>
            )}
            <ShieldCheck size={12} /> You’re in control{" "}
            <span className="statusbar-separator">/</span>
            <Command size={11} />
            <span>Ctrl K</span>
          </div>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={16} />
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={19} />
            </button>
            <Sparkles size={28} className="purple-text" />
            <h2>
              {modal === "help"
                ? "A little guidance."
                : modal === "notifications"
                  ? "You’re all caught up."
                  : modal === "about"
                    ? "Meet Aura."
                    : "Useful today. Built for more."}
            </h2>
            <p>
              {modal === "help"
                ? "Type a goal and press Enter, or click the microphone to record. Review your transcription, then send. Attach a folder when your task needs local context. Press Escape to stop."
                : modal === "notifications"
                  ? tasks.some((t) => t.status === "Needs approval")
                    ? "A task is waiting for your approval. Open My tasks to review its steps."
                    : "There are no new notifications. Aura will let you know when a task needs you."
                  : modal === "about"
                    ? "Your intent, in motion. Aura is a general-purpose desktop assistant designed around outcomes, thoughtful permissions, and real, verified results."
                    : "This version can reason with Gemini or OpenRouter, inspect system resources, list and read selected text files, create new notes with approval, and converse through ElevenLabs voice."}
            </p>
            {modal === "capabilities" && (
              <p>
                Browser operation, app control, advanced file management, and
                cross-app workflows need additional adapters. General autonomous
                computer use remains a longer-term goal; this app does not claim
                to perform those actions today.
              </p>
            )}
            <button className="button primary" onClick={() => setModal(null)}>
              Got it <Check size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
