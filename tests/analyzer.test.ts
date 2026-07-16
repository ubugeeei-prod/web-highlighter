import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../extension/src/analyzer.ts";
import { builtinLanguages } from "../plugins/builtin/catalog.ts";

const samples: Readonly<Record<string, string>> = {
  idris: "data Maybe a = Nothing | Just a\nmain : IO ()\nmain = putStrLn \"hello\"",
  moonbit: "pub fn answer() -> Int { 42 }\nlet value = answer()",
  vibe: "let rec build: Int -> Int = n -> { if n <= 0 { 0 } else { build(n - 1) } }",
  tnix: "let id :: forall a. a -> a; id = x: x; in id \"hello\"",
  ush: "fn greet(name: String) -> String { \"hello \" + name }\nprint greet(\"web\")",
  mbtv: "<script>\nlet count = signal(0)\n</script>\n<template>{{ count.get() }}</template>",
  mojo: "fn main() raises:\n    var x = SIMD[DType.float32, 4](1)",
  gleam: "pub fn main() { let message = \"hello\" echo message }",
  roc: "app [main] { pf: platform \"basic-cli\" }\nmain = \"hello\"",
  typst: "#set page(width: 10cm)\n#let greet(name) = [Hello #name]",
  nushell: "def --env greet [name: string] { $env.NAME = $name }",
  lean4: "theorem add_zero (n : Nat) : n + 0 = n := by simp",
  koka: "fun main() { println(\"hello\") }\neffect ask { ctl ask(): string }",
  nickel: "let Config = { port | default = 8080 } in Config",
  pkl: "module example\nname: String = \"web\"\nhidden localValue = 42",
  uiua: "Square ← ×.\n≡Square ⇡5",
};

test("every built-in scans representative real syntax without invalid spans", () => {
  for (const language of builtinLanguages) {
    const source = samples[language.id];
    assert(source, `missing sample for ${language.id}`);
    const result = analyze(language, source);
    assert(result.tokens.length > 0, `${language.id} emitted no tokens`);
    let previousEnd = 0;
    for (const token of result.tokens) {
      assert(token.start >= previousEnd, `${language.id} token ranges overlap`);
      assert(token.end > token.start, `${language.id} emitted an empty token`);
      assert(token.end <= source.length, `${language.id} emitted an out-of-bounds token`);
      previousEnd = token.end;
    }
  }
});

test("one scan supplies highlighting, definitions, references, and hover line data", () => {
  const ush = builtinLanguages.find(({ id }) => id === "ush")!;
  const source = "fn greet(name: String) -> String { name }\nprint greet(\"Ada\")";
  const result = analyze(ush, source);
  assert.deepEqual(result.definitions.find(({ name }) => name === "greet"), {
    start: 3,
    end: 8,
    name: "greet",
    kind: "function",
    line: 1,
  });
  assert.deepEqual(result.references.filter(({ name }) => name === "greet"), [
    { start: source.lastIndexOf("greet"), end: source.lastIndexOf("greet") + 5, name: "greet" },
  ]);
});

test("compiled language handles are reusable and deterministic", () => {
  const moonbit = builtinLanguages.find(({ id }) => id === "moonbit")!;
  const source = "fn main { let x = 1 }";
  assert.deepEqual(analyze(moonbit, source), analyze(moonbit, source));
  assert.deepEqual(analyze(moonbit, ""), { tokens: [], definitions: [], references: [] });
});
