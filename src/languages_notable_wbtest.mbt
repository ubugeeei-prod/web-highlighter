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
