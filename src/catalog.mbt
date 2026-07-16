///|
/// Splits a readable space-delimited vocabulary into exact words.
fn words(source : String) -> Array[String] {
  let result : Array[String] = []
  for view in source.split(" ") {
    let word = view.to_owned()
    if word != "" {
      result.push(word)
    }
  }
  result
}

///|
fn signature(text : String, weight : Int) -> Signature {
  { text, weight }
}

///|
fn delimiter(open_ : String, close : String) -> Delimiter {
  { open: open_, close, escape: false }
}

///|
fn quoted(marker : String) -> Delimiter {
  { open: marker, close: marker, escape: true }
}

///|
fn language_aliases(id : String, aliases : Array[String]) -> Array[String] {
  let result = [id]
  for item in aliases {
    result.push(item)
  }
  result
}

///|
fn make_language(
  id : String,
  name : String,
  aliases : Array[String],
  extensions : Array[String],
  filenames : Array[String],
  signatures : Array[Signature],
  keywords : String,
  types : String,
  constants : String,
  declarations : Array[(String, SymbolKind)],
  line_comments : Array[String],
  block_comments : Array[Delimiter],
  strings : Array[Delimiter],
  operator_chars : String,
  identifier_extra : String,
) -> Language {
  language(
    id~,
    name~,
    aliases=language_aliases(id, aliases),
    extensions~,
    filenames~,
    signatures~,
    keywords=words(keywords),
    types=words(types),
    constants=words(constants),
    declarations~,
    line_comments~,
    block_comments~,
    strings~,
    operator_chars~,
    identifier_extra~,
  )
}

///|
fn c_blocks() -> Array[Delimiter] {
  [delimiter("/*", "*/")]
}

///|
fn c_strings() -> Array[Delimiter] {
  [quoted("\""), quoted("'")]
}

///|
/// Returns the built-in injected-language support catalog.
///
/// These entries target languages whose adoption by every upstream service is
/// unlikely or slow. The catalog is product policy, not a generic highlighting
/// library registry.
pub fn builtin_languages() -> Array[Language] {
  [
    make_language(
      "idris",
      "Idris 2",
      ["idris2", "idr"],
      ["idr", "lidr"],
      [],
      [
        signature("%default total", 3),
        signature("DecEq", 2),
        signature("data ", 1),
        signature(" where", 1),
      ],
      "case class data do else export if implementation import in infix interface let module mutual namespace of parameters public record then total using where with",
      "Bool Char Dec Double Either Fin IO Int Integer List Maybe Nat String Type Unit Vect",
      "True False Nothing Just Yes No",
      [
        ("data", TypeSymbol),
        ("interface", TypeSymbol),
        ("namespace", ModuleSymbol),
        ("record", TypeSymbol),
      ],
      ["--"],
      [delimiter("{-", "-}")],
      c_strings(),
      "+-*/=<>!&|^~?.:$%\\",
      "$",
    ),
    make_language(
      "moonbit",
      "MoonBit / MoonBit Executable",
      ["mbt", "mbtx", "moonbit-executable"],
      ["mbt", "mbtx"],
      ["moon.mod", "moon.pkg"],
      [
        signature("///|", 3),
        signature("fn main {", 2),
        signature("derive(Debug)", 2),
        signature("pub fn ", 1),
      ],
      "as async break catch const continue derive else enum extern fn for guard if impl import in init let loop match mut pub raise return struct test throw trait try type while with",
      "Array Bool Byte Bytes Char Double Error FixedArray Int Int64 Map Option Result String StringBuilder UInt UInt64 Unit",
      "true false None Some Ok Err",
      [
        ("fn", FunctionSymbol),
        ("struct", TypeSymbol),
        ("enum", TypeSymbol),
        ("trait", TypeSymbol),
        ("type", TypeSymbol),
        ("let", VariableSymbol),
      ],
      ["//"],
      c_blocks(),
      c_strings(),
      "+-*/%=<>!&|^~?.",
      "$",
    ),
    make_language(
      "vibe",
      "Vibe",
      ["vibe-lang"],
      ["vibe"],
      [],
      [
        signature("ArrayBuilder::", 3),
        signature("bench \"", 2),
        signature("let rec ", 2),
      ],
      "as async await bench break catch class const continue effect else enum export extern false fn for from if import in interface let loop match module mut of rec return struct throw trait true try type while with",
      "Array ArrayBuilder Bool Byte Char Double Effect Error Float Int Map Option Result Set String UInt Unit",
      "true false None Some Ok Err",
      [
        ("fn", FunctionSymbol),
        ("class", TypeSymbol),
        ("enum", TypeSymbol),
        ("interface", TypeSymbol),
        ("let", VariableSymbol),
        ("module", ModuleSymbol),
        ("struct", TypeSymbol),
        ("trait", TypeSymbol),
        ("type", TypeSymbol),
      ],
      ["//"],
      c_blocks(),
      c_strings(),
      "+-*/%=<>!&|^~?.",
      "$",
    ),
    make_language(
      "tnix",
      "tNix",
      ["typed-nix"],
      ["tnix"],
      ["tnix.config.tnix"],
      [
        signature("forall ", 2),
        signature(" :: ", 2),
        signature("declare builtin", 3),
      ],
      "any assert declare dynamic else false forall if import in inherit let null or rec then true type unknown with",
      "Any Bool Float Int List Path String Unknown",
      "true false null",
      [("let", VariableSymbol), ("type", TypeSymbol)],
      ["#"],
      c_blocks(),
      [quoted("''"), quoted("\"")],
      "+-*/=<>!&|^~?.:$@",
      "$",
    ),
    make_language(
      "ush",
      "ush",
      ["ush-shell"],
      ["ush"],
      [],
      [
        signature("async {", 2),
        signature("Option::Some", 3),
        signature("fn ", 1),
        signature("print ", 1),
      ],
      "alias async await break catch continue defer else enum export false fn for if impl import in let loop match mut none pub return some spawn struct throw trait true try type while",
      "Bool Bytes Command Error Float Int List Map Option Path Result Stream String Tuple Unit",
      "true false none some None Some Ok Err",
      [
        ("fn", FunctionSymbol),
        ("enum", TypeSymbol),
        ("let", VariableSymbol),
        ("struct", TypeSymbol),
        ("trait", TypeSymbol),
        ("type", TypeSymbol),
      ],
      ["//", "#"],
      c_blocks(),
      [quoted("\""), quoted("'"), quoted("`")],
      "+-*/%=<>!&|^~?.",
      "$",
    ),
    make_language(
      "mbtv",
      "Vapor Moon SFC",
      ["vapor-moon", "moonbit-vue"],
      ["mbtv"],
      [],
      [
        signature("<template>", 3),
        signature("<script>", 2),
        signature("{{ ", 2),
      ],
      "as async break catch const continue derive else enum extern fn for guard if impl import in init let loop match mut pub raise return script struct style template test throw trait try type while with",
      "Array Bool Byte Bytes Char Double Error FixedArray Int Int64 Map Option Result String StringBuilder UInt UInt64 Unit",
      "true false None Some Ok Err",
      [
        ("fn", FunctionSymbol),
        ("struct", TypeSymbol),
        ("enum", TypeSymbol),
        ("trait", TypeSymbol),
        ("type", TypeSymbol),
        ("let", VariableSymbol),
      ],
      ["//"],
      c_blocks(),
      c_strings(),
      "+-*/%=<>!&|^~?.@#",
      "$-",
    ),
    make_language(
      "mojo",
      "Mojo",
      ["🔥"],
      ["mojo", "🔥"],
      [],
      [
        signature("fn main() raises:", 3),
        signature("@value", 2),
        signature("var ", 1),
        signature("SIMD[", 2),
      ],
      "alias as async await break case comptime const continue def elif else fn for from if import in let match owned raises return struct trait try var while with",
      "Bool DTypePointer DynamicVector Error Float16 Float32 Float64 Int Int8 Int16 Int32 Int64 List SIMD String StringLiteral UInt Unit",
      "True False None",
      [
        ("alias", TypeSymbol),
        ("def", FunctionSymbol),
        ("fn", FunctionSymbol),
        ("let", VariableSymbol),
        ("struct", TypeSymbol),
        ("trait", TypeSymbol),
        ("var", VariableSymbol),
      ],
      ["#"],
      [],
      [quoted("\"\"\""), quoted("\""), quoted("'")],
      "+-*/%=<>!&|^~?.@",
      "$",
    ),
    make_language(
      "gleam",
      "Gleam",
      [],
      ["gleam"],
      [],
      [
        signature("pub fn ", 2),
        signature("use <-", 3),
        signature("todo as ", 2),
      ],
      "as assert case const echo else fn if import let opaque panic pub todo type use",
      "BitArray Bool Dict Error Float Int List Nil Option Order Result String UtfCodepoint",
      "True False Nil Ok Error Some None",
      [
        ("const", VariableSymbol),
        ("fn", FunctionSymbol),
        ("let", VariableSymbol),
        ("type", TypeSymbol),
      ],
      ["///", "//"],
      [],
      [quoted("\"")],
      "+-*/%=<>!&|^~?.:#",
      "$",
    ),
    make_language(
      "roc",
      "Roc",
      [],
      ["roc"],
      [],
      [
        signature("app [main]", 3),
        signature("platform \"", 3),
        signature("when ", 1),
        signature(" is\n", 1),
      ],
      "app as crash dbg dbg! expect expect! exposes generates has hosted if implements import imports interface is module package packages platform provides requires return to when where",
      "Bool Box Dec Dict F32 F64 I8 I16 I32 I64 List Num Result Set Str Task U8 U16 U32 U64",
      "True False Ok Err",
      [("interface", TypeSymbol), ("module", ModuleSymbol)],
      ["#"],
      [],
      [quoted("\"\"\""), quoted("\""), quoted("'")],
      "+-*/%=<>!&|^~?.:\\",
      "$",
    ),
    make_language(
      "typst",
      "Typst",
      ["typ"],
      ["typ"],
      ["typst.toml"],
      [
        signature("#set page(", 3),
        signature("#show ", 2),
        signature("#let ", 2),
      ],
      "as auto break case continue context else false for if import in include let none return set show true while",
      "alignment array bool bytes color content datetime decimal dictionary duration float fraction function int label length module none regex relative selector str stroke symbol type version",
      "true false none auto",
      [("let", VariableSymbol)],
      ["//"],
      c_blocks(),
      [quoted("\"")],
      "+-*/%=<>!&|^~?.:#@",
      "$-",
    ),
    make_language(
      "nushell",
      "Nushell",
      ["nu"],
      ["nu"],
      ["config.nu", "env.nu"],
      [
        signature("def --env ", 3),
        signature("$env.", 2),
        signature("| where ", 2),
      ],
      "alias break const continue def do else error export extern false for hide if in let loop match module mut overlay return source true try use while",
      "any binary bool cell-path closure datetime duration error filesize float glob int list nothing number range record string table",
      "true false null",
      [
        ("alias", FunctionSymbol),
        ("const", VariableSymbol),
        ("def", FunctionSymbol),
        ("let", VariableSymbol),
        ("module", ModuleSymbol),
        ("mut", VariableSymbol),
      ],
      ["#"],
      [],
      [quoted("\""), quoted("'"), quoted("`")],
      "+-*/%=<>!&|^~?.:$",
      "$",
    ),
    make_language(
      "lean4",
      "Lean 4",
      ["lean"],
      ["lean"],
      ["lakefile.lean"],
      [signature("theorem ", 2), signature("by\n  ", 2), signature("#eval ", 2)],
      "abbrev axiom by class def deriving do else end example export extends false for from fun have if import in inductive instance let match namespace opaque open private protected return structure syntax theorem true universe variable where with",
      "Array Bool Char Fin Float Int IO List Nat Option Prop Result String Type UInt Unit",
      "true false none some",
      [
        ("abbrev", TypeSymbol),
        ("axiom", VariableSymbol),
        ("class", TypeSymbol),
        ("def", FunctionSymbol),
        ("inductive", TypeSymbol),
        ("namespace", ModuleSymbol),
        ("opaque", FunctionSymbol),
        ("structure", TypeSymbol),
        ("theorem", FunctionSymbol),
      ],
      ["--"],
      [delimiter("/-", "-/")],
      c_strings(),
      "+-*/%=<>!&|^~?.:#@\\",
      "αβγδεζηθικλμνξοπρστυφχψω",
    ),
    make_language(
      "koka",
      "Koka",
      [],
      ["kk", "kki"],
      [],
      [
        signature("effect ", 2),
        signature("fun main()", 3),
        signature("handler ", 2),
      ],
      "alias as break catch con continue ctl effect elif else extern false final finally fn for fun handler if import in include inline interface let match module open pub rec return struct then throw true try type val var with yield",
      "bool char double either int list maybe string unit vector",
      "True False Nothing Just",
      [
        ("alias", TypeSymbol),
        ("effect", TypeSymbol),
        ("fn", FunctionSymbol),
        ("fun", FunctionSymbol),
        ("handler", TypeSymbol),
        ("interface", TypeSymbol),
        ("let", VariableSymbol),
        ("module", ModuleSymbol),
        ("struct", TypeSymbol),
        ("type", TypeSymbol),
        ("val", VariableSymbol),
        ("var", VariableSymbol),
      ],
      ["//"],
      c_blocks(),
      c_strings(),
      "+-*/%=<>!&|^~?.:#",
      "$",
    ),
    make_language(
      "nickel",
      "Nickel",
      [],
      ["ncl"],
      [],
      [
        signature("contract ", 2),
        signature("m%{", 3),
        signature("| default", 2),
      ],
      "assume as break contract default doc else enum export false field force forall fun if import in let match merge null optional or priority rec serialize std true type typeof",
      "Array Bool Dyn Enum Foreign Number Record String Symbol",
      "true false null",
      [
        ("contract", TypeSymbol),
        ("enum", TypeSymbol),
        ("let", VariableSymbol),
        ("type", TypeSymbol),
      ],
      ["#"],
      c_blocks(),
      [delimiter("m%\"", "\"%"), quoted("\"")],
      "+-*/%=<>!&|^~?.:$@",
      "$",
    ),
    make_language(
      "pkl",
      "Pkl",
      [],
      ["pkl", "pcf"],
      ["PklProject", "PklProject.deps.json"],
      [
        signature("amends \"", 3),
        signature("module ", 2),
        signature("hidden ", 1),
      ],
      "abstract amends as class const else extends external false fixed for function hidden if import import* in is let local module new nothing open out outer read read? read* super this throw trace true typealias unknown when",
      "Any Boolean Class DataSize Duration Dynamic Function Int List Listing Map Mapping Module Nothing Number Pair Regex Set String TypeAlias UInt",
      "true false null nothing unknown",
      [
        ("class", TypeSymbol),
        ("function", FunctionSymbol),
        ("let", VariableSymbol),
        ("module", ModuleSymbol),
        ("typealias", TypeSymbol),
      ],
      ["///", "//"],
      c_blocks(),
      [quoted("\"\"\""), quoted("\"")],
      "+-*/%=<>!&|^~?.:#@",
      "$",
    ),
    make_language(
      "uiua",
      "Uiua",
      [],
      ["ua"],
      [],
      [
        signature("⇌", 2),
        signature("⊞", 2),
        signature("°", 2),
        signature("←", 1),
      ],
      "Box Break Call Comptime Content Continue Do Dump Fill Fn Format Git Import Invert Module Quote Set Signature Spawn Switch Test Thread Trace Try Under Use WorkingFile",
      "Array Box Char Complex Function Number",
      "eta infinity pi tau",
      [("Fn", FunctionSymbol), ("Module", ModuleSymbol)],
      ["#"],
      [],
      [delimiter("$ ", "\n"), quoted("\"")],
      "+-*/%=<>!&|^~?.:←↔⇌⊞⊟⊡⊢⊣°⌝⌞◌○□⊙⊸≡≍∊⍉⊂⊃∂⍘",
      "_ηπτ∞",
    ),
  ]
}
