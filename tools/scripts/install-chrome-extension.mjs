import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

export const defaultUrl = "https://github.com/mizchi/vibe-lang/blob/main/lib/%40vibe/ast/ast.vibe";
const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const browserLabels = {
  chrome: "Chrome",
  chromium: "Chromium",
  dia: "Dia",
};
const browserAppNames = {
  chrome: "Google Chrome",
  chromium: "Chromium",
  dia: "Dia",
};

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function onPath(binary, pathEnv) {
  return (pathEnv ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, binary));
}

export function chooseBrowser({ env = process.env } = {}) {
  const requested = env.WEB_HIGHLIGHTER_BROWSER ?? "chrome";
  if (requested === "auto") return "chrome";

  if (requested === "chrome" || requested === "chromium" || requested === "dia") return requested;
  throw new Error(
    `Unsupported WEB_HIGHLIGHTER_BROWSER=${requested}. Use auto, chrome, chromium, or dia.`,
  );
}

export function browserCandidates({
  browser = "chrome",
  env = process.env,
  home = homedir(),
  pathEnv = process.env.PATH ?? "",
  platform = process.platform,
} = {}) {
  const candidates = [];

  if (env.WEB_HIGHLIGHTER_BROWSER_EXECUTABLE) {
    candidates.push(env.WEB_HIGHLIGHTER_BROWSER_EXECUTABLE);
  }

  if (browser === "dia" && env.DIA_EXECUTABLE) {
    candidates.push(env.DIA_EXECUTABLE);
  }

  if (browser === "chrome" && env.CHROME_EXECUTABLE) {
    candidates.push(env.CHROME_EXECUTABLE);
  }

  if (platform === "darwin") {
    if (browser === "dia") {
      candidates.push(
        "/Applications/Dia.app/Contents/MacOS/Dia",
        join(home, "Applications/Dia.app/Contents/MacOS/Dia"),
      );
    } else if (browser === "chromium") {
      candidates.push("/Applications/Chromium.app/Contents/MacOS/Chromium");
    } else {
      candidates.push(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      );
    }
  }

  if (platform !== "win32") {
    if (browser === "dia") {
      candidates.push(...onPath("dia", pathEnv));
    } else if (browser === "chromium") {
      candidates.push(...onPath("chromium", pathEnv), ...onPath("chromium-browser", pathEnv));
    } else {
      candidates.push(
        ...onPath("google-chrome", pathEnv),
        ...onPath("google-chrome-stable", pathEnv),
        ...onPath("chromium", pathEnv),
        ...onPath("chromium-browser", pathEnv),
      );
    }
  }

  if (platform === "win32" && browser === "chrome") {
    for (const base of [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]]) {
      if (base) {
        candidates.push(join(base, "Google/Chrome/Application/chrome.exe"));
      }
    }
  }

  return unique(candidates);
}

export function chromeCandidates(options = {}) {
  return browserCandidates({ ...options, browser: "chrome" });
}

export function findBrowserExecutable(options = {}) {
  const exists = options.exists ?? existsSync;
  const browser = options.browser ?? chooseBrowser(options);
  return browserCandidates({ ...options, browser }).find((candidate) => exists(candidate));
}

export function findChromeExecutable(options = {}) {
  return findBrowserExecutable({ ...options, browser: "chrome" });
}

export function defaultProfileDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
  browser = "chrome",
} = {}) {
  if (env.WEB_HIGHLIGHTER_BROWSER_PROFILE) {
    return env.WEB_HIGHLIGHTER_BROWSER_PROFILE;
  }

  if (browser === "chrome" && env.WEB_HIGHLIGHTER_CHROME_PROFILE) {
    return env.WEB_HIGHLIGHTER_CHROME_PROFILE;
  }

  const profileName = `${browser}-profile`;

  if (platform === "darwin") {
    return join(home, `Library/Application Support/Web Highlighter/${profileName}`);
  }

  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(home, "AppData/Local"), `Web Highlighter/${profileName}`);
  }

  return join(env.XDG_CACHE_HOME ?? join(home, ".cache"), `web-highlighter/${profileName}`);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function chromeProfilePids({
  execFileSyncImpl,
  profileDir,
  platform = process.platform,
} = {}) {
  if (platform === "win32" || !execFileSyncImpl || !profileDir) return [];
  const output = execFileSyncImpl("ps", ["axww", "-o", "pid=,command="], {
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(`--user-data-dir=${profileDir}`))
    .map((line) => Number(line.match(/^\d+/)?.[0]))
    .filter((pid) => Number.isInteger(pid) && pid !== process.pid);
}

export function restartChromeProfile({
  env = process.env,
  execFileSyncImpl,
  kill = (pid, signal) => process.kill(pid, signal),
  profileDir,
  platform = process.platform,
  sleepImpl = sleep,
} = {}) {
  const explicitProfile = env.WEB_HIGHLIGHTER_BROWSER_PROFILE || env.WEB_HIGHLIGHTER_CHROME_PROFILE;
  const restartExplicitProfile =
    env.WEB_HIGHLIGHTER_RESTART_BROWSER_PROFILE === "1" ||
    env.WEB_HIGHLIGHTER_RESTART_CHROME_PROFILE === "1";
  if (explicitProfile && !restartExplicitProfile) return [];
  const pids = chromeProfilePids({ execFileSyncImpl, profileDir, platform });
  for (const pid of pids) {
    try {
      kill(pid, "SIGTERM");
    } catch {
      // The process may already have exited between ps and kill.
    }
  }
  if (pids.length > 0) sleepImpl(700);
  return pids;
}

export function parseInstallArgs(argv) {
  const urls = [];
  let browser;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--browser") {
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
        throw new Error("--browser requires chrome, chromium, or dia.");
      }
      browser = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--browser=")) {
      browser = arg.slice("--browser=".length);
    } else {
      urls.push(arg);
    }
  }
  return { browser, urls };
}

export function validateExtension(extensionDir, exists = existsSync) {
  const required = ["manifest.json", "analyzer.wasm", "content.js", "engine.js"];
  const missing = required.filter((file) => !exists(join(extensionDir, file)));

  if (missing.length > 0) {
    throw new Error(
      `Chrome extension is not built at ${extensionDir}. Missing: ${missing.join(", ")}. Run vpr build first.`,
    );
  }
}

export function chromeLaunchArgs({ extensionDir, profileDir, urls = [defaultUrl] }) {
  return [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    ...(urls.length > 0 ? urls : [defaultUrl]),
  ];
}

export function launchChrome(executable, args, spawnImpl = spawn) {
  const child = spawnImpl(executable, args, {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
  return child.pid;
}

export function activateBrowser({
  browser = "chrome",
  execFileSyncImpl = execFileSync,
  platform = process.platform,
} = {}) {
  if (platform !== "darwin") return false;
  const appName = browserAppNames[browser];
  if (!appName) return false;
  try {
    execFileSyncImpl("/usr/bin/osascript", ["-e", `tell application "${appName}" to activate`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export async function launchChromeWithCdp({
  executable,
  extensionDir,
  profileDir,
  urls = [defaultUrl],
  puppeteerImpl = puppeteer,
} = {}) {
  const browser = await puppeteerImpl.launch({
    executablePath: executable,
    userDataDir: profileDir,
    headless: false,
    pipe: true,
    enableExtensions: [extensionDir],
    args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--no-default-browser-check"],
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const first = pages[0] ?? (await browser.newPage());
  await first.goto(urls[0] ?? defaultUrl, { waitUntil: "domcontentloaded" });
  for (const url of urls.slice(1)) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  return browser;
}

function waitForManagedBrowser(browser) {
  return new Promise((resolveWait) => {
    browser.once("disconnected", resolveWait);
  });
}

function installShutdownHandlers(browser) {
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    void browser.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const root = deps.root ?? repoRoot;
  const exists = deps.exists ?? existsSync;
  const env = deps.env ?? process.env;
  const execFileSyncImpl = deps.execFileSync ?? execFileSync;
  const mkdir = deps.mkdir ?? mkdirSync;
  const spawnImpl = deps.spawn ?? spawn;
  const extensionDir = resolve(root, "dist/chromium");
  const parsed = parseInstallArgs(argv);
  const browser = chooseBrowser({
    env: { ...env, ...(parsed.browser ? { WEB_HIGHLIGHTER_BROWSER: parsed.browser } : {}) },
    execFileSyncImpl,
    platform: deps.platform ?? process.platform,
  });
  const profileDir = resolve(defaultProfileDir({ ...deps, browser, env }));
  const urls = parsed.urls.length > 0 ? parsed.urls : [defaultUrl];

  validateExtension(extensionDir, exists);
  mkdir(profileDir, { recursive: true });
  const restarted = restartChromeProfile({
    env,
    execFileSyncImpl,
    kill: deps.kill,
    platform: deps.platform ?? process.platform,
    profileDir,
  });

  const executable = findBrowserExecutable({ ...deps, browser, exists });
  if (!executable) {
    throw new Error(
      `${browserLabels[browser]} executable was not found. Set WEB_HIGHLIGHTER_BROWSER_EXECUTABLE, or use WEB_HIGHLIGHTER_BROWSER=chrome.`,
    );
  }

  if (browser === "chrome") {
    const managed = await launchChromeWithCdp({
      executable,
      extensionDir,
      profileDir,
      urls,
      puppeteerImpl: deps.puppeteer ?? puppeteer,
    });
    const pid = managed.process()?.pid;
    const activated = activateBrowser({
      browser,
      execFileSyncImpl,
      platform: deps.platform ?? process.platform,
    });

    console.log(`${browserLabels[browser]} launched with Web Highlighter from ${extensionDir}`);
    console.log(`Profile: ${profileDir}`);
    if (restarted.length > 0) {
      console.log(
        `Restarted existing Web Highlighter ${browserLabels[browser]} profile: ${restarted.join(", ")}`,
      );
    }
    console.log(
      "Chrome 137+ no longer accepts --load-extension for branded Chrome, so this local session uses CDP pipe loading.",
    );
    console.log("Keep this vpr ready process running while you use the opened Chrome window.");
    if (activated) console.log(`${browserLabels[browser]} was brought to the front.`);
    console.log(`PID: ${pid ?? "unknown"}`);
    installShutdownHandlers(managed);
    await waitForManagedBrowser(managed);
    return;
  }

  const pid = launchChrome(
    executable,
    chromeLaunchArgs({ extensionDir, profileDir, urls }),
    spawnImpl,
  );
  const activated = activateBrowser({
    browser,
    execFileSyncImpl,
    platform: deps.platform ?? process.platform,
  });

  console.log(`${browserLabels[browser]} launched with Web Highlighter from ${extensionDir}`);
  console.log(`Profile: ${profileDir}`);
  if (restarted.length > 0) {
    console.log(
      `Restarted existing Web Highlighter ${browserLabels[browser]} profile: ${restarted.join(", ")}`,
    );
  }
  console.log(
    `This is an isolated ${browserLabels[browser]} profile. Existing normal browser windows must reload or load this unpacked extension separately.`,
  );
  if (activated) console.log(`${browserLabels[browser]} was brought to the front.`);
  console.log(`PID: ${pid ?? "unknown"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
