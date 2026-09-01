import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { decodeAnalysis } from "../browsers/web/src/analysis.ts";
import { BrowserHost, type Analyzer } from "../browsers/web/src/host.ts";
import { discoverSurfaces } from "../browsers/web/src/surfaces.ts";
import { documentPrefersDark } from "../browsers/web/src/theme.ts";
import { testWindow } from "./dom.ts";

const analyzer: Analyzer = {
  analyze_request(source, hint, filename) {
    if (filename.endsWith(".ipkg")) return "L\tidris\nT\t0\t7\tkeyword\n";
    if (filename.endsWith(".vpkg")) {
      const keyword = source.indexOf("export");
      return `L\tvibe\nT\t${keyword}\t${keyword + 6}\tkeyword\n`;
    }
    if (filename.endsWith(".veryl")) {
      const keyword = source.indexOf("module");
      const name = source.indexOf("DataSelector");
      return `L\tveryl\nT\t${keyword}\t${keyword + 6}\tkeyword\nT\t${name}\t${name + 12}\ttype\n`;
    }
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

test("the wire decoder keeps token spans ordered and non-overlapping", () => {
  const source = "fn greet() {}";
  const wire = "L\tush\nT\t0\t2\tkeyword\nT\t1\t5\ttype\nT\t3\t8\tfunction\nT\t9\t9\toperator\n";
  const result = decodeAnalysis(wire, source)!;
  assert.deepEqual(result.tokens, [
    { start: 0, end: 2, scope: "keyword" },
    { start: 3, end: 8, scope: "function" },
  ]);
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

const multilineAnalyzer: Analyzer = {
  analyze_request(source) {
    const comment = source.indexOf("*/") + 2;
    const first = source.indexOf("greet");
    const second = source.lastIndexOf("greet");
    return `L\tush\nT\t0\t${comment}\tcomment\nT\t${first}\t${first + 5}\tfunction\nT\t${second}\t${second + 5}\tfunction\nD\t${first}\t${first + 5}\tfunction\t3\nR\t${second}\t${second + 5}\tgreet\n`;
  },
  theme_wire: () => "",
};

const discordMoonBitSnippet = `pub fn shift_hex(hex : String, amount : Int, shift : Shift) -> String {
  let digits = strip_hash(hex)
  if digits.length() != 6 {
    return hex
  }
}`;

const discordVpkgSnippet = `name = @vibe/random
version = 0.0.1
description =
  #|@vibe/random keeps state explicit
deps = {}

fn seed(seed_value: Int) -> Int`;

const discordInferenceAnalyzer: Analyzer = {
  analyze_request(source, hint, filename) {
    assert.equal(filename, "");
    if (hint === "vibe" || source.includes("name = @vibe/")) {
      const prose = source.indexOf("#|");
      const proseEnd = source.indexOf("\n", prose) + 1;
      const fn = source.indexOf("fn");
      return `L\tvibe\nT\t${prose}\t${proseEnd}\tstring\nT\t${fn}\t${fn + 2}\tkeyword\n`;
    }
    assert.equal(hint, "");
    const pub = source.indexOf("pub");
    const fn = source.indexOf("fn");
    const stringType = source.indexOf("String");
    return `L\tmoonbit\nT\t${pub}\t${pub + 3}\tkeyword\nT\t${fn}\t${fn + 2}\tkeyword\nT\t${stringType}\t${stringType + 6}\ttype\n`;
  },
  theme_wire: () => "",
};

test("tokens covering several lines are injected into every line they reach", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  const lines = ["/* multi", "   line */", "fn greet() {}", "greet()"];
  window.document.body.innerHTML = `<table><tbody>${lines
    .map((line, index) => `<tr><td data-testid="code-cell" id="LC${index + 1}">${line}</td></tr>`)
    .join("")}</tbody></table>`;
  const host = new BrowserHost(window.document, multilineAnalyzer);

  assert.equal(await host.highlight(), 1);
  for (const [index, line] of lines.entries())
    assert.equal(window.document.querySelector(`#LC${index + 1}`)?.textContent, line);
  assert.equal(window.document.querySelector("#LC1 .wh-comment")?.textContent, "/* multi");
  assert.equal(window.document.querySelector("#LC2 .wh-comment")?.textContent, "   line */");
  assert.equal(window.document.querySelectorAll("#LC3 .wh-token").length, 1);
  assert.equal(window.document.querySelector("#LC4 .wh-comment"), null);

  const definition = window.document.querySelector<HTMLElement>("#LC3 .wh-function")!;
  assert.equal(definition.dataset.whSymbol, "greet");
  assert.equal(definition.dataset.whKind, "function");
  assert.equal(definition.dataset.whLine, "3");
  const reference = window.document.querySelector<HTMLElement>("#LC4 .wh-function")!;
  assert.equal(reference.dataset.whReference, "true");
  assert.equal(reference.dataset.whDefinition, undefined);

  assert.equal(await host.highlight(), 0);
});

test("hovering a symbol reports its declaration without rescanning the file", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML = `
    <table><tbody>
      <tr><td data-testid="code-cell" id="LC1">fn greet() {}</td></tr>
      <tr><td data-testid="code-cell" id="LC2">greet()</td></tr>
    </tbody></table>`;
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);

  const reference = window.document.querySelector<HTMLElement>('[data-wh-reference="true"]')!;
  const hover = window.document.createEvent("Event");
  hover.initEvent("pointerover", true, false);
  reference.dispatchEvent(hover);

  const tooltip = window.document.querySelector<HTMLElement>("#wh-tooltip")!;
  assert.equal(tooltip.textContent, "function greet · line 1");
  assert.equal(tooltip.hidden, false);
});

function githubBlobPage(lines: readonly string[]): string {
  return `<div class="react-code-file-contents"><div class="react-code-lines">${lines
    .map(
      (line, index) =>
        `<div data-key="${index}" class="react-code-text react-code-line-contents"><div><div id="LC${index + 1}" class="react-file-line html-div" data-testid="code-cell" data-line-number="${index + 1}">${line}</div></div></div>`,
    )
    .join("")}</div></div>`;
}

test("GitHub blob lines are patched inside their LC node, not the React wrapper", async () => {
  const window = testWindow(
    "https://github.com/mizchi/vibe-lang/blob/main/lib/%40vibe/ast/example.ush",
  );
  window.document.body.innerHTML = githubBlobPage(["fn greet() {}", "greet()"]);

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "example.ush");
  assert.equal(surface?.segments.length, 2);
  assert.equal(surface?.hint, "");

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#LC1")?.getAttribute("data-line-number"), "1");
  assert.equal(window.document.querySelector("#LC2 .wh-token")?.textContent, "greet");
});

test("GitHub line wrappers still resolve to the LC node without a test id", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML = `
    <div class="react-code-lines">
      <div class="react-code-text react-code-line-contents">
        <div><div id="LC1" class="react-file-line html-div">fn greet() {}</div></div>
      </div>
      <div class="react-code-text react-code-line-contents">
        <div><div id="LC2" class="react-file-line html-div">greet()</div></div>
      </div>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.segments.length, 2);
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector(".react-code-line-contents > div > #LC1")?.id, "LC1");
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

test("GitHub code inserted after initial boot is highlighted", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  const host = new BrowserHost(window.document, analyzer);

  await host.start();
  window.document.body.innerHTML =
    '<table><tbody><tr><td data-testid="code-cell" id="LC1">fn greet() {}</td></tr></tbody></table>';

  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "fn");
  host.stop();
});

test("GitHub vpkg blobs are discovered and highlighted by filename", async () => {
  const window = testWindow(
    "https://github.com/mizchi/vibe-lang/blob/main/lib/%40vibe/ast/index.vpkg",
  );
  window.document.body.innerHTML = `
    <table><tbody>
      <tr><td data-testid="code-cell" id="LC1">name = @vibe/ast</td></tr>
      <tr><td data-testid="code-cell" id="LC2">export enum TypeExpr { TyName(String) }</td></tr>
    </tbody></table>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "index.vpkg");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector("#LC2 .wh-keyword")?.textContent, "export");
  assert.equal(
    window.document.querySelector<HTMLElement>("[data-wh-language]")?.dataset.whLanguage,
    "vibe",
  );
});

test("GitHub Veryl blobs are discovered and highlighted by filename", async () => {
  const window = testWindow("https://github.com/veryl-lang/veryl/blob/master/testcases/vl/a.veryl");
  window.document.body.innerHTML = `
    <table><tbody>
      <tr><td data-testid="code-cell" id="LC1">module DataSelector {</td></tr>
      <tr><td data-testid="code-cell" id="LC2">  always_ff { if_reset {} }</td></tr>
      <tr><td data-testid="code-cell" id="LC3">}</td></tr>
    </tbody></table>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "a.veryl");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "module");
  assert.equal(window.document.querySelector("#LC1 .wh-type")?.textContent, "DataSelector");
  assert.equal(
    window.document.querySelector<HTMLElement>("[data-wh-language]")?.dataset.whLanguage,
    "veryl",
  );
});

test("transient analyzer startup failures keep the observer alive", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  window.document.body.innerHTML =
    '<table><tbody><tr><td data-testid="code-cell" id="LC1">fn greet() {}</td></tr></tbody></table>';
  let calls = 0;
  const flakyAnalyzer: Analyzer = {
    ...analyzer,
    analyze_request(source, hint, filename) {
      calls += 1;
      if (calls === 1) throw new Error("service worker cold start");
      return analyzer.analyze_request(source, hint, filename);
    },
  };
  const host = new BrowserHost(window.document, flakyAnalyzer);

  await host.start();
  await new Promise((resolve) => setTimeout(resolve, 220));

  assert.equal(window.document.querySelector("#LC1 .wh-keyword")?.textContent, "fn");
  assert(calls >= 2);
  host.stop();
});

test("GitHub pull request diff files are grouped by filename", async () => {
  const window = testWindow("https://github.com/ubugeeei-prod/ush/pull/1/files");
  window.document.body.innerHTML = `
    <div data-file-path="src/example.ush">
      <table><tbody>
        <tr>
          <td class="blob-code blob-code-hunk">@@ -1 +1 @@</td>
        </tr>
        <tr>
          <td class="blob-code blob-code-addition js-file-line">
            <span class="blob-code-inner">fn greet() {}</span>
          </td>
        </tr>
        <tr>
          <td class="blob-code blob-code-context js-file-line">
            <span class="blob-code-inner">greet()</span>
          </td>
        </tr>
      </tbody></table>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "src/example.ush");
  assert.equal(surface?.segments.length, 2);
  assert.equal(surface?.source, "fn greet() {}\ngreet()");

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".blob-code-hunk")?.textContent, "@@ -1 +1 @@");
  assert.equal(window.document.querySelector(".blob-code-inner .wh-keyword")?.textContent, "fn");
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

test("GitLab merge request diff files are grouped by filename", async () => {
  const window = testWindow("https://gitlab.com/group/project/-/merge_requests/1/diffs");
  window.document.body.innerHTML = `
    <div class="diff-file" data-new-path="pkg/demo.ipkg">
      <div class="line_content">package demo</div>
      <div class="line_content">sourcedir = src</div>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.filename, "pkg/demo.ipkg");
  assert.equal(surface?.segments.length, 2);

  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".line_content .wh-keyword")?.textContent, "package");
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

test("Discord CSS-module code blocks preserve controls and accept bare language classes", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <article>
      <button id="copy">Copy</button>
      <div class="codeContainer_ab12">
        <pre><code class="hljs ush"><span>fn greet() {}</span><span>greet()</span></code></pre>
      </div>
    </article>`;
  const copy = window.document.querySelector("#copy");

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "ush");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".hljs .wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#copy"), copy);
  assert.equal(copy?.textContent, "Copy");
});

test("Discord unlabelled code blocks are handed to evidence inference", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <article>
      <button id="copy">Copy</button>
      <div class="codeContainer_ab12">
        <pre><code class="hljs"></code></pre>
      </div>
    </article>`;
  const copy = window.document.querySelector("#copy");
  window.document.querySelector<HTMLElement>("code")!.textContent = discordMoonBitSnippet;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "");
  assert.equal(surface?.filename, "");
  assert.equal(surface?.source, discordMoonBitSnippet);
  assert.equal(await new BrowserHost(window.document, discordInferenceAnalyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".hljs .wh-keyword")?.textContent, "pub");
  assert.equal(window.document.querySelector(".hljs .wh-type")?.textContent, "String");
  assert.equal(
    window.document.querySelector<HTMLElement>("[data-wh-language]")?.dataset.whLanguage,
    "moonbit",
  );
  assert.equal(window.document.querySelector("#copy"), copy);
});

test("Discord visible language labels are used when class metadata is absent", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <article>
      <div class="codeContainer_ab12">
        <div class="codeLanguage_cd34">vibe</div>
        <code class="scrollbarGhostHairline__506b3 hljs language-plaintext"></code>
      </div>
    </article>`;
  window.document.querySelector<HTMLElement>("code")!.textContent = discordVpkgSnippet;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "vibe");
  assert.equal(surface?.filename, "");
  assert.equal(surface?.source, discordVpkgSnippet);
  assert.equal(await new BrowserHost(window.document, discordInferenceAnalyzer).highlight(), 1);
  assert.equal(
    window.document.querySelector("code .wh-string")?.textContent,
    "#|@vibe/random keeps state explicit\n",
  );
  assert.equal(window.document.querySelector("code .wh-keyword")?.textContent, "fn");
  assert.equal(
    window.document.querySelector<HTMLElement>("[data-wh-language]")?.dataset.whLanguage,
    "vibe",
  );
});

test("Discord wrapper metadata is enough when code has no language class", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <div class="markup_cd34">
      <div class="codeBlock_ef56" data-code-lang="ush">
        <code>fn greet() {}
greet()</code>
      </div>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "ush");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".codeBlock_ef56 .wh-keyword")?.textContent, "fn");
});

test("Discord click-triggered re-render is highlighted again", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <article>
      <div class="codeContainer_ab12">
        <pre><code class="hljs ush">fn greet() {}
greet()</code></pre>
      </div>
    </article>`;
  const code = window.document.querySelector<HTMLElement>("code")!;
  const host = new BrowserHost(window.document, analyzer);

  await host.start();
  assert.equal(code.querySelector(".wh-keyword")?.textContent, "fn");

  code.addEventListener("click", () => {
    code.replaceChildren(window.document.createTextNode("fn greet() {}\ngreet()"));
  });
  const click = window.document.createEvent("Event");
  click.initEvent("click", true, false);
  code.dispatchEvent(click);

  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(code.querySelector(".wh-keyword")?.textContent, "fn");
  host.stop();
});

test("Discord delayed click re-render is highlighted again", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <article>
      <div class="codeContainer_ab12">
        <pre><code class="hljs ush">fn greet() {}
greet()</code></pre>
      </div>
    </article>`;
  const code = window.document.querySelector<HTMLElement>("code")!;
  const host = new BrowserHost(window.document, analyzer);

  await host.start();
  assert.equal(code.querySelector(".wh-keyword")?.textContent, "fn");

  code.addEventListener("click", () => {
    setTimeout(() => {
      code.replaceChildren(window.document.createTextNode("fn greet() {}\ngreet()"));
    }, 900);
  });
  const click = window.document.createEvent("Event");
  click.initEvent("click", true, false);
  code.dispatchEvent(click);

  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(code.querySelector(".wh-keyword")?.textContent, "fn");
  host.stop();
});

test("Discord codeBlockText fallback covers code nodes recreated without code tags", async () => {
  const window = testWindow("https://discord.com/channels/1/2/3");
  window.document.body.innerHTML = `
    <div class="codeContainer_ab12" data-code-lang="ush">
      <button id="copy">Copy</button>
      <div class="codeBlockText_cd34">fn greet() {}
greet()</div>
    </div>`;
  const copy = window.document.querySelector("#copy");

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "ush");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".codeBlockText_cd34 .wh-keyword")?.textContent, "fn");
  assert.equal(window.document.querySelector("#copy"), copy);
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

test("Qiita code frames read the language from their wrapper metadata", async () => {
  const window = testWindow("https://qiita.com/ubugeeei/items/example");
  window.document.body.innerHTML = `
    <div class="code-frame" data-lang="ush">
      <div class="code-lang"><span class="bold">ush</span></div>
      <pre class="code-frame"><code>fn greet() {}\ngreet()</code></pre>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "ush");
  assert.equal(await new BrowserHost(window.document, analyzer).highlight(), 1);
  assert.equal(window.document.querySelector(".wh-keyword")?.textContent, "fn");
});

test("Zenn code blocks stay analyzable after Shiki drops the language name", async () => {
  const window = testWindow("https://zenn.dev/ubugeeei/articles/example");
  window.document.body.innerHTML = `
    <div class="code-block-container">
      <pre class="shiki github-dark"><code class="code-line">fn greet() {}\ngreet()</code></pre>
    </div>`;

  const [surface] = discoverSurfaces(window.document);
  assert.equal(surface?.hint, "");
  const inferring: Analyzer = {
    analyze_request: (source) => analyzer.analyze_request(source, "ush", ""),
    theme_wire: () => "",
  };
  assert.equal(await new BrowserHost(window.document, inferring).highlight(), 1);
  assert.equal(window.document.querySelector(".wh-keyword")?.textContent, "fn");
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

test("automatic theme mode follows page background before OS preference", () => {
  const hinted = testWindow("https://discord.com/channels/1/2/3");
  hinted.document.documentElement.className = "theme-dark";
  assert.equal(documentPrefersDark(hinted.document, false), true);

  const github = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  github.document.documentElement.setAttribute("data-color-mode", "light");
  assert.equal(documentPrefersDark(github.document, true), false);
  github.document.documentElement.setAttribute("data-color-mode", "dark");
  assert.equal(documentPrefersDark(github.document, false), true);

  const embeddedDark = testWindow("https://example.com/docs");
  embeddedDark.document.documentElement.setAttribute("data-color-mode", "light");
  embeddedDark.document.body.style.backgroundColor = "rgb(255, 255, 255)";
  embeddedDark.document.body.innerHTML =
    '<pre style="background-color: rgb(9, 12, 13)"><code class="language-ush">fn greet() {}</code></pre>';
  assert.equal(documentPrefersDark(embeddedDark.document, false), true);

  const light = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  light.document.body.style.backgroundColor = "rgb(255, 255, 255)";
  light.document.body.innerHTML = '<pre><code class="language-ush">fn greet() {}</code></pre>';
  assert.equal(documentPrefersDark(light.document, true), false);

  const dark = testWindow("https://github.com/ubugeeei-prod/ush/blob/main/example.ush");
  dark.document.body.style.backgroundColor = "rgb(13, 17, 23)";
  dark.document.body.innerHTML = '<pre><code class="language-ush">fn greet() {}</code></pre>';
  assert.equal(documentPrefersDark(dark.document, false), true);
});
