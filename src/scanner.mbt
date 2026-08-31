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
  if index < 0 || index >= source.length() {
    return index
  }
  let width = if source[index].is_leading_surrogate() &&
    index + 1 < source.length() &&
    source[index + 1].is_trailing_surrogate() {
    2
  } else {
    1
  }
  @proof.advance_utf16_index(source.length(), index, width)
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
fn is_identifier_start(language : CompiledLanguage, codepoint : Int) -> Bool {
  is_ascii_letter(codepoint) ||
  codepoint == '_'.to_int() ||
  codepoint_set_contains(language.identifier_extra, codepoint)
}

///|
fn is_identifier_continue(language : CompiledLanguage, codepoint : Int) -> Bool {
  is_identifier_start(language, codepoint) ||
  is_digit(codepoint) ||
  codepoint == '\''.to_int()
}

///|
fn skip_to_line_end(source : String, start : Int) -> Int {
  let mut cursor = start
  while cursor < source.length() &&
        codepoint_at(source, cursor) != '\n'.to_int() {
    cursor = advance_codepoint(source, cursor)
  }
  cursor
}

///|
fn skip_region(source : String, start : Int, delimiter : Delimiter) -> Int {
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
fn token(
  tokens : Array[Token],
  start : Int,
  end_ : Int,
  scope : Scope,
  source_length : Int,
  budget : ScannerBudget,
) -> Unit {
  if @proof.span_is_nonempty(start, end_, source_length) &&
    @proof.item_budget_allows(tokens.length(), budget.max_tokens) {
    tokens.push({ span: { start, end_, }, scope, })
  }
}

///|
/// Records a reference token against the final merged token budget.
fn reference_token(
  tokens : Array[Token],
  reference_tokens : Array[Token],
  start : Int,
  end_ : Int,
  scope : Scope,
  source_length : Int,
  budget : ScannerBudget,
) -> Unit {
  let used = tokens.length() + reference_tokens.length()
  if @proof.span_is_nonempty(start, end_, source_length) &&
    @proof.item_budget_allows(used, budget.max_tokens) {
    reference_tokens.push({ span: { start, end_, }, scope, })
  }
}

///|
/// Records a definition only while the symbol budget has room.
fn record_definition(
  definitions : Array[Definition],
  definitions_by_name : Map[String, Definition],
  item : Definition,
  budget : ScannerBudget,
) -> Unit {
  if @proof.item_budget_allows(definitions.length(), budget.max_symbols) {
    definitions.push(item)
    if definitions_by_name.get(item.name) is None {
      definitions_by_name[item.name] = item
    }
  }
}

///|
/// Records a candidate identifier for the second reference pass.
fn reference_candidate(
  identifiers : Array[(String, Span, Bool)],
  name : String,
  span : Span,
  needs_token : Bool,
  budget : ScannerBudget,
) -> Unit {
  if @proof.item_budget_allows(
      identifiers.length(),
      budget.max_reference_candidates,
    ) {
    identifiers.push((name, span, needs_token))
  }
}

///|
/// Records a resolved reference only while the symbol budget has room.
fn reference(
  references : Array[Reference],
  name : String,
  span : Span,
  budget : ScannerBudget,
) -> Bool {
  if @proof.item_budget_allows(references.length(), budget.max_symbols) {
    references.push({ name, span, })
    true
  } else {
    false
  }
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
/// Merges the lexical and deferred-reference token streams in source order.
///
/// The browser renderer sweeps this list once against ordered DOM segments
/// instead of re-scanning it per line, so the merge re-checks the same verified
/// append contract the scanner uses for a single stream: only spans that stay
/// ordered, non-empty, and in range survive the merge.
fn merge_tokens(
  left : Array[Token],
  right : Array[Token],
  source_length : Int,
) -> Array[Token] {
  let merged : Array[Token] = []
  let mut cursor = 0
  let mut left_index = 0
  let mut right_index = 0
  while left_index < left.length() || right_index < right.length() {
    let next = if right_index >= right.length() ||
      (
        left_index < left.length() &&
        left[left_index].span.start <= right[right_index].span.start
      ) {
      left_index += 1
      left[left_index - 1]
    } else {
      right_index += 1
      right[right_index - 1]
    }
    if @proof.span_is_ordered_after(
        cursor,
        next.span.start,
        next.span.end_,
        source_length,
      ) {
      merged.push(next)
      cursor = @proof.cursor_after_ordered_span(
        cursor,
        next.span.start,
        next.span.end_,
        source_length,
      )
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
/// This compatibility entry point compiles the language first. Browser and
/// add-on hot paths should prefer `compile_language`/`analyze_compiled` so
/// repeated SPA rescans reuse the same lexical indexes.
pub fn analyze(language : Language, source : String) -> Analysis {
  analyze_compiled(compile_language(language), source)
}

///|
/// Scans source with a precompiled declarative grammar.
///
/// The scanner performs one linear lexical/symbol pass and one compact
/// reference pass over identifiers already encountered. It walks Unicode scalar
/// values while retaining UTF-16 browser offsets, emits no AST, and does one
/// exact-word lookup per identifier.
pub fn analyze_compiled(
  language : CompiledLanguage,
  source : String,
) -> Analysis {
  analyze_compiled_with_budget(language, source, default_scanner_budget())
}

///|
/// Scans source with a precompiled grammar and explicit resource budget.
///
/// This is the core analyzer used by the browser-facing entrypoint. Oversized
/// input returns `empty_analysis()` before scanning. Output caps are enforced at
/// every append site, so adversarial code can at worst receive a partial
/// highlight bounded by the declared budget.
pub fn analyze_compiled_with_budget(
  language : CompiledLanguage,
  source : String,
  budget : ScannerBudget,
) -> Analysis {
  if !source_fits_budget(budget, source) {
    return empty_analysis()
  }
  let source_length = source.length()
  let tokens : Array[Token] = []
  let definitions : Array[Definition] = []
  let definitions_by_name : Map[String, Definition] = Map([])
  let identifiers : Array[(String, Span, Bool)] = []
  let mut pending_definition : SymbolKind? = None
  let mut cursor = 0
  let mut line = 1
  while cursor < source.length() {
    match matched_prefix(language.language.line_comments, source, cursor) {
      Some(prefix) => {
        let end_ = skip_to_line_end(source, cursor + prefix.length())
        token(tokens, cursor, end_, Comment, source_length, budget)
        line = @proof.add_line_count(line, line_breaks(source, cursor, end_))
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.language.block_comments, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, cursor, delimiter)
        token(tokens, cursor, end_, Comment, source_length, budget)
        line = @proof.add_line_count(line, line_breaks(source, cursor, end_))
        cursor = end_
        continue
      }
      None => ()
    }
    match matched_delimiter(language.language.strings, source, cursor) {
      Some(delimiter) => {
        let end_ = skip_region(source, cursor, delimiter)
        token(tokens, cursor, end_, String, source_length, budget)
        line = @proof.add_line_count(line, line_breaks(source, cursor, end_))
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
      let span = { start, end_: cursor, }
      match lexeme_for(language, name) {
        Some(entry) =>
          match pending_definition {
            Some(kind) =>
              match entry.scope {
                Keyword => {
                  token(
                    tokens,
                    start,
                    cursor,
                    entry.scope,
                    source_length,
                    budget,
                  )
                  pending_definition = entry.declaration
                }
                Type
                | Constant
                | Function
                | Variable
                | Property
                | String
                | Number
                | Comment
                | Operator
                | Punctuation => {
                  token(
                    tokens,
                    start,
                    cursor,
                    symbol_scope(kind),
                    source_length,
                    budget,
                  )
                  let definition = { name, span, kind, line, }
                  record_definition(
                    definitions, definitions_by_name, definition, budget,
                  )
                  pending_definition = None
                }
              }
            None => {
              token(tokens, start, cursor, entry.scope, source_length, budget)
              if entry.scope == Keyword {
                pending_definition = entry.declaration
              } else if definitions_by_name.get(name) is Some(_) {
                reference_candidate(identifiers, name, span, false, budget)
              }
            }
          }
        None =>
          match pending_definition {
            Some(kind) => {
              token(
                tokens,
                start,
                cursor,
                symbol_scope(kind),
                source_length,
                budget,
              )
              let definition = { name, span, kind, line, }
              record_definition(
                definitions, definitions_by_name, definition, budget,
              )
              pending_definition = None
            }
            None => reference_candidate(identifiers, name, span, true, budget)
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
      token(tokens, start, cursor, Number, source_length, budget)
      continue
    }
    if codepoint_set_contains(language.operators, current) {
      let start = cursor
      cursor = advance_codepoint(source, cursor)
      while cursor < source.length() &&
            codepoint_set_contains(
              language.operators,
              codepoint_at(source, cursor),
            ) {
        cursor = advance_codepoint(source, cursor)
      }
      token(tokens, start, cursor, Operator, source_length, budget)
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
      token(tokens, cursor, next_cursor, Punctuation, source_length, budget)
    }
    if current == '\n'.to_int() {
      line = @proof.add_line_count(line, 1)
    }
    cursor = next_cursor
  }
  let references : Array[Reference] = []
  let reference_tokens : Array[Token] = []
  for entry in identifiers {
    match definitions_by_name.get(entry.0) {
      Some(definition) =>
        if reference(references, entry.0, entry.1, budget) && entry.2 {
          reference_token(
            tokens,
            reference_tokens,
            entry.1.start,
            entry.1.end_,
            symbol_scope(definition.kind),
            source_length,
            budget,
          )
        }
      None => ()
    }
  }
  {
    tokens: merge_tokens(tokens, reference_tokens, source_length),
    definitions,
    references,
  }
}
