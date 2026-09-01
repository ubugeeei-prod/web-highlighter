///|
test "explicit aliases win over inference" {
  let languages = builtin_languages()
  for hint in ["language-mbtx", "language-mbti", "language-mbtp"] {
    let detected = detect_language(languages, "plain", hint, "")
    assert_true(detected.map(fn(item) { item.id }) == Some("moonbit"))
  }
}

///|
test "explicit hints win over filename and literal evidence" {
  let catalog = compile_catalog(builtin_languages())
  let detected = detect_compiled_language(
    catalog, "<template><input v-model=\"name\" /></template>", "vibe", "App.mbtv",
  )
  assert_true(detected.map(fn(item) { item.language.id }) == Some("vibe"))
  let plan = detect_compiled_plan(
    catalog, "<template><input v-model=\"name\" /></template>", "vibe", "App.mbtv",
  ).unwrap()
  assert_eq(plan.reason, ExplicitHint)
}

///|
test "custom project extensions are recognized" {
  let languages = builtin_languages()
  for filename in ["tool.mbtx", "lib.mbti", "proof.mbtp"] {
    assert_true(
      detect_language(languages, "pub fn main { () }", "", filename).map(fn(
        item,
      ) {
        item.id
      }) ==
      Some("moonbit"),
    )
  }
  assert_true(
    detect_language(languages, "let x = 1", "", "examples/sample.tnix").map(fn(
      item,
    ) {
      item.id
    }) ==
    Some("tnix"),
  )
  assert_true(
    detect_language(languages, "<template />", "", "basic.mbtv").map(fn(item) {
      item.id
    }) ==
    Some("mbtv"),
  )
  assert_true(
    detect_language(
      languages,
      "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }",
      "",
      "lib/@vibe/ast/index.vpkg",
    ).map(fn(item) { item.id }) ==
    Some("vibe"),
  )
  assert_true(
    detect_language(
      languages,
      "module DataSelector { always_ff { if_reset {} } }",
      "",
      "rtl/DataSelector.veryl",
    ).map(fn(item) { item.id }) ==
    Some("veryl"),
  )
}

///|
test "filename matching prefers exact filenames before extensions" {
  let extension_language = language(
    id="lockfile",
    name="Lockfile",
    aliases=["lockfile"],
    extensions=["lock"],
    filenames=[],
    signatures=[],
    keywords=[],
    types=[],
    constants=[],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  let exact_language = language(
    id="flake",
    name="Flake",
    aliases=["flake"],
    extensions=[],
    filenames=["flake.lock"],
    signatures=[],
    keywords=[],
    types=[],
    constants=[],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  let catalog = compile_catalog([extension_language, exact_language])
  assert_true(
    detect_compiled_language(catalog, "{}", "", "flake.lock").map(fn(item) {
      item.language.id
    }) ==
    Some("flake"),
  )
  let plan = detect_compiled_plan(catalog, "{}", "", "flake.lock").unwrap()
  assert_eq(plan.reason, ExactFilename)
}

///|
test "extension detection is case-insensitive at the filename boundary" {
  assert_true(
    detect_language(builtin_languages(), "<template />", "", "App.MBTV").map(fn(
      item,
    ) {
      item.id
    }) ==
    Some("mbtv"),
  )
  assert_true(
    detect_language(
      builtin_languages(),
      "module DataSelector { always_ff {} }",
      "",
      "DataSelector.VERYL",
    ).map(fn(item) { item.id }) ==
    Some("veryl"),
  )
  let plan = detect_compiled_plan(
    compile_catalog(builtin_languages()),
    "<template />",
    "",
    "App.MBTV",
  ).unwrap()
  assert_eq(plan.reason, FilenameExtension)
}

///|
test "compiled catalog indexes explicit hints filenames and extensions" {
  let catalog = compile_catalog(builtin_languages())
  assert_true(
    detect_compiled_language(catalog, "plain", "vibe-lang", "").map(fn(item) {
      item.language.id
    }) ==
    Some("vibe"),
  )
  assert_true(
    detect_compiled_language(catalog, "plain", "", "hello.vibex").map(fn(item) {
      item.language.id
    }) ==
    Some("vibe"),
  )
  assert_true(
    detect_compiled_language(catalog, "plain", "", "lib/@vibe/ast/index.vpkg").map(fn(
      item,
    ) {
      item.language.id
    }) ==
    Some("vibe"),
  )
  assert_true(
    detect_compiled_language(catalog, "plain", "", "rtl/DataSelector.veryl").map(fn(
      item,
    ) {
      item.language.id
    }) ==
    Some("veryl"),
  )
  assert_true(
    detect_compiled_language(catalog, "plain", "", "lib.mbti").map(fn(item) {
      item.language.id
    }) ==
    Some("moonbit"),
  )
  assert_true(
    detect_compiled_language(catalog, "plain", "", "proof.mbtp").map(fn(item) {
      item.language.id
    }) ==
    Some("moonbit"),
  )
  assert_true(
    detect_compiled_language(catalog, "{}", "", "tnix.config.tnix").map(fn(
      item,
    ) {
      item.language.id
    }) ==
    Some("tnix"),
  )
  assert_true(
    detect_compiled_language(catalog, "<template />", "", "App.mbtv").map(fn(
      item,
    ) {
      item.language.id
    }) ==
    Some("mbtv"),
  )
}

///|
test "compiled and declarative detectors agree across target languages" {
  let languages = builtin_languages()
  let catalog = compile_catalog(languages)
  let cases = [
    ("moonbit", "pub predicate safe(x : Int) { x >= 0 }", "mbt", "proof.mbtp"),
    (
      "tnix", "declare \"./flake.nix\" { default :: Derivation; }", "", "types.tnix",
    ),
    (
      "vibe", "fn main with Console { handle { println(\"ok\") } }", "vibe-lang",
      "main.vibex",
    ),
    (
      "vibe",
      "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }",
      "",
      "lib/@vibe/ast/index.vpkg",
    ),
    (
      "veryl",
      "module DataSelector { always_ff { if_reset {} } }",
      "",
      "rtl/DataSelector.veryl",
    ),
    (
      "mbtv", "<script>let props = defineProps()</script><template><input v-model=\"name\" /></template>",
      "", "App.mbtv",
    ),
  ]
  for item in cases {
    let declarative = detect_language(languages, item.1, item.2, item.3).map(fn(
      language,
    ) {
      language.id
    })
    let compiled = detect_compiled_language(catalog, item.1, item.2, item.3).map(fn(
        language,
      ) {
        language.language.id
      },
    )
    assert_eq(declarative, Some(item.0))
    assert_eq(compiled, declarative)
  }
}

///|
test "weighted signatures recover discarded fence metadata" {
  let languages = builtin_languages()
  assert_true(
    detect_language(
      languages, "fn main() raises:\n  var x = SIMD[Int, 4](0)", "", "",
    ).map(fn(item) { item.id }) ==
    Some("mojo"),
  )
  assert_true(
    detect_language(languages, "ordinary prose with let", "", "") is None,
  )
  let catalog = compile_catalog(languages)
  let moonbit_plan = detect_compiled_plan(
    catalog, "///|\npub predicate bounded(x : Int) { x >= 0 }", "", "",
  ).unwrap()
  assert_eq(moonbit_plan.reason, WeightedEvidence)
  assert_eq(moonbit_plan.score, 8)
  assert_eq(moonbit_plan.runner_up, 0)
}

///|
test "Discord unlabelled MoonBit snippets recover from typed function evidence" {
  let source = "pub fn shift_hex(hex : String, amount : Int, shift : Shift) -> String {\n  let digits = strip_hash(hex)\n  if digits.length() != 6 {\n    return hex\n  }\n  let mut out = \"#\"\n  out\n}"
  let plan = detect_compiled_plan(compile_catalog(builtin_languages()), source, "", "").unwrap()
  assert_eq(plan.language.language.id, "moonbit")
  assert_eq(plan.reason, WeightedEvidence)
  assert_eq(plan.score, 6)
  assert_eq(plan.runner_up, 2)
  assert_true(
    @proof.score_is_dominant(
      plan.score, plan.runner_up, inference_threshold(), inference_margin(),
    ),
  )
}

///|
test "Discord unlabelled Vibe package snippets prefer Vibe over MoonBit" {
  let source = "name = @vibe/random\nversion = 0.0.1\ndescription =\n  #|@vibe/random keeps state explicit\ndeps = {}\n\n// import @vibe/random { ... } for scoped imports\nfn seed(seed_value: Int) -> Int\nfn next(state: Int) -> (Int, Int)"
  let plan = detect_compiled_plan(compile_catalog(builtin_languages()), source, "", "").unwrap()
  assert_eq(plan.language.language.id, "vibe")
  assert_eq(plan.reason, WeightedEvidence)
  assert_eq(plan.score, 13)
  assert_eq(plan.runner_up, 1)
  assert_true(
    @proof.score_is_dominant(
      plan.score, plan.runner_up, inference_threshold(), inference_margin(),
    ),
  )
}

///|
test "Rust-shaped snippets without MoonBit spacing stay untouched" {
  let source = "pub fn shift_hex(hex: String, amount: i32) -> String {\n  let mut out = String::new();\n  out\n}"
  assert_true(detect_language(builtin_languages(), source, "", "") is None)
}

///|
test "weak and ambiguous weighted evidence is intentionally untouched" {
  let weak = language(
    id="weak",
    name="Weak",
    aliases=[],
    extensions=[],
    filenames=[],
    signatures=[signature("let ", 1)],
    keywords=[],
    types=[],
    constants=[],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  assert_true(detect_language([weak], "let value = prose", "", "") is None)

  let left = language(
    id="left",
    name="Left",
    aliases=[],
    extensions=[],
    filenames=[],
    signatures=[signature("module ", 3)],
    keywords=[],
    types=[],
    constants=[],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  let right = language(
    id="right",
    name="Right",
    aliases=[],
    extensions=[],
    filenames=[],
    signatures=[signature("module ", 3)],
    keywords=[],
    types=[],
    constants=[],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  assert_true(detect_language([left, right], "module example", "", "") is None)
}

///|
test "theme selection and colors are emitted by MoonBit" {
  let dark = theme_wire("auto", true)
  assert_true(dark.has_prefix("M\tmidnight\n"))
  assert_true(dark.contains("C\tkeyword\t#ff8f87"))
  let light = theme_wire("adaptive", true)
  assert_true(light.has_prefix("M\tadaptive\n"))
}
