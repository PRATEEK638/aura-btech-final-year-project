const { _electron: electron } = require("@playwright/test");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    const sarvam = await page.evaluate(() =>
      window.aura.plan(
        "Say hello in one short sentence. No actions.",
        [],
        [],
        "sarvam",
        { failover: false, review: false, semanticMemory: false },
      ),
    );
    console.log("Sarvam reasoning:", sarvam.ok ? "PASS" : sarvam.error);
    const review = await page.evaluate(() =>
      window.aura.plan(
        "Prepare a new Markdown note with exactly this content: # Aura review test. Do not claim the file is already saved.",
        [],
        [],
        "nvidia",
        {
          review: true,
          reviewer: "sarvam",
          failover: false,
          semanticMemory: false,
        },
      ),
    );
    console.log(
      "Independent review:",
      review.ok ? review.data.brain.review.status : review.error,
    );
    if (review.ok)
      console.log(
        "Proposed tools:",
        review.data.actions.map((a) => a.tool).join(", "),
      );
    const memory = await page.evaluate(() =>
      window.aura.plan(
        "Which approved preference says where my invoices are? Answer without any tools.",
        [],
        [
          "I keep invoices in Finance",
          "I prefer short replies",
          "I use Chrome",
          "My reports use Markdown",
          "I study physics",
          "I enjoy teaching",
          "My project is Atlas",
          "I prefer morning meetings",
          "My notes are in Documents",
        ],
        "nvidia",
        { review: false, failover: false, semanticMemory: true },
      ),
    );
    console.log(
      "Memory retrieval:",
      memory.ok ? memory.data.brain.retrieval.method : memory.error,
    );
    const status = await page.evaluate(() => window.aura.brainStatus());
    console.log(
      "Audit integrity:",
      status.data.audit.integrity,
      "Events:",
      status.data.audit.total,
    );
    await page
      .getByRole("button", { name: "Aura intelligence", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Aura intelligence", exact: true })
      .waitFor();
    await page.screenshot({
      path: "artifacts/aura-intelligence.png",
      scale: "css",
    });
    if (
      !sarvam.ok ||
      !review.ok ||
      review.data.brain.review.status !== "approved" ||
      !memory.ok ||
      !status.data.audit.integrity
    )
      process.exitCode = 1;
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
