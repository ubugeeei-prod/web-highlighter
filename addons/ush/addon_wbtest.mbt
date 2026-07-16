///|
test "ush package contributes detection, tokens, and symbols" {
  assert_eq(@web.validate_addons([contribution()]), [])
  let catalog = @web.addon_languages([contribution()])
  assert_eq(catalog.length(), @web.builtin_languages().length() + 1)
  let source = "fn greet(name: String) -> String { name }"
  let result = @web.analyze_catalog_request(
    catalog,
    source,
    "ush",
    "control_flow.ush",
  )
  assert_true(result.has_prefix("L\tush\n"))
  assert_true(result.contains("D\t3\t8\tfunction\t1\n"))
}
