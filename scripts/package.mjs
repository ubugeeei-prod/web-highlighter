import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const release = resolve(root, "release");
const zipTimestamp = new Date("1980-01-01T00:00:00.000Z");

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Returns regular files in stable archive order and rejects special files. */
function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(resolve(directory, prefix), { withFileTypes: true }).sort(
    (a, b) => compareText(a.name, b.name),
  )) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...filesUnder(directory, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`archive input must be a regular file: ${path}`);
  }
  return files;
}

/** Lists reviewed source inputs without ever sweeping ignored local files or secrets. */
function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .sort(compareText);
}

/** Creates a rootless, deterministic ZIP from an explicit allowlist of relative files. */
function createArchive(name, sourceRoot, files) {
  const archive = resolve(release, name);
  const staging = resolve(release, ".staging", name.slice(0, -4));
  mkdirSync(staging, { recursive: true });

  for (const path of files) {
    const source = resolve(sourceRoot, path);
    const destination = resolve(staging, path);
    const stagedPath = relative(staging, destination);
    if (stagedPath === ".." || stagedPath.startsWith(`..${sep}`))
      throw new Error(`archive path escapes staging: ${path}`);
    if (!lstatSync(source).isFile()) throw new Error(`archive input must be a file: ${path}`);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    chmodSync(destination, 0o644);
    utimesSync(destination, zipTimestamp, zipTimestamp);
  }

  execFileSync("zip", ["-q", "-X", archive, ...files], {
    cwd: staging,
    env: { ...process.env, TZ: "UTC" },
    stdio: "inherit",
  });
  rmSync(staging, { recursive: true, force: true });
}

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

for (const { name, target } of [
  { name: `web-highlighter-v${version}-chrome-web-store.zip`, target: "chromium" },
  { name: `web-highlighter-v${version}-edge-addons.zip`, target: "chromium" },
  { name: `web-highlighter-v${version}-firefox-amo.zip`, target: "firefox" },
  { name: `web-highlighter-v${version}-safari-web-extension.zip`, target: "safari" },
]) {
  const source = resolve(root, "dist", target);
  createArchive(name, source, filesUnder(source));
}

createArchive(`web-highlighter-v${version}-firefox-source.zip`, root, trackedFiles());
rmSync(resolve(release, ".staging"), { recursive: true, force: true });

const archives = readdirSync(release)
  .filter((name) => name.endsWith(".zip"))
  .sort(compareText);
const checksums = archives.map((name) => {
  const digest = createHash("sha256")
    .update(readFileSync(resolve(release, name)))
    .digest("hex");
  return `${digest}  ${name}`;
});
writeFileSync(resolve(release, "SHA256SUMS"), `${checksums.join("\n")}\n`);
