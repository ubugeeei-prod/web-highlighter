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
    "name = @vibe/ast\nexport enum TypeExpr { TyName(String) }", "", "lib/@vibe/ast/index.vpkg",
  )
  assert_true(vpkg.has_prefix("L\tvibe\n"))
  assert_true(vpkg.contains("D\t29\t37\ttype\t2\n"))
  let veryl = analyze_request(
    "module DataSelector { always_ff { if_reset {} } }", "", "rtl/DataSelector.veryl",
  )
  assert_true(veryl.has_prefix("L\tveryl\n"))
  assert_true(veryl.contains("D\t7\t19\ttype\t1\n"))
}

///|
test "the production analyzer recovers Discord blocks with no language metadata" {
  let moonbit = analyze_request(
    "pub fn shift_hex(hex : String, amount : Int, shift : Shift) -> String {\n  let digits = strip_hash(hex)\n  if digits.length() != 6 {\n    return hex\n  }\n}",
    "", "",
  )
  assert_true(moonbit.has_prefix("L\tmoonbit\n"))
  assert_true(moonbit.contains("T\t0\t3\tkeyword\n"))
  assert_true(moonbit.contains("T\t23\t29\ttype\n"))
  let vpkg = analyze_request(
    "name = @vibe/random\nversion = 0.0.1\ndescription =\n  #|@vibe/random keeps state explicit\ndeps = {}\n\n// import @vibe/random { ... } for scoped imports\nfn seed(seed_value: Int) -> Int",
    "", "",
  )
  assert_true(vpkg.has_prefix("L\tvibe\n"))
  assert_true(vpkg.contains("T\t52\t88\tstring\n"))
  assert_true(vpkg.contains("T\t149\t151\tkeyword\n"))
}
