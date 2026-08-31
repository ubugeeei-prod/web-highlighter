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
fn line_breaks(source : String, start : Int, end_ : Int) -> Int {
  let mut count = 0
  for index in start..<end_ {
    if source[index].to_int() == '\n'.to_int() {
      count += 1
    }
  }
  count
}
