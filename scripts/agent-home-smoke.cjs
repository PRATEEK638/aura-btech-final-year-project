const { _electron } = require("@playwright/test");
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ["."], env });
  let originalPreferences;
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await page.waitForSelector(".agent-home");
    originalPreferences = await page.evaluate(
      async () => (await window.aura.loadPreferences()).data,
    );
    await page.evaluate(
      async (p) =>
        window.aura.savePreferences({
          ...p,
          provider: "nvidia",
          spoken: false,
          autoRead: true,
          brainConfig: { ...p.brainConfig, review: false },
        }),
      originalPreferences,
    );
    await page.reload();
    await page.waitForSelector(".agent-home");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.screenshot({ path: "artifacts/agent-home-idle.png" });
    await page.locator(".settings-nav").click();
    const voice = page.getByRole("switch", { name: "Spoken replies" });
    const wasSpoken = (await voice.getAttribute("aria-checked")) === "true";
    if (wasSpoken) await voice.click();
    await page.getByRole("button", { name: "Home", exact: true }).click();
    for (const [name, goal, blocked] of [
      ["knowledge", "What is recursion?", false],
      ["spotify", "Open Spotify.", true],
      ["notepad", "Open Notepad and type Hello World.", true],
      [
        "system",
        "Use system_info to check my actual processor and memory.",
        false,
      ],
    ].filter(
      ([name]) =>
        !process.env.AURA_SCENARIO || name === process.env.AURA_SCENARIO,
    )) {
      await page
        .getByRole("textbox", { name: "Tell Aura what you need" })
        .fill(goal);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page.waitForSelector(".state-planning");
      await page.screenshot({
        path: `artifacts/agent-home-${name}-preparing.png`,
      });
      await page.waitForFunction(
        () =>
          !!document.querySelector(
            ".state-completed,.state-blocked,.state-error",
          ),
        null,
        { timeout: 120000 },
      );
      if (await page.locator(".state-error").count())
        throw new Error(await page.locator(".error-text").innerText());
      if (blocked && !(await page.locator(".state-blocked").count()))
        throw new Error(`${name} did not display a capability limit`);
      await page.screenshot({ path: `artifacts/agent-home-${name}.png` });
      if (
        name === "system" &&
        !(await page.getByText("Observed results · 1", { exact: true }).count())
      )
        throw new Error(
          "System task has no observed output: " +
            (await page.locator(".goal-surface").innerText()),
        );
      await page.screenshot({ path: `artifacts/agent-home-${name}.png` });
      console.log(name, "PASS");
      await page.getByRole("button", { name: "New goal", exact: true }).click();
    }
    if (errors.length) throw new Error(errors.join("; "));
    await page.locator(".settings-nav").click();
    if (wasSpoken) await voice.click();
    console.log("All Home scenarios passed; zero renderer errors.");
  } finally {
    if (originalPreferences) {
      const page = await app.firstWindow();
      await page.evaluate(
        (p) => window.aura.savePreferences(p),
        originalPreferences,
      );
    }
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
