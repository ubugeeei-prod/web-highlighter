///|
/// Advances a deterministic pseudo-random state for reproducible fuzz tests.
///
/// The constants are intentionally small: this is a CI fuzz corpus generator,
/// not a cryptographic source. Keeping it pure MoonBit makes every generated
/// snippet replayable from the failing seed printed by the test runner.
fn fuzz_step(state : Int) -> Int {
  (state * 73 + 41) % 9973
}

///|
/// Picks a non-negative bucket without depending on runtime randomness.
fn fuzz_pick(state : Int, count : Int) -> Int {
  let value = if state < 0 { 0 - state } else { state }
  value % count
}

///|
/// Selects one language-owned fragment for a generated snippet.
///
/// Every branch consumes the declarative `Language` tables used by production:
/// keywords, types, constants, comments, declarations, and generic identifiers.
/// That keeps the fuzz corpus catalog-shaped instead of hardcoding one syntax.
fn fuzz_piece(language : Language, state : Int) -> String {
  let bucket = fuzz_pick(state, 12)
  if bucket < 2 && language.keywords.length() > 0 {
    language.keywords[fuzz_pick(state, language.keywords.length())]
  } else if bucket < 4 && language.types.length() > 0 {
    language.types[fuzz_pick(state, language.types.length())]
  } else if bucket < 5 && language.constants.length() > 0 {
    language.constants[fuzz_pick(state, language.constants.length())]
  } else if bucket < 6 && language.functions.length() > 0 {
    language.functions[fuzz_pick(state, language.functions.length())]
  } else if bucket < 7 && language.properties.length() > 0 {
    language.properties[fuzz_pick(state, language.properties.length())]
  } else if bucket < 8 && language.line_comments.length() > 0 {
    language.line_comments[0] + " fuzz comment"
  } else if bucket < 9 && language.declarations.length() > 0 {
    language.declarations[fuzz_pick(state, language.declarations.length())].0
  } else if bucket < 10 {
    "name_" + state.to_string()
  } else if bucket < 11 {
    "42"
  } else {
    "{ }"
  }
}

///|
/// Builds a bounded source sample from a single built-in language definition.
///
/// Newlines are part of the generator because several proved scanner and
/// renderer invariants depend on line-count and segment-boundary arithmetic.
fn fuzz_source(language : Language, seed : Int) -> String {
  let builder = StringBuilder()
  let mut state = seed
  for _ in 0..<64 {
    state = fuzz_step(state)
    builder.write_string(fuzz_piece(language, state))
    if fuzz_pick(state, 5) == 0 {
      builder.write_char('\n')
    } else {
      builder.write_char(' ')
    }
  }
  builder.to_string()
}

///|
/// Fuzzes the declarative scanner against every built-in language.
///
/// The oracle is the same executable invariant used by targeted scanner tests:
/// tokens must be bounded, non-empty, ordered, and references/definitions must
/// never escape the source. This catches catalog additions that accidentally
/// introduce delimiter or identifier combinations the scanner cannot order.
test "fuzz built-in language analysis invariants" {
  let languages = builtin_languages()
  for seed in 0..<256 {
    let language = languages[fuzz_pick(seed * 17 + 3, languages.length())]
    let source = fuzz_source(language, seed + 1)
    let analysis = analyze(language, source)
    assert_true(analysis_is_bounded(analysis, source.length()))
  }
}

///|
/// Fuzzes the compiled catalog path used by the Wasm browser runtime.
///
/// Explicit aliases should bypass weighted inference, so every generated block
/// must resolve to the selected language and still encode a valid wire prefix.
test "fuzz compiled catalog request stays bounded and selectable" {
  let languages = builtin_languages()
  let catalog = compile_catalog(languages)
  for seed in 0..<160 {
    let language = languages[fuzz_pick(seed * 31 + 11, languages.length())]
    let source = fuzz_source(language, seed + 99)
    let selected = detect_compiled_language(catalog, source, language.id, "")
    assert_true(
      selected.map(fn(item) { item.language.id }) == Some(language.id),
    )
    assert_true(
      analyze_compiled_catalog_request(catalog, source, language.id, "").has_prefix(
        "L\t" + language.id + "\n",
      ),
    )
  }
}
