import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  BrowserHost,
  decodeAnalysis,
  discoverSurfaces,
  type Analyzer,
} from "../extension/src/host.ts";
import { testWindow } from "./dom.ts";

const analyzer: Analyzer = {
  analyze_request(source, hint, filename) {
    if (filename.endsWith(".ipkg")) return "L\tidris\nT\t0\t7\tkeyword\n";
    if (hint !== "ush" && !filename.endsWith(".ush")) return "";
    const first = source.indexOf("greet");
    const second = source.lastIndexOf("greet");
    return `L\tush\nT\t0\t2\tkeyword\nT\t${first}\t${first + 5}\tfunction\nT\t${second}\t${second + 5}\tfunction\nD\t${first}\t${first + 5}\tfunction\t1\nR\t${second}\t${second + 5}\tgreet\n`;
  },
  theme_wire() {
    return "M\tmidnight\nC\tkeyword\t#ff7b72\nC\tfunction\t#d2a8ff\n";
  },
};

test("the wire protocol preserves definitions and references", async () => {
  const source = "fn greet() {}\ngreet()";
  const result = decodeAnalysis(await analyzer.analyze_request(source, "ush", ""), source)!;
  assert.equal(result.language, "ush");
  assert.deepEqual(result.definitions[0], {
    start: 3,
    end: 8,
    kind: "function",
    line: 1,
    name: "greet",
  });
  assert.equal(result.references[0]?.name, "greet");
});

test("GitHub lines remain intact while hover and jump metadata is injected", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML = `
    <table><tbody>
      <tr><td id="L1"></td><td data-testid="code-cell" id="LC1">fn greet() {}</td></tr>
      <tr><td id="L2"></td><td data-testid="code-cell" id="LC2">greet()</td></tr>
    </tbody></table>`;
  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "example.ush");
  assert.equal(surface?.segments.length, 2);

  const host = new BrowserHost(window.document, analyzer);
  assert.equal(await host.highlight(), 1);
  assert.equal(window.document.querySelector("#LC1")?.textContent, "fn greet() {}");
  assert(window.document.querySelector("#L2"));
  const reference = window.document.querySelector<HTMLElement>('[data-wh-reference="true"]')!;
  reference.click();
  assert.equal(
    window.document.querySelector<HTMLElement>('[data-wh-definition="true"]')?.dataset.scrolled,
    "true",
  );
  assert.equal(await host.highlight(), 0);
});

test("GitHub hydration cannot permanently remove injected tokens", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML =
    '<table><tbody><tr><td data-testid="code-cell" id="LC1">fn greet() {}</td></tr></tbody></table>';
  const line = window.document.querySelector<HTMLElement>("#LC1")!;
  const host = new BrowserHost(window.document, analyzer);

  assert.equal(await host.highlight(), 1);
  assert.equal(line.querySelector(".wh-keyword")?.textContent, "fn");

  line.replaceChildren(window.document.createTextNode("fn greet() {}"));
  assert.equal(line.querySelector(".wh-token"), null);

  assert.equal(await host.highlight(), 1);
  assert.equal(line.querySelector(".wh-keyword")?.textContent, "fn");
});

test("GitLab visible lines are injected without touching its source overlay", async () => {
  const window = testWindow("https://gitlab.com/group/project/-/blob/main/demo.ipkg");
  window.document.body.innerHTML = `
    <a id="L1" data-line-number="1"></a>
    <a id="L2" data-line-number="2"></a>
    <pre class="code highlight gl-relative">
      <code data-testid="content" class="line">package demo\nsourcedir = src</code>
      <code class="gl-absolute gl-left-0">
        <div id="LC1" class="line">package demo</div>
        <div id="LC2" class="line">sourcedir = src</div>
      </code>
    </pre>`;

  const surfaces = discoverSurfaces(window.document);
  assert.equal(surfaces.length, 1);
  assert.equal(surfaces[0]?.filename, "demo.ipkg");
  assert.equal(surfaces[0]?.segments.length, 2);

  const host = new BrowserHost(window.document, analyzer);
  assert.equal(await host.highlight(), 1);
  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "package");
  assert.equal(window.document.querySelector('[data-testid="content"]')?.childElementCount, 0);
  assert(window.document.querySelector("#L2"));
});

test("GitLab waits for visible lines instead of treating its source overlay as code", async () => {
  const window = testWindow("https://gitlab.com/group/project/-/blob/main/demo.ipkg");
  window.document.body.innerHTML = `
    <pre class="code highlight gl-relative">
      <code data-testid="content" class="line">package demo</code>
    </pre>`;
  const overlay = window.document.querySelector<HTMLElement>('[data-testid="content"]')!;

  assert.deepEqual(discoverSurfaces(window.document), []);
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 0);
  assert.equal(overlay.textContent, "package demo");
  assert.equal(overlay.childElementCount, 0);
});

test("Discord fences and theme changes use the same host", async () => {
  const window = testWindow("https://discord.com/channels/1/2");
  window.document.body.innerHTML =
    '<pre><code class="language-ush">fn greet() {}\ngreet()</code></pre>';
  const host = new BrowserHost(window.document, analyzer);
  assert.equal(await host.highlight(), 1);
  await host.applyTheme("auto", true);
  assert.equal(window.document.documentElement.dataset.whTheme, "midnight");
  assert.equal(window.document.documentElement.style.getPropertyValue("--wh-keyword"), "#ff7b72");
});

test("Slack parent metadata is read without replacing message controls", async () => {
  const window = testWindow("https://workspace.slack.com/archives/C1");
  window.document.body.innerHTML = `
    <article data-message-id="1">
      <button id="thread">Reply in thread</button>
      <pre data-code-language="ush"><code>fn greet() {}\ngreet()</code></pre>
    </article>`;
  const thread = window.document.querySelector("#thread");

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#thread"), thread);
  assert.equal(thread?.textContent, "Reply in thread");
});

test("ChatGPT language metadata is applied without replacing code-block chrome", async () => {
  const window = testWindow("https://chatgpt.com/c/example");
  window.document.body.innerHTML = `
    <section>
      <div class="code-block-header"><button id="copy">Copy code</button></div>
      <pre><code data-language="ush">fn greet() {}\ngreet()</code></pre>
    </section>`;
  const copy = window.document.querySelector("#copy");

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#copy"), copy);
  assert.equal(copy?.textContent, "Copy code");
});

test("ancestor data-lang remains reachable past an empty language attribute", async () => {
  const window = testWindow("https://example.com/thread/1");
  window.document.body.innerHTML = `
    <section data-language="" data-lang="ush">
      <button id="control">Code actions</button>
      <pre><code>fn greet() {}\ngreet()</code></pre>
    </section>`;
  const control = window.document.querySelector("#control");

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#control"), control);
  assert.equal(control?.textContent, "Code actions");
});
