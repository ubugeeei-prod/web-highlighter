import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium, type BrowserContext } from "playwright";

const fixture = `<!doctype html>
<html><body><pre><code class="language-tnix">let enabled = true;
in if enabled then { status = "enabled"; }</code></pre></body></html>`;

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
  await page.goto(`http://127.0.0.1:${address.port}/fixture.tnix`);
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
  assert.equal(startupErrors.length, 0, startupErrors.join("\n"));
  console.log("Chromium loaded the MV3 background engine and injected tNix tokens.");
} finally {
  await context?.close();
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  await rm(temporary, { recursive: true, force: true });
}
