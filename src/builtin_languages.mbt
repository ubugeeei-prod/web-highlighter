///|
/// Returns the built-in injected-language support catalog.
///
/// This is the source entrypoint for bundled language support. The actual
/// declarations live in the adjacent `src/builtin_languages_requested.mbt`,
/// `src/builtin_languages_curated.mbt`, and
/// `src/builtin_languages_notable.mbt` files so adding a language has an
/// obvious owner and review boundary.
///
/// These entries target languages whose adoption by every upstream service is
/// unlikely or slow. The catalog is product policy, not a generic highlighting
/// library registry. Detection keeps this order, so the groups are concatenated
/// exactly as they are declared.
pub fn builtin_languages() -> Array[Language] {
  let catalog : Array[Language] = []
  for
    group in [
      builtin_requested_languages(),
      builtin_curated_languages(),
      builtin_notable_languages(),
    ] {
    for language in group {
      catalog.push(language)
    }
  }
  catalog
}
