///|
/// Validates that every emitted token span is bounded and ordered.
///
/// This executable checker mirrors the proof predicates in `src/proof` and is
/// intentionally independent from theme or language policy. Tests use it as a
/// broad regression oracle for scanner changes.
pub fn analysis_is_bounded(analysis : Analysis, source_length : Int) -> Bool {
  let mut cursor = 0
  for token_ in analysis.tokens {
    if !@proof.span_is_ordered_after(
        cursor,
        token_.span.start,
        token_.span.end_,
        source_length,
      ) {
      return false
    }
    cursor = @proof.cursor_after_ordered_span(
      cursor,
      token_.span.start,
      token_.span.end_,
      source_length,
    )
  }
  for definition in analysis.definitions {
    if !@proof.span_is_nonempty(
        definition.span.start,
        definition.span.end_,
        source_length,
      ) {
      return false
    }
  }
  for reference in analysis.references {
    if !@proof.span_is_nonempty(
        reference.span.start,
        reference.span.end_,
        source_length,
      ) {
      return false
    }
  }
  true
}
