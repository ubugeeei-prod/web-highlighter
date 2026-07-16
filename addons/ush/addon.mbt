///|
/// Returns the bundled ush language as an ordinary external add-on package.
pub fn contribution() -> @web.Addon {
  @web.addon(
    languages=[
      @web.make_language(
        "ush",
        "ush",
        ["ush-shell"],
        ["ush"],
        [],
        [
          @web.signature("async {", 2),
          @web.signature("Option::Some", 3),
          @web.signature("fn ", 1),
          @web.signature("print ", 1),
        ],
        "alias async await break catch continue defer else enum export false fn for if impl import in let loop match mut none pub return some spawn struct throw trait true try type while",
        "Bool Bytes Command Error Float Int List Map Option Path Result Stream String Tuple Unit",
        "true false none some None Some Ok Err",
        [
          ("fn", @web.FunctionSymbol),
          ("enum", @web.TypeSymbol),
          ("let", @web.VariableSymbol),
          ("struct", @web.TypeSymbol),
          ("trait", @web.TypeSymbol),
          ("type", @web.TypeSymbol),
        ],
        ["//", "#"],
        [@web.delimiter("/*", "*/")],
        [@web.quoted("\""), @web.quoted("'"), @web.quoted("`")],
        "+-*/%=<>!&|^~?.",
        "$",
      ),
    ],
    themes=[],
  )
}
