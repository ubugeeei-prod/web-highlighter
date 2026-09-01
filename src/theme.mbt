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
      foreground="#f4f7fb",
      background="transparent",
      selection="#7cb7ff44",
      keyword="#ff8f87",
      type_="#c7b8ff",
      constant="#96c7ff",
      string="#8bd5a4",
      number="#96c7ff",
      comment="#b3bdc9",
      operator="#ffb86c",
      function_="#ffc66d",
      variable="#f4f7fb",
      property="#7dd3fc",
      punctuation="#c9d4e2",
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
  surface_default_theme(catalog, prefers_dark)
}

///|
/// Returns the built-in palette for the page surface polarity.
///
/// This is the final readability guard: add-on catalogs may be incomplete, but
/// the browser must still receive a palette whose foreground roles are designed
/// for the actual rendered background.
fn builtin_surface_theme(prefers_dark : Bool) -> Theme {
  let catalog = builtin_themes()
  for candidate in catalog {
    if candidate.dark == prefers_dark {
      return candidate
    }
  }
  catalog[0]
}

///|
/// Finds the safest catalog theme for the rendered page surface.
///
/// The named built-ins are preferred because they are the audited palettes used
/// by the fallback stylesheet. If a composed catalog replaces them, the first
/// theme with matching polarity is still better than emitting a light palette
/// onto a dark code block.
fn surface_default_theme(catalog : Array[Theme], prefers_dark : Bool) -> Theme {
  let wanted = if prefers_dark { "midnight" } else { "adaptive" }
  for candidate in catalog {
    if candidate.id == wanted {
      return candidate
    }
  }
  for candidate in catalog {
    if candidate.dark == prefers_dark {
      return candidate
    }
  }
  builtin_surface_theme(prefers_dark)
}

///|
/// Converts the executable theme polarity into the proof-side flag domain.
fn surface_flag(dark : Bool) -> Int {
  if dark {
    1
  } else {
    0
  }
}

///|
/// Decides the proof-backed mismatch relation for two executable polarities.
fn theme_needs_surface_fallback(
  selected_dark : Bool,
  prefers_dark : Bool,
) -> Bool {
  @theme_proof.theme_needs_surface_fallback_flag(
    surface_flag(selected_dark),
    surface_flag(prefers_dark),
  )
}

///|
/// Converts the proof-backed emitted polarity back to the Theme representation.
fn resolved_surface_dark(selected_dark : Bool, prefers_dark : Bool) -> Bool {
  @theme_proof.resolved_surface_dark_flag(
    surface_flag(selected_dark),
    surface_flag(prefers_dark),
  ) ==
  1
}

///|
/// Resolves a selected theme into colors that match the rendered surface.
///
/// Theme `dark` is a contrast invariant, not just popup metadata. When a user
/// explicitly selects a light add-on such as Paper on Discord/GitHub dark mode,
/// keeping the selected id is useful, but emitting its raw dark-on-light colors
/// is not. In that mismatch case the semantic role colors are borrowed from the
/// audited surface-default palette so code remains readable without changing
/// layout or injecting backgrounds into the host page.
fn readable_theme_for_surface(
  catalog : Array[Theme],
  selected : Theme,
  prefers_dark : Bool,
) -> Theme {
  if !theme_needs_surface_fallback(selected.dark, prefers_dark) {
    selected
  } else {
    let fallback = surface_default_theme(catalog, prefers_dark)
    theme(
      id=selected.id,
      name=selected.name,
      dark=resolved_surface_dark(selected.dark, prefers_dark),
      foreground=fallback.foreground,
      background=fallback.background,
      selection=fallback.selection,
      keyword=fallback.keyword,
      type_=fallback.type_,
      constant=fallback.constant,
      string=fallback.string,
      number=fallback.number,
      comment=fallback.comment,
      operator=fallback.operator,
      function_=fallback.function_,
      variable=fallback.variable,
      property=fallback.property,
      punctuation=fallback.punctuation,
    )
  }
}

///|
/// Returns a compact CSS-variable plan selected from an explicit catalog.
pub fn theme_catalog_wire(
  catalog : Array[Theme],
  requested : String,
  prefers_dark : Bool,
) -> String {
  let available = if catalog.length() == 0 { builtin_themes() } else { catalog }
  let selected = readable_theme_for_surface(
    available,
    select_theme(available, requested, prefers_dark),
    prefers_dark,
  )
  let output = StringBuilder()
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
/// Percent-encodes delimiters reserved by the theme catalog wire protocol.
///
/// Percent itself is encoded first conceptually, so the browser can recover
/// the exact add-on value with one `decodeURIComponent` call.
fn encode_theme_field(value : String) -> String {
  let output = StringBuilder()
  let mut start = 0
  for index in 0..<value.length() {
    let encoded = match value[index] {
      '%' => "%25"
      '\t' => "%09"
      '\n' => "%0A"
      '\r' => "%0D"
      _ => continue
    }
    if index > start {
      output.write_string(String::unsafe_substring(value, start~, end=index))
    }
    output.write_string(encoded)
    start = index + 1
  }
  if start < value.length() {
    output.write_string(
      String::unsafe_substring(value, start~, end=value.length()),
    )
  }
  output.to_string()
}

///|
/// Lists every selectable theme in a compact, presentation-neutral protocol.
///
/// Each record is `T`, id, display name, and a dark-mode flag separated by
/// tabs. Reserved delimiters use percent escapes so add-on metadata cannot
/// create extra records. The popup only renders these MoonBit-owned values.
pub fn theme_catalog_list_wire(catalog : Array[Theme]) -> String {
  let available = if catalog.length() == 0 { builtin_themes() } else { catalog }
  let output = StringBuilder()
  for theme_ in available {
    output
    ..write_string("T\t")
    ..write_string(encode_theme_field(theme_.id))
    ..write_char('\t')
    ..write_string(encode_theme_field(theme_.name))
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
