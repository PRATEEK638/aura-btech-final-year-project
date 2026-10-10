const { contextBridge, ipcRenderer } = require("electron");
const channels = [
  "status",
  "runTask",
  "taskStatus",
  "importKeys",
  "chooseFolder",
  "listFiles",
  "plan",
  "execute",
  "cancel",
  "transcribe",
  "speak",
  "voiceToken",
  "speakStream",
  "stopSpeech",
  "system",
  "window",
  "savePreferences",
  "loadPreferences",
  "brainStatus",
  "brainDiagnose",
];
contextBridge.exposeInMainWorld("aura", {
  onSpeechChunk: callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('aura:speechChunk',listener);return()=>ipcRenderer.removeListener('aura:speechChunk',listener);},
  onTaskUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("aura:taskUpdate", listener);
    return () => ipcRenderer.removeListener("aura:taskUpdate", listener);
  },
  ...Object.fromEntries(
    channels.map((channel) => [
      channel,
      (...args) => ipcRenderer.invoke("aura:" + channel, ...args),
    ]),
  ),
});
