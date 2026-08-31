///|
fn sorted_strings(values : Array[String]) -> Array[String] {
  let copied : Array[String] = []
  for value in values {
    copied.push(value)
  }
  copied.sort()
  copied
}

///|
/// Records one ASCII code point in a fixed lookup table.
fn set_ascii(table : FixedArray[Bool], codepoint : Int) -> Unit {
  if codepoint >= 0 && codepoint < table.length() {
    table[codepoint] = true
  }
}

///|
/// Compiles a declarative character list into a branch-light lookup table.
fn compile_codepoint_set(chars : String) -> CodepointSet {
  let ascii = FixedArray::make(128, false)
  let mut cursor = 0
  while cursor < chars.length() {
    let codepoint = codepoint_at(chars, cursor)
    set_ascii(ascii, codepoint)
    cursor = advance_codepoint(chars, cursor)
  }
  { ascii, extra: chars, }
}

///|
/// Adds a scoped identifier only when a higher-precedence class has not already
/// claimed the same word.
fn add_lexeme(
  lexemes : Map[String, Lexeme],
  word : String,
  scope : Scope,
) -> Unit {
  if word != "" && lexemes.get(word) is None {
    lexemes[word] = { scope, declaration: None, }
  }
}

///|
/// Builds one exact-word lookup table with keyword > type > constant >
/// function > property precedence.
///
/// Valid catalogs avoid overlapping vocabulary entirely, but preserving the old
/// precedence makes direct one-off `language(...)` calls deterministic even
/// before validation runs.
fn compile_lexemes(language : Language) -> Map[String, Lexeme] {
  let capacity = language.keywords.length() +
    language.types.length() +
    language.constants.length() +
    language.functions.length() +
    language.properties.length()
  let lexemes : Map[String, Lexeme] = Map([], capacity~)
  for word in language.keywords {
    add_lexeme(lexemes, word, Keyword)
  }
  for word in language.types {
    add_lexeme(lexemes, word, Type)
  }
  for word in language.constants {
    add_lexeme(lexemes, word, Constant)
  }
  for word in language.functions {
    add_lexeme(lexemes, word, Function)
  }
  for word in language.properties {
    add_lexeme(lexemes, word, Property)
  }
  for declaration in language.declarations {
    match lexemes.get(declaration.0) {
      Some(entry) =>
        lexemes[declaration.0] = { ..entry, declaration: Some(declaration.1), }
      None => ()
    }
  }
  lexemes
}

///|
/// Compiles one declarative language for repeated analysis.
///
/// Compilation is intentionally cheap and side-effect free: it sorts nothing
/// that the `language(...)` constructor has already normalized, and it produces
/// only immutable lookup tables consumed by the scanner and detector.
pub fn compile_language(language : Language) -> CompiledLanguage {
  {
    language,
    lexemes: compile_lexemes(language),
    operators: compile_codepoint_set(language.operator_chars),
    identifier_extra: compile_codepoint_set(language.identifier_extra),
  }
}

///|
/// Registers a list of detection names with first-writer-wins semantics.
///
/// `validate_addons` reports collisions separately; keeping this function
/// total lets the runtime remain deterministic even with an invalid catalog.
fn register_index(
  registry : Map[String, Int],
  names : Array[String],
  index : Int,
) -> Unit {
  for name in names {
    if name != "" && registry.get(name) is None {
      registry[name] = index
    }
  }
}

///|
/// Indexes every catalog signature by the code unit it can start at.
fn compile_signatures(languages : Array[Language]) -> CompiledSignatures {
  let entries : Array[CompiledSignature] = []
  let ascii : FixedArray[Array[Int]] = FixedArray::make(128, [])
  for slot in 0..<128 {
    ascii[slot] = []
  }
  let wide : Array[Int] = []
  for index in 0..<languages.length() {
    for fingerprint in languages[index].signatures {
      if fingerprint.text == "" || fingerprint.weight <= 0 {
        continue
      }
      let id = entries.length()
      entries.push({
        text: fingerprint.text,
        weight: fingerprint.weight,
        language: index,
      })
      let first = fingerprint.text[0].to_int()
      if first >= 0 && first < 128 {
        ascii[first].push(id)
      } else {
        wide.push(id)
      }
    }
  }
  { entries, ascii, wide, }
}

///|
/// Compiles a language catalog once for detection and scanning.
pub fn compile_catalog(languages : Array[Language]) -> CompiledCatalog {
  let compiled : Array[CompiledLanguage] = []
  let aliases : Map[String, Int] = Map([])
  let extensions : Map[String, Int] = Map([])
  let filenames : Map[String, Int] = Map([])
  for index in 0..<languages.length() {
    let language = languages[index]
    compiled.push(compile_language(language))
    register_index(aliases, language.aliases, index)
    register_index(extensions, language.extensions, index)
    register_index(filenames, language.filenames, index)
  }
  {
    languages: compiled,
    aliases,
    extensions,
    filenames,
    signatures: compile_signatures(languages),
  }
}

///|
/// Checks whether a compiled codepoint set contains one Unicode scalar value.
fn codepoint_set_contains(set : CodepointSet, codepoint : Int) -> Bool {
  if codepoint >= 0 && codepoint < set.ascii.length() {
    set.ascii[codepoint]
  } else {
    contains_codepoint(set.extra, codepoint)
  }
}

///|
/// Looks up one exact identifier in a compiled language.
fn lexeme_for(language : CompiledLanguage, candidate : String) -> Lexeme? {
  language.lexemes.get(candidate)
}
