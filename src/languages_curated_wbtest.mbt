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
