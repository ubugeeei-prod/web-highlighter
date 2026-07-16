import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const release = resolve(root, "release");
rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

for (const target of ["chromium", "firefox", "safari"]) {
  const name = `web-highlighter-v${version}-${target}.zip`;
  execFileSync("zip", ["-q", "-r", resolve(release, name), "."], {
    cwd: resolve(root, "dist", target),
    stdio: "inherit",
  });
}

const checksums = readdirSync(release)
  .sort()
  .map((name) => {
    const digest = createHash("sha256")
      .update(readFileSync(resolve(release, name)))
      .digest("hex");
    return `${digest}  ${name}`;
  });
writeFileSync(resolve(release, "SHA256SUMS"), `${checksums.join("\n")}\n`);
