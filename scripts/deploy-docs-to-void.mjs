import { spawnSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extraArgs = process.argv.slice(2);
const defaultProject = process.env.VOID_PROJECT || "web-highlighter";
const docsBase = process.env.WEB_HIGHLIGHTER_DOCS_BASE || "/";
const docsSiteUrl = process.env.WEB_HIGHLIGHTER_DOCS_SITE_URL || "https://web-highlighter.void.app";

const commandName = (command) => (process.platform === "win32" ? `${command}.cmd` : command);

const hasOption = (args, option) =>
  args.some((arg) => arg === option || arg.startsWith(`${option}=`));

const childEnv = (cwd, overrides = {}) => {
  const env = { ...process.env, PWD: cwd, ...overrides };

  for (const key of Object.keys(env)) {
    if (key.startsWith("VP_")) {
      delete env[key];
    }
  }

  delete env.LC_ALL;
  delete env.LC_CTYPE;
  env.PATH = [resolve(root, "node_modules/.bin"), env.PATH].filter(Boolean).join(delimiter);
  return env;
};

const run = (command, args, options = {}) => {
  const cwd = options.cwd ? resolve(root, options.cwd) : root;
  const result = spawnSync(commandName(command), args, {
    cwd,
    env: childEnv(cwd, options.env),
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const voidArgs = ["deploy"];

if (!hasOption(extraArgs, "--project")) {
  voidArgs.push("--project", defaultProject);
}

if (!hasOption(extraArgs, "--dir")) {
  voidArgs.push("--dir", "dist/docs");
}

voidArgs.push(...extraArgs);

run("vite", ["build", "--config", "docs/vite.config.mjs"], {
  env: {
    WEB_HIGHLIGHTER_DOCS_BASE: docsBase,
    WEB_HIGHLIGHTER_DOCS_SITE_URL: docsSiteUrl,
  },
});
run("void", voidArgs);
