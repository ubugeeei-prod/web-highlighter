import assert from "node:assert/strict";
import test from "node:test";
import { discoverSurfaces } from "../extension/src/surfaces.ts";
import { testWindow } from "./dom.ts";

test("Discord and ChatGPT fenced aliases are retained", () => {
  const discord = testWindow("https://discord.com/channels/1/2");
  discord.document.body.innerHTML = '<pre><code class="hljs language-mbtx">fn main {}</code></pre>';
  const [surface] = discoverSurfaces(discord.document);
  assert.equal(surface?.service, "discord");
  assert.equal(surface?.languageHint, "mbtx");
  assert.equal(surface?.source, "fn main {}");

  const chatgpt = testWindow("https://chatgpt.com/c/abc");
  chatgpt.document.body.innerHTML = '<pre data-language="tnix"><code>let x = 1; in x</code></pre>';
  assert.equal(discoverSurfaces(chatgpt.document)[0]?.languageHint, "tnix");
});

test("GitHub line nodes become one analysis surface without losing anchors", () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML = `
    <table><tbody>
      <tr><td id="L1"></td><td class="blob-code">fn greet() {</td></tr>
      <tr><td id="L2"></td><td class="blob-code">  print "hi"</td></tr>
      <tr><td id="L3"></td><td class="blob-code">}</td></tr>
    </tbody></table>`;
  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "example.ush");
  assert.equal(surface?.segments.length, 3);
  assert.equal(surface?.source, 'fn greet() {\n  print "hi"\n}');
  assert(window.document.querySelector("#L2"));
});

test("generic pages require code-shaped elements", () => {
  const window = testWindow("https://example.com/docs");
  window.document.body.innerHTML = '<p>fn main is prose</p><pre><code class="language-ush">fn main {}</code></pre>';
  assert.equal(discoverSurfaces(window.document).length, 1);
});
