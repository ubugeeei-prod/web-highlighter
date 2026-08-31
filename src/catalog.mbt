///|
/// Splits a readable space-delimited vocabulary into exact words.
pub fn words(source : String) -> Array[String] {
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
/// Declares one weighted literal used for conservative language inference.
pub fn signature(text : String, weight : Int) -> Signature {
  { text, weight, }
}

///|
/// Declares one non-escaping paired lexical region.
pub fn delimiter(open_ : String, close : String) -> Delimiter {
  { open: open_, close, escape: false, }
}

///|
/// Declares a same-marker quoted region with backslash escaping.
pub fn quoted(marker : String) -> Delimiter {
  { open: marker, close: marker, escape: true, }
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
/// Constructs a language add-on from compact readable vocabularies.
///
/// The first three vocabularies describe syntax classes. Optional
/// `functions` and `properties` are for language-owned helper names that should
/// be highlighted without pretending they are declarations.
pub fn make_language(
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
  functions? : String = "",
  properties? : String = "",
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
    functions=words(functions),
    properties=words(properties),
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
      ["idr", "lidr", "ipkg"],
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
      "MoonBit",
      ["mbt", "mbtx", "mbti", "mbtp", "moonbit-executable"],
      ["mbt", "mbtx", "mbti", "mbtp"],
      ["moon.mod", "moon.pkg"],
      [
        signature("///|", 3),
        signature("pub predicate ", 3),
        signature("fn main {", 2),
        signature("derive(Debug)", 2),
        signature("proof_ensure", 2),
        signature("pub fn ", 1),
      ],
      "as async break catch const continue derive else enum extern fn for guard if impl import in init let loop match mut predicate proof_assert proof_decrease proof_ensure proof_external proof_import proof_invariant proof_pure proof_reasoning proof_require proof_yield pub raise return struct test throw trait try type while with",
      "Array Bool Byte Bytes Char Double Error FixedArray Int Int64 Map Option Result String StringBuilder UInt UInt64 Unit",
      "true false None Some Ok Err",
      [
        ("fn", FunctionSymbol),
        ("predicate", FunctionSymbol),
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
      ["vibe-lang", "vpkg"],
      ["vibe", "vibex", "vpkg"],
      [],
      [
        signature("ArrayBuilder::", 3),
        signature("with Exception[", 3),
        signature("with Console", 3),
        signature("handle {", 2),
        signature("let rec ", 2),
      ],
      "as async await bench break catch class const continue effect else enum export extern fn for from handle if import in interface let loop match module mut of rec return struct throw trait try type while with",
      "Array ArrayBuilder Async Bool Byte Bytes Char Console Double Effect Error Exception Float Fs Int Map Option Result Send Set String TaskGroup UInt Unit",
      "true false None Some Ok Err Throw",
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
      functions="print println stdout_write stdout_writeln",
    ),
    make_language(
      "veryl",
      "Veryl",
      [],
      ["veryl"],
      [],
      [
        signature("always_ff", 4),
        signature("if_reset", 4),
        signature("logic<", 3),
        signature("modport ", 3),
        signature("input  clock", 3),
        signature("package ", 1),
        signature("assign ", 1),
      ],
      "alias always_comb always_ff assign as bind block break case connect const converse default else embed enum final for function gen if if_reset import include initial in inout input inside inst interface let mixin modport module output outside package param proto pub repeat return rev same step struct switch type union unsafe var",
      "bbool bit clock clock_negedge clock_posedge f32 f64 i8 i16 i32 i64 lbool logic p8 p16 p32 p64 reset reset_async_high reset_async_low reset_sync_high reset_sync_low signed string tri u8 u16 u32 u64",
      "false lsb msb true",
      [
        ("alias", TypeSymbol),
        ("const", VariableSymbol),
        ("enum", TypeSymbol),
        ("function", FunctionSymbol),
        ("inst", VariableSymbol),
        ("interface", TypeSymbol),
        ("let", VariableSymbol),
        ("modport", PropertySymbol),
        ("module", TypeSymbol),
        ("package", ModuleSymbol),
        ("param", VariableSymbol),
        ("proto", TypeSymbol),
        ("struct", TypeSymbol),
        ("type", TypeSymbol),
        ("union", TypeSymbol),
        ("var", VariableSymbol),
      ],
      ["///", "//"],
      c_blocks(),
      [delimiter("sv{{{", "}}}"), quoted("\"")],
      "+-*/%=<>!&|^~?.:#@",
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
        signature("declare \"", 3),
        signature("# @tnix-", 2),
      ],
      "as assert declare else extends forall if import in infer inherit let or rec satisfies then type with",
      "Any Bool Derivation Float Functor Int List Matrix Nat Number Path Range String Tensor Tuple Unit Vec any dynamic unknown",
      "true false null",
      [("let", VariableSymbol), ("type", TypeSymbol)],
      ["#"],
      c_blocks(),
      [quoted("''"), quoted("\"")],
      "+-*/=<>!&|^~?.:$@",
      "$",
    ),
    make_language(
      "mbtv",
      "Vapor Moon SFC",
      ["vapor-moon", "moonbit-vue"],
      ["mbtv"],
      [],
      [
        signature("<script extern>", 3),
        signature("<template>", 3),
        signature("defineProps()", 3),
        signature("v-model", 2),
        signature("<script>", 2),
        signature("{{ ", 2),
      ],
      "as async break catch component const continue derive else enum extern fn for guard if impl import in init let loop match mut pub raise return script setup struct style template test throw trait try type while with",
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
      functions="computed defineEmits defineExpose defineProps defineSlots inject provide signal use_id use_template_ref watch",
      properties="class is lang scoped v-bind v-for v-if v-model v-on v-show",
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
      "BitArray Bool Dict Float Int List Option Order Result String UtfCodepoint",
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
      "as break case continue context else for if import in include let return set show while",
      "alignment array bool bytes color content datetime decimal dictionary duration float fraction function int label length module regex relative selector str stroke symbol type version",
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
      "alias break const continue def do else export extern for hide if in let loop match module mut overlay return source try use while",
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
      "abbrev axiom by class def deriving do else end example export extends for from fun have if import in inductive instance let match namespace opaque open private protected return structure syntax theorem universe variable where with",
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
      "assume as break contract default doc else enum export field force forall fun if import in let match merge optional or priority rec serialize std type typeof",
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
      "abstract amends as class const else extends external fixed for function hidden if import import* in is let local module new open out outer read read? read* super this throw trace typealias when",
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
      "Array Char Complex Function Number",
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
