///|
/// Verifies both explicit service hints and filename fallback for one built-in.
fn assert_builtin(
  id : String,
  hint : String,
  filename : String,
  source : String,
) -> Unit raise {
  let catalog = builtin_languages()
  assert_true(
    detect_language(catalog, source, hint, "").map(fn(item) { item.id }) ==
    Some(id),
  )
  assert_true(
    detect_language(catalog, source, "", filename).map(fn(item) { item.id }) ==
    Some(id),
  )
  assert_true(
    analyze_request(source, hint, filename).has_prefix("L\t" + id + "\n"),
  )
}

///|
/// Asserts that a built-in language gives one exact lexeme the expected role.
fn assert_builtin_scope(
  id : String,
  filename : String,
  source : String,
  lexeme : String,
  scope : Scope,
) -> Unit raise {
  let language = detect_language(builtin_languages(), source, id, filename).unwrap()
  let result = analyze(language, source)
  assert_true(analysis_is_bounded(result, source.length()))
  let mut found = false
  for token_ in result.tokens {
    if String::unsafe_substring(
        source,
        start=token_.span.start,
        end=token_.span.end_,
      ) ==
      lexeme &&
      token_.scope == scope {
      found = true
    }
  }
  assert_true(found)
}

///|
test "built-in ids and aliases are unique" {
  let catalog = builtin_languages()
  assert_eq(catalog.length(), 24)
  for index in 0..<catalog.length() {
    assert_true(catalog[index].aliases.length() > 0)
    assert_true(catalog[index].aliases[0] == catalog[index].id)
    for other in (index + 1)..<catalog.length() {
      assert_true(catalog[index].id != catalog[other].id)
      for left in catalog[index].aliases {
        for right in catalog[other].aliases {
          assert_true(left != right)
        }
      }
    }
  }
}

///|
test "built-in catalog satisfies strict add-on validation" {
  assert_eq(validate_language_catalog(builtin_languages()), [])
}

///|
test "Idris support" {
  assert_builtin(
    "idris", "idris2", "Main.idr", "data Tree a = Leaf a | Branch (Tree a) (Tree a)",
  )
}

///|
test "Idris package support" {
  assert_builtin(
    "idris", "idris2", "demo.ipkg", "package demo\nsourcedir = src\nmodules = Main\ndepends = contrib",
  )
}

///|
test "MoonBit mbtx mbti and mbtp support" {
  assert_builtin(
    "moonbit", "mbtx", "tool.mbtx", "///|\npub fn main { println(\"ok\") }",
  )
  assert_builtin(
    "moonbit", "mbti", "lib.mbti", "pub fn render(input : String) -> Unit",
  )
  assert_builtin(
    "moonbit", "mbtp", "bounds.mbtp", "pub predicate bounded(x : Int) { x >= 0 }",
  )
  assert_builtin_scope(
    "moonbit",
    "proof.mbtp",
    "pub predicate safe(x : Int) { proof_require }",
    "predicate",
    Keyword,
  )
  assert_builtin_scope(
    "moonbit",
    "proof.mbt",
    "pub fn checked() -> Unit where { proof_ensure: result => true } { () }",
    "proof_ensure",
    Keyword,
  )
}

///|
test "Vibe support" {
  assert_builtin(
    "vibe", "vibe-lang", "main.vibex", "fn main with Console { println(\"42\") }",
  )
  assert_builtin(
    "vibe",
    "vpkg",
    "lib/@vibe/ast/index.vpkg",
    "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }\nfn type_param_key(name: String) -> String",
  )
  assert_builtin_scope(
    "vibe",
    "main.vibex",
    "fn main with Console { println(\"42\") }",
    "println",
    Function,
  )
  assert_builtin_scope(
    "vibe",
    "main.vibex",
    "fn safe_div(a: Int, b: Int) -> Int with Exception[String] { throw(\"x\") }",
    "Exception",
    Type,
  )
  assert_builtin_scope(
    "vibe",
    "main.vibex",
    "fn main with Console { handle { Throw(\"x\") } }",
    "Throw",
    Constant,
  )
}

///|
test "Veryl support" {
  assert_builtin(
    "veryl",
    "veryl",
    "rtl/DataSelector.veryl",
    "module DataSelector #(param Width: u32 = 8) (i_clk: input clock, o_data: output logic<Width>) { always_ff { if_reset { o_data = 0; } } }",
  )
  assert_builtin_scope(
    "veryl",
    "rtl/DataSelector.veryl",
    "module DataSelector #(param Width: u32 = 8) (i_clk: input clock) { always_ff { if_reset {} } }",
    "module",
    Keyword,
  )
  assert_builtin_scope(
    "veryl",
    "rtl/DataSelector.veryl",
    "module DataSelector #(param Width: u32 = 8) (i_clk: input clock) { always_ff { if_reset {} } }",
    "DataSelector",
    Type,
  )
  assert_builtin_scope(
    "veryl",
    "rtl/DataSelector.veryl",
    "module DataSelector #(param Width: u32 = 8) (i_clk: input clock, o_data: output logic<Width>) { always_ff { if_reset {} } }",
    "logic",
    Type,
  )
  assert_builtin_scope(
    "veryl",
    "rtl/PackageA.veryl",
    "package PackageA { function FuncA(a: input logic<8>) -> logic<8> { return a + 1; } }",
    "FuncA",
    Function,
  )
}

///|
test "tNix support" {
  assert_builtin(
    "tnix", "tnix", "flake.tnix", "let value: String = builtins.toString 1; in value",
  )
  assert_builtin_scope(
    "tnix",
    "main.tnix",
    "type Option a = { _tag :: \"some\"; value :: a; }",
    "Option",
    Type,
  )
  assert_builtin_scope(
    "tnix",
    "main.tnix",
    "# @tnix-expected\nlet x = true; in x",
    "true",
    Constant,
  )
  assert_builtin_scope(
    "tnix",
    "types.tnix",
    "declare \"./flake.nix\" { default :: Derivation; };",
    "Derivation",
    Type,
  )
}

///|
test "mbtv support" {
  assert_builtin(
    "mbtv", "mbtv", "App.mbtv", "<script>let props = defineProps()</script><template><input v-model=\"name\" /></template>",
  )
  assert_builtin_scope(
    "mbtv",
    "App.mbtv",
    "<script>let props = defineProps()</script>",
    "defineProps",
    Function,
  )
  assert_builtin_scope(
    "mbtv",
    "App.mbtv",
    "<template><input v-model=\"name\" /></template>",
    "v-model",
    Property,
  )
  assert_builtin_scope(
    "mbtv",
    "App.mbtv",
    "<template><component :is=\"view\" v-on:save=\"save\" /></template>",
    "v-on",
    Property,
  )
}

///|
test "Mojo support" {
  assert_builtin(
    "mojo", "mojo", "main.mojo", "fn main() raises:\n  var lane = SIMD[Int, 4](0)",
  )
}

///|
test "Gleam support" {
  assert_builtin(
    "gleam", "gleam", "main.gleam", "pub fn main() { io.println(\"hello\") }",
  )
}

///|
test "Roc support" {
  assert_builtin(
    "roc", "roc", "Main.roc", "app [main] { pf: platform \"https://example\" }",
  )
}

///|
test "Typst support" {
  assert_builtin(
    "typst", "typst", "paper.typ", "#set text(font: \"Inter\")\n= Heading",
  )
}

///|
test "Nushell support" {
  assert_builtin(
    "nushell", "nu", "tool.nu", "def greet [name: string] { print $name }",
  )
}

///|
test "Lean 4 support" {
  assert_builtin(
    "lean4", "lean", "Main.lean", "theorem identity (n : Nat) : n = n := by rfl",
  )
}

///|
test "Koka support" {
  assert_builtin(
    "koka", "koka", "main.kk", "fun main() : console () { println(\"hello\") }",
  )
}

///|
test "Nickel support" {
  assert_builtin(
    "nickel", "nickel", "config.ncl", "let Config = { port | Number } in Config",
  )
}

///|
test "Pkl support" {
  assert_builtin(
    "pkl", "pkl", "config.pkl", "amends \"package://example\"\nname = \"demo\"",
  )
}

///|
test "Uiua support" {
  assert_builtin("uiua", "uiua", "main.ua", "Square ← ×.\nSquare 5")
}

///|
test "Zig support" {
  assert_builtin(
    "zig", "zig", "main.zig", "const std = @import(\"std\");\npub fn main() !void {}",
  )
  assert_builtin_scope(
    "zig",
    "main.zig",
    "const std = @import(\"std\");",
    "@import",
    Function,
  )
  assert_builtin_scope(
    "zig",
    "main.zig",
    "fn total(values: []const usize) usize { return 0; }",
    "usize",
    Type,
  )
  assert_builtin_scope(
    "zig",
    "build.zig",
    "const target = b.standardTargetOptions(.{});",
    "const",
    Keyword,
  )
}

///|
test "V support" {
  assert_builtin(
    "vlang", "vlang", "app.vsh", "module main\n\nfn main() {\n\tmut count := 1\n\tprintln(count)\n}",
  )
  assert_builtin_scope(
    "vlang",
    "app.vsh",
    "struct Point {\n\tx int\n\ty int\n}",
    "int",
    Type,
  )
  assert_builtin_scope("vlang", "app.vsh", "mut total := 0", "mut", Keyword)
}

///|
test "Just support" {
  assert_builtin(
    "just", "just", "justfile", "set dotenv-load := true\n\nbuild:\n\tcargo build --release",
  )
  assert_builtin_scope(
    "just",
    "justfile",
    "set dotenv-load := true",
    "dotenv-load",
    Property,
  )
  assert_builtin_scope(
    "just",
    "justfile",
    "root := justfile_directory()",
    "justfile_directory",
    Function,
  )
}

///|
test "Carbon support" {
  assert_builtin(
    "carbon", "carbon", "main.carbon", "package Sample api;\n\nfn Main() -> i32 {\n  return 0;\n}",
  )
  assert_builtin_scope(
    "carbon",
    "main.carbon",
    "fn Main() -> i32 { return 0; }",
    "Main",
    Function,
  )
  assert_builtin_scope(
    "carbon",
    "main.carbon",
    "fn Sum(a: i32, b: i32) -> i32 { return a + b; }",
    "i32",
    Type,
  )
}

///|
test "Slint support" {
  assert_builtin(
    "slint", "slint", "ui.slint", "component Badge inherits Rectangle {\n  in property <string> label;\n}",
  )
  assert_builtin_scope(
    "slint",
    "ui.slint",
    "component Badge inherits Rectangle {}",
    "Badge",
    Type,
  )
  assert_builtin_scope(
    "slint",
    "ui.slint",
    "in property <string> label;",
    "string",
    Type,
  )
  assert_builtin_scope(
    "slint",
    "ui.slint",
    "callback clicked();",
    "clicked",
    Function,
  )
}

///|
test "Odin support" {
  assert_builtin(
    "odin", "odin", "main.odin", "package main\n\nimport \"core:fmt\"\n\nmain :: proc() {\n\tfmt.println(\"ok\")\n}",
  )
  assert_builtin_scope(
    "odin",
    "main.odin",
    "main :: proc() {}",
    "proc",
    Keyword,
  )
  assert_builtin_scope("odin", "main.odin", "value: f32 = 1.5", "f32", Type)
}

///|
test "PureScript support" {
  assert_builtin(
    "purescript", "purs", "Main.purs", "module Main where\n\nmain :: Effect Unit\nmain = pure unit",
  )
  assert_builtin_scope(
    "purescript",
    "Main.purs",
    "main :: Effect Unit",
    "Effect",
    Type,
  )
  assert_builtin_scope(
    "purescript",
    "Main.purs",
    "data Tree a = Leaf a | Node (Tree a) (Tree a)",
    "Tree",
    Type,
  )
}

///|
test "ReScript support" {
  assert_builtin(
    "rescript", "res", "App.res", "let greet = (name: string) => \"hi \" ++ name",
  )
  assert_builtin_scope(
    "rescript",
    "App.res",
    "let greet = (name: string) => name",
    "string",
    Type,
  )
  assert_builtin_scope(
    "rescript",
    "App.resi",
    "type point = {x: int, y: int}",
    "point",
    Type,
  )
}
