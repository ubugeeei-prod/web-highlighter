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
test "MoonBit #| prose is scanned as string text" {
  let source = "let message =\n  #| String predicate proof_require are prose\n  #| Int Option and Result stay prose too\npub fn main { message }"
  let language = detect_language(builtin_languages(), source, "moonbit", "main.mbt").unwrap()
  let result = analyze(language, source)
  assert_analysis_safe(result, source)
  let strings = result.tokens.filter(fn(item) { item.scope == String })
  assert_eq(strings.length(), 2)
  assert_eq(
    token_text(source, strings[0]),
    "#| String predicate proof_require are prose\n",
  )
  assert_eq(
    token_text(source, strings[1]),
    "#| Int Option and Result stay prose too\n",
  )
  assert_true(!contains_scoped_token(result, source, "String", Type))
  assert_true(!contains_scoped_token(result, source, "Int", Type))
  assert_true(!contains_scoped_token(result, source, "Option", Type))
  assert_true(!contains_scoped_token(result, source, "Result", Type))
  assert_true(!contains_scoped_token(result, source, "predicate", Keyword))
  assert_true(!contains_scoped_token(result, source, "proof_require", Keyword))
}

///|
test "MoonBit #| final line stays one string without a trailing newline" {
  let source = "let message =\n#| String predicate proof_require"
  let language = detect_language(builtin_languages(), source, "moonbit", "main.mbt").unwrap()
  let result = analyze(language, source)
  assert_analysis_safe(result, source)
  let strings = result.tokens.filter(fn(item) { item.scope == String })
  assert_eq(strings.length(), 1)
  assert_eq(token_text(source, strings[0]), "#| String predicate proof_require")
  assert_true(!contains_scoped_token(result, source, "String", Type))
  assert_true(!contains_scoped_token(result, source, "predicate", Keyword))
  assert_true(!contains_scoped_token(result, source, "proof_require", Keyword))
}

///|
test "Vibe support" {
  assert_builtin(
    "vibe", "vibe-lang", "main.vibex", "fn main with Console { println(\"42\") }",
  )
  assert_builtin(
    "vibe", "vpkg", "lib/@vibe/ast/index.vpkg", "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }\nfn type_param_key(name: String) -> String",
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
    "veryl", "veryl", "rtl/DataSelector.veryl", "module DataSelector #(param Width: u32 = 8) (i_clk: input clock, o_data: output logic<Width>) { always_ff { if_reset { o_data = 0; } } }",
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
test "mbtv MoonBit #| prose is scanned as string text" {
  let source = "<script>\nlet body =\n#| fn String Option prose\n</script>"
  let language = detect_language(builtin_languages(), source, "mbtv", "App.mbtv").unwrap()
  let result = analyze(language, source)
  assert_analysis_safe(result, source)
  let strings = result.tokens.filter(fn(item) { item.scope == String })
  assert_eq(strings.length(), 1)
  assert_eq(token_text(source, strings[0]), "#| fn String Option prose\n")
  assert_true(!contains_scoped_token(result, source, "fn", Keyword))
  assert_true(!contains_scoped_token(result, source, "String", Type))
  assert_true(!contains_scoped_token(result, source, "Option", Type))
}
