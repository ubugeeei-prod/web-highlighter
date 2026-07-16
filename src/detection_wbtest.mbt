///|
test "explicit aliases win over inference" {
  let languages = builtin_languages()
  let detected = detect_language(languages, "plain", "language-mbtx", "")
  assert_true(detected.map(fn(item) { item.id }) == Some("moonbit"))
}

///|
test "custom project extensions are recognized" {
  let languages = builtin_languages()
  assert_true(
    detect_language(languages, "let x = 1", "", "examples/sample.tnix").map(fn(
      item,
    ) {
      item.id
    }) ==
    Some("tnix"),
  )
  assert_true(
    detect_language(languages, "<template />", "", "basic.mbtv").map(fn(item) {
      item.id
    }) ==
    Some("mbtv"),
  )
}

///|
test "weighted signatures recover discarded fence metadata" {
  let languages = builtin_languages()
  assert_true(
    detect_language(
      languages, "fn main() raises:\n  var x = SIMD[Int, 4](0)", "", "",
    ).map(fn(item) { item.id }) ==
    Some("mojo"),
  )
  assert_true(
    detect_language(languages, "ordinary prose with let", "", "") is None,
  )
}

///|
test "theme selection and colors are emitted by MoonBit" {
  let dark = theme_wire("auto", true)
  assert_true(dark.has_prefix("M\tmidnight\n"))
  assert_true(dark.contains("C\tkeyword\t#ff7b72"))
  let light = theme_wire("adaptive", true)
  assert_true(light.has_prefix("M\tadaptive\n"))
}
