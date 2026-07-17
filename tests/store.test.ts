import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vite-plus/test";

interface AmoMetadata {
  summary: Record<string, string>;
  categories: string[];
  homepage: Record<string, string>;
  version: { license: string };
}

const root = new URL("../", import.meta.url);

test("AMO metadata contains the first-submission contract", async () => {
  const metadata = JSON.parse(
    await readFile(new URL("store/amo-metadata.json", root), "utf8"),
  ) as AmoMetadata;

  assert.deepEqual(Object.keys(metadata.summary).sort(), ["en-US", "ja"]);
  assert(metadata.summary["en-US"]?.length);
  assert(metadata.summary.ja?.length);
  assert(metadata.summary["en-US"]!.length <= 132);
  assert(metadata.summary.ja!.length <= 132);
  assert.deepEqual(metadata.categories, ["other"]);
  assert.equal(metadata.version.license, "MIT");
  assert.equal(metadata.homepage["en-US"], "https://github.com/ubugeeei-prod/web-highlighter");
});

test("store declarations stay aligned with the privacy policy", async () => {
  const [listing, privacy, reviewerNotes] = await Promise.all([
    readFile(new URL("store/listing.md", root), "utf8"),
    readFile(new URL("PRIVACY.md", root), "utf8"),
    readFile(new URL("store/reviewer-notes.md", root), "utf8"),
  ]);

  for (const document of [listing, privacy, reviewerNotes]) {
    assert.match(document, /no remote|remote code|remote executable code/iu);
    assert.match(document, /local|device|端末内/iu);
  }
  for (const permission of ["storage", "activeTab", "scripting", "http", "https"])
    assert.match(listing, new RegExp(`\\b${permission}\\b`, "u"));
  assert.match(listing, /Data collection: none/u);
  assert.match(reviewerNotes, /vp run verify/u);
  assert.match(reviewerNotes, /vp run package/u);
});
