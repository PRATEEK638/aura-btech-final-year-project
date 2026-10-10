const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createVoice } = require("../electron/voice.cjs");
const { createDialogue } = require("../electron/dialogue.cjs");
test("speech publishes its first chunk before synthesis completes and hides credentials", async () => {
  let finish, heard;
  const gate = new Promise((r) => (finish = r)),
    first = new Promise((r) => (heard = r)),
    events = [];
  const voice = createVoice({
    getKeys: () => ["private-test-key"],
    publish: (e) => {
      events.push(e);
      if (e.bytes) heard();
    },
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([1, 2, 3, 4]));
            gate.then(() => c.close());
          },
        }),
      ),
  });
  const pending = voice.stream("Hello there.", "voice-request-123");
  await first;
  assert.equal(events.length, 1);
  assert.ok(!events[0].done);
  assert.ok(!JSON.stringify(events).includes("private-test-key"));
  finish();
  const result = await pending;
  assert.equal(result.bytes, 4);
  assert.equal(events.at(-1).done, true);
});
test("speech validation rejects malformed requests before contacting a provider", async () => {
  let called = false;
  const voice = createVoice({
    getKeys: () => ["test"],
    publish: () => {},
    fetchImpl: async () => {
      called = true;
    },
  });
  await assert.rejects(voice.stream("", "request-12345"), /Invalid/);
  assert.equal(called, false);
});
test("stopping speech aborts its in-flight network request", async () => {
  let started;
  const ready = new Promise((resolve) => (started = resolve)),
    events = [];
  const voice = createVoice({
    getKeys: () => ["test"],
    publish: (event) => events.push(event),
    fetchImpl: async (_url, { signal }) => {
      started();
      return new Promise((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () =>
            reject(
              Object.assign(new Error("Cancelled"), { name: "AbortError" }),
            ),
          { once: true },
        ),
      );
    },
  });
  const pending = voice.stream("A longer answer.", "voice-request-cancel");
  await ready;
  voice.cancel();
  await assert.rejects(pending, /Cancelled/);
  assert.equal(events.at(-1).error, "Speech stopped");
});
test("conversation failures never invent a successful answer", async () => {
  const dialogue = createDialogue({
    getKeys: () => ({ sarvam_api_key: ["test"] }),
    request: async () => ({
      choices: [{ message: { content: "No usable JSON" } }],
    }),
  });
  assert.equal(await dialogue("Hello"), null);
  const cancelled = createDialogue({
    getKeys: () => ({ sarvam_api_key: ["test"] }),
    request: async () => {
      throw Object.assign(new Error("Stopped"), { name: "AbortError" });
    },
  });
  await assert.rejects(cancelled("Hello"), { name: "AbortError" });
});
test("dialogue retains context, disables extended reasoning and defers computer tasks", async () => {
  let body;
  const dialogue = createDialogue({
    getKeys: () => ({ sarvam_api_key: ["test"] }),
    request: async (_url, o) => {
      body = JSON.parse(o.body);
      return {
        choices: [
          {
            message: { content: JSON.stringify({ route: "task", reply: "" }) },
          },
        ],
      };
    },
  });
  const result = await dialogue("Open that folder", [
    { role: "user", text: "The folder is Project Atlas." },
  ]);
  assert.equal(result, null);
  assert.equal(body.model, "sarvam-105b");
  assert.equal(body.reasoning_effort, null);
  assert.match(JSON.stringify(body.messages), /Project Atlas/);
});
