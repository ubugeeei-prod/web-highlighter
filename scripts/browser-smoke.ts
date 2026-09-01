import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const gitlabBlobFixture = `<!doctype html>
<html><body>
<a id="L1" data-line-number="1"></a><a id="L2" data-line-number="2"></a>
<pre class="code highlight gl-relative">
  <code data-testid="content" class="line">let enabled = true;\nin if enabled then { status = "enabled"; }</code>
  <code class="gl-absolute gl-left-0">
    <div id="LC1" class="line">let enabled = true;</div>
    <div id="LC2" class="line">in if enabled then { status = "enabled"; }</div>
  </code>
</pre></body></html>`;

const gitlabDiffFixture = `<!doctype html>
<html><body>
<div class="diff-file" data-new-path="pkg/conditionals.tnix">
  <div id="GL-DIFF-1" class="line_content">let enabled = true;</div>
  <div id="GL-DIFF-2" class="line_content">in if enabled then { status = "enabled"; }</div>
</div>
</body></html>`;

/** Mirrors the nested React blob DOM GitHub ships: the LC node holds the text. */
function githubLines(lines: readonly string[]): string {
  return lines
    .map(
      (line, index) =>
        `<div data-key="${index}" class="react-code-text react-code-line-contents"><div><div id="LC${index + 1}" class="react-file-line html-div" data-testid="code-cell" data-line-number="${index + 1}">${line}</div></div></div>`,
    )
    .join("\n");
}

function githubBlobPage(lines: readonly string[]): string {
  return `<!doctype html>
<html data-color-mode="dark"><body>
<div class="react-code-file-contents">
  <div class="react-line-numbers">${lines.map((_, index) => `<div id="L${index + 1}">${index + 1}</div>`).join("")}</div>
  <div class="react-code-lines">${githubLines(lines)}</div>
</div>
</body></html>`;
}

const githubBlobFixture = githubBlobPage([
  "let enabled = true;",
  'in if enabled then { status = "enabled"; }',
]);

const githubMoonBitPipeStringFixture = githubBlobPage([
  "let message =",
  "#| String predicate proof_require stay prose",
  "pub fn main { message }",
]);

const githubVpkgFixture = githubBlobPage([
  "name = @vibe/ast",
  "export enum TypeExpr { TyName(String) }",
]);

const githubVerylFixture = githubBlobPage([
  "module DataSelector {",
  "  always_ff { if_reset {} }",
  "}",
]);

const githubDiffFixture = `<!doctype html>
<html data-color-mode="dark"><body>
<div data-file-path="src/example.ush">
  <table><tbody>
    <tr><td class="blob-code blob-code-hunk">@@ -1 +1 @@</td></tr>
    <tr>
      <td class="blob-code blob-code-addition js-file-line">
        <span id="GH-DIFF-1" class="blob-code-inner">fn greet() {}</span>
      </td>
    </tr>
    <tr>
      <td class="blob-code blob-code-context js-file-line">
        <span id="GH-DIFF-2" class="blob-code-inner">greet()</span>
      </td>
    </tr>
  </tbody></table>
</div>
</body></html>`;

const discordFixture = `<!doctype html>
<html class="theme-dark"><body>
<article>
  <button id="discord-copy">Copy</button>
  <div class="codeContainer_ab12">
    <pre><code id="discord-code" class="hljs ush">fn greet() {}
greet()</code></pre>
  </div>
</article>
</body></html>`;

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(gitlabBlobFixture);
});
const temporary = await mkdtemp(resolve(".browser-smoke-"));
let context: BrowserContext | undefined;

async function assertDistinctTokenColor(page: Page, selector: string) {
  const colors = await page
    .locator(selector)
    .first()
    .evaluate((token) => {
      const parent = token.parentElement ?? token;
      return {
        token: getComputedStyle(token).color,
        parent: getComputedStyle(parent).color,
      };
    });
  assert.notEqual(colors.token, colors.parent);
}

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
  manifest.host_permissions = [
    "http://127.0.0.1/*",
    "https://github.com/*",
    "https://gitlab.com/*",
    "https://discord.com/*",
  ];
  manifest.content_scripts[0]!.matches = manifest.host_permissions;
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

  await page.route("https://github.com/**", (route) => {
    const url = route.request().url();
    const body = url.includes("/pull/")
      ? githubDiffFixture
      : url.endsWith("/pipe-string.mbt")
        ? githubMoonBitPipeStringFixture
        : url.endsWith("/index.vpkg")
          ? githubVpkgFixture
          : url.endsWith("/a.veryl")
            ? githubVerylFixture
            : githubBlobFixture;
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body,
    });
  });
  await page.goto(
    "https://github.com/ubugeeei-prod/tnix/blob/main/examples/basics/conditionals.tnix",
  );
  await page.locator("#LC1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "tnix",
  );
  assert.equal(await page.locator("#LC1 .wh-keyword").first().textContent(), "let");
  assert.equal(await page.locator("#LC2 .wh-keyword").first().textContent(), "in");
  assert.equal(await page.locator("#L2").count(), 1);
  assert.equal(await page.locator("html").getAttribute("data-wh-theme"), "midnight");
  await assertDistinctTokenColor(page, "#LC1 .wh-keyword");

  await page
    .locator("#LC1")
    .evaluate((line) => line.replaceChildren(document.createTextNode("let enabled = true;")));
  await page.locator("#LC1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(await page.locator("#LC1 .wh-keyword").first().textContent(), "let");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#LC1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "tnix",
  );
  assert.equal(await page.locator("#LC1 .wh-keyword").first().textContent(), "let");
  assert.equal(await page.locator("html").getAttribute("data-wh-theme"), "midnight");
  await assertDistinctTokenColor(page, "#LC1 .wh-keyword");

  await page.goto("https://github.com/moonbitlang/core/blob/main/pipe-string.mbt");
  await page.locator("#LC2 .wh-string").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "moonbit",
  );
  assert.equal(
    await page.locator("#LC2 .wh-string").first().textContent(),
    "#| String predicate proof_require stay prose",
  );
  assert.equal(await page.locator("#LC2 .wh-keyword").count(), 0);
  assert.equal(await page.locator("#LC2 .wh-type").count(), 0);
  assert.equal(await page.locator("#LC3 .wh-keyword").first().textContent(), "pub");
  await assertDistinctTokenColor(page, "#LC2 .wh-string");

  await page.goto("https://github.com/mizchi/vibe-lang/blob/main/lib/%40vibe/ast/index.vpkg");
  await page.locator("#LC2 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "vibe",
  );
  assert.equal(await page.locator("#LC2 .wh-keyword").first().textContent(), "export");
  await assertDistinctTokenColor(page, "#LC2 .wh-keyword");

  await page.goto("https://github.com/veryl-lang/veryl/blob/master/testcases/vl/a.veryl");
  await page.locator("#LC1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "veryl",
  );
  assert.equal(await page.locator("#LC1 .wh-keyword").first().textContent(), "module");
  assert.equal(await page.locator("#LC1 .wh-type").first().textContent(), "DataSelector");
  await assertDistinctTokenColor(page, "#LC1 .wh-keyword");

  await page.goto("https://github.com/ubugeeei-prod/ush/pull/1/files");
  await page.locator("#GH-DIFF-1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "ush",
  );
  assert.equal(await page.locator("#GH-DIFF-1 .wh-keyword").first().textContent(), "fn");
  assert.equal(await page.locator(".blob-code-hunk .wh-token").count(), 0);

  await page.route("https://gitlab.com/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: route.request().url().includes("/diffs") ? gitlabDiffFixture : gitlabBlobFixture,
    }),
  );
  await page.goto("https://gitlab.com/group/project/-/merge_requests/1/diffs");
  await page.locator("#GL-DIFF-1 .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "tnix",
  );
  assert.equal(await page.locator("#GL-DIFF-1 .wh-keyword").first().textContent(), "let");

  await page.route("https://discord.com/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: discordFixture }),
  );
  await page.goto("https://discord.com/channels/1/2/3");
  await page.locator("#discord-code .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "ush",
  );
  assert.equal(await page.locator("#discord-code .wh-keyword").first().textContent(), "fn");
  assert.equal(await page.locator("#discord-copy").textContent(), "Copy");
  assert.equal(await page.locator("html").getAttribute("data-wh-theme"), "midnight");
  await assertDistinctTokenColor(page, "#discord-code .wh-keyword");
  await page.locator("#discord-code").evaluate((code) => {
    code.addEventListener(
      "click",
      () => code.replaceChildren(document.createTextNode("fn greet() {}\ngreet()")),
      { once: true },
    );
  });
  await page.locator("#discord-code .wh-keyword").first().click();
  await page.locator("#discord-code .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(await page.locator("#discord-code .wh-keyword").first().textContent(), "fn");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#discord-code .wh-keyword").first().waitFor({ timeout: 10_000 });
  assert.equal(
    await page.locator("[data-wh-language]").first().getAttribute("data-wh-language"),
    "ush",
  );
  assert.equal(await page.locator("#discord-code .wh-keyword").first().textContent(), "fn");
  assert.equal(await page.locator("html").getAttribute("data-wh-theme"), "midnight");
  await assertDistinctTokenColor(page, "#discord-code .wh-keyword");

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
  console.log(
    "Chromium covered GitHub MoonBit #| strings, vpkg/Veryl blobs, GitHub/GitLab diffs, Discord recovery, and the Paper theme.",
  );
} finally {
  await context?.close();
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  await rm(temporary, { recursive: true, force: true });
}
