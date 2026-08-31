///|
test "the production analyzer composes only valid add-ons" {
  assert_eq(@core.validate_addons(configured_addons), [])
}

///|
test "the production analyzer uses the compiled catalog for bundled add-ons" {
  let ush = analyze_request(
    "fn main() -> Problem!String { std::env::get(\"HOME\") | len }", "ush", "main.ush",
  )
  assert_true(ush.has_prefix("L\tush\n"))
  assert_true(ush.contains("T\t30\t33\tproperty\n"))
  assert_true(ush.contains("T\t54\t57\tfunction\n"))
  let mbtv = analyze_request(
    "<script>let props = defineProps()</script><template><input v-model=\"name\" /></template>",
    "", "App.mbtv",
  )
  assert_true(mbtv.has_prefix("L\tmbtv\n"))
  assert_true(mbtv.contains("T\t20\t31\tfunction\n"))
  assert_true(mbtv.contains("T\t59\t66\tproperty\n"))
  let vpkg = analyze_request(
    "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }",
    "",
    "lib/@vibe/ast/index.vpkg",
  )
  assert_true(vpkg.has_prefix("L\tvibe\n"))
  assert_true(vpkg.contains("D\t29\t37\ttype\t2\n"))
  let veryl = analyze_request(
    "module DataSelector { always_ff { if_reset {} } }",
    "",
    "rtl/DataSelector.veryl",
  )
  assert_true(veryl.has_prefix("L\tveryl\n"))
  assert_true(veryl.contains("D\t7\t19\ttype\t1\n"))
}
