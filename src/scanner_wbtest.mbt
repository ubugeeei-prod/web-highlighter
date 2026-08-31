///|
fn test_language() -> Language {
  language(
    id="test",
    name="Test",
    aliases=["test"],
    extensions=["test"],
    filenames=[],
    signatures=[],
    keywords=["fn", "let", "true"],
    types=["Int", "String"],
    constants=["None"],
    functions=["print"],
    properties=["env"],
    declarations=[("fn", FunctionSymbol), ("let", VariableSymbol)],
    line_comments=["//"],
    block_comments=[{ open: "/*", close: "*/", escape: false, }],
    strings=[{ open: "\"", close: "\"", escape: true, }],
    operator_chars="+-=*/<>!|&",
    identifier_extra="$𐐀",
  )
}

///|
fn assert_analysis_safe(result : Analysis, source : String) -> Unit raise {
  assert_true(analysis_is_bounded(result, source.length()))
}

///|
fn token_text(source : String, token_ : Token) -> String {
  String::unsafe_substring(
    source,
    start=token_.span.start,
    end=token_.span.end_,
  )
}

///|
fn contains_scoped_token(
  result : Analysis,
  source : String,
  text : String,
  scope : Scope,
) -> Bool {
  for token_ in result.tokens {
    if token_text(source, token_) == text && token_.scope == scope {
      return true
    }
  }
  false
}

///|
test "declarative tables drive semantic tokenization" {
  let source = "fn greet(name: String) { // hello\n let x = \"world\" }"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
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
test "compiled languages produce the same semantic plan as declarative input" {
  let source = "fn greet(name: String) {\n print(env)\n}\ngreet"
  let declarative = analyze(test_language(), source)
  let compiled = analyze_compiled(compile_language(test_language()), source)
  assert_eq(compiled, declarative)
  assert_analysis_safe(compiled, source)
}

///|
test "budgeted scanner rejects oversized source before tokenization" {
  let source = "fn main()"
  let budget = scanner_budget(
    max_source_units=4,
    max_tokens=10,
    max_symbols=10,
    max_reference_candidates=10,
  )
  assert_eq(
    analyze_compiled_with_budget(
      compile_language(test_language()),
      source,
      budget,
    ),
    empty_analysis(),
  )
}

///|
test "budgeted scanner caps tokens symbols and deferred references" {
  let source = "fn first() {}\nfn second() {}\nfirst first second"
  let budget = scanner_budget(
    max_source_units=source.length(),
    max_tokens=2,
    max_symbols=1,
    max_reference_candidates=1,
  )
  let result = analyze_compiled_with_budget(
    compile_language(test_language()),
    source,
    budget,
  )
  assert_analysis_safe(result, source)
  assert_true(result.tokens.length() <= 2)
  assert_true(result.definitions.length() <= 1)
  assert_true(result.references.length() <= 1)
}

///|
test "compiled builtin functions and properties are exact-word lexemes" {
  let source = "print env printer env2"
  let result = analyze(test_language(), source)
  assert_true(contains_scoped_token(result, source, "print", Function))
  assert_true(contains_scoped_token(result, source, "env", Property))
  assert_true(!contains_scoped_token(result, source, "printer", Function))
  assert_true(!contains_scoped_token(result, source, "env2", Property))
  debug_inspect(
    result.tokens.map(fn(item) { item.scope }),
    content="[Function, Property]",
  )
}

///|
test "built-in function vocabulary can still be locally declared" {
  let source = "fn print(value: Int) { print(value) }\nprint(1)"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  assert_eq(result.definitions.length(), 1)
  assert_eq(result.definitions[0].name, "print")
  assert_true(result.definitions[0].span == { start: 3, end_: 8, })
  assert_eq(result.references.length(), 2)
  assert_true(result.references[0].span == { start: 23, end_: 28, })
  assert_true(result.references[1].span == { start: 38, end_: 43, })
}

///|
test "declarations and references share a symbol name" {
  let source = "let answer = 42\nanswer + answer"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
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
test "spans stay in UTF-16 code units after supplementary characters" {
  let source = "🙂 fn greet() {}\ngreet()"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  assert_true(result.tokens[0].span == { start: 3, end_: 5, })
  assert_true(result.definitions[0].span == { start: 6, end_: 11, })
  assert_true(result.references[0].span == { start: 17, end_: 22, })
}

///|
test "declarative identifier extras accept supplementary code points" {
  let source = "let 𐐀 = 1\n𐐀"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  assert_true(result.definitions[0].span == { start: 4, end_: 6, })
  assert_eq(result.definitions[0].name, "𐐀")
  assert_true(result.references[0].span == { start: 11, end_: 13, })
}

///|
test "comments win over string and operator delimiters" {
  let source = "/* \"x\" + 1 */ let x = 2"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  assert_true(result.tokens[0].scope == Comment)
  assert_true(result.tokens[0].span == { start: 0, end_: 13, })
}

///|
test "escaped quotes remain inside a string" {
  let source = "let x = \"a\\\"b\""
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  let strings = result.tokens.filter(fn(item) { item.scope == String })
  assert_eq(strings.length(), 1)
  assert_true(strings[0].span == { start: 8, end_: 14, })
}

///|
test "unterminated regions consume the remaining source safely" {
  let source = "let x = \"unfinished"
  let result = analyze(test_language(), source)
  assert_analysis_safe(result, source)
  let final_token = result.tokens[result.tokens.length() - 1]
  assert_true(final_token.scope == String)
  assert_eq(final_token.span.end_, 19)
}

///|
test "adversarial scanner corpus stays ordered and bounded" {
  let cases = [
    "", "🙂", "🙂🙂 fn 𐐀() { 𐐀 }", "let $𐐀 = 1\n$𐐀", "/* unterminated",
    "// trailing comment", "let s = \"unterminated", "let n = 0x10.2_foo", "print env printer env2",
    "fn fn fn",
  ]
  for source in cases {
    assert_analysis_safe(analyze(test_language(), source), source)
  }
}

///|
test "analysis safety oracle rejects empty overlapping and out-of-range spans" {
  assert_true(
    !analysis_is_bounded(
      {
        tokens: [{ span: { start: 1, end_: 1, }, scope: Keyword, }],
        definitions: [],
        references: [],
      },
      3,
    ),
  )
  assert_true(
    !analysis_is_bounded(
      {
        tokens: [
          { span: { start: 0, end_: 3, }, scope: Keyword, },
          { span: { start: 2, end_: 4, }, scope: Type, },
        ],
        definitions: [],
        references: [],
      },
      4,
    ),
  )
  assert_true(
    !analysis_is_bounded(
      {
        tokens: [{ span: { start: 0, end_: 5, }, scope: Keyword, }],
        definitions: [],
        references: [],
      },
      4,
    ),
  )
  assert_true(
    !analysis_is_bounded(
      {
        tokens: [],
        definitions: [
          {
            name: "bad",
            span: { start: 2, end_: 2, },
            kind: VariableSymbol,
            line: 1,
          },
        ],
        references: [],
      },
      4,
    ),
  )
  assert_true(
    !analysis_is_bounded(
      {
        tokens: [],
        definitions: [],
        references: [{ name: "bad", span: { start: -1, end_: 2, }, }],
      },
      4,
    ),
  )
}

///|
test "invalid compiled handles are rejected without scanning" {
  assert_eq(analyze_handle_wire("fn main()", -1), "")
  assert_eq(analyze_handle_wire("fn main()", 999), "")
}

///|
test "catalog request rejects oversized source before detection" {
  let builder = StringBuilder()
  let mut count = 0
  while count < 2_000_001 {
    builder.write_char('x')
    count += 1
  }
  let source = builder.to_string()
  let catalog = compile_catalog([test_language()])
  assert_eq(analyze_compiled_catalog_request(catalog, source, "test", ""), "")
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

///|
test "wire helpers accept optional function and property vocabularies" {
  let direct = analyze_wire(
    "print env printer env2",
    "",
    "",
    "",
    "",
    "",
    "",
    "\"",
    "",
    "",
    functions="print",
    properties="env",
  )
  inspect(
    direct,
    content=(
      #|T	0	5	function
      #|T	6	9	property
      #|
    ),
  )
  let handle = compile_language_wire(
    "",
    "",
    "",
    "",
    "",
    "",
    "\"",
    "",
    "",
    functions="print",
    properties="env",
  )
  assert_eq(
    analyze_handle_wire("print env", handle),
    "T\t0\t5\tfunction\nT\t6\t9\tproperty\n",
  )
}
