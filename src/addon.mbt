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

///|
/// Reports identity collisions across built-ins and configured add-ons.
///
/// A build should assert that this list is empty. Detection remains ordered and
/// deterministic even for invalid catalogs, but silently shadowed aliases are
/// almost always an authoring mistake.
pub fn validate_addons(addons : Array[Addon]) -> Array[String] {
  let errors : Array[String] = []
  let language_ids : Map[String, Bool] = Map([])
  let language_names : Map[String, String] = Map([])
  for language in addon_languages(addons) {
    match language_ids.get(language.id) {
      Some(_) => errors.push("duplicate language id: " + language.id)
      None => language_ids[language.id] = true
    }
    let names = [language.id]
    for alias_ in language.aliases {
      names.push(alias_)
    }
    for name in names {
      match language_names.get(name) {
        Some(owner) =>
          if owner != language.id {
            errors.push(
              "language name " + name + " is shared by " + owner + " and " + language.id,
            )
          }
        None => language_names[name] = language.id
      }
    }
  }
  let theme_ids : Map[String, Bool] = Map([])
  for theme_ in addon_themes(addons) {
    match theme_ids.get(theme_.id) {
      Some(_) => errors.push("duplicate theme id: " + theme_.id)
      None => theme_ids[theme_.id] = true
    }
  }
  errors
}
