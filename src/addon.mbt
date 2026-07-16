///|
/// A build-time package contribution containing only declarative values.
///
/// Add-ons cannot receive source callbacks or DOM access. A separate MoonBit
/// package exports this value and the analyzer registry composes it once.
pub struct Addon {
  languages : Array[Language]
  themes : Array[Theme]
}

///|
/// Constructs one declarative language-and-theme contribution.
pub fn addon(
  languages~ : Array[Language],
  themes~ : Array[Theme],
) -> Addon {
  { languages, themes }
}

///|
/// Appends add-on languages after immutable built-ins in package order.
pub fn addon_languages(addons : Array[Addon]) -> Array[Language] {
  let catalog = builtin_languages()
  for contribution in addons {
    for language in contribution.languages {
      catalog.push(language)
    }
  }
  catalog
}

///|
/// Appends add-on themes after immutable built-ins in package order.
pub fn addon_themes(addons : Array[Addon]) -> Array[Theme] {
  let catalog = builtin_themes()
  for contribution in addons {
    for theme_ in contribution.themes {
      catalog.push(theme_)
    }
  }
  catalog
}
