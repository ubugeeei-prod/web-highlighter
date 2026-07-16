///|
fn test_language() -> Language {
  language(
    keywords=["fn", "let", "true"],
    types=["Int", "String"],
    constants=["None"],
    declarations=[("fn", FunctionSymbol), ("let", VariableSymbol)],
    line_comments=["//"],
    block_comments=[{ open: "/*", close: "*/", escape: false }],
    strings=[{ open: "\"", close: "\"", escape: true }],
    operator_chars="+-=*/<>!|&",
    identifier_extra="$",
  )
}

///|
test "declarative tables drive semantic tokenization" {
  let result = analyze(
    test_language(),
    "fn greet(name: String) { // hello\n let x = \"world\" }",
  )
  debug_inspect(
    result.tokens.map(fn(item) { item.scope }),
    content=(
      #|[
      #|  Keyword,
      #|  Function,
      #|  Punctuation,
      #|  Punctuation,
      #|  Type,
      #|  Punctuation,
      #|  Punctuation,
      #|  Comment,
      #|  Keyword,
      #|  Variable,
      #|  Operator,
      #|  String,
      #|  Punctuation,
      #|]
    ),
  )
}

///|
test "declarations and references share a symbol name" {
  let result = analyze(test_language(), "let answer = 42\nanswer + answer")
  debug_inspect(
    result.definitions,
    content=(
      #|[
      #|  {
      #|    name: "answer",
      #|    span: { start: 4, end_: 10 },
      #|    kind: VariableSymbol,
      #|    line: 1,
      #|  },
      #|]
    ),
  )
  debug_inspect(
    result.references,
    content=(
      #|[
      #|  { name: "answer", span: { start: 16, end_: 22 } },
      #|  { name: "answer", span: { start: 25, end_: 31 } },
      #|]
    ),
  )
}

///|
test "comments win over string and operator delimiters" {
  let result = analyze(test_language(), "/* \"x\" + 1 */ let x = 2")
  assert_true(result.tokens[0].scope == Comment)
  assert_true(result.tokens[0].span == { start: 0, end_: 13 })
}

///|
test "escaped quotes remain inside a string" {
  let result = analyze(test_language(), "let x = \"a\\\"b\"")
  let strings = result.tokens.filter(fn(item) { item.scope == String })
  assert_eq(strings.length(), 1)
  assert_true(strings[0].span == { start: 8, end_: 14 })
}

///|
test "unterminated regions consume the remaining source safely" {
  let result = analyze(test_language(), "let x = \"unfinished")
  let final_token = result.tokens[result.tokens.length() - 1]
  assert_true(final_token.scope == String)
  assert_eq(final_token.span.end_, 19)
}

///|
test "wire output stays compact and deterministic" {
  let encoded = analyze_wire(
    "fn main()", "fn", "", "", "fn:function", "//", "/*\u{1e}*/", "\"", "+-=", "",
  )
  inspect(
    encoded,
    content=(
      #|T	0	2	keyword
      #|T	3	7	function
      #|T	7	8	punctuation
      #|T	8	9	punctuation
      #|D	3	7	function	1
      #|
    ),
  )
}
