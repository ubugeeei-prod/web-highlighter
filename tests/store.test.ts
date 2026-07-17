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

function listingSummary(listing: string, localeHeading: string): string {
  const marker = `## ${localeHeading}\n\n### Summary\n\n`;
  const start = listing.indexOf(marker);
  assert(start >= 0, `missing ${localeHeading} summary`);
  return listing.slice(start + marker.length).split("\n", 1)[0]!;
}

test("AMO metadata contains the first-submission contract", async () => {
  const [metadataSource, listing] = await Promise.all([
    readFile(new URL("store/amo-metadata.json", root), "utf8"),
    readFile(new URL("store/listing.md", root), "utf8"),
  ]);
  const metadata = JSON.parse(metadataSource) as AmoMetadata;

  assert.deepEqual(Object.keys(metadata.summary).sort(), ["en-US", "ja"]);
  assert.equal(metadata.summary["en-US"], listingSummary(listing, "English (United States)"));
  assert.equal(metadata.summary.ja, listingSummary(listing, "Japanese"));
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

  for (const statement of [
    "- Data collection: none.",
    "- Data sale or sharing: none.",
    "- Remote code: none. JavaScript, CSS, themes, language definitions, and Wasm are packaged with the extension.",
  ])
    assert(listing.includes(statement), `listing is missing: ${statement}`);

  const permissionRows = Object.fromEntries(
    listing
      .split("\n")
      .filter((line) => line.startsWith("|") && !line.includes("---"))
      .slice(1)
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      ),
  );
  assert.deepEqual(permissionRows, {
    "`storage`": "Stores only the user's selected theme through the browser synchronization API.",
    "Supported-service host access":
      "Finds and decorates code on GitHub, GitLab, Discord, Slack, and ChatGPT without requiring a click on every visit.",
    "`activeTab`":
      "Reads the active tab only after the user opens the popup to enable another site.",
    "`scripting`":
      "Injects the packaged content script and stylesheet after the user grants access to another site.",
    "Optional `http://*/*` and `https://*/*` host access":
      "Lets the user opt in one additional origin at a time; no optional origin is granted automatically.",
  });

  assert(
    privacy.includes(
      "Web Highlighter does not send code, page contents, browsing history, page URLs, filenames, theme preferences, or permission choices to the developer or to any third party.",
    ),
  );
  assert(privacy.includes("Clearing extension data alone may not revoke host access."));
  assert(
    privacy.includes(
      "Issues are public: do not include personal information, private code, browsing data, credentials, or other confidential material.",
    ),
  );
  assert(reviewerNotes.includes("No source text or browsing data is sent over the network."));
  assert(reviewerNotes.includes("vp run verify"));
  assert(reviewerNotes.includes("vp run package"));
});
