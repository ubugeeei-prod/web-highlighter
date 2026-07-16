///|
test "paper is a valid independently packaged theme contribution" {
  let contribution = contribution()
  assert_eq(@web.validate_addons([contribution]), [])
  assert_true(
    @web.theme_catalog_list_wire(@web.addon_themes([contribution])).contains(
      "T\tpaper\tPaper\t0\n",
    ),
  )
}
