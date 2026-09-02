import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import { test } from "vite-plus/test";

for (const target of ["chromium", "firefox", "safari"] as const) {
  test(`${target} distribution is valid Manifest V3`, async () => {
    const manifest = JSON.parse(
      await readFile(new URL(`../dist/${target}/manifest.json`, import.meta.url), "utf8"),
    ) as {
      manifest_version: number;
      name: string;
      description: string;
      default_locale: string;
      icons: Record<string, string>;
      action: { default_icon: Record<string, string>; default_title: string };
      content_scripts: Array<{ matches: string[] }>;
      optional_host_permissions: string[];
      content_security_policy: { extension_pages: string };
      background: { service_worker?: string; scripts?: string[] };
      browser_specific_settings?: {
        gecko?: {
          strict_min_version?: string;
          data_collection_permissions?: { required?: string[] };
        };
        gecko_android?: { strict_min_version?: string };
      };
    };
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.name, "__MSG_extensionName__");
    assert.equal(manifest.description, "__MSG_extensionDescription__");
    assert.equal(manifest.default_locale, "en");
    assert.equal(manifest.action.default_title, "__MSG_extensionShortName__");
    for (const size of [16, 32, 48, 128]) {
      const path = `icons/icon-${size}.png`;
      assert.equal(manifest.icons[String(size)], path);
      const icon = await readFile(new URL(`../dist/${target}/${path}`, import.meta.url));
      assert.equal(icon.readUInt32BE(16), size);
      assert.equal(icon.readUInt32BE(20), size);
    }
    assert.equal(manifest.action.default_icon["16"], "icons/icon-16.png");
    assert.equal(manifest.action.default_icon["32"], "icons/icon-32.png");
    assert(manifest.content_scripts[0]?.matches.includes("https://github.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://gitlab.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://discord.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://*.slack.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://chatgpt.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://zenn.dev/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://qiita.com/*"));
    assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
    assert(manifest.content_security_policy.extension_pages.includes("wasm-unsafe-eval"));
    assert(
      manifest.background.service_worker === "engine.js" ||
        manifest.background.scripts?.includes("engine.js"),
    );
    if (target === "firefox") {
      assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, "140.0");
      assert.equal(manifest.browser_specific_settings?.gecko_android?.strict_min_version, "142.0");
      assert.deepEqual(
        manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
        ["none"],
      );
    }
    assert((await stat(new URL(`../dist/${target}/popup.html`, import.meta.url))).size > 0);
    for (const locale of ["en", "ja"]) {
      const source = await readFile(
        new URL(`../dist/${target}/_locales/${locale}/messages.json`, import.meta.url),
        "utf8",
      );
      assert(source.length > 0);
      const messages = JSON.parse(source) as Record<string, { message?: unknown }>;
      assert.deepEqual(Object.keys(messages).sort(), [
        "extensionDescription",
        "extensionName",
        "extensionShortName",
      ]);
      for (const value of Object.values(messages))
        assert.equal(typeof value.message === "string" && value.message.length > 0, true);
    }
    assert((await stat(new URL(`../dist/${target}/engine.js`, import.meta.url))).size > 0);
    assert((await stat(new URL(`../dist/${target}/analyzer.wasm`, import.meta.url))).size > 0);
  });
}

test("the runtime stays below its hard compressed-size budget", async () => {
  const content = await readFile(new URL("../dist/chromium/content.js", import.meta.url));
  const engine = await readFile(new URL("../dist/chromium/engine.js", import.meta.url));
  const wasm = await readFile(new URL("../dist/chromium/analyzer.wasm", import.meta.url));
  assert(
    brotliCompressSync(content).length +
      brotliCompressSync(engine).length +
      brotliCompressSync(wasm).length <=
      32_768,
  );
  const text = content.toString("utf8");
  assert(!text.includes("eval("));
  assert(!text.includes("new Function"));
});

test("the content stylesheet has visible startup fallback colors", async () => {
  const stylesheet = await readFile(
    new URL("../dist/chromium/content.css", import.meta.url),
    "utf8",
  );
  assert(stylesheet.includes("--wh-keyword: #cf222e"));
  assert(stylesheet.includes("--wh-keyword: #ff8f87"));
  assert(stylesheet.includes(':root[data-color-mode="dark"]'));
  assert(stylesheet.includes(".wh-keyword"));
});

test("the extension popup stays flat and supports dark mode", async () => {
  const html = await readFile(new URL("../dist/chromium/popup.html", import.meta.url), "utf8");
  const popup = html.toLowerCase();
  for (const banned of [
    "linear-gradient",
    "radial-gradient",
    "conic-gradient",
    "box-shadow",
    "text-shadow",
    "drop-shadow",
    "backdrop-filter",
  ])
    assert(!popup.includes(banned), `popup must not use ${banned}`);
  assert(popup.includes("@media (prefers-color-scheme: dark)"));
  assert(popup.includes("--surface-muted"));
  assert(popup.includes("sample-strip"));
});

test("Nix and helper scripts are wired through tools", async () => {
  const flake = await readFile(new URL("../flake.nix", import.meta.url), "utf8");
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const tsconfig = await readFile(new URL("../tsconfig.json", import.meta.url), "utf8");
  const workflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );

  assert(flake.includes("flake-parts.lib.mkFlake"));
  assert(flake.includes("./tools/nix/vp.nix"));
  assert(flake.includes("./tools/nix/dev-shell.nix"));
  assert(config.includes("node tools/release/package.mjs"));
  assert(config.includes("node tools/docs/highlight.mjs verify dist/docs"));
  assert(config.includes("node tools/bench/runtime-budget.mjs"));
  assert(config.includes("node tools/browser/smoke.mjs"));
  assert(config.includes("bash tools/moon/prove.sh"));
  for (const taskName of [
    "docs:build",
    "docs:deploy",
    "moon:check",
    "moon:prove",
    "moon:test",
    "moon:fuzz",
    "tools:bench",
    "browser:smoke",
    "publish:browser-store",
    "release:package",
  ])
    assert(config.includes(`"${taskName}"`), `missing grouped Vite task ${taskName}`);
  for (const legacyTaskName of [
    "docs-build",
    "docs-deploy",
    "moon-check",
    "moon-prove",
    "moon-test",
    "browser-smoke",
    "store-publish",
    "chrome-ready-test",
    "package",
  ])
    assert(!config.includes(`"${legacyTaskName}"`), `legacy Vite task ${legacyTaskName} returned`);
  assert(!config.includes("node scripts/"));
  assert(!config.includes("bash scripts/"));
  assert(!tsconfig.includes("tools/**/*.ts"));
  assert(
    config.includes(
      "vp exec void deploy --project ${VOID_PROJECT:-web-highlighter} --dir dist/docs",
    ),
  );
  assert(workflow.includes("VOID_PROJECT: ${{ vars.VOID_PROJECT || 'web-highlighter' }}"));
  assert(!workflow.includes('"scripts/deploy-docs-to-void.mjs"'));
  assert((await stat(new URL("../tools/release/package.mjs", import.meta.url))).isFile());
  assert((await stat(new URL("../tools/docs/highlight.mjs", import.meta.url))).isFile());
  assert((await stat(new URL("../tools/nix/dev-shell.nix", import.meta.url))).isFile());
});

test("the docs build runs Web Highlighter over unsupported Ox Content languages", async () => {
  const docsConfig = await readFile(new URL("../docs/vite.config.mjs", import.meta.url), "utf8");
  const highlighter = await readFile(
    new URL("../tools/docs/highlight.mjs", import.meta.url),
    "utf8",
  );

  assert(docsConfig.includes("webHighlighterDocsPlugin({ projectRoot, outDir: docsOutput })"));
  assert(highlighter.includes('new Set(["moonbit", "ush-shell", "veryl"])'));
  for (const language of ["moonbit", "ush-shell", "veryl"])
    assert(highlighter.includes(`language: "${language}"`));
  assert(highlighter.includes("--octc-syntax-${scope}"));
  for (const scope of ["function", "keyword", "operator", "type"])
    assert(highlighter.includes(`${scope}: "#`));
});

test("MoonBit proof kernels are owner-named and not contract packages", async () => {
  const legacyProofSuffix = ["", "contract"].join("_");
  const legacyProofWbtest = ["proof", "contract"].join("_") + "_wbtest.mbt";
  const sourceEntries = await readdir(new URL("../src", import.meta.url), {
    withFileTypes: true,
  });
  assert(
    !sourceEntries.some((entry) => entry.isDirectory() && entry.name.endsWith(legacyProofSuffix)),
  );
  assert(sourceEntries.some((entry) => entry.isFile() && entry.name === "proof_wbtest.mbt"));
  assert(!sourceEntries.some((entry) => entry.isFile() && entry.name === legacyProofWbtest));

  const pkg = await readFile(new URL("../src/moon.pkg", import.meta.url), "utf8");
  const proveScript = await readFile(new URL("../tools/moon/prove.sh", import.meta.url), "utf8");
  for (const owner of ["cursor", "scanner", "model", "detection", "sweep", "theme"]) {
    const proofPackage = `src/${owner}_proof`;
    assert(pkg.includes(`"ubugeeei-prod/web_highlighter/${proofPackage}"`));
    assert(proveScript.includes(proofPackage));
    assert((await stat(new URL(`../${proofPackage}/kernel.mbt`, import.meta.url))).isFile());
    assert((await stat(new URL(`../${proofPackage}/proof.mbtp`, import.meta.url))).isFile());
  }
  assert(!pkg.includes(legacyProofSuffix));
  assert(!proveScript.includes(legacyProofSuffix));
});

test("built-in language source files are discoverable by name", async () => {
  for (const file of [
    "builtin_languages.mbt",
    "builtin_languages_requested.mbt",
    "builtin_languages_curated.mbt",
    "builtin_languages_notable.mbt",
  ])
    assert((await stat(new URL(`../src/${file}`, import.meta.url))).isFile());
});

test("the docs deploy path always exercises the Void deployment job on main", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const workflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );
  assert(
    workflow.includes("github.event_name != 'pull_request' && github.ref == 'refs/heads/main'"),
  );
  assert(workflow.includes("VOID_PROJECT: ${{ vars.VOID_PROJECT || 'web-highlighter' }}"));
  assert(!workflow.includes("vars.VOID_PROJECT != ''"));
  assert(config.includes("vpr docs:build"));
  assert(config.includes("vp exec void deploy"));
  assert(!config.includes("tools/docs/deploy-to-void.mjs"));
  assert(!config.includes("Skipping Void deploy"));
});

test("the packaged Wasm-GC engine exports real injected support", async () => {
  const wasm = await readFile(new URL("../dist/chromium/analyzer.wasm", import.meta.url));
  const { instance } = await WebAssembly.instantiate(
    wasm,
    {},
    {
      builtins: ["js-string"],
      importedStringConstants: "_",
    },
  );
  const exports = instance.exports as unknown as {
    analyze_request(source: string, hint: string, filename: string): string;
    theme_wire(theme: string, dark: boolean): string;
    themes_wire(): string;
  };
  const result = exports.analyze_request("fn greet() {}\ngreet()", "ush", "example.ush");
  assert(result.startsWith("L\tush\n"));
  assert(result.includes("D\t3\t8\tfunction\t1\n"));
  assert(result.includes("R\t14\t19\tgreet\n"));
  assert.equal(
    exports.themes_wire(),
    "T\tadaptive\tAdaptive\t0\nT\tmidnight\tMidnight\t1\nT\tpaper\tPaper\t0\n",
  );
  const adaptiveOnDark = exports.theme_wire("adaptive", true);
  assert(adaptiveOnDark.startsWith("M\tadaptive\n"));
  assert(adaptiveOnDark.includes("C\tforeground\t#f4f7fb\n"));
  assert(adaptiveOnDark.includes("C\tkeyword\t#ff8f87\n"));
  const paperOnDark = exports.theme_wire("paper", true);
  assert(paperOnDark.startsWith("M\tpaper\n"));
  assert(paperOnDark.includes("C\tforeground\t#f4f7fb\n"));
  assert(!paperOnDark.includes("#252525"));
});
