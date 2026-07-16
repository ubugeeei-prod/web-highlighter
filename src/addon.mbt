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
fn language_label(language : Language) -> String {
  if language.id == "" { "<empty>" } else { language.id }
}

///|
fn validate_nonempty_strings(
  owner : String,
  field : String,
  values : Array[String],
  errors : Array[String],
) -> Unit {
  for value in values {
    if value == "" {
      errors.push(owner + " has an empty " + field)
    }
  }
}

///|
/// Ensures first-match prefix tables retain longest-prefix semantics.
fn validate_prefixes(
  owner : String,
  field : String,
  values : Array[String],
  errors : Array[String],
) -> Unit {
  validate_nonempty_strings(owner, field, values, errors)
  for index in 0..<values.length() {
    if values[index] == "" {
      continue
    }
    for later in (index + 1)..<values.length() {
      if values[later].has_prefix(values[index]) {
        errors.push(owner + " " + field + " must put longer prefixes first")
      }
    }
  }
}

///|
fn validate_delimiters(
  owner : String,
  field : String,
  delimiters : Array[Delimiter],
  errors : Array[String],
) -> Unit {
  for index in 0..<delimiters.length() {
    let delimiter_ = delimiters[index]
    if delimiter_.open == "" || delimiter_.close == "" {
      errors.push(owner + " has an empty " + field + " delimiter")
      continue
    }
    for later in (index + 1)..<delimiters.length() {
      if delimiters[later].open.has_prefix(delimiter_.open) {
        errors.push(owner + " " + field + " must put longer delimiters first")
      }
    }
  }
}

///|
/// Validates fields whose bad values would otherwise make detection ambiguous
/// or make a declared lexical rule unreachable.
fn validate_language_shape(language : Language, errors : Array[String]) -> Unit {
  let owner = "language " + language_label(language)
  if language.id == "" {
    errors.push("language id must not be empty")
  } else if language.id.to_lower() != language.id {
    errors.push(owner + " id must be lowercase")
  }
  if language.name == "" {
    errors.push(owner + " name must not be empty")
  }
  if language.aliases.length() == 0 {
    errors.push(owner + " must declare an alias")
  }
  validate_nonempty_strings(owner, "alias", language.aliases, errors)
  validate_nonempty_strings(owner, "extension", language.extensions, errors)
  validate_nonempty_strings(owner, "filename", language.filenames, errors)
  for alias_ in language.aliases {
    if alias_.to_lower() != alias_ {
      errors.push(owner + " alias must be lowercase: " + alias_)
    }
  }
  for extension in language.extensions {
    if extension.to_lower() != extension || extension.has_prefix(".") {
      errors.push(owner + " extension must be lowercase without a dot: " + extension)
    }
  }
  for fingerprint in language.signatures {
    if fingerprint.text == "" || fingerprint.weight <= 0 {
      errors.push(owner + " signatures require non-empty text and positive weight")
    }
  }
  for declaration in language.declarations {
    if !language.keywords.contains(declaration.0) {
      errors.push(owner + " declaration is not a keyword: " + declaration.0)
    }
  }
  validate_prefixes(owner, "line comments", language.line_comments, errors)
  validate_delimiters(owner, "block comment", language.block_comments, errors)
  validate_delimiters(owner, "string", language.strings, errors)
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
    validate_language_shape(language, errors)
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
    if theme_.id == "" {
      errors.push("theme id must not be empty")
    } else if theme_.id.to_lower() != theme_.id {
      errors.push("theme " + theme_.id + " id must be lowercase")
    }
    if theme_.name == "" {
      errors.push("theme " + theme_.id + " name must not be empty")
    }
    match theme_ids.get(theme_.id) {
      Some(_) => errors.push("duplicate theme id: " + theme_.id)
      None => theme_ids[theme_.id] = true
    }
  }
  errors
}
