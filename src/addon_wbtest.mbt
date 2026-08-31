///|
fn example_addon() -> Addon {
  addon(
    languages=[
      make_language(
        id="quill",
        name="Quill",
        aliases=["ql"],
        extensions=["ql"],
        filenames=[],
        signatures=[signature("quill.module", 3)],
        keywords="fn let",
        types="Int String",
        constants="false true",
        declarations=[("fn", FunctionSymbol), ("let", VariableSymbol)],
        line_comments=["//"],
        block_comments=[delimiter("/*", "*/")],
        strings=[quoted("\"")],
        operator_chars="+-=",
        identifier_extra="$",
      ),
    ],
    themes=[
      theme(
        id="paper",
        name="Paper",
        dark=false,
        foreground="#111111",
        background="#ffffff",
        selection="#dddddd",
        keyword="#aa0000",
        type_="#660099",
        constant="#004488",
        string="#006600",
        number="#004488",
        comment="#777777",
        operator="#aa0000",
        function_="#660099",
        variable="#111111",
        property="#994400",
        punctuation="#555555",
      ),
    ],
  )
}

///|
test "add-ons compose language and theme catalogs without callbacks" {
  let contribution = example_addon()
  assert_eq(validate_addons([contribution]), [])
  let languages = addon_languages([contribution])
  let themes = addon_themes([contribution])
  assert_eq(languages.length(), builtin_languages().length() + 1)
  assert_eq(themes.length(), builtin_themes().length() + 1)
  assert_true(
    analyze_catalog_request(languages, "fn write()", "", "note.ql").has_prefix(
      "L\tquill\n",
    ),
  )
  assert_true(
    theme_catalog_wire(themes, "paper", false).has_prefix("M\tpaper\n"),
  )
}

///|
test "make_language optional vocabularies compile into exact scopes" {
  let language = make_language(
    id="mini",
    name="Mini",
    aliases=["mini"],
    extensions=["mini"],
    filenames=[],
    signatures=[],
    keywords="fn",
    types="Thing",
    constants="None",
    declarations=[("fn", FunctionSymbol)],
    line_comments=["//"],
    block_comments=[],
    strings=[quoted("\"")],
    operator_chars="+-=",
    identifier_extra="",
    functions="trace",
    properties="std",
  )
  assert_eq(validate_addons([addon(languages=[language], themes=[])]), [])
  let source = "fn trace() -> Thing { std::trace(None) }"
  let analysis = analyze(language, source)
  assert_true(analysis_is_bounded(analysis, source.length()))
  assert_eq(analysis.definitions.length(), 1)
  assert_eq(analysis.definitions[0].name, "trace")
  assert_true(
    analysis.tokens.map(fn(token_) { token_.scope }).contains(Property),
  )
}

///|
test "add-on validation reports shadowed language and theme identities" {
  let errors = validate_addons([example_addon(), example_addon()])
  assert_true(errors.contains("duplicate language id: quill"))
  assert_true(errors.contains("duplicate theme id: paper"))
}

///|
test "an empty explicit theme catalog falls back safely" {
  assert_true(
    theme_catalog_wire([], "missing", true).has_prefix("M\tadaptive\n"),
  )
}

///|
test "add-on validation rejects unreachable and ambiguous declarations" {
  let malformed = make_language(
    id="Bad",
    name="",
    aliases=["", "MixedCase"],
    extensions=[".BAD", ""],
    filenames=[""],
    signatures=[signature("", 0)],
    keywords="fn",
    types="",
    constants="",
    declarations=[("missing", FunctionSymbol)],
    line_comments=["/", "//", ""],
    block_comments=[delimiter("", "*/")],
    strings=[delimiter("\"", "")],
    operator_chars="",
    identifier_extra="",
  )
  let errors = validate_addons([addon(languages=[malformed], themes=[])])
  assert_eq(errors, [
    "language Bad id must be lowercase", "language Bad name must not be empty", "language Bad has an empty alias",
    "language Bad has an empty extension", "language Bad has an empty filename",
    "language Bad alias must be lowercase: Bad", "language Bad alias must be lowercase: MixedCase",
    "language Bad extension must be lowercase without a dot: .BAD", "language Bad signatures require non-empty text and positive weight",
    "language Bad declaration is not a keyword: missing", "language Bad has an empty line comments",
    "language Bad line comments must put longer prefixes first", "language Bad has an empty block comment delimiter",
    "language Bad has an empty string delimiter",
  ])
}

///|
test "add-on validation rejects duplicate and overlapping vocabulary" {
  let malformed = language(
    id="overlap",
    name="Overlap",
    aliases=["overlap"],
    extensions=[],
    filenames=[],
    signatures=[],
    keywords=["fn", "fn", "Unit"],
    types=["Unit", "value"],
    constants=["value"],
    functions=["print"],
    properties=["print"],
    declarations=[("fn", FunctionSymbol), ("fn", FunctionSymbol)],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  let errors = validate_addons([addon(languages=[malformed], themes=[])])
  assert_true(errors.contains("language overlap has duplicate keyword: fn"))
  assert_true(
    errors.contains("language overlap word Unit is both keyword and type"),
  )
  assert_true(
    errors.contains("language overlap word value is both type and constant"),
  )
  assert_true(
    errors.contains("language overlap word print is both function and property"),
  )
  assert_true(errors.contains("language overlap has duplicate declaration: fn"))
}

///|
test "add-on validation rejects empty exact vocabulary entries" {
  let malformed = language(
    id="emptywords",
    name="Empty Words",
    aliases=["emptywords"],
    extensions=[],
    filenames=[],
    signatures=[],
    keywords=[""],
    types=[""],
    constants=[""],
    functions=[""],
    properties=[""],
    declarations=[],
    line_comments=[],
    block_comments=[],
    strings=[],
    operator_chars="",
    identifier_extra="",
  )
  let errors = validate_addons([addon(languages=[malformed], themes=[])])
  assert_true(errors.contains("language emptywords has an empty keyword"))
  assert_true(errors.contains("language emptywords has an empty type"))
  assert_true(errors.contains("language emptywords has an empty constant"))
  assert_true(errors.contains("language emptywords has an empty function"))
  assert_true(errors.contains("language emptywords has an empty property"))
}
