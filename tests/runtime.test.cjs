const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AgentRuntime } = require("../electron/runtime.cjs");
const read = { tool: "system_info", label: "Inspect system" };
const write = { tool: "create_note", label: "Create note", content: "Hello" };
const plan = (id, actions = []) => ({
  id,
  reply: "Result",
  title: "Task",
  actions,
});
const context = { prompt: "Original goal", history: [], folder: null };

test("runtime executes multiple plans without a UI and retains goal and all observations", async () => {
  let calls = 0;
  const prompts = [];
  const states = [];
  const r = new AgentRuntime({
    execute: async () => ({ sequence: ++calls }),
    plan: async (c) => {
      prompts.push(c.prompt);
      return plan("next" + calls, calls < 2 ? [read] : []);
    },
    publish: (state) => states.push(state),
  });
  r.register(plan("first", [read]), context);
  const state = await r.run("first");
  assert.equal(state.status, "Complete");
  assert.equal(state.completed, 2);
  assert.match(prompts[1], /Original goal/);
  assert.match(prompts[1], /"sequence":1/);
  assert.match(prompts[1], /"sequence":2/);
  assert.ok(states.some((s) => s.phase === "thinking"));
  assert.equal("context" in state, false);
});

test("each new write plan pauses again; resume never replays completed steps", async () => {
  const executed = [];
  const r = new AgentRuntime({
    execute: async (id) => {
      executed.push(id);
      return { verified: true };
    },
    plan: async () => plan("second", executed.length < 2 ? [write] : []),
  });
  r.register(plan("first", [write]), context);
  assert.equal((await r.run("first")).status, "Needs approval");
  assert.equal(executed.length, 0);
  assert.equal(
    (await r.run("first", { approve: true })).status,
    "Needs approval",
  );
  assert.deepEqual(executed, ["first"]);
  assert.equal((await r.run("first", { approve: true })).status, "Complete");
  assert.deepEqual(executed, ["first", "second"]);
  await assert.rejects(r.run("first"), /cannot be resumed/);
});

test("parallel runs are rejected and cancelling preserves completed evidence without executing next step", async () => {
  let release;
  let count = 0;
  let replans = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const r = new AgentRuntime({
    execute: async () => {
      count++;
      await gate;
      return { verified: true };
    },
    plan: async () => {
      replans++;
      return plan("done");
    },
  });
  r.register(plan("first", [read, read]), context);
  const running = r.run("first");
  await assert.rejects(r.run("first"), /already running/);
  r.cancel();
  release();
  const result = await running;
  assert.equal(result.status, "Stopped");
  assert.equal(result.completed, 1);
  assert.equal(count, 1);
  assert.equal(replans, 0);
});

test("failure or unavailable review cannot become completion or trigger automatic retries", async () => {
  const r = new AgentRuntime({
    execute: async () => {
      throw new Error("Permission denied");
    },
    plan: async () => {
      throw new Error("Unexpected planner invocation");
    },
  });
  r.register(plan("first", [read]), context);
  const result = await r.run("first");
  assert.equal(result.status, "Needs attention");
  assert.match(result.error, /Permission denied/);
  r.register(
    {
      ...plan("blocked", []),
      brain: { review: { status: "unavailable", reason: "Offline" } },
    },
    context,
  );
  assert.equal(
    r.snapshot("blocked").status,
    "Needs attention",
  );
  await assert.rejects(r.run("blocked", { approve: true }), /cannot be resumed/);
});

test("runtime enforces round limit even when a model keeps requesting actions", async () => {
  let executed = 0;
  const r = new AgentRuntime({
    maxRounds: 2,
    execute: async () => ({ n: ++executed }),
    plan: async () => plan("next", [read]),
  });
  r.register(plan("first", [read]), context);
  const result = await r.run("first");
  assert.equal(executed, 2);
  assert.equal(result.status, "Needs attention");
  assert.match(result.error, /limit/);
});

test("cancel during planning discards late actions and manual read mode pauses before reading", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const r = new AgentRuntime({
    execute: async () => ({}),
    plan: async () => gate,
  });
  r.register(plan("first", [read]), context);
  assert.equal(
    (await r.run("first", { autoRead: false })).status,
    "Needs approval",
  );
  const running = r.run("first", { approve: true });
  await new Promise((resolve) => setImmediate(resolve));
  r.cancel();
  release(plan("late", [write]));
  const result = await running;
  assert.equal(result.status, "Stopped");
  assert.equal(result.actions.length, 1);
});
