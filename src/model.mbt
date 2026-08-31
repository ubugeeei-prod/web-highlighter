///|
/// A semantic token category understood by every bundled theme.
///
/// The deliberately small vocabulary keeps language plugins independent from
/// presentation. A theme can style all languages without knowing their names.
pub enum Scope {
  Keyword
  Type
  Constant
  String
  Number
  Comment
  Operator
  Function
  Variable
  Property
  Punctuation
} derive(Eq, Debug)

///|
/// A source range whose offsets use UTF-16 code units.
///
/// UTF-16 offsets match JavaScript strings and browser DOM APIs, so applying a
/// token never requires an allocation-heavy offset conversion in the content
/// script.
pub struct Span {
  start : Int
  end_ : Int
} derive(Eq, Debug)

///|
/// A semantic token emitted by the scanner.
pub struct Token {
  span : Span
  scope : Scope
} derive(Eq, Debug)

///|
/// A symbol category used by same-file navigation and hover cards.
pub(all) enum SymbolKind {
  FunctionSymbol
  TypeSymbol
  ModuleSymbol
  VariableSymbol
  PropertySymbol
} derive(Eq, Debug)

///|
/// A declared symbol with the range of its name and its one-based line.
pub struct Definition {
  name : String
  span : Span
  kind : SymbolKind
  line : Int
} derive(Eq, Debug)

///|
/// A reference to a declared symbol.
pub struct Reference {
  name : String
  span : Span
} derive(Eq, Debug)

///|
/// The complete, immutable result of one source scan.
pub struct Analysis {
  tokens : Array[Token]
  definitions : Array[Definition]
  references : Array[Reference]
} derive(Eq, Debug)

///|
/// Explicit runtime limits for one source analysis.
///
/// Large hosted blobs can contain millions of code units or identifiers. The
/// scanner uses this value object to reject oversized input early and cap every
/// untrusted output array without consulting the browser host. The proof
/// package defines the arithmetic predicates behind these checks.
pub struct ScannerBudget {
  max_source_units : Int
  max_tokens : Int
  max_symbols : Int
  max_reference_candidates : Int
} derive(Eq, Debug)

///|
/// A paired delimiter used for comments or quoted strings.
pub struct Delimiter {
  open : String
  close : String
  escape : Bool
} derive(Eq, Debug)

///|
/// A literal language fingerprint used when a service discards fence metadata.
pub struct Signature {
  text : String
  weight : Int
} derive(Eq, Debug)

///|
/// A declarative language definition consumed by the scanner.
///
/// Plugins describe vocabulary, built-in helpers, and lexical regions only.
/// They never receive callbacks and cannot run code while a page is being
/// highlighted. This makes plugin cost predictable and keeps the extension
/// compatible with Manifest V3.
pub struct Language {
  id : String
  name : String
  aliases : Array[String]
  extensions : Array[String]
  filenames : Array[String]
  signatures : Array[Signature]
  keywords : Array[String]
  types : Array[String]
  constants : Array[String]
  functions : Array[String]
  properties : Array[String]
  declarations : Array[(String, SymbolKind)]
  line_comments : Array[String]
  block_comments : Array[Delimiter]
  strings : Array[Delimiter]
  operator_chars : String
  identifier_extra : String
}

///|
/// A compiled lexical table entry for one exact identifier.
///
/// The declarative DSL keeps keywords, types, constants, and declaration
/// introducers separate for author readability. The scanner consumes this
/// merged form so every identifier needs one hash lookup on the hot path.
pub(all) struct Lexeme {
  scope : Scope
  declaration : SymbolKind?
} derive(Eq, Debug)

///|
/// A compact membership table for operator and identifier-extra code points.
///
/// ASCII membership is a direct indexed lookup. Non-ASCII entries stay in their
/// original string so experimental languages can still declare symbols such as
/// Uiua glyphs or Greek Lean identifiers without a large table.
pub(all) struct CodepointSet {
  ascii : FixedArray[Bool]
  extra : String
}

///|
/// A language definition compiled for repeated scans.
///
/// Add-on authors still export ordinary `Language` values. The analyzer builds
/// this indexed representation once at startup, keeping DOM-triggered rescans
/// independent from catalog size and declaration-table length.
pub struct CompiledLanguage {
  language : Language
  lexemes : Map[String, Lexeme]
  operators : CodepointSet
  identifier_extra : CodepointSet
}

///|
/// A compiled language catalog with first-match indexes for detection.
///
/// The immutable source order remains the tie-breaker for signatures, while
/// explicit hints, filenames, and extensions avoid repeated catalog walks.
pub struct CompiledCatalog {
  languages : Array[CompiledLanguage]
  aliases : Map[String, Int]
  extensions : Map[String, Int]
  filenames : Map[String, Int]
}

///|
/// Constructs a scanner budget from explicit limits.
pub fn scanner_budget(
  max_source_units~ : Int,
  max_tokens~ : Int,
  max_symbols~ : Int,
  max_reference_candidates~ : Int,
) -> ScannerBudget {
  { max_source_units, max_tokens, max_symbols, max_reference_candidates, }
}

///|
/// The production budget used by the browser extension and analyzer command.
///
/// The source limit matches the existing WebExtension boundary. Output limits
/// are intentionally lower than the theoretical worst case so pathological
/// files degrade to a partial highlight instead of creating unbounded arrays.
pub fn default_scanner_budget() -> ScannerBudget {
  scanner_budget(
    max_source_units=2_000_000,
    max_tokens=200_000,
    max_symbols=20_000,
    max_reference_candidates=100_000,
  )
}

///|
/// Empty analysis is the total, safe result for rejected or unsupported input.
pub fn empty_analysis() -> Analysis {
  { tokens: [], definitions: [], references: [], }
}

///|
/// Checks whether a source may be scanned under a budget.
pub fn source_fits_budget(budget : ScannerBudget, source : String) -> Bool {
  @proof.source_length_is_allowed(source.length(), budget.max_source_units)
}

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
/// Constructs a language from declarative token and symbol tables.
///
/// Arrays preserve source order. For prefix-like delimiters, plugins should put
/// the longest delimiter first so matching stays deterministic.
pub fn language(
  id~ : String,
  name~ : String,
  aliases~ : Array[String],
  extensions~ : Array[String],
  filenames~ : Array[String],
  signatures~ : Array[Signature],
  keywords~ : Array[String],
  types~ : Array[String],
  constants~ : Array[String],
  functions? : Array[String] = [],
  properties? : Array[String] = [],
  declarations~ : Array[(String, SymbolKind)],
  line_comments~ : Array[String],
  block_comments~ : Array[Delimiter],
  strings~ : Array[Delimiter],
  operator_chars~ : String,
  identifier_extra~ : String,
) -> Language {
  {
    id,
    name,
    aliases,
    extensions,
    filenames,
    signatures,
    keywords: sorted_strings(keywords),
    types: sorted_strings(types),
    constants: sorted_strings(constants),
    functions: sorted_strings(functions),
    properties: sorted_strings(properties),
    declarations,
    line_comments,
    block_comments,
    strings,
    operator_chars,
    identifier_extra,
  }
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
  { languages: compiled, aliases, extensions, filenames, }
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

///|
/// Validates that every emitted token span is bounded and ordered.
///
/// This executable checker mirrors the proof predicates in `src/proof` and is
/// intentionally independent from theme or language policy. Tests use it as a
/// broad regression oracle for scanner changes.
pub fn analysis_is_bounded(analysis : Analysis, source_length : Int) -> Bool {
  let mut cursor = 0
  for token_ in analysis.tokens {
    if !@proof.span_is_ordered_after(
        cursor,
        token_.span.start,
        token_.span.end_,
        source_length,
      ) {
      return false
    }
    cursor = @proof.cursor_after_ordered_span(
      cursor,
      token_.span.start,
      token_.span.end_,
      source_length,
    )
  }
  for definition in analysis.definitions {
    if !@proof.span_is_nonempty(
        definition.span.start,
        definition.span.end_,
        source_length,
      ) {
      return false
    }
  }
  for reference in analysis.references {
    if !@proof.span_is_nonempty(
        reference.span.start,
        reference.span.end_,
        source_length,
      ) {
      return false
    }
  }
  true
}
