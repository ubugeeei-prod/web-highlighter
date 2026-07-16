import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import test from "node:test";

for (const target of ["chromium", "firefox", "safari"] as const) {
  test(`${target} distribution is valid Manifest V3`, async () => {
    const manifest = JSON.parse(await readFile(new URL(`../dist/${target}/manifest.json`, import.meta.url), "utf8")) as {
      manifest_version: number;
      content_scripts: Array<{ matches: string[] }>;
      optional_host_permissions: string[];
    };
    assert.equal(manifest.manifest_version, 3);
    assert(manifest.content_scripts[0]?.matches.includes("https://github.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://discord.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://*.slack.com/*"));
    assert(manifest.content_scripts[0]?.matches.includes("https://chatgpt.com/*"));
    assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
    assert((await stat(new URL(`../dist/${target}/popup.html`, import.meta.url))).size > 0);
  });
}

test("the runtime stays below its hard compressed-size budget", async () => {
  const content = await readFile(new URL("../dist/chromium/content.js", import.meta.url));
  assert(brotliCompressSync(content).length <= 32_000);
  const text = content.toString("utf8");
  assert(!text.includes("eval("));
  assert(!text.includes("new Function"));
});
