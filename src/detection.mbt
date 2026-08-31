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
fn compiled_at(catalog : CompiledCatalog, index : Int) -> CompiledLanguage? {
  if index >= 0 && index < catalog.languages.length() {
    Some(catalog.languages[index])
  } else {
    None
  }
}

///|
/// Why one language was selected for injection.
pub enum DetectionReason {
  ExplicitHint
  ExactFilename
  FilenameExtension
  WeightedEvidence
} derive(Eq, Debug)

///|
/// A selected language plus the evidence that made it safe to inject.
pub struct DetectionPlan {
  language : CompiledLanguage
  reason : DetectionReason
  score : Int
  runner_up : Int
}

///|
/// Minimum literal-evidence score required when a host drops language metadata.
fn inference_threshold() -> Int {
  3
}

///|
/// Required score gap between the winner and the nearest competitor.
fn inference_margin() -> Int {
  2
}

///|
/// Counts weighted literal fingerprints for one candidate language.
fn signature_score(language : Language, source : String) -> Int {
  let mut score = 0
  for fingerprint in language.signatures {
    if source.contains(fingerprint.text) && fingerprint.weight > 0 {
      score += fingerprint.weight
    }
  }
  score
}

///|
/// Chooses injected language support by explicit metadata, then evidence.
///
/// The strategy is intentionally conservative:
///
/// - explicit fence/class hints are exact aliases;
/// - exact filenames outrank generic extensions;
/// - filename extensions are deterministic project metadata;
/// - unlabelled inference requires a strong weighted score and a clear margin.
///
/// If the evidence is weak or ambiguous, the caller receives `None` and the
/// browser host leaves the code block untouched.
pub fn detect_compiled_plan(
  catalog : CompiledCatalog,
  source : String,
  hint : String,
  filename : String,
) -> DetectionPlan? {
  let normalized = normalized_hint(hint)
  if normalized != "" {
    match catalog.aliases.get(normalized) {
      Some(index) =>
        match compiled_at(catalog, index) {
          Some(language) =>
            return Some({
              language,
              reason: ExplicitHint,
              score: 0,
              runner_up: 0,
            })
          None => ()
        }
      None => ()
    }
  }
  if filename != "" {
    let name = basename(filename)
    let suffix = extension(name)
    match catalog.filenames.get(name) {
      Some(index) =>
        match compiled_at(catalog, index) {
          Some(language) =>
            return Some({
              language,
              reason: ExactFilename,
              score: 0,
              runner_up: 0,
            })
          None => ()
        }
      None => ()
    }
    match catalog.extensions.get(suffix) {
      Some(index) =>
        match compiled_at(catalog, index) {
          Some(language) =>
            return Some({
              language,
              reason: FilenameExtension,
              score: 0,
              runner_up: 0,
            })
          None => ()
        }
      None => ()
    }
  }
  let mut best_index = -1
  let mut best_score = 0
  let mut runner_up = 0
  for index in 0..<catalog.languages.length() {
    let score = signature_score(catalog.languages[index].language, source)
    if score > best_score {
      runner_up = best_score
      best_score = score
      best_index = index
    } else if score > runner_up {
      runner_up = score
    }
  }
  if best_index >= 0 &&
    @proof.score_is_dominant(
      best_score,
      runner_up,
      inference_threshold(),
      inference_margin(),
    ) {
    match compiled_at(catalog, best_index) {
      Some(language) =>
        Some({
          language,
          reason: WeightedEvidence,
          score: best_score,
          runner_up,
        })
      None => None
    }
  } else {
    None
  }
}

///|
/// Compatibility selector for callers that only need the chosen language.
pub fn detect_compiled_language(
  catalog : CompiledCatalog,
  source : String,
  hint : String,
  filename : String,
) -> CompiledLanguage? {
  detect_compiled_plan(catalog, source, hint, filename).map(fn(plan) {
    plan.language
  })
}

///|
/// Compatibility detector for callers that still own declarative languages.
pub fn detect_language(
  languages : Array[Language],
  source : String,
  hint : String,
  filename : String,
) -> Language? {
  detect_compiled_language(compile_catalog(languages), source, hint, filename).map(fn(
      candidate,
    ) {
      candidate.language
    },
  )
}
