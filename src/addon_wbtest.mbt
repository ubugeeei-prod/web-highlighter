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
