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
    if (hint !== "ush" && !filename.endsWith(".ush")) return "";
    const first = source.indexOf("greet");
    const second = source.lastIndexOf("greet");
    return `L\tush\nT\t0\t2\tkeyword\nT\t${first}\t${first + 5}\tfunction\nT\t${second}\t${second + 5}\tfunction\nD\t${first}\t${first + 5}\tfunction\t1\nR\t${second}\t${second + 5}\tgreet\n`;
  },
  theme_wire() {
    return "M\tmidnight\nC\tkeyword\t#ff7b72\nC\tfunction\t#d2a8ff\n";
  },
};

test("the wire protocol preserves definitions and references", () => {
  const source = "fn greet() {}\ngreet()";
  const result = decodeAnalysis(analyzer.analyze_request(source, "ush", ""), source)!;
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

test("GitHub lines remain intact while hover and jump metadata is injected", () => {
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
  assert.equal(host.highlight(), 1);
  assert.equal(window.document.querySelector("#LC1")?.textContent, "fn greet() {}");
  assert(window.document.querySelector("#L2"));
  const reference = window.document.querySelector<HTMLElement>('[data-wh-reference="true"]')!;
  reference.click();
  assert.equal(
    window.document.querySelector<HTMLElement>('[data-wh-definition="true"]')?.dataset.scrolled,
    "true",
  );
  assert.equal(host.highlight(), 0);
});

test("Discord fences and theme changes use the same host", () => {
  const window = testWindow("https://discord.com/channels/1/2");
  window.document.body.innerHTML =
    '<pre><code class="language-ush">fn greet() {}\ngreet()</code></pre>';
  const host = new BrowserHost(window.document, analyzer);
  assert.equal(host.highlight(), 1);
  host.applyTheme("auto", true);
  assert.equal(window.document.documentElement.dataset.whTheme, "midnight");
  assert.equal(window.document.documentElement.style.getPropertyValue("--wh-keyword"), "#ff7b72");
});
