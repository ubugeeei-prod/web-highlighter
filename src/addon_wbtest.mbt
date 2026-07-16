///|
fn example_addon() -> Addon {
  addon(
    languages=[
      make_language(
        "quill",
        "Quill",
        ["ql"],
        ["ql"],
        [],
        [signature("quill.module", 3)],
        "fn let",
        "Int String",
        "false true",
        [("fn", FunctionSymbol), ("let", VariableSymbol)],
        ["//"],
        [delimiter("/*", "*/")],
        [quoted("\"")],
        "+-=",
        "$",
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
  assert_true(theme_catalog_wire(themes, "paper", false).has_prefix("M\tpaper\n"))
}

///|
test "add-on validation reports shadowed language and theme identities" {
  let errors = validate_addons([example_addon(), example_addon()])
  assert_true(errors.contains("duplicate language id: quill"))
  assert_true(errors.contains("duplicate theme id: paper"))
}

///|
test "an empty explicit theme catalog falls back safely" {
  assert_true(theme_catalog_wire([], "missing", true).has_prefix("M\tadaptive\n"))
}

///|
test "add-on validation rejects unreachable and ambiguous declarations" {
  let malformed = make_language(
    "Bad",
    "",
    ["", "MixedCase"],
    [".BAD", ""],
    [""],
    [signature("", 0)],
    "fn",
    "",
    "",
    [("missing", FunctionSymbol)],
    ["/", "//", ""],
    [delimiter("", "*/")],
    [delimiter("\"", "")],
    "",
    "",
  )
  let errors = validate_addons([addon(languages=[malformed], themes=[])])
  assert_eq(
    errors,
    [
      "language Bad id must be lowercase",
      "language Bad name must not be empty",
      "language Bad has an empty alias",
      "language Bad has an empty extension",
      "language Bad has an empty filename",
      "language Bad alias must be lowercase: Bad",
      "language Bad alias must be lowercase: MixedCase",
      "language Bad extension must be lowercase without a dot: .BAD",
      "language Bad signatures require non-empty text and positive weight",
      "language Bad declaration is not a keyword: missing",
      "language Bad has an empty line comments",
      "language Bad line comments must put longer prefixes first",
      "language Bad has an empty block comment delimiter",
      "language Bad has an empty string delimiter",
    ],
  )
}
