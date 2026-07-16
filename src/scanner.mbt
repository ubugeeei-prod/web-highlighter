///|
fn contains_word(words : Array[String], candidate : String) -> Bool {
  let mut low = 0
  let mut high = words.length()
  while low < high {
    let middle = low + (high - low) / 2
    let word = words[middle]
    if word == candidate {
      return true
    } else if word < candidate {
      low = middle + 1
    } else {
      high = middle
    }
  }
  false
}

///|
fn declaration_kind(
  declarations : Array[(String, SymbolKind)],
  candidate : String,
) -> SymbolKind? {
  for declaration in declarations {
    if declaration.0 == candidate {
      return Some(declaration.1)
    }
  }
  None
}

///|
fn contains_char(chars : String, candidate : Char) -> Bool {
  for char in chars {
    if char == candidate {
      return true
    }
  }
  false
}

///|
fn starts_with(source : String, start : Int, expected : String) -> Bool {
  if expected.length() == 0 || start + expected.length() > source.length() {
    return false
  }
  for offset in 0..<expected.length() {
    if source[start + offset] != expected[offset] {
      return false
    }
  }
  true
}

///|
fn is_ascii_letter(char : Char) -> Bool {
  (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

///|
fn is_digit(char : Char) -> Bool {
  char >= '0' && char <= '9'
}

///|
fn is_identifier_start(language : Language, char : Char) -> Bool {
  is_ascii_letter(char) ||
  char == '_' ||
  contains_char(language.identifier_extra, char)
}

///|
fn is_identifier_continue(language : Language, char : Char) -> Bool {
  is_identifier_start(language, char) || is_digit(char) || char == '\''
}

///|
fn skip_to_line_end(chars : Array[Char], start : Int) -> Int {
  let mut cursor = start
  while cursor < chars.length() && chars[cursor] != '\n' {
    cursor += 1
  }
  cursor
}

///|
fn skip_region(
  source : String,
  chars : Array[Char],
  start : Int,
  delimiter : Delimiter,
) -> Int {
  let mut cursor = start + delimiter.open.length()
  while cursor < chars.length() {
    if delimiter.escape && chars[cursor] == '\\' {
      cursor += 2
      continue
    }
    if starts_with(source, cursor, delimiter.close) {
      return cursor + delimiter.close.length()
    }
    cursor += 1
  }
  chars.length()
}

///|
fn matched_prefix(
  prefixes : Array[String],
  source : String,
  start : Int,
) -> String? {
  for prefix in prefixes {
    if starts_with(source, start, prefix) {
      return Some(prefix)
    }
  }
  None
}

///|
fn matched_delimiter(
  delimiters : Array[Delimiter],
  source : String,
  start : Int,
) -> Delimiter? {
  for delimiter in delimiters {
    if starts_with(source, start, delimiter.open) {
      return Some(delimiter)
    }
  }
  None
}

///|
fn token(tokens : Array[Token], start : Int, end_ : Int, scope : Scope) -> Unit {
  tokens.push({ span: { start, end_ }, scope })
}

///|
fn symbol_scope(kind : SymbolKind) -> Scope {
  match kind {
    FunctionSymbol => Function
    TypeSymbol | ModuleSymbol => Type
    VariableSymbol => Variable
    PropertySymbol => Property
  }
}

///|
fn merge_tokens(left : Array[Token], right : Array[Token]) -> Array[Token] {
  let merged : Array[Token] = []
  let mut left_index = 0
  let mut right_index = 0
  while left_index < left.length() || right_index < right.length() {
    if right_index >= right.length() ||
      (
        left_index < left.length() &&
        left[left_index].span.start <= right[right_index].span.start
      ) {
      merged.push(left[left_index])
      left_index += 1
    } else {
      merged.push(right[right_index])
      right_index += 1
    }
  }
  merged
}

///|
fn line_breaks(chars : Array[Char], start : Int, end_ : Int) -> Int {
  let mut count = 0
  for index in start..<end_ {
    if chars[index] == '\n' {
      count += 1
    }
  }
  count
}

///|
/// Scans source according to a declarative language definition.
///
/// The scanner performs one linear pass for tokens and symbol declarations,
/// followed by a compact reference pass over identifiers already encountered.
/// It does not allocate a syntax tree, which keeps chat timelines responsive.
pub fn analyze(language : Language, source : String) -> Analysis {
  let chars = source.to_array()
  let tokens : Array[Token] = []
  let definitions : Array[Definition] = []
  let definitions_by_name : Map[String, Definition] = Map([])
  let identifiers : Array[(String, Span)] = []
  let mut pending_definition : SymbolKind? = None
  let mut cursor = 0
  let mut line = 1
  while cursor < chars.length() {
    match matched_prefix(language.line_comments, source, cursor) {
      Some(prefix) => {
        let end_ = skip_to_line_end(chars, cursor + prefix.length())
        token(tokens, cursor, end_, Comment)
        line += line_breaks(chars, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.block_comments, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, chars, cursor, delimiter)
        token(tokens, cursor, end_, Comment)
        line += line_breaks(chars, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.strings, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, chars, cursor, delimiter)
        token(tokens, cursor, end_, String)
        line += line_breaks(chars, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    let current = chars[cursor]
    if is_identifier_start(language, current) {
      let start = cursor
      cursor += 1
      while cursor < chars.length() &&
            is_identifier_continue(language, chars[cursor]) {
        cursor += 1
      }
      let name = String::unsafe_substring(source, start~, end=cursor)
      let span = { start, end_: cursor }
      if contains_word(language.keywords, name) {
        token(tokens, start, cursor, Keyword)
        pending_definition = declaration_kind(language.declarations, name)
      } else if contains_word(language.types, name) {
        token(tokens, start, cursor, Type)
        match pending_definition {
          Some(kind) => {
            let definition = { name, span, kind, line }
            definitions.push(definition)
            if definitions_by_name.get(name) is None {
              definitions_by_name[name] = definition
            }
            pending_definition = None
          }
          None => ()
        }
      } else if contains_word(language.constants, name) {
        token(tokens, start, cursor, Constant)
      } else {
        match pending_definition {
          Some(kind) => {
            token(tokens, start, cursor, symbol_scope(kind))
            let definition = { name, span, kind, line }
            definitions.push(definition)
            if definitions_by_name.get(name) is None {
              definitions_by_name[name] = definition
            }
            pending_definition = None
          }
          None => identifiers.push((name, span))
        }
      }
      continue
    }
    if is_digit(current) {
      let start = cursor
      cursor += 1
      while cursor < chars.length() &&
            (
              is_digit(chars[cursor]) ||
              is_ascii_letter(chars[cursor]) ||
              chars[cursor] == '_' ||
              chars[cursor] == '.'
            ) {
        cursor += 1
      }
      token(tokens, start, cursor, Number)
      continue
    }
    if contains_char(language.operator_chars, current) {
      let start = cursor
      cursor += 1
      while cursor < chars.length() &&
            contains_char(language.operator_chars, chars[cursor]) {
        cursor += 1
      }
      token(tokens, start, cursor, Operator)
      continue
    }
    if current == '(' ||
      current == ')' ||
      current == '[' ||
      current == ']' ||
      current == '{' ||
      current == '}' ||
      current == ',' ||
      current == ';' ||
      current == ':' {
      token(tokens, cursor, cursor + 1, Punctuation)
    }
    if current == '\n' {
      line += 1
    }
    cursor += 1
  }
  let references : Array[Reference] = []
  let reference_tokens : Array[Token] = []
  for entry in identifiers {
    match definitions_by_name.get(entry.0) {
      Some(definition) => {
        references.push({ name: entry.0, span: entry.1 })
        token(
          reference_tokens,
          entry.1.start,
          entry.1.end_,
          symbol_scope(definition.kind),
        )
      }
      None => ()
    }
  }
  { tokens: merge_tokens(tokens, reference_tokens), definitions, references }
}
