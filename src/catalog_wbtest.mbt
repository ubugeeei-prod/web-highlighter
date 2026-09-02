///|
/// Verifies both explicit service hints and filename fallback for one built-in.
fn assert_builtin(
  id : String,
  hint : String,
  filename : String,
  source : String,
) -> Unit raise {
  let catalog = builtin_languages()
  assert_true(
    detect_language(catalog, source, hint, "").map(fn(item) { item.id }) ==
    Some(id),
  )
  assert_true(
    detect_language(catalog, source, "", filename).map(fn(item) { item.id }) ==
    Some(id),
  )
  assert_true(
    analyze_request(source, hint, filename).has_prefix("L\t" + id + "\n"),
  )
}

///|
/// Asserts that a built-in language gives one exact lexeme the expected role.
fn assert_builtin_scope(
  id : String,
  filename : String,
  source : String,
  lexeme : String,
  scope : Scope,
) -> Unit raise {
  let language = detect_language(builtin_languages(), source, id, filename).unwrap()
  let result = analyze(language, source)
  assert_true(analysis_is_bounded(result, source.length()))
  let mut found = false
  for token_ in result.tokens {
    if String::unsafe_substring(
        source,
        start=token_.span.start,
        end=token_.span.end_,
      ) ==
      lexeme &&
      token_.scope == scope {
      found = true
    }
  }
  assert_true(found)
}

///|
test "built-in ids and aliases are unique" {
  let catalog = builtin_languages()
  assert_eq(catalog.length(), 25)
  for index in 0..<catalog.length() {
    assert_true(catalog[index].aliases.length() > 0)
    assert_true(catalog[index].aliases[0] == catalog[index].id)
    for other in (index + 1)..<catalog.length() {
      assert_true(catalog[index].id != catalog[other].id)
      for left in catalog[index].aliases {
        for right in catalog[other].aliases {
          assert_true(left != right)
        }
      }
    }
  }
}

///|
test "built-in catalog source groups are explicit and ordered" {
  let requested = builtin_requested_languages()
  let curated = builtin_curated_languages()
  let notable = builtin_notable_languages()
  let catalog = builtin_languages()
  assert_eq(
    catalog.length(),
    requested.length() + curated.length() + notable.length(),
  )
  assert_eq(requested.length(), 7)
  assert_eq(curated.length(), 10)
  assert_eq(notable.length(), 8)
  assert_eq(catalog[0].id, requested[0].id)
  assert_eq(catalog[requested.length()].id, curated[0].id)
  assert_eq(catalog[requested.length() + curated.length()].id, notable[0].id)
}

///|
test "built-in catalog satisfies strict add-on validation" {
  assert_eq(validate_language_catalog(builtin_languages()), [])
}
