const { _electron: electron } = require("@playwright/test");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(60000);
    await page.waitForSelector("h1");
    await page.locator(".settings-nav").click();
    await page
      .getByRole("combobox", { name: "Thinking provider" })
      .selectOption(process.env.AURA_TEST_PROVIDER || "nvidia");
    const voice = page.getByRole("switch", { name: "Spoken replies" });
    if ((await voice.getAttribute("aria-checked")) === "true")
      await voice.click();
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Tell Aura what you need" })
      .fill(
        "Inspect my real processor, total memory, and uptime with your system_info tool, and give me a concise summary.",
      );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".message.error") ||
        [...document.querySelectorAll(".task-card .tag")].some((e) =>
          ["Complete", "Needs attention"].includes(e.textContent),
        ),
      null,
      { timeout: 120000 },
    );
    const failure = await page
      .locator(".message.error,.error-text")
      .allTextContents();
    if (failure.length) throw new Error(failure.join(" "));
    await page
      .locator("summary")
      .filter({ hasText: "Verified results" })
      .click();
    const proof = await page.locator(".task-card pre").textContent();
    if (!proof.includes("win32") || !proof.includes("memory"))
      throw new Error("Missing actual system result");
    await page.screenshot({ path: "artifacts/aura-verified-task.png" });
    console.log(
      "PASS: goal → AI plan → native system inspection → verified output → AI summary.",
    );
    await page.locator(".settings-nav").click();
    if ((await voice.getAttribute("aria-checked")) === "false")
      await voice.click();
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
