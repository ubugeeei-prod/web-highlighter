import { execFileSync } from "node:child_process";
import { brotliCompressSync } from "node:zlib";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

const root = import.meta.dirname;
const staging = resolve(root, ".vite-build");
const dist = resolve(root, "dist");
const wasm = resolve(root, "_build/wasm-gc/release/build/cmd/analyzer/analyzer.wasm");
const targets = ["chromium", "firefox", "safari"] as const;
const automaticHosts = [
  "https://github.com/*",
  "https://gitlab.com/*",
  "https://discord.com/*",
  "https://*.slack.com/*",
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
];

function manifest(target: (typeof targets)[number]) {
  const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    version: string;
  };
  return {
    manifest_version: 3,
    name: "__MSG_extensionName__",
    short_name: "__MSG_extensionShortName__",
    default_locale: "en",
    version,
    description: "__MSG_extensionDescription__",
    homepage_url: "https://github.com/ubugeeei-prod/web-highlighter",
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: automaticHosts,
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_icon: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
      },
      default_popup: "popup.html",
      default_title: "__MSG_extensionShortName__",
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    content_scripts: [
      {
        matches: automaticHosts,
        js: ["content.js"],
        css: ["content.css"],
        run_at: "document_idle",
      },
    ],
    background:
      target === "firefox"
        ? { scripts: ["engine.js"] }
        : { service_worker: "engine.js", type: "module" },
    ...(target === "chromium" ? { minimum_chrome_version: "119" } : {}),
    ...(target === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "web-highlighter@ubugeeei-prod",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["none"] },
            },
            gecko_android: { strict_min_version: "142.0" },
          },
        }
      : {}),
  };
}

export default defineConfig({
  build: {
    target: "es2022",
    outDir: staging,
    emptyOutDir: true,
    minify: true,
    rolldownOptions: {
      input: {
        content: resolve(root, "extension/src/content.ts"),
        engine: resolve(root, "extension/src/engine.ts"),
        popup: resolve(root, "extension/src/popup.ts"),
      },
      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js" },
    },
  },
  plugins: [
    {
      name: "webextension-distributions",
      apply: "build",
      buildStart() {
        execFileSync("moon", ["build", "--target", "wasm-gc", "--release"], {
          cwd: root,
          stdio: "inherit",
        });
        rmSync(dist, { recursive: true, force: true });
      },
      closeBundle() {
        for (const target of targets) {
          const out = resolve(dist, target);
          mkdirSync(out, { recursive: true });
          cpSync(staging, out, { recursive: true });
          cpSync(resolve(root, "extension/src/content.css"), resolve(out, "content.css"));
          cpSync(resolve(root, "extension/static/popup.html"), resolve(out, "popup.html"));
          cpSync(resolve(root, "extension/static/icons"), resolve(out, "icons"), {
            recursive: true,
          });
          cpSync(resolve(root, "extension/static/_locales"), resolve(out, "_locales"), {
            recursive: true,
          });
          cpSync(wasm, resolve(out, "analyzer.wasm"));
          writeFileSync(
            resolve(out, "manifest.json"),
            `${JSON.stringify(manifest(target), null, 2)}\n`,
          );
        }
        const content = readFileSync(resolve(dist, "chromium/content.js"));
        const compressed = brotliCompressSync(content).length;
        if (compressed > 32_000)
          throw new Error(`content bundle exceeded 32 KiB Brotli: ${compressed}`);
        console.log(`content.js: ${content.length} bytes (${compressed} bytes Brotli)`);
      },
    },
  ],
  test: { include: ["tests/**/*.test.ts"] },
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    tasks: {
      "moon-check": "moon check --target wasm-gc --deny-warn",
      "moon-test": "moon test --target wasm-gc --deny-warn",
      bench: "node scripts/benchmark.ts",
      "browser-smoke": {
        command: "node --experimental-strip-types scripts/browser-smoke.ts",
        cache: false,
      },
      "firefox-lint": "vp exec addons-linter dist/firefox --warnings-as-errors",
      "actions-lint": "actionlint",
      "store-publish-test": "node --test scripts/store-publish.test.mjs",
      verify: [
        "vp run moon-check",
        "vp run moon-test",
        "vp check",
        "vp run actions-lint",
        "vp run package",
        "vp run firefox-lint",
        "vp run store-publish-test",
        "vp test",
        "vp run bench",
      ],
      release: { command: "node scripts/release.mjs", cache: false },
      package: {
        command: ["vp build", "node scripts/package.mjs", "node --test scripts/package.test.mjs"],
        cache: false,
      },
    },
  },
});
