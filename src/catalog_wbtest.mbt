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
test "built-in ids and aliases are unique" {
  let catalog = builtin_languages()
  assert_eq(catalog.length(), 16)
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
test "Idris support" {
  assert_builtin(
    "idris", "idris2", "Main.idr", "data Tree a = Leaf a | Branch (Tree a) (Tree a)",
  )
}

///|
test "Idris package support" {
  assert_builtin(
    "idris",
    "idris2",
    "demo.ipkg",
    "package demo\nsourcedir = src\nmodules = Main\ndepends = contrib",
  )
}

///|
test "MoonBit and mbtx support" {
  assert_builtin(
    "moonbit", "mbtx", "tool.mbtx", "///|\npub fn main { println(\"ok\") }",
  )
}

///|
test "Vibe support" {
  assert_builtin(
    "vibe", "vibe-lang", "main.vibe", "let rec visit = fn(value) { value }",
  )
}

///|
test "tNix support" {
  assert_builtin(
    "tnix", "tnix", "flake.tnix", "let value: String = builtins.toString 1; in value",
  )
}

///|
test "ush support" {
  assert_builtin(
    "ush", "ush", "control_flow.ush", "fn greet(name: String) -> String { name }",
  )
}

///|
test "mbtv support" {
  assert_builtin(
    "mbtv", "mbtv", "App.mbtv", "<template><div>{message}</div></template>",
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
