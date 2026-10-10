const { _electron: electron } = require("@playwright/test");
const fs = require("node:fs/promises");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.waitForSelector("h1");
    await fs.mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/aura-home.png" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const name of [
      "Conversations",
      "My tasks",
      "Files & context",
      "Skills & connections",
      "Memory",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { name, exact: true }).waitFor();
    }
    await page
      .getByPlaceholder("e.g. I prefer concise replies and Markdown documents")
      .fill("I like concise replies.");
    await page.getByRole("button", { name: "Remember", exact: true }).click();
    await page.getByText("I like concise replies.", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Delete memory", exact: true })
      .click();
    await page.locator(".settings-nav").click();
    await page
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor();
    await page.screenshot({ path: "artifacts/aura-settings.png" });
    const status = await page.evaluate(async () => await window.aura.status());
    console.log(
      "Desktop bridge:",
      status.ok,
      "configured providers:",
      status.data.providers
        .filter((p) => p.configured)
        .map((p) => p.id)
        .join(", "),
    );
    const system = await page.evaluate(async () => await window.aura.system());
    console.log("System inspection:", system.ok, system.data.platform);
    console.log("Renderer errors:", errors.length);
    if (errors.length) throw new Error(errors.join("; "));
    console.log(
      "Navigation, memory controls, native bridge, and screenshots passed.",
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
