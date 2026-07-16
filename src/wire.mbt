///|
fn scope_name(scope : Scope) -> String {
  match scope {
    Keyword => "keyword"
    Type => "type"
    Constant => "constant"
    String => "string"
    Number => "number"
    Comment => "comment"
    Operator => "operator"
    Function => "function"
    Variable => "variable"
    Property => "property"
    Punctuation => "punctuation"
  }
}

///|
fn symbol_kind_name(kind : SymbolKind) -> String {
  match kind {
    FunctionSymbol => "function"
    TypeSymbol => "type"
    ModuleSymbol => "module"
    VariableSymbol => "variable"
    PropertySymbol => "property"
  }
}

///|
fn split_words(source : String) -> Array[String] {
  let words : Array[String] = []
  let mut start = 0
  for index in 0..<=source.length() {
    if index == source.length() || source[index] == '\u{1f}' {
      if index > start {
        words.push(String::unsafe_substring(source, start~, end=index))
      }
      start = index + 1
    }
  }
  words
}

///|
fn split_declarations(source : String) -> Array[(String, SymbolKind)] {
  let declarations : Array[(String, SymbolKind)] = []
  for entry in split_words(source) {
    let mut separator = -1
    for index in 0..<entry.length() {
      if entry[index] == ':' {
        separator = index
        break
      }
    }
    if separator <= 0 {
      continue
    }
    let name = String::unsafe_substring(entry, start=0, end=separator)
    let kind_name = String::unsafe_substring(
      entry,
      start=separator + 1,
      end=entry.length(),
    )
    let kind = match kind_name {
      "function" => FunctionSymbol
      "type" => TypeSymbol
      "module" => ModuleSymbol
      "property" => PropertySymbol
      _ => VariableSymbol
    }
    declarations.push((name, kind))
  }
  declarations
}

///|
fn split_pairs(source : String, escape : Bool) -> Array[Delimiter] {
  let delimiters : Array[Delimiter] = []
  for entry in split_words(source) {
    let mut separator = -1
    for index in 0..<entry.length() {
      if entry[index] == '\u{1e}' {
        separator = index
        break
      }
    }
    if separator < 0 {
      delimiters.push({ open: entry, close: entry, escape })
    } else {
      delimiters.push({
        open: String::unsafe_substring(entry, start=0, end=separator),
        close: String::unsafe_substring(
          entry,
          start=separator + 1,
          end=entry.length(),
        ),
        escape,
      })
    }
  }
  delimiters
}

///|
fn encode_analysis(analysis : Analysis) -> String {
  let output = StringBuilder::new()
  for token_ in analysis.tokens {
    output
    ..write_string("T\t")
    ..write_string(token_.span.start.to_string())
    ..write_char('\t')
    ..write_string(token_.span.end_.to_string())
    ..write_char('\t')
    ..write_string(scope_name(token_.scope))
    .write_char('\n')
  }
  for definition in analysis.definitions {
    output
    ..write_string("D\t")
    ..write_string(definition.span.start.to_string())
    ..write_char('\t')
    ..write_string(definition.span.end_.to_string())
    ..write_char('\t')
    ..write_string(symbol_kind_name(definition.kind))
    ..write_char('\t')
    ..write_string(definition.line.to_string())
    .write_char('\n')
  }
  for reference in analysis.references {
    output
    ..write_string("R\t")
    ..write_string(reference.span.start.to_string())
    ..write_char('\t')
    ..write_string(reference.span.end_.to_string())
    ..write_char('\t')
    ..write_string(reference.name)
    .write_char('\n')
  }
  output.to_string()
}

///|
/// JavaScript boundary for the browser extension.
///
/// Each table uses the ASCII unit separator between entries; paired delimiters
/// use the record separator between their opening and closing text. The compact
/// wire format avoids shipping a JSON parser in the generated JavaScript.
pub fn analyze_wire(
  source : String,
  keywords : String,
  types : String,
  constants : String,
  declarations : String,
  line_comments : String,
  block_comments : String,
  strings : String,
  operator_chars : String,
  identifier_extra : String,
) -> String {
  let definition = language(
    id="wire",
    name="Wire language",
    aliases=[],
    extensions=[],
    filenames=[],
    signatures=[],
    keywords=split_words(keywords),
    types=split_words(types),
    constants=split_words(constants),
    declarations=split_declarations(declarations),
    line_comments=split_words(line_comments),
    block_comments=split_pairs(block_comments, false),
    strings=split_pairs(strings, true),
    operator_chars~,
    identifier_extra~,
  )
  encode_analysis(analyze(definition, source))
}

///|
let language_registry : Array[Language] = []

///|
let builtin_catalog : Array[Language] = builtin_languages()

///|
/// Detects a built-in language and returns its complete injected-support plan.
///
/// The first line identifies the selected language. Remaining lines contain
/// semantic tokens, definitions, and references for the browser host to apply.
pub fn analyze_request(
  source : String,
  hint : String,
  filename : String,
) -> String {
  match detect_language(builtin_catalog, source, hint, filename) {
    None => ""
    Some(definition) =>
      "L\t" +
      definition.id +
      "\n" +
      encode_analysis(analyze(definition, source))
  }
}

///|
/// Compiles declarative wire tables once and returns a stable scanner handle.
pub fn compile_language_wire(
  keywords : String,
  types : String,
  constants : String,
  declarations : String,
  line_comments : String,
  block_comments : String,
  strings : String,
  operator_chars : String,
  identifier_extra : String,
) -> Int {
  language_registry.push(
    language(
      id="wire",
      name="Wire language",
      aliases=[],
      extensions=[],
      filenames=[],
      signatures=[],
      keywords=split_words(keywords),
      types=split_words(types),
      constants=split_words(constants),
      declarations=split_declarations(declarations),
      line_comments=split_words(line_comments),
      block_comments=split_pairs(block_comments, false),
      strings=split_pairs(strings, true),
      operator_chars~,
      identifier_extra~,
    ),
  )
  language_registry.length() - 1
}

///|
/// Scans source with a previously compiled language handle.
pub fn analyze_handle_wire(source : String, handle : Int) -> String {
  if handle < 0 || handle >= language_registry.length() {
    return ""
  }
  encode_analysis(analyze(language_registry[handle], source))
}
