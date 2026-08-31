import { strict as assert } from "node:assert";
import test from "node:test";
import {
  chromeCandidates,
  chromeLaunchArgs,
  defaultProfileDir,
  findChromeExecutable,
  validateExtension,
} from "./install-chrome-extension.mjs";

await test("chromeCandidates honors CHROME_EXECUTABLE first", () => {
  const candidates = chromeCandidates({
    env: { CHROME_EXECUTABLE: "/custom/chrome" },
    home: "/home/dev",
    pathEnv: "/bin",
    platform: "linux",
  });

  assert.equal(candidates[0], "/custom/chrome");
});

await test("findChromeExecutable picks the first existing candidate", () => {
  const executable = findChromeExecutable({
    env: { CHROME_EXECUTABLE: "/missing/chrome" },
    exists: (candidate) => candidate === "/bin/chromium",
    home: "/home/dev",
    pathEnv: "/bin:/usr/bin",
    platform: "linux",
  });

  assert.equal(executable, "/bin/chromium");
});

await test("validateExtension requires the built browser bundle contract", () => {
  const files = new Set([
    "/repo/dist/chromium/manifest.json",
    "/repo/dist/chromium/analyzer.wasm",
    "/repo/dist/chromium/content.js",
    "/repo/dist/chromium/engine.js",
  ]);

  assert.doesNotThrow(() => validateExtension("/repo/dist/chromium", (file) => files.has(file)));
  assert.throws(
    () => validateExtension("/repo/dist/missing", () => false),
    /manifest\.json, analyzer\.wasm, content\.js, engine\.js/,
  );
});

await test("defaultProfileDir keeps the Chrome profile outside the checkout by default", () => {
  assert.equal(
    defaultProfileDir({ env: {}, home: "/Users/dev", platform: "darwin" }),
    "/Users/dev/Library/Application Support/Web Highlighter/chrome-profile",
  );
  assert.equal(
    defaultProfileDir({ env: { XDG_CACHE_HOME: "/cache" }, home: "/home/dev", platform: "linux" }),
    "/cache/web-highlighter/chrome-profile",
  );
});

await test("chromeLaunchArgs loads only the built extension with an isolated profile", () => {
  const args = chromeLaunchArgs({
    extensionDir: "/repo/dist/chromium",
    profileDir: "/repo/.chrome-profile",
    urls: ["https://github.com"],
  });

  assert.deepEqual(args, [
    "--user-data-dir=/repo/.chrome-profile",
    "--disable-extensions-except=/repo/dist/chromium",
    "--load-extension=/repo/dist/chromium",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    "https://github.com",
  ]);
});
