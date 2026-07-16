import { execFileSync } from "node:child_process";
import { brotliCompressSync } from "node:zlib";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const targets = ["chromium", "firefox", "safari"];
const automaticHosts = [
  "https://github.com/*",
  "https://discord.com/*",
  "https://*.slack.com/*",
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
];

execFileSync("moon", ["build", "--target", "js", "--release"], { cwd: root, stdio: "inherit" });
rmSync(dist, { recursive: true, force: true });

for (const target of targets) {
  const outdir = join(dist, target);
  mkdirSync(outdir, { recursive: true });
  await Promise.all([
    build({
      entryPoints: [join(root, "extension/src/content.ts")],
      outfile: join(outdir, "content.js"),
      bundle: true,
      format: "iife",
      minify: true,
      legalComments: "none",
      target: target === "firefox" ? "firefox115" : target === "safari" ? "safari17" : "chrome109",
    }),
    build({
      entryPoints: [join(root, "extension/src/popup.ts")],
      outfile: join(outdir, "popup.js"),
      bundle: true,
      format: "iife",
      minify: true,
      legalComments: "none",
      target: target === "firefox" ? "firefox115" : target === "safari" ? "safari17" : "chrome109",
    }),
  ]);
  cpSync(join(root, "extension/src/content.css"), join(outdir, "content.css"));
  cpSync(join(root, "extension/static/popup.html"), join(outdir, "popup.html"));
  const manifest = {
    manifest_version: 3,
    name: "Web Highlighter",
    version: "0.1.0",
    description: "Fast syntax highlighting and code navigation for languages the web forgot.",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: automaticHosts,
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: { default_popup: "popup.html", default_title: "Web Highlighter" },
    content_scripts: [
      {
        matches: automaticHosts,
        js: ["content.js"],
        css: ["content.css"],
        run_at: "document_idle",
      },
    ],
    ...(target === "firefox"
      ? { browser_specific_settings: { gecko: { id: "web-highlighter@ubugeeei-prod", strict_min_version: "115.0" } } }
      : { minimum_chrome_version: "109" }),
  };
  writeFileSync(join(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

const content = readFileSync(join(dist, "chromium/content.js"));
const compressed = brotliCompressSync(content);
console.log(`content.js: ${content.length} bytes (${compressed.length} bytes brotli)`);
if (compressed.length > 32_000) {
  throw new Error(`content bundle exceeded the 32 KiB brotli budget: ${compressed.length}`);
}
