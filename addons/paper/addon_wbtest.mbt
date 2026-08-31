///|
test "paper is a valid independently packaged theme contribution" {
  let contribution = contribution()
  assert_eq(@highlight.validate_addons([contribution]), [])
  assert_true(
    @highlight.theme_catalog_list_wire(@highlight.addon_themes([contribution])).contains(
      "T\tpaper\tPaper\t0\n",
    ),
  )
}
