import assert from "node:assert/strict";
import test from "node:test";
import { HighlighterEngine } from "../extension/src/engine.ts";
import { builtinLanguages } from "../plugins/builtin/catalog.ts";
import { builtinThemes } from "../plugins/builtin/themes.ts";
import { testWindow } from "./dom.ts";

test("rendering is text-lossless and idempotent", () => {
  const window = testWindow("https://discord.com/channels/1/2");
  const source = "fn greet(name: String) -> String { name }\nprint greet(\"Ada\")";
  window.document.body.innerHTML = `<pre><code class="language-ush"></code></pre>`;
  window.document.querySelector("code")!.textContent = source;
  const engine = new HighlighterEngine({ document: window.document, languages: builtinLanguages, theme: builtinThemes[0]! });
  assert.equal(engine.highlight(), 1);
  assert.equal(window.document.querySelector("code")?.textContent, source);
  assert(window.document.querySelector(".wh-keyword"));
  assert(window.document.querySelector('[data-wh-definition="true"][data-wh-symbol="greet"]'));
  assert.equal(engine.highlight(), 0);
  assert.equal(window.document.querySelectorAll(".wh-token .wh-token").length, 0);
});

test("references expose keyboard navigation and hover metadata", () => {
  const window = testWindow("https://github.com/o/r/blob/main/example.ush");
  window.document.body.innerHTML = '<pre><code class="language-ush">fn greet() { }\ngreet()</code></pre>';
  const engine = new HighlighterEngine({ document: window.document, languages: builtinLanguages, theme: builtinThemes[1]! });
  engine.highlight();
  const reference = window.document.querySelector<HTMLElement>('[data-wh-reference="true"]')!;
  const definition = window.document.querySelector<HTMLElement>('[data-wh-definition="true"]')!;
  assert.equal(reference.tabIndex, 0);
  reference.click();
  assert.equal(definition.dataset.scrolled, "true");
  reference.dispatchEvent(new window.PointerEvent("pointerover", { bubbles: true }));
  assert.match(window.document.querySelector("#wh-tooltip")?.textContent ?? "", /function greet · line 1/u);
});

test("theme changes are CSS-only and never alter token markup", () => {
  const window = testWindow("https://example.com");
  window.document.body.innerHTML = '<pre><code class="language-moonbit">fn main {}</code></pre>';
  const engine = new HighlighterEngine({ document: window.document, languages: builtinLanguages, theme: builtinThemes[0]! });
  engine.highlight();
  const html = window.document.querySelector("code")?.innerHTML;
  window.document.documentElement.style.setProperty("--wh-keyword", "#000");
  assert.equal(window.document.querySelector("code")?.innerHTML, html);
});
