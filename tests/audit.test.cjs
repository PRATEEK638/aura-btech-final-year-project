const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { AuditLog, verify } = require("../electron/audit.cjs");
test("audit writes are serialized, content is excluded, and changed events are detected", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aura-audit-test-"));
  const file = path.join(dir, "audit.jsonl");
  try {
    const log = new AuditLog(file);
    await log.load();
    await Promise.all([
      log.append({
        type: "model_response",
        provider: "nvidia",
        outcome: "received",
        prompt: "PRIVATE TEXT",
      }),
      log.append({ type: "tool_finished", outcome: "succeeded" }),
    ]);
    assert.equal(log.snapshot().total, 2);
    assert.equal(log.snapshot().integrity, true);
    assert.ok(!(await fs.readFile(file, "utf8")).includes("PRIVATE TEXT"));
    const rows = log.records.map((r) => ({ ...r }));
    rows[0].outcome = "modified";
    assert.equal(verify(rows), false);
    await fs.writeFile(file, rows.map(JSON.stringify).join("\n") + "\n");
    const changed = new AuditLog(file);
    await changed.load();
    assert.equal(changed.snapshot().integrity, false);
    await assert.rejects(changed.append({ type: "next" }), /integrity/);
  } finally {
    await fs.unlink(file).catch(() => {});
    await fs.rmdir(dir);
  }
});
