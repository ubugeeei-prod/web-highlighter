import assert from "node:assert/strict";
import test from "node:test";
import { detectLanguage } from "../extension/src/detection.ts";
import { builtinLanguages } from "../plugins/builtin/catalog.ts";

test("explicit aliases win across chat services", () => {
  assert.equal(detectLanguage(builtinLanguages, { languageHint: "language-mbtx", source: "anything" })?.id, "moonbit");
  assert.equal(detectLanguage(builtinLanguages, { languageHint: "idris2", source: "anything" })?.id, "idris");
});

test("GitHub filenames identify custom project languages", () => {
  assert.equal(detectLanguage(builtinLanguages, { filename: "examples/basic.mbtv", source: "<template />" })?.id, "mbtv");
  assert.equal(detectLanguage(builtinLanguages, { filename: "sample.tnix", source: "let x = 1; in x" })?.id, "tnix");
  assert.equal(detectLanguage(builtinLanguages, { filename: "task.ush", source: "print 1" })?.id, "ush");
  assert.equal(detectLanguage(builtinLanguages, { filename: "bench.vibe", source: "bench \"x\" {}" })?.id, "vibe");
});

test("literal signatures recover labels discarded by Discord and Slack", () => {
  assert.equal(detectLanguage(builtinLanguages, { source: "fn main() raises:\n  var x = SIMD[Int, 4](0)" })?.id, "mojo");
  assert.equal(detectLanguage(builtinLanguages, { source: "#set page(width: 10cm)" })?.id, "typst");
  assert.equal(detectLanguage(builtinLanguages, { source: "ordinary prose with let once" }), undefined);
});
