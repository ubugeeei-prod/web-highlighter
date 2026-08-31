///|
/// Splits a readable space-delimited vocabulary into exact words.
pub fn words(source : String) -> Array[String] {
  let result : Array[String] = []
  for view in source.split(" ") {
    let word = view.to_owned()
    if word != "" {
      result.push(word)
    }
  }
  result
}

///|
/// Declares one weighted literal used for conservative language inference.
pub fn signature(text : String, weight : Int) -> Signature {
  { text, weight, }
}

///|
/// Declares one non-escaping paired lexical region.
pub fn delimiter(open_ : String, close : String) -> Delimiter {
  { open: open_, close, escape: false, }
}

///|
/// Declares a same-marker quoted region with backslash escaping.
pub fn quoted(marker : String) -> Delimiter {
  { open: marker, close: marker, escape: true, }
}

///|
fn language_aliases(id : String, aliases : Array[String]) -> Array[String] {
  let result = [id]
  for item in aliases {
    result.push(item)
  }
  result
}

///|
/// Constructs a language add-on from compact readable vocabularies.
///
/// The first three vocabularies describe syntax classes. Optional
/// `functions` and `properties` are for language-owned helper names that should
/// be highlighted without pretending they are declarations.
pub fn make_language(
  id~ : String,
  name~ : String,
  aliases~ : Array[String],
  extensions~ : Array[String],
  filenames~ : Array[String],
  signatures~ : Array[Signature],
  keywords~ : String,
  types~ : String,
  constants~ : String,
  declarations~ : Array[(String, SymbolKind)],
  line_comments~ : Array[String],
  block_comments~ : Array[Delimiter],
  strings~ : Array[Delimiter],
  operator_chars~ : String,
  identifier_extra~ : String,
  functions? : String = "",
  properties? : String = "",
) -> Language {
  language(
    id~,
    name~,
    aliases=language_aliases(id, aliases),
    extensions~,
    filenames~,
    signatures~,
    keywords=words(keywords),
    types=words(types),
    constants=words(constants),
    functions=words(functions),
    properties=words(properties),
    declarations~,
    line_comments~,
    block_comments~,
    strings~,
    operator_chars~,
    identifier_extra~,
  )
}

///|
fn c_blocks() -> Array[Delimiter] {
  [delimiter("/*", "*/")]
}

///|
fn c_strings() -> Array[Delimiter] {
  [quoted("\""), quoted("'")]
}

///|
/// Returns the built-in injected-language support catalog.
///
/// These entries target languages whose adoption by every upstream service is
/// unlikely or slow. The catalog is product policy, not a generic highlighting
/// library registry. Detection keeps this order, so the groups are concatenated
/// exactly as they are declared.
pub fn builtin_languages() -> Array[Language] {
  let catalog : Array[Language] = []
  for group in [requested_languages(), curated_languages(), notable_languages()] {
    for language in group {
      catalog.push(language)
    }
  }
  catalog
}
