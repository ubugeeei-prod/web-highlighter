import { strict as assert } from "node:assert";
import test from "node:test";
import {
  chromeCandidates,
  chromeLaunchArgs,
  chromeProfilePids,
  defaultUrl,
  defaultProfileDir,
  findChromeExecutable,
  restartChromeProfile,
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

await test("chromeLaunchArgs opens a real GitHub code page by default", () => {
  const args = chromeLaunchArgs({
    extensionDir: "/repo/dist/chromium",
    profileDir: "/repo/.chrome-profile",
    urls: [],
  });

  assert.equal(args.at(-1), defaultUrl);
  assert(defaultUrl.includes("github.com/mizchi/vibe-lang/blob/"));
});

await test("chromeProfilePids finds only the dedicated profile processes", () => {
  const pids = chromeProfilePids({
    execFileSyncImpl() {
      return [
        " 101 /Applications/Google Chrome --user-data-dir=/tmp/web-highlighter --load-extension=/repo/dist/chromium",
        " 202 /Applications/Google Chrome --user-data-dir=/tmp/other",
        " 303 /Applications/Google Chrome Helper --user-data-dir=/tmp/web-highlighter",
      ].join("\n");
    },
    profileDir: "/tmp/web-highlighter",
    platform: "darwin",
  });

  assert.deepEqual(pids, [101, 303]);
});

await test("restartChromeProfile restarts only the default isolated profile by default", () => {
  const killed = [];
  const restarted = restartChromeProfile({
    env: {},
    execFileSyncImpl() {
      return " 101 /Applications/Google Chrome --user-data-dir=/tmp/web-highlighter";
    },
    kill(pid, signal) {
      killed.push([pid, signal]);
      return true;
    },
    profileDir: "/tmp/web-highlighter",
    platform: "darwin",
    sleepImpl() {},
  });

  assert.deepEqual(restarted, [101]);
  assert.deepEqual(killed, [[101, "SIGTERM"]]);
});

await test("restartChromeProfile does not stop an explicitly overridden profile", () => {
  const killed = [];
  const restarted = restartChromeProfile({
    env: { WEB_HIGHLIGHTER_CHROME_PROFILE: "/Users/dev/Library/Application Support/Google/Chrome" },
    execFileSyncImpl() {
      return " 101 /Applications/Google Chrome --user-data-dir=/Users/dev/Library/Application Support/Google/Chrome";
    },
    kill(pid) {
      killed.push(pid);
      return true;
    },
    profileDir: "/Users/dev/Library/Application Support/Google/Chrome",
    platform: "darwin",
  });

  assert.deepEqual(restarted, []);
  assert.deepEqual(killed, []);
});
