///|
test "theme add-ons are ordinary immutable MoonBit values" {
  let custom = theme(
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
  )
  assert_true(custom.id == "paper")
  assert_true(custom.keyword == "#aa0000")
}

///|
test "automatic themes follow the system preference" {
  assert_true(theme_wire("auto", false).has_prefix("M\tadaptive\n"))
  assert_true(theme_wire("auto", true).has_prefix("M\tmidnight\n"))
}

///|
test "unknown theme names safely fall back" {
  let result = theme_wire("missing", true)
  assert_true(result.has_prefix("M\tmidnight\n"))
  assert_true(result.contains("C\tbackground\ttransparent\n"))
}

///|
test "explicit light themes are made readable on dark surfaces" {
  let custom = theme(
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
  )
  let result = theme_catalog_wire([custom], "paper", true)
  assert_true(result.has_prefix("M\tpaper\n"))
  assert_true(result.contains("C\tforeground\t#f4f7fb\n"))
  assert_true(result.contains("C\tkeyword\t#ff8f87\n"))
  assert_true(!result.contains("#111111"))
  assert_true(!result.contains("#aa0000"))
}

///|
test "explicit dark themes are made readable on light surfaces" {
  let result = theme_wire("midnight", false)
  assert_true(result.has_prefix("M\tmidnight\n"))
  assert_true(result.contains("C\tforeground\t#24292f\n"))
  assert_true(result.contains("C\tkeyword\t#cf222e\n"))
  assert_true(!result.contains("#f4f7fb"))
}

///|
test "surface-matching custom themes keep their declared colors" {
  let custom = theme(
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
  )
  let result = theme_catalog_wire([custom], "paper", false)
  assert_true(result.has_prefix("M\tpaper\n"))
  assert_true(result.contains("C\tforeground\t#111111\n"))
  assert_true(result.contains("C\tkeyword\t#aa0000\n"))
}

///|
test "theme catalogs expose stable popup metadata" {
  assert_eq(
    theme_list_wire(),
    "T\tadaptive\tAdaptive\t0\nT\tmidnight\tMidnight\t1\n",
  )
}

///|
test "theme catalog fields cannot corrupt record delimiters" {
  let custom = theme(
    id="paper\talt",
    name="Paper\nLight%20",
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
  )
  assert_eq(
    theme_catalog_list_wire([custom]),
    "T\tpaper%09alt\tPaper%0ALight%2520\t0\n",
  )
}
