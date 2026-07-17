import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const release = resolve(root, "release");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const names = {
  chrome: `web-highlighter-v${version}-chrome-web-store.zip`,
  edge: `web-highlighter-v${version}-edge-addons.zip`,
  firefox: `web-highlighter-v${version}-firefox-amo.zip`,
  safari: `web-highlighter-v${version}-safari-web-extension.zip`,
  source: `web-highlighter-v${version}-firefox-source.zip`,
};

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function entries(name) {
  return execFileSync("unzip", ["-Z1", resolve(release, name)], { encoding: "utf8" })
    .trim()
    .split("\n");
}

function manifest(name) {
  return JSON.parse(
    execFileSync("unzip", ["-p", resolve(release, name), "manifest.json"], {
      encoding: "utf8",
    }),
  );
}

function digests() {
  return Object.fromEntries(
    readdirSync(release)
      .filter((name) => name.endsWith(".zip"))
      .sort(compareText)
      .map((name) => [
        name,
        createHash("sha256")
          .update(readFileSync(resolve(release, name)))
          .digest("hex"),
      ]),
  );
}

test("store archives are rootless and target-correct", () => {
  assert.deepEqual(
    readdirSync(release).sort(compareText),
    ["SHA256SUMS", ...Object.values(names)].sort(compareText),
  );
  for (const name of Object.values(names)) {
    const archived = entries(name);
    assert.deepEqual(archived, [...archived].sort(compareText));
    assert(!archived.some((path) => path.startsWith("/") || path.includes("../")));
  }

  assert.equal(manifest(names.chrome).background.service_worker, "engine.js");
  assert.equal(manifest(names.edge).background.service_worker, "engine.js");
  assert.deepEqual(manifest(names.firefox).background.scripts, ["engine.js"]);
  assert.equal(manifest(names.safari).manifest_version, 3);
  assert.deepEqual(digests()[names.chrome], digests()[names.edge]);
});

test("the Mozilla source bundle is complete and excludes generated or secret inputs", () => {
  const archived = entries(names.source);
  for (const required of [
    "LICENSE",
    "README.md",
    "flake.lock",
    "flake.nix",
    "moon.mod",
    "package.json",
    "pnpm-lock.yaml",
    "vite.config.ts",
  ])
    assert(archived.includes(required), `source archive is missing ${required}`);
  assert(
    !archived.some(
      (path) =>
        /(^|\/)(?:node_modules|dist|release|\.git)(?:\/|$)/u.test(path) ||
        /(^|\/)\.env(?:\.|$)/u.test(path) ||
        /\.(?:key|p12|pem)$/iu.test(path),
    ),
  );
});

test("checksums cover every archive and a rebuild is byte-for-byte reproducible", () => {
  const first = digests();
  const expectedChecksums = Object.entries(first)
    .map(([name, digest]) => `${digest}  ${name}`)
    .join("\n");
  assert.equal(readFileSync(resolve(release, "SHA256SUMS"), "utf8").trim(), expectedChecksums);

  execFileSync(process.execPath, [resolve(root, "scripts/package.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  assert.deepEqual(digests(), first);
});
