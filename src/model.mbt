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
/// untrusted output array without consulting the browser host. Its arithmetic
/// predicate lives beside this model in `src/model_contract/contract.mbtp`,
/// because the budget is part of the core data contract rather than a browser
/// convention.
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
  signatures : CompiledSignatures
}

///|
/// One catalog signature compiled with the index of the language that owns it.
pub(all) struct CompiledSignature {
  text : String
  weight : Int
  language : Int
}

///|
/// Every catalog signature indexed by its first UTF-16 code unit.
///
/// Unlabelled inference used to run one substring search per signature per
/// language, so its cost grew with the catalog. This index turns detection into
/// one forward pass over the source: each position only tests the signatures
/// that can start there, which keeps evidence scoring independent of how many
/// languages ship.
pub(all) struct CompiledSignatures {
  entries : Array[CompiledSignature]
  ascii : FixedArray[Array[Int]]
  wide : Array[Int]
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
  @model_contract.source_length_is_allowed(
    source.length(),
    budget.max_source_units,
  )
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
