import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, parseFragment, serialize } from "parse5";

const analyzerWasm = "_build/wasm-gc/release/build/runtime/analyzer/analyzer.wasm";
const expectedDocsLanguages = new Set(["moonbit", "ush-shell", "veryl"]);
const expectedDocsBlocks = [
  { page: "index.html", language: "moonbit", scopes: ["function", "keyword", "type"] },
  { page: "index.html", language: "veryl", scopes: ["keyword", "number", "type"] },
  { page: "index.html", language: "ush-shell", scopes: ["function", "operator", "string"] },
  { page: "plugins/index.html", language: "moonbit", scopes: ["function", "keyword", "string"] },
];
const scopeFallbacks = {
  attribute: "#add7ff",
  builtin: "#91ddff",
  comment: "#767c9d",
  constant: "#fffac2",
  deleted: "#d0679d",
  function: "#91ddff",
  heading: "#add7ff",
  inserted: "#5de4c7",
  keyword: "#5de4c7",
  link: "#91ddff",
  number: "#d0679d",
  operator: "#89ddff",
  property: "#add7ff",
  punctuation: "#767c9d",
  string: "#5de4c7",
  tag: "#5de4c7",
  text: "#a6accd",
  type: "#add7ff",
  variable: "#a6accd",
};

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .sort((a, b) => compareText(a.name, b.name))
      .map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return htmlFiles(path);
        return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
      }),
  );
  return files.flat();
}

function attr(node, name) {
  return node.attrs?.find((item) => item.name === name);
}

function attrValue(node, name) {
  return attr(node, name)?.value ?? "";
}

function classList(node) {
  return attrValue(node, "class").split(/\s+/u).filter(Boolean);
}

function hasClass(node, className) {
  return classList(node).includes(className);
}

function languageOf(code) {
  return classList(code)
    .find((className) => className.startsWith("language-"))
    ?.slice("language-".length);
}

function isElement(node, tagName) {
  return node?.nodeName === tagName;
}

function firstElementChild(node, tagName) {
  return node.childNodes?.find((child) => isElement(child, tagName));
}

function textContent(node) {
  if (node.nodeName === "#text") return node.value ?? "";
  return node.childNodes?.map(textContent).join("") ?? "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function styleFor(scope) {
  const fallback = scopeFallbacks[scope] ?? scopeFallbacks.text;
  return `color:var(--octc-syntax-${scope}, ${fallback})`;
}

function decodeTokens(wire) {
  const tokens = [];
  let language = "";
  let cursor = 0;
  for (const line of wire.split("\n")) {
    const [tag, a = "", b = "", scope = ""] = line.split("\t");
    if (tag === "L") language = a;
    else if (tag === "T") {
      const start = Number(a);
      const end = Number(b);
      if (start >= cursor && start < end && scope) {
        tokens.push({ start, end, scope });
        cursor = end;
      }
    }
  }
  return language ? tokens : [];
}

function renderRange(source, tokens, start, end, tokenCursor) {
  let output = "";
  let cursor = start;
  while (tokenCursor.index < tokens.length && tokens[tokenCursor.index].end <= start)
    tokenCursor.index += 1;
  for (let index = tokenCursor.index; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.start >= end) break;
    const spanStart = Math.max(token.start, start);
    const spanEnd = Math.min(token.end, end);
    if (spanStart > cursor) output += escapeHtml(source.slice(cursor, spanStart));
    output += `<span style="${styleFor(token.scope)}">${escapeHtml(source.slice(spanStart, spanEnd))}</span>`;
    cursor = spanEnd;
    if (token.end <= end) tokenCursor.index = index + 1;
    else break;
  }
  if (cursor < end) output += escapeHtml(source.slice(cursor, end));
  return output;
}

function renderHighlightedPre(source, language, tokens) {
  const escapedLanguage = escapeHtml(language);
  const tokenCursor = { index: 0 };
  let lines = "";
  let lineStart = 0;
  while (lineStart <= source.length) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    lines += `<span class="line">${renderRange(source, tokens, lineStart, lineEnd, tokenCursor)}</span>`;
    if (newline === -1) break;
    lines += "\n";
    lineStart = newline + 1;
  }
  return `<pre class="ox-highlight css-variables" style="background-color:var(--octc-color-code-bg, #1b1e28);color:var(--octc-syntax-text, #a6accd)" tabindex="0" data-language="${escapedLanguage}"><code class="language-${escapedLanguage}" data-language="${escapedLanguage}">${lines}</code></pre>`;
}

function collectCodeBlocks(root) {
  const blocks = [];
  function visit(node, parent) {
    if (isElement(node, "pre")) {
      const code = firstElementChild(node, "code");
      const language = code ? languageOf(code) : undefined;
      if (code && language) blocks.push({ pre: node, code, language, parent });
      return;
    }
    for (const child of node.childNodes ?? []) visit(child, node);
  }
  visit(root);
  return blocks;
}

function replaceChild(parent, current, next) {
  const index = parent.childNodes?.indexOf(current) ?? -1;
  if (index < 0) throw new Error("docs highlight could not replace a code block");
  next.parentNode = parent;
  parent.childNodes[index] = next;
}

async function loadAnalyzer(projectRoot) {
  const bytes = await readFile(resolve(projectRoot, analyzerWasm));
  const { instance } = await WebAssembly.instantiate(
    bytes,
    {},
    {
      builtins: ["js-string"],
      importedStringConstants: "_",
    },
  );
  return instance.exports;
}

export async function highlightDocsHtml(html, analyzer) {
  const document = parse(html);
  let highlighted = 0;
  for (const block of collectCodeBlocks(document)) {
    if (hasClass(block.pre, "ox-highlight")) continue;
    const source = textContent(block.code);
    const wire = analyzer.analyze_request(source, block.language, "");
    const tokens = decodeTokens(wire);
    if (tokens.length === 0) continue;
    const next = parseFragment(renderHighlightedPre(source, block.language, tokens)).childNodes[0];
    replaceChild(block.parent, block.pre, next);
    highlighted += 1;
  }
  return { html: serialize(document), highlighted };
}

export function webHighlighterDocsPlugin({ projectRoot, outDir }) {
  return {
    name: "web-highlighter-docs-highlight",
    apply: "build",
    buildStart() {
      execFileSync("moon", ["build", "--target", "wasm-gc", "--release"], {
        cwd: projectRoot,
        stdio: "inherit",
      });
    },
    async closeBundle() {
      const analyzer = await loadAnalyzer(projectRoot);
      const pages = await htmlFiles(outDir);
      let highlighted = 0;
      await Promise.all(
        pages.map(async (path) => {
          const html = await readFile(path, "utf8");
          const result = await highlightDocsHtml(html, analyzer);
          if (result.highlighted > 0) await writeFile(path, result.html);
          highlighted += result.highlighted;
        }),
      );
      this.info(`Web Highlighter highlighted ${highlighted} docs code blocks`);
    },
  };
}

export async function verifyDocsHighlight(outDir) {
  const failures = [];
  for (const { page, language, scopes } of expectedDocsBlocks) {
    const html = await readFile(resolve(outDir, page), "utf8");
    const blocks = collectCodeBlocks(parse(html)).filter(
      (candidate) => candidate.language === language,
    );
    if (blocks.length === 0) {
      failures.push(`${page}: missing ${language} code block`);
      continue;
    }
    const highlighted = blocks.filter((block) => hasClass(block.pre, "ox-highlight"));
    if (highlighted.length === 0) {
      failures.push(`${page}: ${language} code block is not highlighted`);
      continue;
    }
    if (!highlighted.some((block) => serialize(block.pre).includes('<span class="line">')))
      failures.push(`${page}: ${language} code block has no highlighted lines`);
    const hasRepresentativeBlock = highlighted.some((block) => {
      const markup = serialize(block.pre);
      return scopes.every((scope) => markup.includes(`--octc-syntax-${scope}`));
    });
    if (!hasRepresentativeBlock)
      failures.push(`${page}: ${language} code blocks do not cover ${scopes.join(", ")} tokens`);
  }

  for (const path of await htmlFiles(outDir)) {
    for (const block of collectCodeBlocks(parse(await readFile(path, "utf8")))) {
      if (expectedDocsLanguages.has(block.language) && !hasClass(block.pre, "ox-highlight"))
        failures.push(`${path}: ${block.language} code block is not highlighted`);
    }
  }

  if (failures.length > 0)
    throw new Error(`docs syntax highlighting failed:\n${failures.join("\n")}`);
  return expectedDocsBlocks.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? "verify";
  if (command !== "verify") throw new Error(`unknown docs highlight command: ${command}`);
  const outDir = resolve(process.cwd(), process.argv[3] ?? "dist/docs");
  const count = await verifyDocsHighlight(outDir);
  console.log(`docs syntax highlighting verified (${count} representative blocks)`);
}
