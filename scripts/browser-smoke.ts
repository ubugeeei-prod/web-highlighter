import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium, type BrowserContext } from "playwright";

const fixture = `<!doctype html>
<html><body>
<a id="L1" data-line-number="1"></a><a id="L2" data-line-number="2"></a>
<pre class="code highlight gl-relative">
  <code data-testid="content" class="line">let enabled = true;\nin if enabled then { status = "enabled"; }</code>
  <code class="gl-absolute gl-left-0">
    <div id="LC1" class="line">let enabled = true;</div>
    <div id="LC2" class="line">in if enabled then { status = "enabled"; }</div>
  </code>
</pre></body></html>`;

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(fixture);
});
const temporary = await mkdtemp(resolve(".browser-smoke-"));
let context: BrowserContext | undefined;

try {
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not bind");

  const extension = join(temporary, "extension");
  await cp(resolve("dist/chromium"), extension, { recursive: true });
  const manifestPath = join(extension, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions: string[];
    content_scripts: Array<{ matches: string[] }>;
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  manifest.content_scripts[0]!.matches = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  context = await chromium.launchPersistentContext(join(temporary, "profile"), {
    headless: true,
    channel: "chromium",
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const startupErrors: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Web Highlighter")) startupErrors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${address.port}/group/project/-/blob/main/fixture.tnix`);
  await page
    .locator(".wh-token")
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(async (cause: unknown) => {
      const pageState = await page.evaluate(() => ({
        booted: document.documentElement.dataset.whBooted ?? null,
        language:
          document.querySelector<HTMLElement>("[data-wh-language]")?.dataset.whLanguage ?? null,
        tokens: document.querySelectorAll(".wh-token").length,
      }));
      const state = { ...pageState, startupErrors };
      throw new Error(`extension did not inject: ${JSON.stringify(state)}`, { cause });
    });

  assert.equal(await page.locator("html").getAttribute("data-wh-booted"), "true");
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "tnix",
  );
  assert.equal(await page.locator(".wh-keyword").first().textContent(), "let");
  assert.equal(await page.locator('[data-testid="content"] > *').count(), 0);
  assert.equal(await page.locator("#L2").count(), 1);
  assert.equal(startupErrors.length, 0, startupErrors.join("\n"));

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  assert.deepEqual(await popup.locator("#theme option").allTextContents(), [
    "Follow system",
    "Adaptive",
    "Midnight",
    "Paper",
  ]);
  await popup.locator("#theme").selectOption("paper");
  await page.waitForFunction(() => document.documentElement.dataset.whTheme === "paper");
  assert.equal(
    await page
      .locator("html")
      .evaluate((element) => element.style.getPropertyValue("--wh-keyword")),
    "#9c1c1c",
  );
  console.log("Chromium injected tNix tokens and applied the packaged Paper theme.");
} finally {
  await context?.close();
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  await rm(temporary, { recursive: true, force: true });
}
