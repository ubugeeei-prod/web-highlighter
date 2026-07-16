import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const level = process.argv[2];
if (!["major", "minor", "patch"].includes(level)) {
  throw new Error("usage: vp run release <major|minor|patch>");
}

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
if (git("status", "--porcelain")) throw new Error("release requires a clean worktree");
if (git("branch", "--show-current") !== "main") throw new Error("release must run from main");
git("fetch", "origin", "main", "--tags");
if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main"))
  throw new Error("main must exactly match origin/main");

const packagePath = resolve(root, "package.json");
const modulePath = resolve(root, "moon.mod");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const parts = String(packageJson.version).split(".").map(Number);
if (parts.length !== 3 || parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
  throw new Error(`unsupported version: ${packageJson.version}`);
}
if (level === "major") parts.splice(0, 3, parts[0] + 1, 0, 0);
if (level === "minor") parts.splice(1, 2, parts[1] + 1, 0);
if (level === "patch") parts[2] += 1;
const version = parts.join(".");
const tag = `v${version}`;

packageJson.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
const moduleSource = readFileSync(modulePath, "utf8");
writeFileSync(modulePath, moduleSource.replace(/^version = "[^"]+"$/m, `version = "${version}"`));
execFileSync("vp", ["run", "verify"], { cwd: root, stdio: "inherit" });
execFileSync("git", ["add", "package.json", "moon.mod", "pnpm-lock.yaml"], { cwd: root });
execFileSync("git", ["commit", "-m", `chore(release): ${tag}`], { cwd: root, stdio: "inherit" });
execFileSync("git", ["tag", "-a", tag, "-m", tag], { cwd: root, stdio: "inherit" });
execFileSync("git", ["push", "--atomic", "origin", "HEAD:main", tag], {
  cwd: root,
  stdio: "inherit",
});
