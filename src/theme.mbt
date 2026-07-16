///|
/// A serializable presentation add-on consumed by the browser host.
///
/// Themes name semantic roles rather than language-specific scopes. They are
/// immutable MoonBit data and can neither inspect source nor execute callbacks.
pub struct Theme {
  id : String
  name : String
  dark : Bool
  foreground : String
  background : String
  selection : String
  keyword : String
  type_ : String
  constant : String
  string : String
  number : String
  comment : String
  operator : String
  function_ : String
  variable : String
  property : String
  punctuation : String
} derive(Eq, Debug)

///|
/// Constructs one declarative theme add-on.
pub fn theme(
  id~ : String,
  name~ : String,
  dark~ : Bool,
  foreground~ : String,
  background~ : String,
  selection~ : String,
  keyword~ : String,
  type_~ : String,
  constant~ : String,
  string~ : String,
  number~ : String,
  comment~ : String,
  operator~ : String,
  function_~ : String,
  variable~ : String,
  property~ : String,
  punctuation~ : String,
) -> Theme {
  {
    id,
    name,
    dark,
    foreground,
    background,
    selection,
    keyword,
    type_,
    constant,
    string,
    number,
    comment,
    operator,
    function_,
    variable,
    property,
    punctuation,
  }
}

///|
/// Returns the default build-time theme catalog.
pub fn builtin_themes() -> Array[Theme] {
  [
    theme(
      id="adaptive",
      name="Adaptive",
      dark=false,
      foreground="#24292f",
      background="transparent",
      selection="#0969da33",
      keyword="#cf222e",
      type_="#8250df",
      constant="#0550ae",
      string="#0a3069",
      number="#0550ae",
      comment="#6e7781",
      operator="#cf222e",
      function_="#8250df",
      variable="#24292f",
      property="#953800",
      punctuation="#57606a",
    ),
    theme(
      id="midnight",
      name="Midnight",
      dark=true,
      foreground="#e6edf3",
      background="transparent",
      selection="#58a6ff33",
      keyword="#ff7b72",
      type_="#d2a8ff",
      constant="#79c0ff",
      string="#a5d6ff",
      number="#79c0ff",
      comment="#8b949e",
      operator="#ff7b72",
      function_="#d2a8ff",
      variable="#e6edf3",
      property="#ffa657",
      punctuation="#8b949e",
    ),
  ]
}

///|
fn theme_color(output : StringBuilder, name : String, color : String) -> Unit {
  output
  ..write_string("C\t")
  ..write_string(name)
  ..write_char('\t')
  ..write_string(color)
  .write_char('\n')
}

///|
fn select_theme(
  catalog : Array[Theme],
  requested : String,
  prefers_dark : Bool,
) -> Theme {
  let wanted = if requested == "auto" || requested == "" {
    if prefers_dark {
      "midnight"
    } else {
      "adaptive"
    }
  } else {
    requested
  }
  for candidate in catalog {
    if candidate.id == wanted {
      return candidate
    }
  }
  catalog[0]
}

///|
/// Returns a compact CSS-variable plan selected from an explicit catalog.
pub fn theme_catalog_wire(
  catalog : Array[Theme],
  requested : String,
  prefers_dark : Bool,
) -> String {
  let available = if catalog.length() == 0 { builtin_themes() } else { catalog }
  let selected = select_theme(available, requested, prefers_dark)
  let output = StringBuilder::new()
  output..write_string("M\t")..write_string(selected.id).write_char('\n')
  theme_color(output, "foreground", selected.foreground)
  theme_color(output, "background", selected.background)
  theme_color(output, "selection", selected.selection)
  theme_color(output, "keyword", selected.keyword)
  theme_color(output, "type", selected.type_)
  theme_color(output, "constant", selected.constant)
  theme_color(output, "string", selected.string)
  theme_color(output, "number", selected.number)
  theme_color(output, "comment", selected.comment)
  theme_color(output, "operator", selected.operator)
  theme_color(output, "function", selected.function_)
  theme_color(output, "variable", selected.variable)
  theme_color(output, "property", selected.property)
  theme_color(output, "punctuation", selected.punctuation)
  output.to_string()
}

///|
/// Lists every selectable theme in a compact, presentation-neutral protocol.
///
/// Each record is `T`, id, display name, and a dark-mode flag separated by
/// tabs. The browser popup only renders these MoonBit-owned declarations.
pub fn theme_catalog_list_wire(catalog : Array[Theme]) -> String {
  let available = if catalog.length() == 0 { builtin_themes() } else { catalog }
  let output = StringBuilder::new()
  for theme_ in available {
    output
    ..write_string("T\t")
    ..write_string(theme_.id)
    ..write_char('\t')
    ..write_string(theme_.name)
    ..write_char('\t')
    ..write_string(if theme_.dark { "1" } else { "0" })
    .write_char('\n')
  }
  output.to_string()
}

///|
/// Lists the built-in themes through the browser wire protocol.
pub fn theme_list_wire() -> String {
  theme_catalog_list_wire(builtin_themes())
}

///|
/// Returns a compact CSS-variable plan selected from built-in themes.
pub fn theme_wire(requested : String, prefers_dark : Bool) -> String {
  theme_catalog_wire(builtin_themes(), requested, prefers_dark)
}
