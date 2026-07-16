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
pub enum SymbolKind {
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
/// Plugins describe vocabulary and lexical regions only. They never receive
/// callbacks and cannot run code while a page is being highlighted. This makes
/// plugin cost predictable and keeps the extension compatible with Manifest V3.
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
  declarations : Array[(String, SymbolKind)]
  line_comments : Array[String]
  block_comments : Array[Delimiter]
  strings : Array[Delimiter]
  operator_chars : String
  identifier_extra : String
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
    declarations,
    line_comments,
    block_comments,
    strings,
    operator_chars,
    identifier_extra,
  }
}
