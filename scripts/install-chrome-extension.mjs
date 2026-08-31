import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultUrl = "https://github.com/mizchi/vibe-lang/blob/main/lib/%40vibe/ast/ast.vibe";
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function onPath(binary, pathEnv) {
  return (pathEnv ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, binary));
}

export function chromeCandidates({
  env = process.env,
  home = homedir(),
  pathEnv = process.env.PATH ?? "",
  platform = process.platform,
} = {}) {
  const candidates = [];

  if (env.CHROME_EXECUTABLE) {
    candidates.push(env.CHROME_EXECUTABLE);
  }

  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  }

  if (platform !== "win32") {
    candidates.push(
      ...onPath("google-chrome", pathEnv),
      ...onPath("google-chrome-stable", pathEnv),
      ...onPath("chromium", pathEnv),
      ...onPath("chromium-browser", pathEnv),
    );
  }

  if (platform === "win32") {
    for (const base of [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]]) {
      if (base) {
        candidates.push(join(base, "Google/Chrome/Application/chrome.exe"));
      }
    }
  }

  return unique(candidates);
}

export function findChromeExecutable(options = {}) {
  const exists = options.exists ?? existsSync;
  return chromeCandidates(options).find((candidate) => exists(candidate));
}

export function defaultProfileDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  if (env.WEB_HIGHLIGHTER_CHROME_PROFILE) {
    return env.WEB_HIGHLIGHTER_CHROME_PROFILE;
  }

  if (platform === "darwin") {
    return join(home, "Library/Application Support/Web Highlighter/chrome-profile");
  }

  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(home, "AppData/Local"), "Web Highlighter/chrome-profile");
  }

  return join(env.XDG_CACHE_HOME ?? join(home, ".cache"), "web-highlighter/chrome-profile");
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
  if (env.WEB_HIGHLIGHTER_CHROME_PROFILE && env.WEB_HIGHLIGHTER_RESTART_CHROME_PROFILE !== "1")
    return [];
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

export function main(argv = process.argv.slice(2), deps = {}) {
  const root = deps.root ?? repoRoot;
  const exists = deps.exists ?? existsSync;
  const execFileSyncImpl = deps.execFileSync ?? execFileSync;
  const mkdir = deps.mkdir ?? mkdirSync;
  const spawnImpl = deps.spawn ?? spawn;
  const extensionDir = resolve(root, "dist/chromium");
  const profileDir = resolve(defaultProfileDir(deps));
  const urls = argv.length > 0 ? argv : [defaultUrl];

  validateExtension(extensionDir, exists);
  mkdir(profileDir, { recursive: true });
  const restarted = restartChromeProfile({
    env: deps.env ?? process.env,
    execFileSyncImpl,
    kill: deps.kill,
    platform: deps.platform ?? process.platform,
    profileDir,
  });

  const executable = findChromeExecutable({ ...deps, exists });
  if (!executable) {
    throw new Error(
      "Chrome executable was not found. Set CHROME_EXECUTABLE to Google Chrome, Chrome Canary, or Chromium.",
    );
  }

  const args = chromeLaunchArgs({ extensionDir, profileDir, urls });
  const pid = launchChrome(executable, args, spawnImpl);

  console.log(`Chrome launched with Web Highlighter from ${extensionDir}`);
  console.log(`Profile: ${profileDir}`);
  if (restarted.length > 0) {
    console.log(`Restarted existing Web Highlighter Chrome profile: ${restarted.join(", ")}`);
  }
  console.log(
    "This is an isolated Chrome profile. Existing normal Chrome windows must reload or load this unpacked extension separately.",
  );
  console.log(`PID: ${pid ?? "unknown"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
