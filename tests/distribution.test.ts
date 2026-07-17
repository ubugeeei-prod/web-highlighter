import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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
    assert.equal(manifest.icons["128"], "icons/icon-128.png");
    assert(manifest.content_scripts[0]?.matches.includes("https://github.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://gitlab.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://discord.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://*.slack.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://chatgpt.com/*"));
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
    assert((await stat(new URL(`../dist/${target}/icons/icon-128.png`, import.meta.url))).size > 0);
    assert(
      (await stat(new URL(`../dist/${target}/_locales/en/messages.json`, import.meta.url))).size >
        0,
    );
    assert(
      (await stat(new URL(`../dist/${target}/_locales/ja/messages.json`, import.meta.url))).size >
        0,
    );
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
});
