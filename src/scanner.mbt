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
/// Checks a short declarative character set by Unicode scalar value.
fn contains_codepoint(chars : String, candidate : Int) -> Bool {
  for char in chars {
    if char.to_int() == candidate {
      return true
    }
  }
  false
}

///|
/// Decodes one scalar while keeping the caller's cursor in UTF-16 code units.
fn codepoint_at(source : String, index : Int) -> Int {
  let first = source[index]
  if first.is_leading_surrogate() && index + 1 < source.length() {
    let second = source[index + 1]
    if second.is_trailing_surrogate() {
      return 0x10000 +
        (first.to_int() - 0xd800) * 0x400 +
        (second.to_int() - 0xdc00)
    }
  }
  first.to_int()
}

///|
/// Advances a UTF-16 cursor by one valid scalar or one unpaired code unit.
fn advance_codepoint(source : String, index : Int) -> Int {
  if index >= source.length() {
    return index
  }
  if source[index].is_leading_surrogate() &&
    index + 1 < source.length() &&
    source[index + 1].is_trailing_surrogate() {
    return index + 2
  }
  index + 1
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
fn is_ascii_letter(codepoint : Int) -> Bool {
  (codepoint >= 'a'.to_int() && codepoint <= 'z'.to_int()) ||
  (codepoint >= 'A'.to_int() && codepoint <= 'Z'.to_int())
}

///|
fn is_digit(codepoint : Int) -> Bool {
  codepoint >= '0'.to_int() && codepoint <= '9'.to_int()
}

///|
fn is_identifier_start(language : Language, codepoint : Int) -> Bool {
  is_ascii_letter(codepoint) ||
  codepoint == '_'.to_int() ||
  contains_codepoint(language.identifier_extra, codepoint)
}

///|
fn is_identifier_continue(language : Language, codepoint : Int) -> Bool {
  is_identifier_start(language, codepoint) ||
  is_digit(codepoint) ||
  codepoint == '\''.to_int()
}

///|
fn skip_to_line_end(source : String, start : Int) -> Int {
  let mut cursor = start
  while cursor < source.length() && codepoint_at(source, cursor) != '\n'.to_int() {
    cursor = advance_codepoint(source, cursor)
  }
  cursor
}

///|
fn skip_region(
  source : String,
  start : Int,
  delimiter : Delimiter,
) -> Int {
  let mut cursor = start + delimiter.open.length()
  while cursor < source.length() {
    if delimiter.escape && codepoint_at(source, cursor) == '\\'.to_int() {
      cursor = advance_codepoint(source, cursor)
      cursor = advance_codepoint(source, cursor)
      continue
    }
    if starts_with(source, cursor, delimiter.close) {
      return cursor + delimiter.close.length()
    }
    cursor = advance_codepoint(source, cursor)
  }
  source.length()
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
fn line_breaks(source : String, start : Int, end_ : Int) -> Int {
  let mut count = 0
  for index in start..<end_ {
    if source[index].to_int() == '\n'.to_int() {
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
/// It walks Unicode code points while retaining UTF-16 browser offsets and does
/// not allocate a syntax tree, which keeps chat timelines responsive.
pub fn analyze(language : Language, source : String) -> Analysis {
  let tokens : Array[Token] = []
  let definitions : Array[Definition] = []
  let definitions_by_name : Map[String, Definition] = Map([])
  let identifiers : Array[(String, Span)] = []
  let mut pending_definition : SymbolKind? = None
  let mut cursor = 0
  let mut line = 1
  while cursor < source.length() {
    match matched_prefix(language.line_comments, source, cursor) {
      Some(prefix) => {
        let end_ = skip_to_line_end(source, cursor + prefix.length())
        token(tokens, cursor, end_, Comment)
        line += line_breaks(source, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.block_comments, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, cursor, delimiter)
        token(tokens, cursor, end_, Comment)
        line += line_breaks(source, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.strings, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, cursor, delimiter)
        token(tokens, cursor, end_, String)
        line += line_breaks(source, cursor, end_)
        cursor = end_
        continue
      }
      None => ()
    }
    let current = codepoint_at(source, cursor)
    if is_identifier_start(language, current) {
      let start = cursor
      cursor = advance_codepoint(source, cursor)
      while cursor < source.length() &&
            is_identifier_continue(language, codepoint_at(source, cursor)) {
        cursor = advance_codepoint(source, cursor)
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
      cursor = advance_codepoint(source, cursor)
      while cursor < source.length() {
        let next = codepoint_at(source, cursor)
        if is_digit(next) ||
          is_ascii_letter(next) ||
          next == '_'.to_int() ||
          next == '.'.to_int() {
          cursor = advance_codepoint(source, cursor)
        } else {
          break
        }
      }
      token(tokens, start, cursor, Number)
      continue
    }
    if contains_codepoint(language.operator_chars, current) {
      let start = cursor
      cursor = advance_codepoint(source, cursor)
      while cursor < source.length() &&
            contains_codepoint(
              language.operator_chars,
              codepoint_at(source, cursor),
            ) {
        cursor = advance_codepoint(source, cursor)
      }
      token(tokens, start, cursor, Operator)
      continue
    }
    let next_cursor = advance_codepoint(source, cursor)
    if current == '('.to_int() ||
      current == ')'.to_int() ||
      current == '['.to_int() ||
      current == ']'.to_int() ||
      current == '{'.to_int() ||
      current == '}'.to_int() ||
      current == ','.to_int() ||
      current == ';'.to_int() ||
      current == ':'.to_int() {
      token(tokens, cursor, next_cursor, Punctuation)
    }
    if current == '\n'.to_int() {
      line += 1
    }
    cursor = next_cursor
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
