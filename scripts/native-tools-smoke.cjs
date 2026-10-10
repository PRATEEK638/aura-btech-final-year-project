const { _electron: electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const folder = path.resolve("test-results/native-tools");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(
    path.join(folder, "approved.txt"),
    "Aura approved fixture.",
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector("h1");
    await app.evaluate(({ dialog, app }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
      dialog.showMessageBox = async () => ({ response: 0 });
      app.setPath("documents", folder);
    }, folder);
    await page.evaluate(() => window.aura.chooseFolder());
    const files = await page.evaluate(() => window.aura.listFiles());
    if (!files.ok || !files.data.some((f) => f.name === "approved.txt"))
      throw new Error("Folder listing failed");
    const read = await page.evaluate(() =>
      window.aura.plan(
        "Read approved.txt in the selected folder using read_text.",
        [],
        [],
        "nvidia",
        { review: false, failover: false, semanticMemory: false },
      ),
    );
    if (!read.ok) throw new Error(read.error);
    const readIndex = read.data.actions.findIndex(
      (a) => a.tool === "read_text",
    );
    if (readIndex < 0) throw new Error("No read action was proposed");
    const output = await page.evaluate(
      ([id, index]) => window.aura.execute(id, index),
      [read.data.id, readIndex],
    );
    if (output.data?.text !== "Aura approved fixture.")
      throw new Error("File content verification failed");
    const create = () =>
      page.evaluate(() =>
        window.aura.plan(
          "Create a new Markdown note with exactly the content: # Aura native test. Propose create_note now.",
          [],
          [],
          "nvidia",
          { review: false, failover: false, semanticMemory: false },
        ),
      );
    const denied = await create();
    if (!denied.ok) throw new Error(denied.error);
    const deniedIndex = denied.data.actions.findIndex(
      (a) => a.tool === "create_note",
    );
    if (deniedIndex < 0) throw new Error("No note action proposed");
    const decline = await page.evaluate(
      ([id, index]) => window.aura.execute(id, index),
      [denied.data.id, deniedIndex],
    );
    if (decline.ok) throw new Error("Approval denial was ignored");
    const approved = await create();
    if (!approved.ok) throw new Error(approved.error);
    const index = approved.data.actions.findIndex(
      (a) => a.tool === "create_note",
    );
    if (index < 0) throw new Error("No note action proposed");
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    const results = await page.evaluate(
      ([id, index]) =>
        Promise.all([
          window.aura.execute(id, index),
          window.aura.execute(id, index),
        ]),
      [approved.data.id, index],
    );
    if (
      results.filter((r) => r.ok).length !== 1 ||
      !results.find((r) => r.ok).data.verified
    )
      throw new Error("Write/replay verification failed");
    const created = results.find((r) => r.ok).data.path;
    if (!(await fs.readFile(created, "utf8")).includes("Aura native test"))
      throw new Error("Written note did not match");
    console.log(
      "PASS: scoped folder listing, real text reading, denied approval, verified note creation, and concurrent replay rejection.",
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
