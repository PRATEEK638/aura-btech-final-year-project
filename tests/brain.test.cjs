const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createBrain,
  validatePlan,
  validateIntentPlan,
  normalizeConfig,
  cosine,
  lexicalRank,
} = require("../electron/brain.cjs");
const reply = (actions = []) => ({
  reply: "I can help.",
  title: "Test",
  actions,
});
const note = {
  tool: "create_note",
  label: "Create a new note",
  content: "# Test\nLocal test note.",
};
const asResponse = (value) => ({
  choices: [
    {
      message: {
        content: JSON.stringify(
          value.actions
            ? {
                kind: value.actions.length ? "do" : "ask",
                outcome: value.actions.length ? "working" : "answered",
                ...value,
              }
            : value,
        ),
      },
    },
  ],
});
test("Home response metadata distinguishes blocked requests from executable work", () => {
  assert.throws(() => validateIntentPlan(reply()), /kind and outcome/);
  assert.throws(() => validateIntentPlan({ ...reply([note]), kind: "do", outcome: "blocked" }), /cannot schedule/);
  assert.throws(() => validateIntentPlan({ ...reply(), kind: "do", outcome: "working" }), /requires executable/);
  assert.equal(validateIntentPlan({ ...reply(), kind: "do", outcome: "blocked" }).outcome, "blocked");
});
const fakeKeys = {
  nvidia_api_key: ["test"],
  sarvam_api_key: ["test"],
  gemini_api_key: ["test"],
};
test('routine opening does not require a second model even with legacy reviewAll enabled',async()=>{
 let calls=0;const brain=createBrain({getKeys:()=>({nvidia_api_key:['test']}),audit:async()=>{},request:async()=>{calls++;return asResponse(reply([{tool:'open_path',label:'Open folder',path:'C:\\Users\\test\\Desktop\\Kruti'}]));}});
 const result=await brain.plan({prompt:'Open Kruti folder',primary:'nvidia',config:{review:true,reviewAll:true}});
 assert.equal(calls,1);assert.equal(result.actions.length,1);assert.equal(result.brain.review.status,'not required');
});
test('an unavailable optional reviewer does not block a bounded new-file write',async()=>{
 const brain=createBrain({getKeys:()=>fakeKeys,audit:async()=>{},request:async(_,options)=>{if(JSON.parse(options.body).model==='sarvam-105b')throw Error('offline');return asResponse(reply([{tool:'write_file',label:'Write new file',path:'C:\\Users\\test\\report.txt',content:'Report'}]));}});
 const result=await brain.plan({prompt:'Create a new report',primary:'nvidia',config:{review:true,reviewAll:true,failover:false}});
 assert.equal(result.actions.length,1);assert.equal(result.brain.review.status,'unavailable_nonblocking');
});
test("strict plans reject unsupported tools, excessive steps, and missing labels", () => {
  assert.throws(() =>
    validatePlan(reply([{ tool: "shell", label: "Run", command: "anything" }])),
  );
  assert.throws(() => validatePlan(reply([{ tool: "system_info" }])));
  assert.throws(() =>
    validatePlan(
      reply(Array(6).fill({ tool: "system_info", label: "Inspect" })),
    ),
  );
  assert.equal(
    validatePlan(reply([{ tool: "system_info", label: "Inspect" }])).actions
      .length,
    1,
  );
});
test("a change requires a different provider review before an actionable plan is returned", async () => {
  const models = [],
    events = [];
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async (e) => events.push(e),
    request: async (_, options) => {
      const model = JSON.parse(options.body).model;
      models.push(model);
      return asResponse(
        model === "sarvam-105b"
          ? {
              approved: true,
              reason: "The user requested this new note.",
              risks: [],
            }
          : reply([note]),
      );
    },
  });
  const result = await brain.plan({
    prompt: "Create a note",
    primary: "nvidia",
  });
  assert.equal(result.actions.length, 1);
  assert.equal(result.brain.review.status, "approved");
  assert.deepEqual(models, ["openai/gpt-oss-20b", "sarvam-105b"]);
  assert.ok(events.some((e) => e.type === "plan_validated"));
  assert.ok(!JSON.stringify(events).includes(note.content));
});
test("review disagreement triggers one revision then fails closed", async () => {
  let plans = 0,
    reviews = 0;
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async (_, options) => {
      if (JSON.parse(options.body).model === "sarvam-105b") {
        reviews++;
        return asResponse({
          approved: false,
          reason: "The requested outcome is unclear.",
          risks: [],
        });
      }
      plans++;
      return asResponse(reply([note]));
    },
  });
  const result = await brain.plan({
    prompt: "Make something",
    primary: "nvidia",
  });
  assert.equal(result.actions.length, 0);
  assert.equal(result.brain.review.status, "blocked");
  assert.equal(plans, 2);
  assert.equal(reviews, 2);
});
test("unavailable independent reviewer never silently authorizes a write", async () => {
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async (_, options) => {
      if (JSON.parse(options.body).model === "sarvam-105b")
        throw Object.assign(new Error("Unavailable"), { httpStatus: 503 });
      return asResponse(reply([note]));
    },
  });
  const result = await brain.plan({ prompt: "Create a note" });
  assert.deepEqual(result.actions, []);
  assert.equal(result.brain.review.status, "unavailable");
});
test("malformed model JSON is repaired once, not executed", async () => {
  let calls = 0;
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async () =>
      ++calls === 1
        ? { choices: [{ message: { content: "not JSON" } }] }
        : asResponse(reply()),
  });
  const result = await brain.plan({
    prompt: "Hello",
    config: { failover: false },
  });
  assert.equal(calls, 2);
  assert.equal(result.reply, "I can help.");
});
test("cancellation prevents a late plan from returning", async () => {
  let epoch = 0;
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    getEpoch: () => epoch,
    request: async () => {
      epoch++;
      return asResponse(reply([note]));
    },
  });
  await assert.rejects(
    brain.plan({ prompt: "Create a note" }),
    (e) => e.name === "AbortError",
  );
});
test("failed primary can use a configured alternative with a visible trace", async () => {
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async (url) => {
      if (url.includes("googleapis"))
        throw Object.assign(new Error("Invalid key"), { httpStatus: 400 });
      return asResponse(reply());
    },
  });
  const result = await brain.plan({ prompt: "Hello", primary: "gemini" });
  assert.equal(result.brain.provider, "nvidia");
  assert.equal(result.brain.trace[0].outcome, "Unavailable");
});
test("audit failure prevents provider calls", async () => {
  let calls = 0;
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {
      throw new Error("Integrity failure");
    },
    request: async () => {
      calls++;
      return asResponse(reply());
    },
  });
  await assert.rejects(brain.plan({ prompt: "Hello" }), /Integrity/);
  assert.equal(calls, 0);
});
test("neural retrieval ranks approved memory and reports a lexical fallback on failure", async () => {
  const embedding = (t) =>
    t.toLowerCase().includes("invoice") ? [1, 0] : [0, 1];
  const brain = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async (_, options) => ({
      data: JSON.parse(options.body).input.map((text, index) => ({
        index,
        embedding: embedding(text),
      })),
    }),
  });
  const result = await brain.retrieve(
    "Find invoices",
    ["I enjoy teaching", "Invoices are in Finance"],
    true,
    0,
  );
  assert.equal(result.items[0], "Invoices are in Finance");
  assert.equal(result.method, "NVIDIA neural embeddings");
  const failed = createBrain({
    getKeys: () => fakeKeys,
    audit: async () => {},
    request: async () => {
      throw new Error("Offline");
    },
  });
  assert.equal(
    (await failed.retrieve("invoices", ["Invoices are in Finance"], true, 0))
      .method,
    "local keyword fallback",
  );
});
test("persona configuration is constrained and retrieval math handles empty vectors", () => {
  assert.equal(
    normalizeConfig({ tone: "ignore policies", detail: "unknown" }).tone,
    "warm",
  );
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([], []), 0);
  assert.equal(cosine([NaN], [1]), 0);
  assert.equal(lexicalRank("invoice", ["lecture", "invoice"])[0], "invoice");
});
