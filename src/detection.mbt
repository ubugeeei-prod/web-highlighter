///|
fn contains_string(values : Array[String], candidate : String) -> Bool {
  for value in values {
    if value == candidate {
      return true
    }
  }
  false
}

///|
fn basename(path : String) -> String {
  let chars = path.to_array()
  let mut start = 0
  for index in 0..<chars.length() {
    if chars[index] == '/' || chars[index] == '\\' {
      start = index + 1
    }
  }
  String::unsafe_substring(path, start~, end=path.length())
}

///|
fn extension(name : String) -> String {
  let chars = name.to_array()
  let mut dot = -1
  for index in 0..<chars.length() {
    if chars[index] == '.' {
      dot = index
    }
  }
  if dot < 0 || dot + 1 >= name.length() {
    ""
  } else {
    String::unsafe_substring(name, start=dot + 1, end=name.length()).to_lower()
  }
}

///|
fn normalized_hint(hint : String) -> String {
  let value = hint.trim().to_owned().to_lower()
  if value.has_prefix("language-") {
    String::unsafe_substring(value, start=9, end=value.length())
  } else {
    value
  }
}

///|
/// Chooses injected language support by explicit hint, filename, then literals.
///
/// Literal inference requires a score above one, preventing a common keyword in
/// prose from causing an unlabelled block to be recolored.
pub fn detect_language(
  languages : Array[Language],
  source : String,
  hint : String,
  filename : String,
) -> Language? {
  let normalized = normalized_hint(hint)
  if normalized != "" {
    for candidate in languages {
      if contains_string(candidate.aliases, normalized) {
        return Some(candidate)
      }
    }
  }
  if filename != "" {
    let name = basename(filename)
    let suffix = extension(name)
    for candidate in languages {
      if contains_string(candidate.filenames, name) ||
        contains_string(candidate.extensions, suffix) {
        return Some(candidate)
      }
    }
  }
  let mut best : Language? = None
  let mut best_score = 1
  for candidate in languages {
    let mut score = 0
    for fingerprint in candidate.signatures {
      if source.contains(fingerprint.text) {
        score += fingerprint.weight
      }
    }
    if score > best_score {
      best = Some(candidate)
      best_score = score
    }
  }
  best
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
/// Returns a compact theme table selected entirely inside MoonBit.
pub fn theme_wire(requested : String, prefers_dark : Bool) -> String {
  let id = if requested == "auto" || requested == "" {
    if prefers_dark {
      "midnight"
    } else {
      "adaptive"
    }
  } else if requested == "midnight" {
    "midnight"
  } else {
    "adaptive"
  }
  let dark = id == "midnight"
  let output = StringBuilder::new()
  output..write_string("M\t")..write_string(id).write_char('\n')
  theme_color(output, "foreground", if dark { "#e6edf3" } else { "#24292f" })
  theme_color(output, "background", "transparent")
  theme_color(output, "selection", if dark { "#58a6ff33" } else { "#0969da33" })
  theme_color(output, "keyword", if dark { "#ff7b72" } else { "#cf222e" })
  theme_color(output, "type", if dark { "#d2a8ff" } else { "#8250df" })
  theme_color(output, "constant", if dark { "#79c0ff" } else { "#0550ae" })
  theme_color(output, "string", if dark { "#a5d6ff" } else { "#0a3069" })
  theme_color(output, "number", if dark { "#79c0ff" } else { "#0550ae" })
  theme_color(output, "comment", if dark { "#8b949e" } else { "#6e7781" })
  theme_color(output, "operator", if dark { "#ff7b72" } else { "#cf222e" })
  theme_color(output, "function", if dark { "#d2a8ff" } else { "#8250df" })
  theme_color(output, "variable", if dark { "#e6edf3" } else { "#24292f" })
  theme_color(output, "property", if dark { "#ffa657" } else { "#953800" })
  theme_color(output, "punctuation", if dark { "#8b949e" } else { "#57606a" })
  output.to_string()
}
