import assert from "node:assert/strict";
import test from "node:test";
import { builtinLanguages } from "../plugins/builtin/catalog.ts";
import { defineLanguage, defineTheme, words } from "../extension/src/plugin-api.ts";

test("words keeps language modules readable and declarative", () => {
  assert.deepEqual(words("  let fn   struct\ntrait "), ["let", "fn", "struct", "trait"]);
});

test("all built-ins have globally unique ids and aliases", () => {
  assert.equal(builtinLanguages.length, 16);
  const ids = builtinLanguages.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  const owners = new Map<string, string>();
  for (const language of builtinLanguages) {
    assert(Object.isFrozen(language));
    assert(Object.isFrozen(language.grammar));
    assert(language.extensions.length > 0 || language.filenames.length > 0);
    for (const alias of language.aliases) {
      const previous = owners.get(alias);
      assert(!previous, `alias ${alias} is shared by ${previous} and ${language.id}`);
      owners.set(alias, language.id);
    }
  }
});

test("language plugins compile to separator-safe immutable tables", () => {
  const language = defineLanguage({
    id: "tiny",
    name: "Tiny",
    aliases: ["tn"],
    extensions: [".tiny"],
    grammar: {
      keywords: ["let", "fn"],
      declarations: { fn: "function" },
      blockComments: [{ open: "/*", close: "*/" }],
      strings: [{ open: "\"", close: "\"" }],
    },
  });
  assert.deepEqual(language.extensions, ["tiny"]);
  assert.equal(language.wire.keywords, "fn\u001flet");
  assert.equal(language.wire.blockComments, "/*\u001e*/");
  assert.throws(() => (language.aliases as string[]).push("bad"), TypeError);
});

test("invalid plugin definitions fail before browser runtime", () => {
  assert.throws(
    () => defineLanguage({ id: "Not Valid", name: "Bad", grammar: {} }),
    /invalid language id/u,
  );
  assert.throws(
    () => defineLanguage({ id: "bad", name: "Bad", aliases: ["x", "x"], grammar: {} }),
    /duplicates/u,
  );
  assert.throws(
    () => defineLanguage({ id: "bad", name: "Bad", grammar: { strings: [{ open: "", close: "\"" }] } }),
    /non-empty/u,
  );
});

test("themes reject CSS injection and freeze colors", () => {
  const colors = Object.fromEntries(
    ["keyword", "type", "constant", "string", "number", "comment", "operator", "function", "variable", "property", "punctuation", "foreground", "background", "selection"].map((name) => [name, "#fff"]),
  ) as Parameters<typeof defineTheme>[0]["colors"];
  const theme = defineTheme({ id: "clean", name: "Clean", dark: false, colors });
  assert(Object.isFrozen(theme.colors));
  assert.throws(() => defineTheme({ ...theme, id: "unsafe", colors: { ...colors, keyword: "red;display:none" } }), /invalid keyword color/u);
});
