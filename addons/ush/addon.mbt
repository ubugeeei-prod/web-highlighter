///|
/// Returns the bundled ush language as an ordinary external add-on package.
pub fn contribution() -> @highlight.Addon {
  @highlight.addon(
    languages=[
      @highlight.make_language(
        "ush",
        "ush",
        ["ush-shell"],
        ["ush"],
        [],
        [
          @highlight.signature("std::", 3),
          @highlight.signature("Problem!String", 3),
          @highlight.signature("async {", 2),
          @highlight.signature("shell ", 2),
          @highlight.signature("Option::Some", 3),
          @highlight.signature("fn ", 1),
          @highlight.signature("print ", 1),
        ],
        "alias async await break catch continue defer else enum export fn for if impl import in let loop match mut pub return shell spawn struct throw trait try type while",
        "Bool Bytes Command Error Float Int List Map Option Path Problem Result Stream String Tuple Unit",
        "true false none some None Some Ok Err",
        [
          ("fn", @highlight.FunctionSymbol),
          ("enum", @highlight.TypeSymbol),
          ("let", @highlight.VariableSymbol),
          ("struct", @highlight.TypeSymbol),
          ("trait", @highlight.TypeSymbol),
          ("type", @highlight.TypeSymbol),
        ],
        ["//", "#"],
        [@highlight.delimiter("/*", "*/")],
        [
          @highlight.quoted("\""),
          @highlight.quoted("'"),
          @highlight.quoted("`"),
        ],
        "+-*/%=<>!&|^~?.",
        "$",
        functions="car cat cd cdr command confirm disown drop echo enumerate env fany ffmap ffilter fg filter flat fmap fjoin frev fsort fst funiq fzip head help input json len lines ls map nth port print ps pwd rm sammary select snd source stop tail take upper wait which xml",
        properties="std",
      ),
    ],
    themes=[],
  )
}
