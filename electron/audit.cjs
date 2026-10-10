const fs = require("node:fs/promises");
const { createHash } = require("node:crypto");
const ALLOWED = [
  "type",
  "provider",
  "stage",
  "duration",
  "outcome",
  "code",
  "count",
  "review",
  "digest",
  "channel",
  "tool",
];
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function verify(records) {
  let previous = "genesis";
  for (const record of records) {
    const { hash, ...event } = record;
    if (event.previous !== previous || digest(event) !== hash) return false;
    previous = hash;
  }
  return true;
}
class AuditLog {
  constructor(file) {
    this.file = file;
    this.records = [];
    this.valid = true;
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const lines = (await fs.readFile(this.file, "utf8")).trim();
      this.records = lines ? lines.split("\n").map(JSON.parse) : [];
      this.valid = verify(this.records);
    } catch (e) {
      if (e.code !== "ENOENT") this.valid = false;
    }
  }
  append(data) {
    const operation = this.queue.then(async () => {
      if (!this.valid)
        throw new Error(
          "Audit integrity check failed. Restore the local audit log before running more work.",
        );
      const safe = {};
      for (const key of ALLOWED)
        if (["string", "number", "boolean"].includes(typeof data[key]))
          safe[key] =
            typeof data[key] === "string" ? data[key].slice(0, 300) : data[key];
      const event = {
        sequence: this.records.length + 1,
        time: new Date().toISOString(),
        ...safe,
        previous: this.records.at(-1)?.hash || "genesis",
      };
      const record = { ...event, hash: digest(event) };
      await fs.appendFile(this.file, JSON.stringify(record) + "\n", "utf8");
      this.records.push(record);
      return record;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  snapshot() {
    return {
      integrity: this.valid && verify(this.records),
      total: this.records.length,
      events: this.records.slice(-100).reverse(),
      note: "Local hash-linked metadata log. Not externally anchored or compliance-certified.",
    };
  }
}
module.exports = { AuditLog, verify };
