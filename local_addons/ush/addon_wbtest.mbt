///|
test "ush package contributes detection, tokens, and symbols" {
  assert_eq(@highlight.validate_addons([contribution()]), [])
  let catalog = @highlight.addon_languages([contribution()])
  assert_eq(catalog.length(), @highlight.builtin_languages().length() + 1)
  let source = "fn greet(name: String) -> String { name }"
  let result = @highlight.analyze_catalog_request(
    catalog, source, "ush", "control_flow.ush",
  )
  assert_true(result.has_prefix("L\tush\n"))
  assert_true(result.contains("D\t3\t8\tfunction\t1\n"))
}

///|
test "ush typed shell vocabulary highlights helpers and std paths" {
  let catalog = @highlight.addon_languages([contribution()])
  let source = "fn main() -> Problem!String { std::env::get(\"HOME\") | len }"
  let result = @highlight.analyze_catalog_request(
    catalog, source, "ush", "main.ush",
  )
  assert_true(result.has_prefix("L\tush\n"))
  assert_true(result.contains("T\t30\t33\tproperty\n"))
  assert_true(result.contains("T\t54\t57\tfunction\n"))
}
