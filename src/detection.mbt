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
