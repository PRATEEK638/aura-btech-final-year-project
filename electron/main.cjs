const {createCapabilities,definitions}=require('./capabilities.cjs');
const {createBrowser}=require('./browser.cjs');
const {createDesktop}=require('./desktop.cjs');
const {pythonAnalysis}=require('./python.cjs');
const {localIntent}=require('./local-intent.cjs');
const {createVoice}=require('./voice.cjs');
const {createDialogue}=require('./dialogue.cjs');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  session,
  shell,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createBrain } = require("./brain.cjs");
const { AuditLog } = require("./audit.cjs");
const { AgentRuntime } = require("./runtime.cjs");
const {
  parseKeys,
  within,
  validateAction,
  withCredentialFallback,
} = require("./core.cjs");
app.setName("Aura");
app.setPath("userData", path.join(app.getPath("appData"), "Aura"));
let win,
  keys = {},
  root = null,
  controllers = new Set(),
  pendingPlans = new Map(),
  executionEpoch = 0;
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
const vaultPath = () => path.join(app.getPath("userData"), "providers.vault");
const providers = () =>
  ["gemini", "openrouter", "nvidia", "elevenlabs", "sarvam", "fish_audio"].map(
    (id) => ({
      id,
      configured: !!keys[id + "_api_key"]?.length,
      keyCount: keys[id + "_api_key"]?.length || 0,
      active: true,
    }),
  );
async function importKeys(file) {
  const parsed = parseKeys(await fs.readFile(file, "utf8"));
  if (!Object.keys(parsed).length)
    throw new Error("No supported API keys found.");
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("Windows credential encryption is unavailable.");
  for (const [name, values] of Object.entries(parsed))
    keys[name] = [...new Set([...values, ...(keys[name] || [])])];
  await fs.writeFile(
    vaultPath(),
    safeStorage.encryptString(JSON.stringify(keys)),
  );
  brain?.reset();
  return providers();
}
async function request(url, options) {
  const controller = new AbortController();
  controllers.add(controller);
  const timer = setTimeout(
    () =>
      controller.abort(
        Object.assign(new Error("Provider request timed out."), {
          name: "TimeoutError",
        }),
      ),
    options.timeoutMs || 60000,
  );
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(
        `Provider returned HTTP ${response.status}. Check your key, quota, or model access in Settings.`,
      );
      error.httpStatus = response.status;
      try {
        const body = await response.json();
        error.providerCode = body.detail?.status || body.error?.code;
      } catch {}
      throw error;
    }
    return options.binary
      ? Buffer.from(await response.arrayBuffer()).toString("base64")
      : await response.json();
  } finally {
    clearTimeout(timer);
    controllers.delete(controller);
  }
}
const systemInfo = () => ({
  platform: os.platform(),
  release: os.release(),
  cpu: os.cpus()[0]?.model,
  cores: os.cpus().length,
  memory: Math.round(os.totalmem() / 1073741824),
  freeMemory: (os.freemem() / 1073741824).toFixed(1),
  uptime: Math.round(os.uptime() / 3600),
});
async function listFiles() {
  if (!root) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  return Promise.all(
    entries.slice(0, 200).map(async (e) => {
      let stat;
      try {
        stat = await fs.lstat(path.join(root, e.name));
      } catch {}
      return {
        name: e.name,
        directory: e.isDirectory(),
        size: stat?.size || 0,
        modified: stat?.mtime.toISOString(),
        path: path.join(root, e.name),
      };
    }),
  );
}
let brain, auditLog, runtime, capabilityEngine, browserEngine,voiceEngine,dialogue;
async function ai(
  prompt,
  history,
  memory,
  provider,
  config = {},
  register = true,
) {
  const epoch = executionEpoch;
  const local = register ? await localIntent(prompt,{desktop:app.getPath('desktop'),documents:app.getPath('documents'),downloads:app.getPath('downloads')}) : null;
  const conversational=!local&&register&&config.voiceMode ? await dialogue(prompt,history,provider) : null;
  const result = local || conversational || await brain.plan({
    prompt,
    history,
    memory,
    primary: provider,
    config,
    folder: root,
  });
  if (epoch !== executionEpoch)
    throw Object.assign(new Error("Request stopped."), { name: "AbortError" });
  result.id = crypto.randomUUID();
  if(local)await auditLog.append({type:'local_plan',count:result.actions.length,outcome:'validated'});
  if (pendingPlans.size > 50)
    pendingPlans.delete(pendingPlans.keys().next().value);
  pendingPlans.set(result.id, structuredClone(result.actions));
  if (register)
    runtime.register(result, {
      prompt,
      history,
      memory,
      provider,
      config,
      folder: root,
      localResult: local,
    });
  return result;
}

function handle(name, fn) {
  ipcMain.handle("aura:" + name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw new Error("Untrusted caller");
    try {
      if (name === "execute")
        await auditLog.append({
          type: "tool_started",
          channel: name,
          tool: pendingPlans.get(args[0])?.[args[1]]?.tool || "unknown",
          outcome: "started",
        });
      const data = await fn(...args);
      if (name === "execute")
        await auditLog.append({
          type: "tool_finished",
          channel: name,
          outcome: "succeeded",
        });
      return { ok: true, data };
    } catch (e) {
      if (name === "execute")
        await auditLog
          .append({
            type: "tool_finished",
            channel: name,
            outcome: "failed",
            code: e.httpStatus || 0,
          })
          .catch(() => {});
      return {
        ok: false,
        error:
          e.name === "AbortError" ? "Request stopped or timed out." : e.message,
      };
    }
  });
}
app.whenReady().then(async () => {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  auditLog = new AuditLog(path.join(app.getPath("userData"), "audit.jsonl"));
  await auditLog.load();
  brain = createBrain({
    request,
    getKeys: () => keys,
    audit: (event) => auditLog.append(event),
    getEpoch: () => executionEpoch,
  });
  try {
    keys = JSON.parse(
      safeStorage.decryptString(await fs.readFile(vaultPath())),
    );
  } catch {}
  if (process.env.AURA_IMPORT_KEYS) {
    try {
      await importKeys(process.env.AURA_IMPORT_KEYS);
    } catch {
      console.error("Credential import failed. Use Settings to try again.");
    }
  }
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) =>
      callback(
        webContents === win?.webContents &&
          permission === "media" &&
          !details.mediaTypes?.includes("video"),
      ),
  );
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: "#080b12",
    frame: false,
    title: "Aura",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  handle("status", () => ({
    autoVoiceAllowed: process.env.AURA_DISABLE_AUTO_VOICE !== '1',
    providers: providers(),
    folder: root,
    desktop: true,
  }));
  handle("brainStatus", () => ({
    providers: brain.snapshot(),
    audit: auditLog.snapshot(),
  }));
  handle("brainDiagnose", async () => ({
    ...(await brain.diagnose()),
    audit: auditLog.snapshot(),
  }));
  handle("importKeys", async () => {
    const choice = await dialog.showOpenDialog(win, {
      title: "Import provider credentials",
      properties: ["openFile"],
      filters: [{ name: "Credentials", extensions: ["txt", "env"] }],
    });
    return choice.canceled ? providers() : importKeys(choice.filePaths[0]);
  });
  handle("chooseFolder", async () => {
    const choice = await dialog.showOpenDialog(win, {
      title: "Choose a folder Aura can access",
      properties: ["openDirectory"],
    });
    if (!choice.canceled) root = await fs.realpath(choice.filePaths[0]);
    return root;
  });
  browserEngine = createBrowser({BrowserWindow,session});
  const pythonWorker=(name,payload,check)=>pythonAnalysis(path.join(app.isPackaged?process.resourcesPath:app.getAppPath(),'python',name),payload,{check});
  const desktopEngine=createDesktop({run: (payload,check)=>pythonWorker('desktop_worker.py',payload,check)});
  let appCatalog;
  const localDrives=(await Promise.all(Array.from({length:26},(_,i)=>String.fromCharCode(65+i)+':\\').map(async drive=>await fs.stat(drive).then(()=>drive,()=>null)))).filter(Boolean);
  capabilityEngine = createCapabilities({
    roots: () => [app.getPath("desktop"), app.getPath("documents"), app.getPath("downloads"), app.getPath('home'), ...(root ? [root] : []), ...localDrives],
    shell,
    autoMove:true,
    desktop: desktopEngine,
    browser: browserEngine,
    document: (payload,check)=>pythonWorker('document_worker.py',payload,check),
    check: () => {},
    browse: (url,check) => browserEngine.browse(url,check),
    apps: async () => {
      if(!appCatalog) {
        const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'],{windowsHide:true,timeout:15000,maxBuffer:2000000});
        const parsed=JSON.parse(stdout); appCatalog=Array.isArray(parsed)?parsed:[parsed];
      }
      return appCatalog;
    },
    launch: async id => { await execFileAsync('explorer.exe',['shell:AppsFolder\\'+id],{windowsHide:true,timeout:10000}).catch(e=>{if(e.code!==1)throw e;}); },
    confirm: async (message,detail) => {
      const result=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Proceed'],defaultId:0,cancelId:0,message,detail});
      if(result.response!==1)throw new Error('Action declined.');
    },
  });
  handle("listFiles", listFiles);
  handle("system", systemInfo);
  handle("plan", ai);
  async function executeAction(id, index) {
    const epoch = executionEpoch;
    const actions = pendingPlans.get(id);
    const action = actions?.[index];
    if (!action) throw new Error("This action has expired or already ran.");
    validateAction(action);
    // Claim the step before asynchronous work so it cannot be replayed concurrently.
    actions[index] = null;
    if (definitions[action.tool]) {
      return capabilityEngine.execute(action, () => { if(epoch !== executionEpoch) throw new Error("Task stopped."); });
    }
    if (action.tool === "system_info") {
      actions[index] = null;
      return systemInfo();
    }
    if (action.tool === "list_files") {
      if (!root) throw new Error("Choose a folder in Files first.");
      const result = await listFiles();
      actions[index] = null;
      return result;
    }
    if (action.tool === "read_text") {
      if (!root) throw new Error("Choose a folder first.");
      const target = await fs.realpath(path.resolve(root, action.path));
      if (!within(root, target))
        throw new Error("This file is outside the folder you allowed.");
      if (
        !/\.(txt|md|csv|json|js|ts|jsx|tsx|py|html|css|log)$/i.test(target) ||
        /(?:api.?key|credential|secret|password|\.env)/i.test(
          path.basename(target),
        )
      )
        throw new Error(
          "This file type or sensitive filename is not available for AI reading.",
        );
      const stat = await fs.stat(target);
      if (stat.size > 40000)
        throw new Error("This file exceeds the 40 KB reading limit.");
      const text = await fs.readFile(target, "utf8");
      actions[index] = null;
      return { path: target, text };
    }
    const approval = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Cancel", "Create note"],
      defaultId: 0,
      cancelId: 0,
      title: "Create a new note?",
      message: action.label,
      detail:
        "Aura will create a new Markdown file in Documents/Aura. Existing files will not be changed.",
    });
    if (approval.response !== 1) throw new Error("Note creation was declined.");
    if (epoch !== executionEpoch) throw new Error("Task was stopped.");
    const out = path.join(app.getPath("documents"), "Aura");
    await fs.mkdir(out, { recursive: true });
    if (epoch !== executionEpoch) throw new Error("Task was stopped.");
    const file = path.join(out, `Aura-note-${Date.now()}.md`);
    await fs.writeFile(file, action.content, { flag: "wx" });
    const verified = (await fs.readFile(file, "utf8")) === action.content;
    actions[index] = null;
    if (!verified)
      throw new Error(
        "The note was written but could not be verified. Inspect the output before trying again.",
      );
    return { path: file, verified };
  }
  handle("execute", executeAction);
  runtime = new AgentRuntime({
    plan: (context) => context.localResult ? Promise.resolve({...context.localResult,id:crypto.randomUUID(),actions:[],outcome:'answered',reply:'Windows accepted the request to open '+path.basename(context.localResult.actions[0].path)+'.'}) : ai(
        context.prompt,
        context.history,
        context.memory,
        context.provider,
        context.config,
        false,
      ),
    execute: async (id, index, context) => {
      if (root !== context.folder)
        throw new Error(
          "The shared folder changed. Start a new task with the new context.",
        );
      await auditLog.append({
        type: "tool_started",
        channel: "runtime",
        tool: pendingPlans.get(id)?.[index]?.tool || "unknown",
        outcome: "started",
      });
      try {
        const output = await executeAction(id, index);
        await auditLog.append({
          type: "tool_finished",
          channel: "runtime",
          outcome: "succeeded",
        });
        return output;
      } catch (error) {
        await auditLog
          .append({
            type: "tool_finished",
            channel: "runtime",
            outcome: "failed",
          })
          .catch(() => {});
        throw error;
      }
    },
    publish: (state) => {
      if (!win.isDestroyed()) win.webContents.send("aura:taskUpdate", state);
    },
  });
  handle("runTask", (id, options) => runtime.run(id, options));
  handle("taskStatus", (id) => runtime.snapshot(id));
  handle("cancel", () => {
    voiceEngine?.cancel();
    browserEngine?.stop();
    runtime.cancel();
    executionEpoch++;
    controllers.forEach((c) => c.abort());
    pendingPlans.clear();
    auditLog
      .append({ type: "user_stop", outcome: "cancelled" })
      .catch(() => {});
    return true;
  });
  handle("transcribe", async (bytes) => {
    const key = keys.elevenlabs_api_key?.[0];
    if (!key)
      throw new Error(
        "Voice input needs an ElevenLabs key. Import credentials in Settings.",
      );
    if (!Array.isArray(bytes) || bytes.length > 15000000)
      throw new Error("Recording is too large.");
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append(
      "file",
      new Blob([new Uint8Array(bytes)], { type: "audio/webm" }),
      "recording.webm",
    );
    const result = await withCredentialFallback(
      keys.elevenlabs_api_key,
      (key) =>
        request("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": key },
          body: form,
        }),
    );
    return result.text;
  });
  voiceEngine=createVoice({getKeys:()=>keys.elevenlabs_api_key,request,publish:event=>{if(!win.isDestroyed())win.webContents.send('aura:speechChunk',event);}});
  dialogue=createDialogue({getKeys:()=>keys,request});
  handle('voiceToken',()=>voiceEngine.token());
  handle('speakStream',(text,id)=>voiceEngine.stream(text,id));
  handle('stopSpeech',id=>{voiceEngine.cancel(id);return true;});
  handle("speak", async (text, provider = "elevenlabs", voiceId = "") => {
    if (provider === "sarvam") {
      const key = keys.sarvam_api_key?.[0];
      if (!key) throw new Error("Import a Sarvam key in Settings first.");
      const result = await request("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": key,
        },
        body: JSON.stringify({
          text: String(text).slice(0, 2500),
          language_code: "en-IN",
          model: "bulbul:v3",
          speaker: "shubh",
        }),
      });
      if (!result.audios?.[0]) throw new Error("Sarvam returned no audio.");
      return { base64: result.audios[0], mime: "audio/wav" };
    }
    if (provider === "fish_audio") {
      const key = keys.fish_audio_api_key?.[0];
      if (!key) throw new Error("Import a Fish Audio key in Settings first.");
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(voiceId))
        throw new Error("Enter your Fish Audio voice model ID in Settings.");
      const base64 = await request("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          model: "s2.1-pro-free",
        },
        body: JSON.stringify({
          text: String(text).slice(0, 3000),
          reference_id: voiceId,
          format: "mp3",
          temperature: 0.7,
        }),
        binary: true,
      });
      return { base64, mime: "audio/mpeg" };
    }
    const key = keys.elevenlabs_api_key?.[0];
    if (!key) throw new Error("Natural voice needs an ElevenLabs key.");
    const base64 = await withCredentialFallback(
      keys.elevenlabs_api_key,
      (key) =>
        request(
          "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "xi-api-key": key },
            body: JSON.stringify({
              text: String(text).slice(0, 3000),
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.45,
                similarity_boost: 0.75,
                style: 0.25,
                use_speaker_boost: true,
              },
            }),
            binary: true,
          },
        ),
    );
    return { base64, mime: "audio/mpeg" };
  });
  handle("window", (action) => {
    if (action === "minimize") win.minimize();
    else if (action === "maximize")
      win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === "close") win.close();
  });
  let preferenceQueue = Promise.resolve();
  const savePreferences = (data) => {
    const pending = preferenceQueue.then(async () => {
      if (!safeStorage.isEncryptionAvailable())
        throw new Error("Windows credential encryption is unavailable.");
      if (
        !data ||
        typeof data !== "object" ||
        JSON.stringify(data).length > 200000
      )
        throw new Error("Invalid preferences.");
      const target = path.join(app.getPath("userData"), "preferences.vault");
      await fs.writeFile(
        target + ".tmp",
        safeStorage.encryptString(JSON.stringify(data)),
      );
      await fs.rename(target + ".tmp", target);
      brain.clearMemory();
      return true;
    });
    preferenceQueue = pending.catch(() => {});
    return pending;
  };
  handle("savePreferences", savePreferences);
  handle("loadPreferences", async () => {
    try {
      return JSON.parse(
        safeStorage.decryptString(
          await fs.readFile(
            path.join(app.getPath("userData"), "preferences.vault"),
          ),
        ),
      );
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error("Preferences could not be decrypted.");
      const legacy = path.join(app.getPath("userData"), "preferences.json");
      try {
        const data = JSON.parse(await fs.readFile(legacy, "utf8"));
        await savePreferences(data);
        await fs.unlink(legacy);
        return data;
      } catch (legacyError) {
        if (legacyError.code !== "ENOENT")
          throw new Error("Preferences could not be migrated.");
        return {};
      }
    }
  });
  if (process.env.AURA_DEV) await win.loadURL("http://127.0.0.1:5173");
  else await win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
