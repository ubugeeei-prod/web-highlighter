///|
test "the production analyzer composes only valid add-ons" {
  assert_eq(@core.validate_addons(configured_addons), [])
}
