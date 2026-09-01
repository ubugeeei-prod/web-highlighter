import { strict as assert } from "node:assert";
import test from "node:test";
import {
  activateBrowser,
  browserCandidates,
  chromeCandidates,
  chromeLaunchArgs,
  chromeProfilePids,
  chooseBrowser,
  defaultUrl,
  defaultProfileDir,
  findBrowserExecutable,
  findChromeExecutable,
  launchChromeWithCdp,
  parseInstallArgs,
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

await test("chooseBrowser honors explicit browser selection", () => {
  assert.equal(chooseBrowser({ env: {} }), "chrome");
  assert.equal(chooseBrowser({ env: { WEB_HIGHLIGHTER_BROWSER: "auto" } }), "chrome");
  assert.equal(chooseBrowser({ env: { WEB_HIGHLIGHTER_BROWSER: "chrome" } }), "chrome");
  assert.equal(chooseBrowser({ env: { WEB_HIGHLIGHTER_BROWSER: "dia" } }), "dia");
  assert.throws(
    () => chooseBrowser({ env: { WEB_HIGHLIGHTER_BROWSER: "safari" } }),
    /Unsupported WEB_HIGHLIGHTER_BROWSER=safari/,
  );
});

await test("browserCandidates can target Dia without Chrome flags", () => {
  const candidates = browserCandidates({
    browser: "dia",
    env: { DIA_EXECUTABLE: "/custom/dia" },
    home: "/Users/dev",
    pathEnv: "/bin",
    platform: "darwin",
  });

  assert.deepEqual(candidates.slice(0, 3), [
    "/custom/dia",
    "/Applications/Dia.app/Contents/MacOS/Dia",
    "/Users/dev/Applications/Dia.app/Contents/MacOS/Dia",
  ]);
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

await test("findBrowserExecutable picks the requested browser executable", () => {
  const executable = findBrowserExecutable({
    browser: "dia",
    env: {},
    exists: (candidate) => candidate === "/Applications/Dia.app/Contents/MacOS/Dia",
    home: "/Users/dev",
    pathEnv: "",
    platform: "darwin",
  });

  assert.equal(executable, "/Applications/Dia.app/Contents/MacOS/Dia");
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

await test("defaultProfileDir keeps Dia in a separate isolated profile", () => {
  assert.equal(
    defaultProfileDir({ browser: "dia", env: {}, home: "/Users/dev", platform: "darwin" }),
    "/Users/dev/Library/Application Support/Web Highlighter/dia-profile",
  );
  assert.equal(
    defaultProfileDir({ browser: "chromium", env: {}, home: "/Users/dev", platform: "darwin" }),
    "/Users/dev/Library/Application Support/Web Highlighter/chromium-profile",
  );
});

await test("parseInstallArgs accepts browser selection plus URLs", () => {
  assert.deepEqual(parseInstallArgs(["--browser=dia", "https://github.com/example/repo"]), {
    browser: "dia",
    urls: ["https://github.com/example/repo"],
  });
  assert.deepEqual(parseInstallArgs(["--browser", "chrome"]), {
    browser: "chrome",
    urls: [],
  });
  assert.throws(() => parseInstallArgs(["--browser"]), /--browser requires/);
  assert.throws(() => parseInstallArgs(["--browser", "--next"]), /--browser requires/);
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

await test("launchChromeWithCdp installs Chrome 137+ extensions through Puppeteer pipe", async () => {
  const visited = [];
  const launchOptions = [];
  const fakeBrowser = {
    async pages() {
      return [
        {
          goto: async (url, options) => visited.push(["first", url, options]),
        },
      ];
    },
    async newPage() {
      return {
        goto: async (url, options) => visited.push(["new", url, options]),
      };
    },
  };

  const browser = await launchChromeWithCdp({
    executable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    extensionDir: "/repo/dist/chromium",
    profileDir: "/repo/profile",
    urls: ["https://github.com/one", "https://github.com/two"],
    puppeteerImpl: {
      async launch(options) {
        launchOptions.push(options);
        return fakeBrowser;
      },
    },
  });

  assert.equal(browser, fakeBrowser);
  assert.deepEqual(launchOptions, [
    {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      userDataDir: "/repo/profile",
      headless: false,
      pipe: true,
      enableExtensions: ["/repo/dist/chromium"],
      args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--no-default-browser-check"],
      defaultViewport: null,
    },
  ]);
  assert.deepEqual(visited, [
    ["first", "https://github.com/one", { waitUntil: "domcontentloaded" }],
    ["new", "https://github.com/two", { waitUntil: "domcontentloaded" }],
  ]);
});

await test("activateBrowser brings the requested macOS app forward", () => {
  const calls = [];
  assert.equal(
    activateBrowser({
      browser: "dia",
      execFileSyncImpl(command, args) {
        calls.push([command, args]);
      },
      platform: "darwin",
    }),
    true,
  );
  assert.deepEqual(calls, [["/usr/bin/osascript", ["-e", 'tell application "Dia" to activate']]]);
});

await test("activateBrowser is a no-op outside macOS", () => {
  const calls = [];
  assert.equal(
    activateBrowser({
      browser: "chrome",
      execFileSyncImpl() {
        calls.push(true);
      },
      platform: "linux",
    }),
    false,
  );
  assert.deepEqual(calls, []);
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
    env: {
      WEB_HIGHLIGHTER_BROWSER_PROFILE: "/Users/dev/Library/Application Support/Google/Chrome",
    },
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

await test("restartChromeProfile can explicitly restart an overridden profile", () => {
  const killed = [];
  const restarted = restartChromeProfile({
    env: {
      WEB_HIGHLIGHTER_BROWSER_PROFILE: "/tmp/web-highlighter",
      WEB_HIGHLIGHTER_RESTART_BROWSER_PROFILE: "1",
    },
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
