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
  "https://zenn.dev/*",
  "https://qiita.com/*",
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
      install: { command: "vp install --frozen-lockfile", cache: false },
      check: "vp check",
      build: { command: "vp build", cache: false },
      test: "vp test",
      ready: {
        command: ["vpr build", "node tools/scripts/install-chrome-extension.mjs"],
        cache: false,
      },
      "docs-build": "vp exec vite build --config docs/vite.config.mjs",
      "docs-dev": {
        command: "vp exec vite --config docs/vite.config.mjs --host 127.0.0.1",
        cache: false,
      },
      "docs-preview": {
        command: "vp exec vite preview --config docs/vite.config.mjs",
        cache: false,
      },
      "docs-deploy": {
        command: "vp exec node tools/scripts/deploy-docs-to-void.mjs",
        cache: false,
      },
      "moon-check": "moon check --target wasm-gc --deny-warn",
      "moon-prove": "bash tools/scripts/moon-prove.sh",
      "moon-test": "moon test --target wasm-gc --deny-warn",
      bench: "node tools/scripts/benchmark.ts",
      "browser-smoke": {
        command: "node --experimental-strip-types tools/scripts/browser-smoke.ts",
        cache: false,
      },
      "firefox-lint": "vp exec addons-linter dist/firefox --warnings-as-errors",
      "firefox-sign": { command: "vp exec web-ext sign", cache: false },
      "playwright-install-chromium": {
        command: "vp exec playwright install --with-deps --no-shell chromium",
        cache: false,
      },
      "actions-lint": "actionlint",
      "safari-package": { command: "xcrun safari-web-extension-packager", cache: false },
      "store-publish": { command: "node tools/scripts/store-publish.mjs", cache: false },
      "store-publish-test": "node --test tools/scripts/store-publish.test.mjs",
      "chrome-ready-test": "node --test tools/scripts/install-chrome-extension.test.mjs",
      verify: [
        "vpr moon-check",
        "vpr moon-prove",
        "vpr moon-test",
        "vpr check",
        "vpr actions-lint",
        "vpr package",
        "vpr firefox-lint",
        "vpr store-publish-test",
        "vpr chrome-ready-test",
        "vpr test",
        "vpr bench",
      ],
      release: { command: "node tools/scripts/release.mjs", cache: false },
      package: {
        command: [
          "vpr build",
          "node tools/scripts/package.mjs",
          "node --test tools/scripts/package.test.mjs",
        ],
        cache: false,
      },
    },
  },
});
