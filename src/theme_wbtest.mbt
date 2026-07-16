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
  assert_true(result.has_prefix("M\tadaptive\n"))
  assert_true(result.contains("C\tbackground\ttransparent\n"))
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
